#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

// Configuration - easily adjustable for scaling up
const CONFIG = {
    TARGET_PRIME_COUNT: 10_000_000_000, // 10 billion primes
    SEGMENT_SIZE: 1_000_000,            // 1M primes per segment  
    SIEVE_SEGMENT_SIZE: 100_000_000,    // 100M numbers per sieve segment
    DATABASE_PATH: path.join(__dirname, '../database/primes.db'),
    PROGRESS_LOG_INTERVAL: 100,         // Log progress every 100 segments
    BATCH_SIZE: 100                     // Insert segments in batches
};

class PrimeDatabaseBuilder {
    constructor() {
        this.db = null;
        this.currentSegmentId = 0;
        this.primesGenerated = 0;
        this.startTime = Date.now();
    }

    async initialize() {
        // Ensure database directory exists
        const dbDir = path.dirname(CONFIG.DATABASE_PATH);
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }

        // Initialize database
        this.db = new sqlite3.Database(CONFIG.DATABASE_PATH);
        
        // Read and execute schema
        const schemaPath = path.join(__dirname, '../database/schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');
        
        return new Promise((resolve, reject) => {
            this.db.exec(schema, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    // Variable-length integer encoding for delta compression
    encodeVarInt(value) {
        const bytes = [];
        while (value >= 128) {
            bytes.push((value & 127) | 128);
            value >>>= 7;
        }
        bytes.push(value & 127);
        return Buffer.from(bytes);
    }

    // Compress array of gaps using delta encoding + VarInt
    compressDeltas(gaps) {
        const compressed = [];
        for (const gap of gaps) {
            compressed.push(this.encodeVarInt(gap));
        }
        return Buffer.concat(compressed);
    }

    // Segmented Sieve of Eratosthenes
    segmentedSieve(start, end) {
        const segmentSize = end - start;
        const isPrime = new Array(segmentSize).fill(true);
        const limit = Math.sqrt(end);
        
        // Generate base primes up to sqrt(end)
        const basePrimes = this.simpleSieve(Math.floor(limit));
        
        // Sieve the segment
        for (const prime of basePrimes) {
            // Find first multiple of prime >= start
            let firstMultiple = Math.max(prime * prime, Math.ceil(start / prime) * prime);
            
            // Mark multiples as composite
            for (let j = firstMultiple; j < end; j += prime) {
                isPrime[j - start] = false;
            }
        }
        
        // Extract primes from segment
        const primes = [];
        for (let i = 0; i < segmentSize; i++) {
            if (isPrime[i] && (start + i) > 1) {
                primes.push(start + i);
            }
        }
        
        return primes;
    }

    // Simple sieve for base primes
    simpleSieve(limit) {
        if (limit < 2) return [];
        
        const isPrime = new Array(limit + 1).fill(true);
        isPrime[0] = isPrime[1] = false;
        
        for (let i = 2; i * i <= limit; i++) {
            if (isPrime[i]) {
                for (let j = i * i; j <= limit; j += i) {
                    isPrime[j] = false;
                }
            }
        }
        
        return isPrime.map((prime, index) => prime ? index : null)
                      .filter(prime => prime !== null);
    }

    // Calculate gaps between consecutive primes
    calculateGaps(primes) {
        const gaps = [];
        for (let i = 1; i < primes.length; i++) {
            gaps.push(primes[i] - primes[i - 1]);
        }
        return gaps;
    }

    // Insert segment into database
    async insertSegment(segmentId, startIndex, endIndex, startPrime, gaps) {
        const compressedDeltas = this.compressDeltas(gaps);
        const segmentSize = endIndex - startIndex + 1;
        
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                INSERT INTO prime_segments 
                (segment_id, start_index, end_index, start_prime, segment_size, compressed_deltas)
                VALUES (?, ?, ?, ?, ?, ?)
            `);
            
            stmt.run(segmentId, startIndex, endIndex, startPrime, segmentSize, compressedDeltas, (err) => {
                if (err) reject(err);
                else resolve();
            });
            stmt.finalize();
        });
    }

    // Update progress in database
    async updateProgress(segmentId, currentNumber, primesGenerated) {
        const now = new Date().toISOString();
        const progressPercent = (primesGenerated / CONFIG.TARGET_PRIME_COUNT * 100).toFixed(2);
        const ratePerSecond = primesGenerated / ((Date.now() - this.startTime) / 1000);
        const estimatedCompletion = new Date(Date.now() + 
            (CONFIG.TARGET_PRIME_COUNT - primesGenerated) / ratePerSecond * 1000
        ).toISOString();

        return new Promise((resolve, reject) => {
            this.db.run(`
                INSERT OR REPLACE INTO generation_progress 
                (id, current_segment, current_number, primes_generated, start_time, last_update, estimated_completion)
                VALUES (1, ?, ?, ?, ?, ?, ?)
            `, [segmentId, currentNumber, primesGenerated, new Date(this.startTime).toISOString(), now, estimatedCompletion], 
            (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        // Console progress
        if (segmentId % CONFIG.PROGRESS_LOG_INTERVAL === 0) {
            console.log(`Progress: ${progressPercent}% | Segment ${segmentId} | ${primesGenerated.toLocaleString()} primes | Rate: ${Math.floor(ratePerSecond).toLocaleString()}/sec | ETA: ${new Date(estimatedCompletion).toLocaleString()}`);
        }
    }

    // Main generation function
    async generate() {
        console.log(`🚀 Starting prime database generation...`);
        console.log(`📊 Target: ${CONFIG.TARGET_PRIME_COUNT.toLocaleString()} primes`);
        console.log(`🔧 Segment size: ${CONFIG.SEGMENT_SIZE.toLocaleString()} primes`);
        console.log(`💾 Database: ${CONFIG.DATABASE_PATH}`);
        console.log('');

        // Set status to in_progress
        await new Promise((resolve, reject) => {
            this.db.run(`
                UPDATE database_metadata 
                SET value = ?, updated_at = CURRENT_TIMESTAMP 
                WHERE key = ?
            `, ['in_progress', 'generation_status'], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        let currentNumber = 2;
        let primesInCurrentSegment = [];
        let globalPrimeIndex = 1;

        while (this.primesGenerated < CONFIG.TARGET_PRIME_COUNT) {
            // Generate primes for current sieve segment
            const segmentEnd = currentNumber + CONFIG.SIEVE_SEGMENT_SIZE;
            const segmentPrimes = this.segmentedSieve(currentNumber, segmentEnd);
            
            for (const prime of segmentPrimes) {
                primesInCurrentSegment.push(prime);
                
                // When we have enough primes for a database segment, store it
                if (primesInCurrentSegment.length >= CONFIG.SEGMENT_SIZE || 
                    this.primesGenerated + primesInCurrentSegment.length >= CONFIG.TARGET_PRIME_COUNT) {
                    
                    const startIndex = globalPrimeIndex;
                    const endIndex = globalPrimeIndex + primesInCurrentSegment.length - 1;
                    const startPrime = primesInCurrentSegment[0];
                    const gaps = this.calculateGaps(primesInCurrentSegment);
                    
                    await this.insertSegment(this.currentSegmentId, startIndex, endIndex, startPrime, gaps);
                    
                    this.primesGenerated += primesInCurrentSegment.length;
                    globalPrimeIndex += primesInCurrentSegment.length;
                    
                    await this.updateProgress(this.currentSegmentId, currentNumber, this.primesGenerated);
                    
                    this.currentSegmentId++;
                    primesInCurrentSegment = [];
                    
                    // Check if we've reached our target
                    if (this.primesGenerated >= CONFIG.TARGET_PRIME_COUNT) break;
                }
            }
            
            currentNumber = segmentEnd;
        }

        // Update final metadata
        await new Promise((resolve, reject) => {
            this.db.run(`
                UPDATE database_metadata 
                SET value = ?, updated_at = CURRENT_TIMESTAMP 
                WHERE key = ?
            `, ['completed', 'generation_status'], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        const totalTime = ((Date.now() - this.startTime) / 1000 / 60).toFixed(1);
        console.log('');
        console.log(`✅ Database generation completed!`);
        console.log(`📊 Generated: ${this.primesGenerated.toLocaleString()} primes`);
        console.log(`🏁 Total segments: ${this.currentSegmentId}`);
        console.log(`⏱️  Total time: ${totalTime} minutes`);
        console.log(`💾 Database size: ${(fs.statSync(CONFIG.DATABASE_PATH).size / 1024 / 1024 / 1024).toFixed(2)} GB`);
    }

    async close() {
        if (this.db) {
            this.db.close();
        }
    }
}

// Main execution
async function main() {
    const builder = new PrimeDatabaseBuilder();
    
    try {
        await builder.initialize();
        await builder.generate();
    } catch (error) {
        console.error('❌ Error during database generation:', error);
        process.exit(1);
    } finally {
        await builder.close();
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Received interrupt signal. Shutting down gracefully...');
    process.exit(0);
});

if (require.main === module) {
    main();
}

module.exports = { PrimeDatabaseBuilder, CONFIG };