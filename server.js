const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { getPrimeDatabaseInstance } = require('./lib/prime-database');

const app = express();
const PORT = 3007;

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-eval'"], // unsafe-eval needed for web workers
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            connectSrc: ["'self'"],
            imgSrc: ["'self'", "data:"]
        }
    }
}));

// Rate limiting to protect server resources
const apiLimiter = rateLimit({
    windowMs: 1000, // 1 second window
    max: 10, // limit each IP to 10 requests per second
    message: {
        error: 'Too many requests',
        message: 'Rate limit exceeded. Maximum 10 requests per second.',
        retryAfter: '1 second'
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// More restrictive rate limiting for API endpoints
const strictApiLimiter = rateLimit({
    windowMs: 1000, // 1 second window  
    max: 5, // limit each IP to 5 API calls per second
    message: {
        error: 'Server busy - rate limit exceeded',
        message: 'Too many requests. Please try again in 1 second.',
        limit: 5,
        window: '1 second',
        suggestion: 'For bulk requests, add delays between calls'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Apply rate limiting to all routes
app.use(apiLimiter);

// Middleware for parsing JSON and URL-encoded data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize prime database
const primeDB = getPrimeDatabaseInstance();

// Get nth prime using database (1-indexed)
async function getNthPrime(n) {
    if (n < 1) return null;
    
    try {
        const prime = await primeDB.getPrimeByIndex(n);
        return prime;
    } catch (error) {
        console.error(`Error retrieving prime at index ${n}:`, error);
        return null;
    }
}

// Main prime generator route - serves HTML page and handles API requests
app.get('/', strictApiLimiter, async (req, res, next) => {
    const primeIndex = req.query.pi;
    
    // If pi parameter exists, return JSON API response
    if (primeIndex !== undefined) {
        const index = parseInt(primeIndex);
        
        // Get current database maximum dynamically
        let maxIndex;
        try {
            const stats = await primeDB.getStats();
            maxIndex = stats.max_prime_index || 0;
        } catch (error) {
            return res.status(503).json({
                error: "Database unavailable",
                message: "Prime database is not accessible",
                suggestion: "Database may still be building. Try again later."
            });
        }
        
        // Validate input with dynamic maximum
        if (isNaN(index) || index < 1) {
            return res.status(400).json({
                error: "Invalid prime index",
                message: `Index must be a positive integer`,
                example: "/prime-generator/api?pi=5"
            });
        }
        
        if (index > maxIndex) {
            return res.status(400).json({
                error: "Index out of range",
                message: `Index must be between 1 and ${maxIndex.toLocaleString()}`,
                current_max: maxIndex,
                requested: index,
                suggestion: maxIndex === 0 ? "Database is still building" : "Try a smaller index"
            });
        }
        
        const startTime = Date.now();
        const prime = await getNthPrime(index);
        const calculationTime = Date.now() - startTime;
        
        if (prime === null) {
            return res.status(500).json({
                error: "Prime lookup failed",
                message: "Unable to retrieve the requested prime from database",
                index: index
            });
        }
        
        return res.json({
            index: index,
            prime: prime
        });
    }
    
    // If no 'pi' parameter, pass to the next middleware (static files)
    return next();
});

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// API route - handles both documentation and API requests
app.get('/api', strictApiLimiter, async (req, res) => {
    const primeIndex = req.query.pi;
    
    // If pi parameter exists, return JSON API response
    if (primeIndex !== undefined) {
        const index = parseInt(primeIndex);
        
        // Get current database maximum dynamically
        let maxIndex;
        try {
            const stats = await primeDB.getStats();
            maxIndex = stats.max_prime_index || 0;
        } catch (error) {
            return res.status(503).json({
                error: "Database unavailable",
                message: "Prime database is not accessible",
                suggestion: "Database may still be building. Try again later."
            });
        }
        
        // Validate input with dynamic maximum
        if (isNaN(index) || index < 1) {
            return res.status(400).json({
                error: "Invalid prime index",
                message: `Index must be a positive integer`,
                example: "/prime-generator/api?pi=5"
            });
        }
        
        if (index > maxIndex) {
            return res.status(400).json({
                error: "Index out of range",
                message: `Index must be between 1 and ${maxIndex.toLocaleString()}`,
                current_max: maxIndex,
                requested: index,
                suggestion: maxIndex === 0 ? "Database is still building" : "Try a smaller index"
            });
        }
        
        const startTime = Date.now();
        const prime = await getNthPrime(index);
        const calculationTime = Date.now() - startTime;
        
        if (prime === null) {
            return res.status(500).json({
                error: "Prime lookup failed",
                message: "Unable to retrieve the requested prime from database",
                index: index
            });
        }
        
        return res.json({
            index: index,
            prime: prime
        });
    }
    
    // If no 'pi' parameter, serve API documentation
    res.sendFile(path.join(__dirname, 'public', 'api.html'));
});

// Database stats endpoint for dynamic API information
app.get('/stats', async (req, res) => {
    try {
        const stats = await primeDB.getStats();
        const cacheStats = primeDB.getCacheStats();
        
        res.json({
            database: {
                max_prime_index: stats.max_prime_index || 0,
                total_segments: stats.total_segments || 0,
                status: stats.status || 'unknown',
                target_count: parseInt(stats.target_count) || 0
            },
            cache: cacheStats,
            timestamp: new Date().toISOString(),
            version: '2025-08-05-dynamic'
        });
    } catch (error) {
        res.status(503).json({
            error: 'Database unavailable',
            message: 'Unable to retrieve database statistics',
            timestamp: new Date().toISOString()
        });
    }
});

// Simple test route to verify server is running updated code
app.get('/test', (req, res) => {
    res.json({ 
        message: 'Server is running updated code', 
        timestamp: new Date().toISOString(),
        version: '2025-08-05-dynamic'
    });
});

function getOrdinal(n) {
    const j = n % 10;
    const k = n % 100;
    if (j === 1 && k !== 11) return n + 'st';
    if (j === 2 && k !== 12) return n + 'nd';
    if (j === 3 && k !== 13) return n + 'rd';
    return n + 'th';
}

app.listen(PORT, async () => {
    console.log(`Prime Generator server running on port ${PORT}`);
    console.log(`Access at: http://localhost:${PORT}`);
    
    // Initialize prime database
    try {
        await primeDB.initialize();
        const stats = await primeDB.getStats();
        console.log(`📊 Prime Database: ${stats.max_prime_index?.toLocaleString() || '0'} primes available`);
        console.log(`🔧 Status: ${stats.status}`);
    } catch (error) {
        console.warn('⚠️  Prime database not available - API will return errors until database is built');
        console.warn('   Run: node scripts/build-prime-database.js');
    }
});