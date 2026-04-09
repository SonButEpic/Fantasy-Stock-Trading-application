require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const path = require('path');
const axios = require('axios'); 
const cron = require('node-cron');

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

// --- DATABASE INITIALIZATION ---
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

// --- HELPER FUNCTIONS ---
function createError(message) {
    return { success: false, message };
}

function parsePositiveNumber(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) {
        return null;
    }
    return numeric;
}

function parsePositiveInteger(value) {
    const numeric = Number(value);
    if (!Number.isInteger(numeric) || numeric <= 0) {
        return null;
    }
    return numeric;
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

function parsePositiveInteger(value) {
    const numeric = Number(value);
    if (!Number.isInteger(numeric) || numeric <= 0) {
        return null;
    }
    return numeric;
}

/**
 * NEW: Fetches the real-time price from Twelve Data API.
 * This ensures trades use current market values instead of seeded database values.
 */
async function getLivePrice(symbol) {
    try {
        const apiKey = process.env.TWELVE_DATA_KEY;
        const response = await axios.get(`https://api.twelvedata.com/price?symbol=${symbol}&apikey=${apiKey}`);
        
        if (response.data && response.data.price) {
            return parseFloat(response.data.price);
        }
        return null;
    } catch (error) {
        console.error(`Error fetching live price for ${symbol}:`, error.message);
        return null;
    }
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

// --- SEEDER & CLEANUP LOGIC ---
async function clearStockTable() {
    try {
        console.log("--- [DB] Clearing existing stock data... ---");
        await pool.query('TRUNCATE TABLE Stock');
        console.log("--- [DB] Stock table cleared successfully. ---");
    } catch (error) {
        console.error("--- [DB] Error clearing Stock table:", error.message);
    }
}

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

        const limitedStocks = stocks.slice(0, 200);

        for (let stock of limitedStocks) {
            const symbol = stock.symbol;
            const name = stock.name;
            const sector = 'Market';
            // Note: Seeder uses random prices for initial display; the trade endpoint now overrides this with live data.
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

// --- MIDDLEWARE ---
app.use(express.json());
app.use(express.static(clientPath));

// ==========================================
//                 API ROUTES
// ==========================================

// --- 1. AUTH ROUTES ---
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

app.post('/api/trades', async (req, res) => {
    const username = (req.body.username || '').trim();
    const tickerSymbol = (req.body.tickerSymbol || '').trim().toUpperCase();
    const tradeType = (req.body.tradeType || '').trim();
    const quantity = parsePositiveInteger(req.body.quantity);
    const fallbackPrice = parsePositiveNumber(req.body.pricePerShare);

    if (!username || !tickerSymbol || !tradeType || !quantity) {
        return res.status(400).json(createError('username, tickerSymbol, tradeType, and quantity are required.'));
    }

    if (tradeType !== 'Buy' && tradeType !== 'Sell') {
        return res.status(400).json(createError('tradeType must be Buy or Sell.'));
    }

    let connection;

    try {
        const [users] = await pool.execute(
            'SELECT userID, username FROM `User` WHERE username = ?',
            [username]
        );

        if (users.length === 0) {
            return res.status(404).json(createError('User not found.'));
        }

        const user = users[0];
        connection = await pool.getConnection();
        await connection.beginTransaction();

        let [portfolios] = await connection.execute(
            `SELECT portfolioID, cashBalance
             FROM Portfolio
             WHERE userID = ? AND leagueID IS NULL
             ORDER BY portfolioID DESC
             LIMIT 1
             FOR UPDATE`,
            [user.userID]
        );

        if (portfolios.length === 0) {
            const startingCash = 10000;
            const [insertPortfolio] = await connection.execute(
                `INSERT INTO Portfolio (userID, leagueID, cashBalance, portfolioType, createdDate)
                 VALUES (?, NULL, ?, 'Individual', CURDATE())`,
                [user.userID, startingCash]
            );

            portfolios = [{
                portfolioID: insertPortfolio.insertId,
                cashBalance: startingCash,
            }];
        }

        const portfolio = portfolios[0];
        const [stocks] = await connection.execute(
            `SELECT tickerSymbol, currentPrice
             FROM Stock
             WHERE UPPER(tickerSymbol) = ?
             LIMIT 1`,
            [tickerSymbol]
        );

        const stockPrice = stocks.length > 0 ? parsePositiveNumber(stocks[0].currentPrice) : null;
        const pricePerShare = stockPrice || fallbackPrice;

        if (!pricePerShare) {
            await connection.rollback();
            return res.status(400).json(createError('No valid price was found for this ticker.'));
        }

        const cashBalance = Number(portfolio.cashBalance) || 0;
        const totalPrice = Number((pricePerShare * quantity).toFixed(2));

        if (tradeType === 'Buy') {
            if (cashBalance < totalPrice) {
                await connection.rollback();
                return res.status(400).json(createError('Insufficient buying power for this purchase.'));
            }

            const updatedCash = Number((cashBalance - totalPrice).toFixed(2));
            await connection.execute(
                'UPDATE Portfolio SET cashBalance = ? WHERE portfolioID = ?',
                [updatedCash, portfolio.portfolioID]
            );

            const [holdings] = await connection.execute(
                `SELECT holdingID, quantity, purchasePrice
                 FROM Holding
                 WHERE portfolioID = ? AND UPPER(tickerSymbol) = ?
                 LIMIT 1
                 FOR UPDATE`,
                [portfolio.portfolioID, tickerSymbol]
            );

            if (holdings.length > 0) {
                const existing = holdings[0];
                const existingQty = Number(existing.quantity) || 0;
                const existingAvg = Number(existing.purchasePrice) || 0;
                const newQty = existingQty + quantity;
                const newAvg = Number((((existingQty * existingAvg) + totalPrice) / newQty).toFixed(4));

                await connection.execute(
                    'UPDATE Holding SET quantity = ?, purchasePrice = ? WHERE holdingID = ?',
                    [newQty, newAvg, existing.holdingID]
                );
            } else {
                await connection.execute(
                    `INSERT INTO Holding (userID, portfolioID, leagueID, tickerSymbol, quantity, purchasePrice)
                     VALUES (?, ?, NULL, ?, ?, ?)`,
                    [user.userID, portfolio.portfolioID, tickerSymbol, quantity, pricePerShare]
                );
            }
        } else {
            const [holdings] = await connection.execute(
                `SELECT holdingID, quantity
                 FROM Holding
                 WHERE portfolioID = ? AND UPPER(tickerSymbol) = ?
                 LIMIT 1
                 FOR UPDATE`,
                [portfolio.portfolioID, tickerSymbol]
            );

            if (holdings.length === 0) {
                await connection.rollback();
                return res.status(400).json(createError('You do not own this stock.'));
            }

            const existing = holdings[0];
            const existingQty = Number(existing.quantity) || 0;

            if (existingQty < quantity) {
                await connection.rollback();
                return res.status(400).json(createError('Sell quantity exceeds shares currently held.'));
            }

            const remainingQty = existingQty - quantity;
            const updatedCash = Number((cashBalance + totalPrice).toFixed(2));

            await connection.execute(
                'UPDATE Portfolio SET cashBalance = ? WHERE portfolioID = ?',
                [updatedCash, portfolio.portfolioID]
            );

            if (remainingQty === 0) {
                await connection.execute(
                    'DELETE FROM Holding WHERE holdingID = ?',
                    [existing.holdingID]
                );
            } else {
                await connection.execute(
                    'UPDATE Holding SET quantity = ? WHERE holdingID = ?',
                    [remainingQty, existing.holdingID]
                );
            }
        }

        await connection.execute(
            `INSERT INTO Transaction
             (portfolioID, userID, tickerSymbol, transactionType, quantity, pricePerShare, totalPrice, transactionDate, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, CURDATE(), TRUE)`,
            [portfolio.portfolioID, user.userID, tickerSymbol, tradeType, quantity, pricePerShare, totalPrice]
        );

        await connection.commit();

        return res.status(201).json({
            success: true,
            message: `${tradeType} order executed successfully.`,
            trade: {
                username: user.username,
                tickerSymbol,
                tradeType,
                quantity,
                pricePerShare,
                totalPrice,
            },
        });
    } catch (error) {
        if (connection) {
            await connection.rollback();
        }
        console.error('Trade execution error:', error);
        return res.status(500).json(createError('Unable to execute trade at this time.'));
    } finally {
        if (connection) {
            connection.release();
        }
    }
});

// --- Catch-all Route ---

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

/**
 * TRADE EXECUTION ENDPOINT - UPDATED
 * Now fetches live market price during execution to fix discrepancy issues.
 */
app.post('/api/trades', async (req, res) => {
    const username = (req.body.username || '').trim();
    const tickerSymbol = (req.body.tickerSymbol || '').trim().toUpperCase();
    const tradeType = (req.body.tradeType || req.body.transactionType || '').trim(); 
    const quantity = parsePositiveInteger(req.body.quantity);

    if (!username || !tickerSymbol || !tradeType || !quantity) {
        return res.status(400).json(createError('username, tickerSymbol, tradeType, and quantity are required.'));
    }

    const normalizedTradeType = tradeType.charAt(0).toUpperCase() + tradeType.slice(1).toLowerCase();

    if (normalizedTradeType !== 'Buy' && normalizedTradeType !== 'Sell') {
        return res.status(400).json(createError('tradeType must be Buy or Sell.'));
    }

    let connection;

    try {
        const [users] = await pool.execute(
            'SELECT userID, username FROM `User` WHERE username = ?',
            [username]
        );

        if (users.length === 0) {
            return res.status(404).json(createError('User not found.'));
        }

        const user = users[0];

        // FETCH LIVE PRICE: This overrides the stale DB price and fallback price
        const livePrice = await getLivePrice(tickerSymbol);
        if (!livePrice) {
            return res.status(400).json(createError('Could not retrieve current market price. Please try again.'));
        }

        connection = await pool.getConnection();
        await connection.beginTransaction();

        let [portfolios] = await connection.execute(
            `SELECT portfolioID, cashBalance
             FROM Portfolio
             WHERE userID = ? AND leagueID IS NULL
             ORDER BY portfolioID DESC
             LIMIT 1
             FOR UPDATE`,
            [user.userID]
        );

        if (portfolios.length === 0) {
            const startingCash = 10000;
            const [insertPortfolio] = await connection.execute(
                `INSERT INTO Portfolio (userID, leagueID, cashBalance, portfolioType, createdDate)
                 VALUES (?, NULL, ?, 'Individual', CURDATE())`,
                [user.userID, startingCash]
            );

            portfolios = [{
                portfolioID: insertPortfolio.insertId,
                cashBalance: startingCash,
            }];
        }

        const portfolio = portfolios[0];
        const currentCash = Number(portfolio.cashBalance);
        const totalPrice = Number((livePrice * quantity).toFixed(2));

        if (normalizedTradeType === 'Buy') {
            if (currentCash < totalPrice) {
                await connection.rollback();
                return res.status(400).json(createError('Insufficient funds.'));
            }

            await connection.execute(
                'UPDATE Portfolio SET cashBalance = cashBalance - ? WHERE portfolioID = ?',
                [totalPrice, portfolio.portfolioID]
            );

            const [holdings] = await connection.execute(
                `SELECT holdingID, quantity, purchasePrice FROM Holding 
                 WHERE portfolioID = ? AND UPPER(tickerSymbol) = ? FOR UPDATE`,
                [portfolio.portfolioID, tickerSymbol]
            );

            if (holdings.length > 0) {
                const existing = holdings[0];
                const newQty = Number(existing.quantity) + quantity;
                const newAvg = ((Number(existing.quantity) * Number(existing.purchasePrice)) + totalPrice) / newQty;

                await connection.execute(
                    'UPDATE Holding SET quantity = ?, purchasePrice = ? WHERE holdingID = ?',
                    [newQty, newAvg.toFixed(4), existing.holdingID]
                );
            } else {
                await connection.execute(
                    `INSERT INTO Holding (userID, portfolioID, tickerSymbol, quantity, purchasePrice)
                     VALUES (?, ?, ?, ?, ?)`,
                    [user.userID, portfolio.portfolioID, tickerSymbol, quantity, livePrice]
                );
            }

        } else { // Sell logic
            const [holdings] = await connection.execute(
                `SELECT holdingID, quantity FROM Holding 
                 WHERE portfolioID = ? AND UPPER(tickerSymbol) = ? FOR UPDATE`,
                [portfolio.portfolioID, tickerSymbol]
            );

            if (holdings.length === 0 || Number(holdings[0].quantity) < quantity) {
                await connection.rollback();
                return res.status(400).json(createError('Insufficient shares to sell.'));
            }

            const existing = holdings[0];
            const remainingQty = Number(existing.quantity) - quantity;

            await connection.execute(
                'UPDATE Portfolio SET cashBalance = cashBalance + ? WHERE portfolioID = ?',
                [totalPrice, portfolio.portfolioID]
            );

            if (remainingQty === 0) {
                await connection.execute('DELETE FROM Holding WHERE holdingID = ?', [existing.holdingID]);
            } else {
                await connection.execute(
                    'UPDATE Holding SET quantity = ? WHERE holdingID = ?',
                    [remainingQty, existing.holdingID]
                );
            }
        }

        await connection.execute(
            `INSERT INTO Transaction (portfolioID, userID, tickerSymbol, transactionType, quantity, pricePerShare, totalPrice, transactionDate, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, CURDATE(), TRUE)`,
            [portfolio.portfolioID, user.userID, tickerSymbol, normalizedTradeType, quantity, livePrice, totalPrice]
        );

        // SYNC DB: Optional but recommended—update the Stock table with the live price we just fetched
        await connection.execute(
            `UPDATE Stock SET currentPrice = ? WHERE tickerSymbol = ?`,
            [livePrice, tickerSymbol]
        );

        await connection.commit();
        res.status(201).json({ success: true, message: 'Trade executed successfully.', priceExecuted: livePrice });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Trade Error:', error);
        res.status(500).json(createError('Error executing trade.'));
    } finally {
        if (connection) connection.release();
    }
});

// --- Catch-all Route ---
app.get('*', (req, res) => {
    res.sendFile(path.join(clientPath, 'landingPage.html'));
});

// ==========================================
//                STARTUP SEQUENCE
// ==========================================
initDb()
    .then(async () => {
        app.listen(port, () => {
            console.log(`Server listening on http://localhost:${port}`);
        });

        // Seed database on startup
        await clearStockTable();
        await seedDatabase();

        // Schedule Daily Market Refresh
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