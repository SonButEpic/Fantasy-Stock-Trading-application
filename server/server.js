require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Resolve the absolute path to the client folder (one level up from /server)
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

async function initDb() {
    try {
        pool = mysql.createPool(dbConfig);
        // Test connection
        await pool.query('SELECT 1');
        console.log('Database initialized successfully');
    } catch (error) {
        throw error;
    }
}

function createError(message) {
    return { success: false, message };
}

async function ensureIndividualPortfolio(userID) {
    const [existing] = await pool.execute(
        `SELECT portfolioID, userID, leagueID, cashBalance, createdDate
         FROM Portfolio
         WHERE userID = ? AND leagueID IS NULL
         ORDER BY portfolioID DESC
         LIMIT 1`,
        [userID]
    );

    if (existing.length > 0) {
        return existing[0];
    }

    const startingCash = 10000;
    const [result] = await pool.execute(
        `INSERT INTO Portfolio (userID, leagueID, cashBalance, portfolioType, createdDate)
         VALUES (?, NULL, ?, 'Individual', CURDATE())`,
        [userID, startingCash]
    );

    return {
        portfolioID: result.insertId,
        userID,
        leagueID: null,
        cashBalance: startingCash,
        createdDate: new Date(),
    };
}

app.use(express.json());

// FIXED: Use the resolved clientPath for static files
app.use(express.static(clientPath));

// --- API Routes ---

app.post('/api/auth/register', async (req, res) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
        return res.status(400).json(createError('Username, email, and password are required')); 
    }

    try {
        const [existing] = await pool.execute(
            'SELECT username, email FROM `User` WHERE username = ? OR email = ?',
            [username, email]
        );

        if (existing.length > 0) {
            const duplicate = existing[0];
            if (duplicate.username === username) {
                return res.status(409).json(createError('That username already exists.'));
            }
            return res.status(409).json(createError('That email already exists.'));
        }

        const passwordHash = await bcrypt.hash(password, 10);
        await pool.execute(
            'INSERT INTO `User` (username, email, passwordHash) VALUES (?, ?, ?)',
            [username, email, passwordHash]
        );

        return res.status(201).json({ success: true, username });
    } catch (error) {
        console.error('Register error:', error);
        return res.status(500).json(createError('Unable to create account.'));
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json(createError('Username and password are required')); 
    }

    try {
        const [users] = await pool.execute(
            'SELECT username, passwordHash FROM `User` WHERE username = ?',
            [username]
        );

        if (users.length === 0) {
            return res.status(401).json(createError('Invalid username or password.'));
        }

        const user = users[0];
        const passwordMatches = await bcrypt.compare(password, user.passwordHash);

        if (!passwordMatches) {
            return res.status(401).json(createError('Invalid username or password.'));
        }

        return res.json({ success: true, username: user.username });
    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json(createError('Unable to verify login.'));
    }
});

app.get('/api/portfolio/individual', async (req, res) => {
    const username = (req.query.username || '').trim();
    if (!username) {
        return res.status(400).json(createError('username is required'));
    }

    try {
        const [users] = await pool.execute(
            'SELECT userID, username FROM `User` WHERE username = ?',
            [username]
        );

        if (users.length === 0) {
            return res.status(404).json(createError('User not found.'));
        }

        const user = users[0];
        const portfolio = await ensureIndividualPortfolio(user.userID);

        const [holdings] = await pool.execute(
            `SELECT
                h.tickerSymbol,
                COALESCE(s.companyName, h.tickerSymbol) AS companyName,
                h.quantity,
                h.purchasePrice AS avgPrice,
                COALESCE(s.currentPrice, h.purchasePrice) AS currentPrice
             FROM Holding h
             LEFT JOIN Stock s ON s.tickerSymbol = h.tickerSymbol
             WHERE h.portfolioID = ?
             ORDER BY h.tickerSymbol ASC`,
            [portfolio.portfolioID]
        );

        const [transactions] = await pool.execute(
            `SELECT
                transactionID,
                tickerSymbol,
                transactionType,
                quantity,
                pricePerShare,
                totalPrice,
                transactionDate,
                status
             FROM Transaction
             WHERE portfolioID = ?
             ORDER BY transactionDate DESC, transactionID DESC`,
            [portfolio.portfolioID]
        );

        let holdingsMarketValue = 0;
        let holdingsCostBasis = 0;

        const holdingsSnapshot = holdings.map((holding) => {
            const quantity = Number(holding.quantity) || 0;
            const avgPrice = Number(holding.avgPrice) || 0;
            const currentPrice = Number(holding.currentPrice) || 0;
            const marketValue = quantity * currentPrice;
            const costBasis = quantity * avgPrice;

            holdingsMarketValue += marketValue;
            holdingsCostBasis += costBasis;

            return {
                tickerSymbol: holding.tickerSymbol,
                companyName: holding.companyName,
                quantity,
                avgPrice,
                currentPrice,
                marketValue,
                costBasis,
            };
        });

        const txSnapshot = transactions.map((tx) => ({
            transactionID: tx.transactionID,
            tickerSymbol: tx.tickerSymbol,
            transactionType: tx.transactionType,
            quantity: Number(tx.quantity) || 0,
            pricePerShare: Number(tx.pricePerShare) || 0,
            totalPrice: Number(tx.totalPrice) || 0,
            transactionDate: tx.transactionDate,
            status: Boolean(tx.status),
        }));

        const cashBalance = Number(portfolio.cashBalance) || 0;
        const portfolioValue = cashBalance + holdingsMarketValue;
        const initialCash = 10000;
        const performancePct = ((portfolioValue - initialCash) / initialCash) * 100;

        return res.json({
            success: true,
            portfolio: {
                portfolioId: portfolio.portfolioID,
                userId: user.userID,
                username: user.username,
                scope: 'individual',
                createdDate: portfolio.createdDate,
                cashBalance,
                currentMarketValue: holdingsMarketValue,
                holdingsCostBasis,
                portfolioValue,
                initialCash,
                performancePct,
                holdings: holdingsSnapshot,
                transactions: txSnapshot,
            },
        });
    } catch (error) {
        console.error('Individual portfolio fetch error:', error);
        return res.status(500).json(createError('Unable to load individual portfolio.'));
    }
});

// --- Catch-all Route ---

// FIXED: Use the resolved clientPath to find landingPage.html
app.get('*', (req, res) => {
    res.sendFile(path.join(clientPath, 'landingPage.html'));
});

initDb()
    .then(() => {
        app.listen(port, () => {
            console.log(`Auth server listening on http://localhost:${port}`);
            console.log(`Serving client files from: ${clientPath}`);
        });
    })
    .catch((error) => {
        console.error('Unable to initialize database connection:', error);
        process.exit(1);
    });