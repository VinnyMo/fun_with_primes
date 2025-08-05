# 🔢 Prime Generator API & Web Interface

A high-performance, database-driven prime number API with lightning-fast lookups and intelligent caching. Features both a REST API for developers and an interactive web interface for exploration.

**🚀 Now supports up to 10 billion primes with sub-10ms response times!**

## ✨ Features

### 🗃️ Database-Driven API
- **Lightning Fast**: 1-8ms database lookups with intelligent segment caching
- **Massive Scale**: Pre-computed database of 10 billion primes (~12-15GB)
- **Dynamic Scaling**: API automatically expands as database grows
- **Rate Limited**: 5 requests/second to protect server resources
- **Delta Compression**: Efficient storage using gap encoding

### 🖥️ Interactive Web Interface  
- **Multi-Core Processing**: Utilizes all available CPU cores via Web Workers
- **Real-Time Statistics**: Live generation stats and prime properties
- **Progressive Loading**: Infinite scroll with dynamic loading
- **Responsive Design**: Works on desktop and mobile devices

### 🛡️ Security & Performance
- **Read-only Database**: Secure access with input validation
- **Rate Limiting**: Protects against abuse while maintaining performance
- **Helmet Security**: CSP headers and security middleware

## 🚀 Quick Start

### Installation
```bash
git clone https://github.com/your-username/fun_with_primes.git
cd fun_with_primes
npm install
```

### Build Prime Database
```bash
# Build 10 billion prime database (2-4 hours)
npm run build-db

# Check build progress
npm run db-stats
```

### Start Server
```bash
npm start
# Server runs on http://localhost:3007
```

Visit `http://localhost:3007` for the interactive interface or `http://localhost:3007/api` for API documentation.

## 📡 API Usage

### Get Prime by Index
```bash
# Get the 1,000,000th prime
curl "http://localhost:3007/api?pi=1000000"

# Response
{
  "index": 1000000,
  "prime": 15485863
}
```

### Check Database Stats
```bash
curl "http://localhost:3007/stats"
```

### Rate Limits
- **5 API requests per second** per IP address
- **429 error** if exceeded with helpful retry message

## 🔧 Scaling Up

Want 100 billion primes? Easy:

1. Edit `TARGET_PRIME_COUNT` in `scripts/build-prime-database.js`
2. Set to `100_000_000_000` (will use ~116GB)
3. Run `npm run build-db` (resumes from current progress)
4. API automatically scales - no code changes needed!

## 🏗️ Architecture

### Database Design
- **SQLite database** with delta-compressed segments
- **1M primes per segment** for optimal I/O performance
- **Variable-length integer encoding** for efficient storage
- **Read-only access** for security

### Performance
- **Sub-10ms lookups** for any prime in the database
- **Intelligent caching** of hot segments
- **Parallel request handling** with rate limiting
- **~12-15GB storage** for 10 billion primes

## 📊 Scripts

```bash
npm start         # Start the server
npm run build-db  # Build prime database
npm run db-stats  # Show database statistics
npm run fix-status # Fix database status (if needed)
```

## 🖥️ Web Interface

Interactive prime number generator with:
- **Multi-core web workers** for parallel computation
- **Real-time statistics** and progress tracking
- **Responsive design** for mobile and desktop
- **Prime number details** modal with mathematical properties

## 📖 Documentation

- **API Docs**: Visit `/prime-generator/api` for interactive documentation
- **Live Testing**: Built-in API testing interface
- **Examples**: JavaScript, Python, and cURL examples included

## 🤝 Contributing

Feel free to open issues or submit PRs! Some areas for improvement:
- Additional compression algorithms
- Distributed database segments
- WebSocket real-time updates
- Prime factorization endpoints

## 📄 License

MIT License - Built with ❤️ by Vincent Mossman.
