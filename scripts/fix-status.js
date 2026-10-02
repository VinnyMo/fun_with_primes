#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

async function fixStatus() {
    const dbPath = path.join(__dirname, '../database/primes.db');
    const db = new sqlite3.Database(dbPath);
    
    // Update status to in_progress if we have segments but status is not_started
    return new Promise((resolve, reject) => {
        db.get(`
            SELECT 
                (SELECT COUNT(*) FROM prime_segments) as segment_count,
                (SELECT value FROM database_metadata WHERE key = 'generation_status') as status
        `, (err, row) => {
            if (err) {
                reject(err);
                return;
            }
            
            if (row.segment_count > 0 && row.status === 'not_started') {
                db.run(`
                    UPDATE database_metadata 
                    SET value = 'in_progress', updated_at = CURRENT_TIMESTAMP 
                    WHERE key = 'generation_status'
                `, (updateErr) => {
                    if (updateErr) {
                        reject(updateErr);
                    } else {
                        console.log('✅ Status updated to "in_progress"');
                        resolve();
                    }
                });
            } else {
                console.log(`ℹ️  Status is already correct: ${row.status} (${row.segment_count} segments)`);
                resolve();
            }
        });
    }).finally(() => {
        db.close();
    });
}

if (require.main === module) {
    fixStatus().catch(console.error);
}

module.exports = { fixStatus };