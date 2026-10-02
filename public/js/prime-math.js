/* Shared, dependency-free mathematics. Used in the worker and the details view. */
(function (root) {
    'use strict';
    const MAX_VALUE = 1_000_000_000_000;
    const SEGMENT_SIZE = 1000;
    let baseLimit = 1;
    let basePrimes = [];

    function primesThrough(limit) {
        if (limit <= baseLimit) return basePrimes;
        baseLimit = Math.min(1_000_000, Math.ceil(limit / 1000) * 1000);
        const composite = new Uint8Array(baseLimit + 1);
        for (let p = 2; p * p <= baseLimit; p++) {
            if (!composite[p]) {
                for (let multiple = p * p; multiple <= baseLimit; multiple += p) composite[multiple] = 1;
            }
        }
        basePrimes = [];
        for (let p = 2; p <= baseLimit; p++) if (!composite[p]) basePrimes.push(p);
        return basePrimes;
    }

    function segmentedSieve(start, end) {
        if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 2 || end < start || end > MAX_VALUE || end - start >= SEGMENT_SIZE) {
            throw new RangeError('Expected a range of at most 1,000 integers between 2 and 1 trillion.');
        }
        const composite = new Uint8Array(end - start + 1);
        for (const p of primesThrough(Math.floor(Math.sqrt(end)))) {
            if (p * p > end) break;
            for (let multiple = Math.max(p * p, Math.ceil(start / p) * p); multiple <= end; multiple += p) composite[multiple - start] = 1;
        }
        const primes = [];
        for (let i = 0; i < composite.length; i++) if (!composite[i]) primes.push(start + i);
        return primes;
    }

    function modPow(base, exponent, modulus) {
        let result = 1n;
        for (base %= modulus; exponent > 0n; exponent >>= 1n) {
            if (exponent & 1n) result = (result * base) % modulus;
            base = (base * base) % modulus;
        }
        return result;
    }

    // Deterministic Miller–Rabin for unsigned 64-bit integers. All accepted
    // JavaScript safe integers are inside that range; BigInt avoids rounding.
    function isPrime(value) {
        if (!Number.isSafeInteger(value) || value < 2) return false;
        for (const p of [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37]) {
            if (value % p === 0) return value === p;
        }
        const n = BigInt(value);
        let d = n - 1n;
        let r = 0;
        while (!(d & 1n)) { d >>= 1n; r++; }
        for (const witness of [2n, 325n, 9375n, 28178n, 450775n, 9780504n, 1795265022n]) {
            if (witness % n === 0n) continue;
            let x = modPow(witness, d, n);
            if (x === 1n || x === n - 1n) continue;
            let passed = false;
            for (let j = 1; j < r; j++) {
                x = (x * x) % n;
                if (x === n - 1n) { passed = true; break; }
            }
            if (!passed) return false;
        }
        return true;
    }
    const api = { MAX_VALUE, SEGMENT_SIZE, segmentedSieve, isPrime };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.PrimeMath = api;
})(typeof self !== 'undefined' ? self : globalThis);
