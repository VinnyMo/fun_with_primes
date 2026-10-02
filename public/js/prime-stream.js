/* A reversible bounded window: range boundaries and absolute ordinals travel
   with each segment, so evicted segments can be regenerated without a history. */
(function (root) {
    'use strict';
    const math = typeof module !== 'undefined' && module.exports ? require('./prime-math.js') : root.PrimeMath;
    class PrimeStream {
        constructor() {
            this.segments = [];
            this.maxSegments = 12;
            this.explored = 0;
            this.largest = 0;
        }
        nextRange(direction) {
            if (direction === 'earlier') {
                const first = this.segments[0];
                if (!first || first.start === 2) return null;
                return { start: Math.max(2, first.start - math.SEGMENT_SIZE), end: first.start - 1 };
            }
            const last = this.segments.at(-1);
            const start = last ? last.end + 1 : 2;
            return start > math.MAX_VALUE ? null : { start, end: Math.min(math.MAX_VALUE, start + math.SEGMENT_SIZE - 1) };
        }
        accept(range, primes, direction) {
            const expected = this.nextRange(direction);
            if (!expected || expected.start !== range.start || expected.end !== range.end) throw new Error('Unexpected range.');
            let previous = range.start - 1;
            if (!Array.isArray(primes)) throw new Error('Invalid prime batch.');
            for (const prime of primes) {
                if (!Number.isSafeInteger(prime) || prime <= previous || prime > range.end) throw new Error('Unordered prime batch.');
                previous = prime;
            }
            const first = this.segments[0];
            const last = this.segments.at(-1);
            const startIndex = direction === 'earlier' ? first.startIndex - primes.length : last ? last.startIndex + last.primes.length : 1;
            if (startIndex < 1) throw new Error('Invalid prime positions.');
            const segment = { ...range, primes, startIndex };
            let removed = null;
            if (direction === 'earlier') {
                this.segments.unshift(segment);
                if (this.segments.length > this.maxSegments) removed = this.segments.pop();
            } else {
                this.segments.push(segment);
                if (this.segments.length > this.maxSegments) removed = this.segments.shift();
            }
            this.explored = Math.max(this.explored, startIndex + primes.length - 1);
            this.largest = Math.max(this.largest, primes.at(-1) || 0);
            return { segment, removed };
        }
    }
    if (typeof module !== 'undefined' && module.exports) module.exports = PrimeStream;
    else root.PrimeStream = PrimeStream;
})(typeof self !== 'undefined' ? self : globalThis);
