require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const path = require('path');
const axios = require('axios'); 
const cron = require('node-cron');

const app = express();
const port = process.env.PORT || 3000;

const clientPath = path.resolve(__dirname, '..', 'client');

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'trade_db',
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
    waitForConnections: true,
    connectionLimit: 10,
};

let pool;

// --- DATABASE CLEANUP ---
async function clearStockTable() {
    try {
        console.log("--- [DB] Clearing existing stock data... ---");
        await pool.query('TRUNCATE TABLE Stock'); // Using .query for consistency
        console.log("--- [DB] Stock table cleared successfully. ---");
    } catch (error) {
        console.error("--- [DB] Error clearing Stock table:", error.message);
    }
}

// --- 1. SEEDER LOGIC ---
async function seedDatabase() {
    const apiKey = process.env.TWELVE_DATA_KEY;
    
    if (!apiKey) {
        console.error("--- [SEEDER] Error: No TWELVE_DATA_KEY found in .env ---");
        return;
    }

    const url = `https://api.twelvedata.com/stocks?exchange=NASDAQ&type=common%20stock&apikey=${apiKey}`;

    try {
        console.log("--- [SEEDER] Fetching market data from Twelve Data ---");
        const response = await axios.get(url);
        const stocks = response.data.data;

        if (!stocks || !Array.isArray(stocks)) {
            console.error("--- [SEEDER] API error or limit reached:", response.data);
            return;
        }

        // CHANGE: Increased to 200 to enable meaningful infinite scrolling
        const limitedStocks = stocks.slice(0, 200);

        for (let stock of limitedStocks) {
            const symbol = stock.symbol;
            const name = stock.name;
            const sector = 'Market';
            const randomPrice = (Math.random() * (250 - 10) + 10).toFixed(2);

            const query = `
                INSERT INTO Stock (tickerSymbol, companyName, currentPrice, sector) 
                VALUES (?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE currentPrice = VALUES(currentPrice)
            `;
            
            await pool.query(query, [symbol, name, randomPrice, sector]);
        }
        console.log(`--- [SEEDER] Successfully seeded ${limitedStocks.length} stocks from Twelve Data! ---`);
    } catch (error) {
        console.error("--- [SEEDER] Error during seeding:", error.message);
    }
}

// --- 2. STOCK API ROUTES ---

app.get('/api/stocks', async (req, res) => {
    // Force inputs to Integers
    const limit = parseInt(req.query.limit, 10) || 12;
    const offset = parseInt(req.query.offset, 10) || 0;
    const search = req.query.search || '';

    try {
        const searchParam = `%${search}%`;

        // Using string injection for LIMIT/OFFSET (safe because of parseInt)
        // to avoid ER_WRONG_ARGUMENTS from the mysql2 driver
        const sql = `
            SELECT * FROM Stock 
            WHERE tickerSymbol LIKE ? OR companyName LIKE ? 
            ORDER BY tickerSymbol ASC 
            LIMIT ${limit} OFFSET ${offset}
        `;
        
        const [rows] = await pool.query(sql, [searchParam, searchParam]);
        res.json(rows);
    } catch (err) {
        console.error("SQL Error Details:", err);
        res.status(500).json({ error: "Database query failed" });
    }
});

app.get('/api/stock-history/:symbol', async (req, res) => {
    try {
        const symbol = req.params.symbol.toUpperCase();
        const apiKey = process.env.MASSIVE_API_KEY;
        const url = `https://api.massive.com/v2/aggs/ticker/&ticker=${symbol}/range/1/day/2025-01-01/2026-04-08?adjusted=true&sort=asc&apiKey=${apiKey}`;
        
        const response = await axios.get(url);
        res.json(response.data);
    } catch (error) {
        console.error("History API error:", error.message);
        res.status(500).json({ error: "Error fetching history" });
    }
});

// --- 3. DATABASE & AUTH LOGIC ---
async function initDb() {
    try {
        pool = mysql.createPool(dbConfig);
        await pool.query('SELECT 1');
        console.log('Database initialized successfully');
    } catch (error) {
        console.error('Database connection failed:', error.message);
        throw error;
    }
}

app.use(express.json());
app.use(express.static(clientPath));

// Auth routes placeholder (ensure your existing login/register logic is here)
app.post('/api/auth/register', async (req, res) => { /* ... */ });
app.post('/api/auth/login', async (req, res) => { /* ... */ });

app.get('*', (req, res) => {
    res.sendFile(path.join(clientPath, 'landingPage.html'));
});

// --- 4. STARTUP SEQUENCE ---
initDb()
    .then(async () => {
        app.listen(port, () => {
            console.log(`Server listening on http://localhost:${port}`);
        });

        await clearStockTable();
        await seedDatabase();

        cron.schedule('0 0 * * *', async () => {
            console.log('--- [CRON] Starting Daily Market Refresh ---');
            await clearStockTable();
            await seedDatabase();
        });
    })
    .catch((error) => {
        console.error('Startup failed:', error);
        process.exit(1);
    });