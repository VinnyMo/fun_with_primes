#!/usr/bin/env node

const { PrimeDatabase } = require('../lib/prime-database');
const fs = require('fs');
const path = require('path');

async function displayDatabaseStats() {
    const dbPath = path.join(__dirname, '../database/primes.db');
    
    // Check if database exists
    if (!fs.existsSync(dbPath)) {
        console.log('❌ Prime database not found!');
        console.log('   Run: npm run build-db');
        return;
    }
    
    const db = new PrimeDatabase(dbPath);
    
    try {
        await db.initialize();
        const stats = await db.getStats();
        
        // Get file size
        const fileSizeBytes = fs.statSync(dbPath).size;
        const fileSizeGB = (fileSizeBytes / 1024 / 1024 / 1024).toFixed(2);
        const fileSizeMB = (fileSizeBytes / 1024 / 1024).toFixed(1);
        
        console.log('');
        const progressPercent = stats.max_prime_index ? 
            (stats.max_prime_index / parseInt(stats.target_count) * 100).toFixed(2) : '0.00';
        
        console.log('🗄️  PRIME DATABASE STATISTICS');
        console.log('═'.repeat(50));
        console.log(`📊 Total Primes: ${stats.max_prime_index?.toLocaleString() || '0'}`);
        console.log(`🎯 Target Count: ${parseInt(stats.target_count).toLocaleString()}`);
        console.log(`📈 Progress: ${progressPercent}%`);
        console.log(`🏁 Status: ${stats.status}`);
        console.log(`📁 Segments: ${stats.total_segments?.toLocaleString() || '0'}`);
        console.log(`💾 File Size: ${fileSizeGB} GB (${fileSizeMB} MB)`);
        console.log(`📍 Location: ${dbPath}`);
        
        if (stats.max_prime_index > 0) {
            // Test a few lookups to show performance
            console.log('');
            console.log('⚡ PERFORMANCE TEST');
            console.log('─'.repeat(30));
            
            const testIndices = [1, 100, 10000, 1000000];
            
            for (const index of testIndices) {
                if (index <= stats.max_prime_index) {
                    const startTime = Date.now();
                    const prime = await db.getPrimeByIndex(index);
                    const lookupTime = Date.now() - startTime;
                    
                    console.log(`Prime #${index.toLocaleString()}: ${prime.toLocaleString()} (${lookupTime}ms)`);
                }
            }
            
            // Cache stats
            const cacheStats = db.getCacheStats();
            console.log('');
            console.log('🗃️  CACHE STATISTICS');
            console.log('─'.repeat(30));
            console.log(`Cache Size: ${cacheStats.cacheSize}/${cacheStats.maxCacheSize}`);
        }
        
        console.log('');
        
    } catch (error) {
        console.error('❌ Error reading database:', error.message);
    } finally {
        await db.close();
    }
}

if (require.main === module) {
    displayDatabaseStats();
}

module.exports = { displayDatabaseStats };