const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const { pool, initializeDatabase } = require('./config/database');
const studentRoutes = require('./routes/studentRoutes');
const recordRoutes = require('./routes/recordRoutes');
const attendanceRoutes = require('./routes/attendance');
const authRoutes = require('./routes/authRoutes');
const requireAuth = require('./middleware/requireAuth');
const requireAdmin = require('./middleware/requireAdmin');
const adminRoutes = require('./routes/adminRoutes');

const app = express();

const configuredOrigins = String(process.env.FRONTEND_URL || process.env.CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);

const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'http://localhost:5500',
    'http://127.0.0.1:5500',
    ...configuredOrigins
];

const corsOptions = {
    origin: (origin, callback) => {
        if (!origin) {
            return callback(null, true);
        }
        // Allow any *.onrender.com subdomain automatically (covers URL changes)
        const isRenderDomain = /^https:\/\/[a-z0-9-]+\.onrender\.com$/.test(origin);

        if (allowedOrigins.includes(origin) || isRenderDomain) {
            callback(null, true);
        } else {
            console.error('CORS blocked origin:', JSON.stringify(origin));
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 200
};

// Middleware
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/api/health', (req, res) => {
    res.json({ success: true, message: 'Backend is running' });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', requireAuth, requireAdmin, adminRoutes);
app.use('/api/students', requireAuth, studentRoutes);
app.use('/api/records', requireAuth, recordRoutes);
app.use('/api/attendance', requireAuth, attendanceRoutes);

// Static file serving
const staticRoot = path.join(__dirname, '../../');
app.get('/terms', (req, res) => {
    res.sendFile(path.join(staticRoot, 'terms.html'));
});
app.get('/acceptable-use', (req, res) => {
    res.sendFile(path.join(staticRoot, 'acceptable-use.html'));
});
app.use('/', express.static(staticRoot, {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css');
        } else if (filePath.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
        }
    }
}));

// Catch-all route for SPA - Must come after API routes and static files
app.get('*', (req, res) => {
    // Only send index.html for non-API routes
    if (!req.path.startsWith('/api/')) {
        res.sendFile(path.join(__dirname, '../../index.html'));
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        message: 'Internal Server Error'
    });
});

async function seedSubjects() {
    try {
        const [rows] = await pool.query('SELECT COUNT(*) AS count FROM subjects');
        if (rows[0].count === 0) {
            await pool.query(
                'INSERT INTO subjects (code, teacher) VALUES ?',
                [[
                    ['IT223', 'Ms. Garcia'],
                    ['IT221', 'Mr. Santos']
                ]]
            );
            console.log('Seeded subjects table');
        }
    } catch (error) {
        console.error('Error seeding subjects:', error);
    }
}

function startServer(port) {
    const server = app.listen(port, async () => {
        console.log(`Server is running on port ${port}`);
        try {
            await initializeDatabase();
            await seedSubjects();
        } catch (error) {
            console.error('Database initialization failed:', error);
        }
    });

    server.on('error', (error) => {
        if (error.code === 'EADDRINUSE') {
            const nextPort = port + 1;
            console.warn(`Port ${port} is already in use. Trying ${nextPort} instead.`);
            startServer(nextPort);
            return;
        }

        console.error('Server failed to start:', error);
        process.exit(1);
    });
}

const PORT = parseInt(process.env.PORT, 10) || 3000;
startServer(PORT); 