// Optimized Prime Generation Web Worker
// Uses segmented sieve for efficient parallel processing

class OptimizedPrimeGenerator {
    constructor() {
        this.smallPrimes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47];
        this.cache = new Map();
    }

    // Generate small primes up to limit using simple sieve
    generateSmallPrimes(limit) {
        if (limit <= 47) {
            return this.smallPrimes.filter(p => p <= limit);
        }

        const sieve = new Array(limit + 1).fill(true);
        sieve[0] = sieve[1] = false;

        for (let i = 2; i * i <= limit; i++) {
            if (sieve[i]) {
                for (let j = i * i; j <= limit; j += i) {
                    sieve[j] = false;
                }
            }
        }

        const primes = [];
        for (let i = 2; i <= limit; i++) {
            if (sieve[i]) primes.push(i);
        }
        return primes;
    }

    // Optimized segmented sieve for large ranges
    segmentedSieve(start, end) {
        const segmentSize = end - start + 1;
        const segment = new Array(segmentSize).fill(true);
        const sqrtEnd = Math.sqrt(end);
        
        // Get all primes up to sqrt(end)
        const basePrimes = this.generateSmallPrimes(Math.floor(sqrtEnd));
        
        // Sieve the segment
        for (const prime of basePrimes) {
            // Find the minimum number in [start, end] that is a multiple of prime
            let startMultiple = Math.max(prime * prime, Math.ceil(start / prime) * prime);
            
            // Mark multiples as composite
            for (let j = startMultiple; j <= end; j += prime) {
                segment[j - start] = false;
            }
        }

        // Collect primes from segment
        const primes = [];
        for (let i = 0; i < segmentSize; i++) {
            const number = start + i;
            if (number > 1 && segment[i]) {
                primes.push(number);
            }
        }

        return primes;
    }

    // Main function to generate primes in range
    generatePrimes(start, end) {
        console.log(`Worker generating primes from ${start} to ${end}`);
        
        // Always use simple sieve for reliability - we'll optimize viewport instead
        return this.generateSmallPrimes(end).filter(p => p >= start);
    }

    // Trial division primality test for individual numbers
    isPrime(n) {
        if (n < 2) return false;
        if (n === 2) return true;
        if (n % 2 === 0) return false;
        
        const limit = Math.sqrt(n);
        for (let i = 3; i <= limit; i += 2) {
            if (n % i === 0) return false;
        }
        return true;
    }
}

// Worker message handler
const generator = new OptimizedPrimeGenerator();
let isGenerating = false;
let startTime = Date.now();

self.onmessage = function(e) {
    const { type, start, end, workerId } = e.data;

    switch (type) {
        case 'generate':
            if (isGenerating) return;
            
            isGenerating = true;
            startTime = Date.now();
            
            try {
                const primes = generator.generatePrimes(start, end);
                const duration = Date.now() - startTime;
                
                self.postMessage({
                    type: 'result',
                    primes: primes,
                    start: start,
                    end: end,
                    workerId: workerId,
                    duration: duration,
                    primesPerSecond: Math.round(primes.length / (duration / 1000))
                });
            } catch (error) {
                self.postMessage({
                    type: 'error',
                    error: error.message,
                    workerId: workerId
                });
            } finally {
                isGenerating = false;
            }
            break;

        case 'test-prime':
            const isPrime = generator.isPrime(e.data.number);
            self.postMessage({
                type: 'prime-test-result',
                number: e.data.number,
                isPrime: isPrime,
                workerId: workerId
            });
            break;

        case 'terminate':
            self.close();
            break;
    }
};