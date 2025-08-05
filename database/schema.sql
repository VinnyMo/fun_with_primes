-- Prime Database Schema
-- Designed for 10 billion primes, easily upgradeable to 100+ billion

CREATE TABLE IF NOT EXISTS prime_segments (
    segment_id INTEGER PRIMARY KEY,
    start_index BIGINT NOT NULL,       -- Using BIGINT for future 100B+ expansion
    end_index BIGINT NOT NULL,
    start_prime BIGINT NOT NULL,
    segment_size INTEGER NOT NULL,     -- Number of primes in this segment
    compressed_deltas BLOB NOT NULL,   -- Delta-encoded gaps (VLInt format)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    checksum TEXT                      -- For data integrity verification
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_prime_index_range ON prime_segments(start_index, end_index);
CREATE INDEX IF NOT EXISTS idx_segment_id ON prime_segments(segment_id);

-- Metadata table for database info and configuration
CREATE TABLE IF NOT EXISTS database_metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Initial metadata
INSERT OR REPLACE INTO database_metadata (key, value) VALUES 
    ('version', '1.0'),
    ('target_prime_count', '10000000000'),  -- 10 billion
    ('segment_size', '1000000'),            -- 1M primes per segment
    ('generation_status', 'not_started'),
    ('last_generated_index', '0'),
    ('total_segments', '10000'),
    ('compression_method', 'varint_delta');

-- Progress tracking table for resumable generation
CREATE TABLE IF NOT EXISTS generation_progress (
    id INTEGER PRIMARY KEY,
    current_segment INTEGER NOT NULL,
    current_number BIGINT NOT NULL,
    primes_generated BIGINT NOT NULL,
    start_time TIMESTAMP NOT NULL,
    last_update TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    estimated_completion TIMESTAMP
);