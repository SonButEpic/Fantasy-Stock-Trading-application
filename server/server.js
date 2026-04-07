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