const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const app = express();
const PORT = 3007;

// Trust proxy since we're behind nginx
app.set('trust proxy', 1);

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

// Apply rate limiting to all routes
app.use(apiLimiter);

// Middleware for parsing JSON and URL-encoded data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Simple test route to verify server is running
app.get('/test', (req, res) => {
    res.json({
        message: 'Fun With Primes - Server is running',
        timestamp: new Date().toISOString(),
        version: '2025-11-12-simplified'
    });
});

app.listen(PORT, () => {
    console.log(`Fun With Primes server running on port ${PORT}`);
    console.log(`Access at: http://localhost:${PORT}`);
    console.log('Client-side prime generation only - no database API');
});