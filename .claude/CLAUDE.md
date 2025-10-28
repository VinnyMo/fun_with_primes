# Prime Generator Web Application

## Project Overview

A high-performance, database-driven prime number generator with both a REST API and interactive web interface. The application features ultra-fast prime lookups from a pre-computed database of 10 billion primes with sub-10ms response times.

**Live URL**: https://vincentmossman.com/prime-generator/
**GitHub**: https://github.com/VinnyMo/fun_with_primes
**Port**: 3007
**Systemd Service**: prime-generator.service

## Key Features

- **Database-Driven API**: Pre-computed SQLite database with 10 billion primes (~12-15GB)
- **Ultra-Fast Lookups**: 1-8ms response times with intelligent segment caching
- **Multi-Core Web Interface**: Client-side prime generation using Web Workers
- **Dynamic Scaling**: API automatically expands as database grows
- **Rate Limiting**: 5 requests/second for API, 10 requests/second for static content
- **Security**: Helmet middleware with CSP headers, read-only database access

## Architecture

### Backend (Node.js + Express)
- **Server**: Express.js on port 3007
- **Database**: SQLite with delta-compression and segment-based storage
- **Security**: Helmet CSP headers, express-rate-limit
- **Proxy**: Runs behind nginx with path rewriting at /prime-generator/

### Database Design
- **Storage**: Delta-compressed segments (1M primes per segment)
- **Encoding**: Variable-length integer encoding for efficient storage
- **Caching**: LRU cache for hot segments (~100MB cache)
- **Current Capacity**: 10 billion primes (~12-15GB)
- **Location**: `/home/maestro/fun_with_primes/database/primes.db`

### Frontend
- **Interactive UI**: Progressive loading with infinite scroll
- **Web Workers**: Multi-core client-side prime generation
- **Real-time Stats**: Live statistics and prime number properties
- **Responsive Design**: Optimized for desktop and mobile

## Project Structure

```
fun_with_primes/
├── server.js                 # Main Express server
├── lib/
│   └── prime-database.js     # Database access layer with caching
├── scripts/
│   ├── build-prime-database.js  # Database builder script
│   ├── database-stats.js        # Database statistics viewer
│   └── fix-status.js            # Database status repair utility
├── public/
│   ├── index.html            # Interactive web interface
│   ├── api.html              # API documentation page
│   ├── js/                   # Client-side JavaScript
│   └── css/                  # Stylesheets
├── database/
│   └── primes.db            # SQLite database (10B primes)
├── javascript/              # Legacy/utility JS modules
└── prime-generator.service  # Systemd service configuration
```

## API Endpoints

### Main Endpoints

1. **GET /** - Serve web interface or API request
   - With `?pi=N` query param: Returns JSON with Nth prime
   - Without params: Serves index.html

2. **GET /api** - API documentation or API request
   - With `?pi=N` query param: Returns JSON with Nth prime
   - Without params: Serves api.html documentation

3. **GET /stats** - Database and cache statistics
   ```json
   {
     "database": {
       "max_prime_index": 10000000000,
       "total_segments": 10000,
       "status": "complete",
       "target_count": 10000000000
     },
     "cache": { ... },
     "timestamp": "2025-08-05T12:00:00.000Z"
   }
   ```

4. **GET /test** - Server health check

### Rate Limits
- **API endpoints** (`/?pi=N`, `/api?pi=N`): 5 requests/second per IP
- **Static content**: 10 requests/second per IP
- **429 Response**: Includes retry-after and helpful error messages

### API Response Format

**Success (200)**:
```json
{
  "index": 1000000,
  "prime": 15485863
}
```

**Error Responses**:
- **400**: Invalid index or out of range
- **429**: Rate limit exceeded
- **500**: Prime lookup failed
- **503**: Database unavailable

## NPM Scripts

```bash
npm start           # Start the server (production)
npm run dev         # Start the server (development)
npm run build-db    # Build/expand prime database
npm run db-stats    # Show database statistics
npm run fix-status  # Fix database status if corrupted
```

## Database Management

### Current Database
- **Size**: ~12-15GB
- **Capacity**: 10 billion primes
- **First prime**: 2 (index 1)
- **Last prime**: ~252,097,800,623 (index 10,000,000,000)

### Expanding Database Capacity

To expand to 100 billion primes (~116GB):

1. Edit `scripts/build-prime-database.js`
2. Change `TARGET_PRIME_COUNT` to `100_000_000_000`
3. Run `npm run build-db` (resumes from current progress)
4. API automatically scales - no code changes needed

The build process:
- Uses Sieve of Eratosthenes for efficient prime generation
- Segments of 1M primes with delta compression
- Stores gaps as variable-length integers
- Can be resumed if interrupted
- Takes 2-4 hours for 10B primes (hardware dependent)

### Database Statistics

Check database status:
```bash
npm run db-stats
```

Or via API:
```bash
curl https://vincentmossman.com/prime-generator/stats
```

## Development Guidelines

### Server Management
- **Production**: Managed by systemd service `prime-generator.service`
- **Development**: Run manually with `npm start` or `npm run dev`
- **Never**: Run sudo commands (coordinate with system admin)
- **Port**: 3007 (nginx forwards from /prime-generator/)

### Nginx Configuration
- **Config file**: `/etc/nginx/sites-enabled/vincentmossman.com`
- **Path**: `/prime-generator/` → `localhost:3007/` (with rewriting)
- **API Path**: `/prime-generator/api` → `localhost:3007/api`
- Server restarts handled by system admin

### Code Style
- Express middleware pattern
- Async/await for database operations
- Error handling with descriptive JSON responses
- Rate limiting on all routes

### Security Considerations
- Database is **read-only** (OPEN_READONLY flag)
- Input validation on all user-provided indices
- CSP headers configured via Helmet
- Rate limiting to prevent abuse
- Trust proxy setting enabled (behind nginx)

## Testing

### Manual Testing

Test server health:
```bash
curl http://localhost:3007/test
```

Test API locally:
```bash
curl "http://localhost:3007/api?pi=1000000"
```

Test API through nginx:
```bash
curl "https://vincentmossman.com/prime-generator/api?pi=1000000"
```

Check database stats:
```bash
curl "http://localhost:3007/stats"
```

### Rate Limit Testing
The rate limiter uses IP-based tracking. Be aware:
- Multiple rapid requests will trigger 429 errors
- Headers include `RateLimit-Limit` and `RateLimit-Remaining`
- Helpful error messages guide users to slow down

## Common Tasks

### Restart Production Server
```bash
# System admin will run:
sudo systemctl restart prime-generator
```

### View Production Logs
```bash
journalctl -u prime-generator -f
```

### Check Database Status
```bash
npm run db-stats
```

### Add New API Endpoint
1. Add route in `server.js`
2. Apply appropriate rate limiter
3. Follow existing error response patterns
4. Test locally before deploying

### Modify Frontend
- Edit files in `public/` directory
- No build step required (static files)
- Changes visible immediately after refresh

## Dependencies

- **express**: Web server framework
- **express-rate-limit**: API rate limiting
- **helmet**: Security headers
- **sqlite3**: Database driver

## Performance Characteristics

- **Database Lookup**: 1-8ms (with caching)
- **Segment Cache**: 100 segments (~100MB in memory)
- **API Response Time**: <10ms for cached segments
- **Concurrent Requests**: Handled via Express async patterns
- **Storage Efficiency**: ~1.2-1.5 bytes per prime (delta compression)

## Troubleshooting

### Database Not Available
```bash
# Check if database exists
ls -lh database/primes.db

# Check database status
npm run db-stats

# If status is incorrect, fix it
npm run fix-status
```

### Server Won't Start
```bash
# Check if port 3007 is in use
lsof -i :3007

# Check database permissions
ls -la database/
```

### API Returns 503 Errors
- Database may still be building (check `npm run db-stats`)
- Database file may be corrupted (check logs)
- Check systemd logs: `journalctl -u prime-generator -n 50`

## Future Enhancement Ideas

- WebSocket support for real-time prime generation streams
- Prime factorization API endpoint
- Additional compression algorithms for better storage efficiency
- Distributed database segments across multiple servers
- GraphQL API layer
- Export functionality (CSV, JSON bulk exports)
- Prime number sequence patterns and analytics

## License

MIT License - Built by Vincent Mossman

## Notes

- This application runs as one of several services on vincentmossman.com
- The main landing page is on port 3001
- Multiple Node.js servers run on different ports (3000, 3001, 3002, 3007, etc.)
- Production servers are managed as systemd services
- Development servers are run manually in terminal
