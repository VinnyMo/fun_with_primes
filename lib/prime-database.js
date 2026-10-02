const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class PrimeDatabase {
    constructor(dbPath = null) {
        this.dbPath = dbPath || path.join(__dirname, '../database/primes.db');
        this.db = null;
        this.isInitialized = false;
        this.cache = new Map(); // LRU cache for hot segments
        this.maxCacheSize = 100; // Cache up to 100 segments (~100MB)
    }

    // Initialize database connection
    async initialize() {
        if (this.isInitialized) return;

        this.db = new sqlite3.Database(this.dbPath, sqlite3.OPEN_READONLY, (err) => {
            if (err) {
                console.error('Failed to open prime database:', err);
                throw err;
            }
        });

        this.isInitialized = true;
        console.log('✅ Prime database initialized');
    }

    // Decode variable-length integer
    decodeVarInt(buffer, offset = 0) {
        let result = 0;
        let shift = 0;
        let index = offset;

        while (index < buffer.length) {
            const byte = buffer[index++];
            result |= (byte & 127) << shift;
            
            if ((byte & 128) === 0) {
                return { value: result, nextOffset: index };
            }
            
            shift += 7;
        }
        
        throw new Error('Invalid VarInt encoding');
    }

    // Decompress delta-encoded gaps
    decompressDeltas(compressedBuffer) {
        const gaps = [];
        let offset = 0;

        while (offset < compressedBuffer.length) {
            const decoded = this.decodeVarInt(compressedBuffer, offset);
            gaps.push(decoded.value);
            offset = decoded.nextOffset;
        }

        return gaps;
    }

    // Reconstruct primes from start prime + gaps
    reconstructPrimes(startPrime, gaps) {
        const primes = [startPrime];
        let currentPrime = startPrime;

        for (const gap of gaps) {
            currentPrime += gap;
            primes.push(currentPrime);
        }

        return primes;
    }

    // Find which segment contains the given prime index
    async findSegmentForIndex(primeIndex) {
        return new Promise((resolve, reject) => {
            this.db.get(`
                SELECT segment_id, start_index, end_index, start_prime, compressed_deltas
                FROM prime_segments 
                WHERE start_index <= ? AND end_index >= ?
                LIMIT 1
            `, [primeIndex, primeIndex], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }

    // Get prime by index (1-based indexing)
    async getPrimeByIndex(primeIndex) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        // Check cache first
        const cacheKey = `index_${primeIndex}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        try {
            // Find the segment containing this prime index
            const segment = await this.findSegmentForIndex(primeIndex);
            
            if (!segment) {
                throw new Error(`Prime index ${primeIndex} not found in database`);
            }

            // Check if we have this segment cached
            const segmentCacheKey = `segment_${segment.segment_id}`;
            let primes;

            if (this.cache.has(segmentCacheKey)) {
                primes = this.cache.get(segmentCacheKey);
            } else {
                // Decompress and reconstruct primes for this segment
                const gaps = this.decompressDeltas(segment.compressed_deltas);
                primes = this.reconstructPrimes(segment.start_prime, gaps);
                
                // Cache the segment (implement simple LRU)
                if (this.cache.size >= this.maxCacheSize) {
                    const firstKey = this.cache.keys().next().value;
                    this.cache.delete(firstKey);
                }
                this.cache.set(segmentCacheKey, primes);
            }

            // Calculate the position within the segment
            const positionInSegment = primeIndex - segment.start_index;
            const prime = primes[positionInSegment];

            // Cache the individual result
            if (this.cache.size < this.maxCacheSize * 10) { // Allow more individual cache entries
                this.cache.set(cacheKey, prime);
            }

            return prime;

        } catch (error) {
            console.error(`Error retrieving prime at index ${primeIndex}:`, error);
            throw error;
        }
    }

    // Get database statistics
    async getStats() {
        if (!this.isInitialized) {
            await this.initialize();
        }

        return new Promise((resolve, reject) => {
            this.db.all(`
                SELECT 
                    (SELECT COUNT(*) FROM prime_segments) as total_segments,
                    (SELECT MAX(end_index) FROM prime_segments) as max_prime_index,
                    (SELECT value FROM database_metadata WHERE key = 'generation_status') as status,
                    (SELECT value FROM database_metadata WHERE key = 'target_prime_count') as target_count
            `, (err, rows) => {
                if (err) reject(err);
                else resolve(rows[0]);
            });
        });
    }

    // Check if prime index is available
    async isIndexAvailable(primeIndex) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        const stats = await this.getStats();
        return primeIndex <= stats.max_prime_index;
    }

    // Batch get multiple primes (for potential future optimization)
    async getPrimesByIndexRange(startIndex, endIndex) {
        const results = [];
        
        for (let i = startIndex; i <= endIndex; i++) {
            try {
                const prime = await this.getPrimeByIndex(i);
                results.push({ index: i, prime });
            } catch (error) {
                results.push({ index: i, error: error.message });
            }
        }
        
        return results;
    }

    // Clean up resources
    async close() {
        if (this.db) {
            this.db.close();
            this.isInitialized = false;
            this.cache.clear();
        }
    }

    // Get cache statistics
    getCacheStats() {
        return {
            cacheSize: this.cache.size,
            maxCacheSize: this.maxCacheSize,
            hitRate: this.cacheHits / (this.cacheHits + this.cacheMisses) || 0
        };
    }
}

// Singleton instance for the API server
let globalInstance = null;

function getPrimeDatabaseInstance() {
    if (!globalInstance) {
        globalInstance = new PrimeDatabase();
    }
    return globalInstance;
}

module.exports = {
    PrimeDatabase,
    getPrimeDatabaseInstance
};