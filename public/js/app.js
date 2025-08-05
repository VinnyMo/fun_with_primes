// Multi-Core Prime Generator Application
class PrimeGeneratorApp {
    constructor() {
        this.workers = [];
        this.workerCount = navigator.hardwareConcurrency || 4;
        this.allPrimes = [];
        this.maxPrimeGenerated = 1; // Track highest number we've checked
        this.statistics = {
            totalPrimes: 0,
            largestPrime: 2,
            totalCalculationTime: 0 // Track cumulative calculation time
        };
        this.isGenerating = false;
        this.primesPerPage = 200; // Only generate this many at a time
        
        this.initializeWorkers();
        this.bindEvents();
        this.updateStatistics();
        this.generateInitialBatch();
    }

    initializeWorkers() {
        console.log(`Initializing ${this.workerCount} workers...`);
        
        for (let i = 0; i < this.workerCount; i++) {
            const worker = new Worker('js/prime-worker.js');
            worker.onmessage = (e) => this.handleWorkerMessage(e, i);
            worker.onerror = (error) => console.error(`Worker ${i} error:`, error);
            
            this.workers.push({
                worker: worker,
                id: i,
                busy: false,
                currentRange: null
            });
        }
    }

    bindEvents() {
        let scrollTimeout;
        
        // Improved scroll handling - generate earlier to stay ahead
        window.addEventListener('scroll', () => {
            clearTimeout(scrollTimeout);
            
            // Start generating when 70% through current content (much earlier buffer)
            const scrollPercentage = (window.innerHeight + window.scrollY) / document.body.offsetHeight;
            
            if (scrollPercentage > 0.7 && !this.isGenerating) {
                console.log(`At ${Math.round(scrollPercentage * 100)}% - generating more primes`);
                this.generateNextBatch();
            }
            
            // Stop generation when scrolling stops
            scrollTimeout = setTimeout(() => {
                if (this.isGenerating) {
                    console.log('Stopping generation - user stopped scrolling');
                    this.stopGeneration();
                }
            }, 2000);
        });

        // Prime click handling
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('prime-number')) {
                const primeValue = parseInt(e.target.textContent.replace(/,/g, ''));
                this.showPrimeModal(primeValue);
            }
        });

        // Modal close handling
        document.addEventListener('click', (e) => {
            const modal = document.getElementById('prime-modal');
            if (e.target === modal || e.target.classList.contains('close')) {
                modal.style.display = 'none';
            }
        });

        // Performance monitoring
        setInterval(() => {
            this.updateStatistics();
        }, 1000);
    }

    handleWorkerMessage(e, workerId) {
        const { type, primes, start, end, duration, primesPerSecond, error } = e.data;

        switch (type) {
            case 'result':
                this.workers[workerId].busy = false;
                this.statistics.activeWorkers--;
                
                if (primes && primes.length > 0) {
                    console.log(`Worker ${workerId} generated ${primes.length} primes from ${start} to ${end} in ${duration}ms`);
                    console.log(`First few primes:`, primes.slice(0, 10));
                    
                    // Add new primes to our collection
                    this.allPrimes = this.allPrimes.concat(primes);
                    this.allPrimes.sort((a, b) => a - b); // Keep sorted
                    
                    // Display the new primes
                    this.displayPrimes();
                    
                    this.statistics.totalPrimes = this.allPrimes.length;
                    this.statistics.largestPrime = Math.max(this.statistics.largestPrime, ...primes);
                    this.statistics.totalCalculationTime += duration || 0; // Add to cumulative time
                    this.maxPrimeGenerated = end;
                }
                
                // This batch is complete, stop generating
                this.stopGeneration();
                break;

            case 'error':
                console.error(`Worker ${workerId} error:`, error);
                this.workers[workerId].busy = false;
                this.stopGeneration();
                break;
        }
    }

    displayPrimes() {
        const container = document.getElementById('prime-container');
        
        // Use virtual scrolling approach - only show what's needed
        const maxDisplayedPrimes = 1000; // Limit for performance
        const primesToShow = this.allPrimes.slice(0, maxDisplayedPrimes);
        
        // Batch DOM updates using requestAnimationFrame
        this.scheduleDisplayUpdate(container, primesToShow);
        
        console.log(`Displaying ${primesToShow.length} of ${this.allPrimes.length} primes. First: ${this.allPrimes[0]}, Last: ${primesToShow[primesToShow.length - 1]}`);
        
        // Show indicator if we have more primes than displayed
        if (this.allPrimes.length > maxDisplayedPrimes) {
            this.showMorePrimesIndicator(maxDisplayedPrimes);
        }
    }

    scheduleDisplayUpdate(container, primesToShow) {
        // Use requestAnimationFrame for smooth updates
        requestAnimationFrame(() => {
            // Use efficient batch processing
            const batchSize = 100;
            let currentIndex = 0;
            
            const processBatch = () => {
                const fragment = document.createDocumentFragment();
                const endIndex = Math.min(currentIndex + batchSize, primesToShow.length);
                
                // Clear container only on first batch
                if (currentIndex === 0) {
                    container.innerHTML = '';
                }
                
                for (let i = currentIndex; i < endIndex; i++) {
                    const primeElement = document.createElement('div');
                    primeElement.className = 'prime-number';
                    primeElement.textContent = primesToShow[i].toLocaleString();
                    fragment.appendChild(primeElement);
                }
                
                container.appendChild(fragment);
                currentIndex = endIndex;
                
                // Continue processing if more batches remain
                if (currentIndex < primesToShow.length) {
                    requestAnimationFrame(processBatch);
                }
            };
            
            processBatch();
        });
    }

    showMorePrimesIndicator(displayedCount) {
        const container = document.getElementById('prime-container');
        const indicator = document.createElement('div');
        indicator.className = 'more-primes-indicator';
        indicator.innerHTML = `
            <div class="indicator-content">
                + ${(this.allPrimes.length - displayedCount).toLocaleString()} more primes generated<br>
                <small>Showing first ${displayedCount.toLocaleString()} for performance</small>
            </div>
        `;
        container.appendChild(indicator);
    }

    generateInitialBatch() {
        console.log('Generating initial batch of primes');
        this.generateNextBatch();
    }

    generateNextBatch() {
        if (this.isGenerating) return;
        
        this.isGenerating = true;
        
        // Calculate range for next batch  
        let start, end;
        
        if (this.allPrimes.length === 0) {
            // First batch - start from 2
            start = 2;
            end = 2000; // Larger first batch to get ahead
        } else {
            // Subsequent batches - continue from where we left off
            start = this.maxPrimeGenerated + 1;
            end = start + 5000; // Larger batch size to stay ahead of scrolling
        }
        
        console.log(`Starting generation from ${start} to ${end}`);
        
        // Use first available worker
        const worker = this.workers[0];
        worker.busy = true;
        
        // Send work to worker
        worker.worker.postMessage({
            type: 'generate',
            start: start,
            end: end,
            workerId: 0
        });
        
        document.getElementById('loading-indicator').style.display = 'block';
    }

    stopGeneration() {
        this.isGenerating = false;
        
        this.workers.forEach(worker => {
            worker.busy = false;
        });
        
        document.getElementById('loading-indicator').style.display = 'none';
    }

    // Remove the old complex methods and keep it simple

    updateStatistics() {
        // Update DOM elements
        document.getElementById('core-count').textContent = this.workerCount;
        document.getElementById('prime-count').textContent = this.statistics.totalPrimes.toLocaleString();
        document.getElementById('largest-prime').textContent = this.statistics.largestPrime.toLocaleString();
        
        // Update current range
        const rangeStart = this.allPrimes.length > 0 ? this.allPrimes[0] : 2;
        const rangeEnd = this.maxPrimeGenerated;
        document.getElementById('current-range').textContent = 
            `${rangeStart.toLocaleString()} - ${rangeEnd.toLocaleString()}`;
        
        // Update total calculation time
        const totalSeconds = this.statistics.totalCalculationTime / 1000;
        document.getElementById('total-calc-time').textContent = `${totalSeconds.toFixed(1)}s`;
    }

    // Performance monitoring methods
    clearAllPrimes() {
        // Clear displayed primes
        document.getElementById('prime-container').innerHTML = '';
        
        // Reset state
        this.allPrimes = [];
        this.maxPrimeGenerated = 1;
        this.statistics.totalPrimes = 0;
        this.statistics.largestPrime = 2;
        this.statistics.totalCalculationTime = 0;
        
        this.updateStatistics();
        console.log('All primes cleared');
    }

    showPrimeModal(prime) {
        const modal = document.getElementById('prime-modal');
        const modalInfo = document.getElementById('modal-prime-info');
        
        // Find the position of this prime in our list (1-indexed)
        const primeIndex = this.allPrimes.indexOf(prime) + 1;
        
        // Run independent primality test
        const isPrimeConfirmed = this.millerRabinTest(prime);
        
        // Generate prime properties
        const properties = this.getPrimeProperties(prime);
        
        modalInfo.innerHTML = `
            <div class="prime-detail">
                <strong>Prime Number:</strong>
                <span class="detail-content">${prime.toLocaleString()}</span>
            </div>
            <div class="prime-detail">
                <strong>Position:</strong>
                <span class="detail-content">${primeIndex === 0 ? 'Unknown' : `${primeIndex.toLocaleString()} (${this.getOrdinal(primeIndex)} prime)`}</span>
            </div>
            <div class="prime-detail verification">
                <strong>Verification:</strong>
                <span class="detail-content">${isPrimeConfirmed ? '✓ Confirmed Prime' : '✗ Not Prime'} (Miller-Rabin Test)</span>
            </div>
            <div class="prime-detail">
                <strong>Binary:</strong>
                <span class="detail-content">${prime.toString(2)}</span>
            </div>
            <div class="prime-detail">
                <strong>Hexadecimal:</strong>
                <span class="detail-content">0x${prime.toString(16).toUpperCase()}</span>
            </div>
            <div class="prime-detail">
                <strong>Digit Sum:</strong>
                <span class="detail-content">${properties.digitSum}</span>
            </div>
            <div class="prime-detail">
                <strong>Type:</strong>
                <span class="detail-content">${properties.type}</span>
            </div>
            ${properties.special ? `<div class="prime-detail"><strong>Special:</strong><span class="detail-content">${properties.special}</span></div>` : ''}
        `;
        
        modal.style.display = 'block';
    }

    millerRabinTest(n, k = 5) {
        if (n < 2) return false;
        if (n === 2 || n === 3) return true;
        if (n % 2 === 0) return false;

        // Write n-1 as d * 2^r
        let d = n - 1;
        let r = 0;
        while (d % 2 === 0) {
            d /= 2;
            r++;
        }

        // Witness loop
        for (let i = 0; i < k; i++) {
            const a = 2 + Math.floor(Math.random() * (n - 4));
            let x = this.modPow(a, d, n);

            if (x === 1 || x === n - 1) continue;

            let composite = true;
            for (let j = 0; j < r - 1; j++) {
                x = (x * x) % n;
                if (x === n - 1) {
                    composite = false;
                    break;
                }
            }

            if (composite) return false;
        }
        return true;
    }

    modPow(base, exp, mod) {
        let result = 1;
        base = base % mod;
        while (exp > 0) {
            if (exp % 2 === 1) {
                result = (result * base) % mod;
            }
            exp = Math.floor(exp / 2);
            base = (base * base) % mod;
        }
        return result;
    }

    getPrimeProperties(prime) {
        const digitSum = prime.toString().split('').reduce((sum, digit) => sum + parseInt(digit), 0);
        let type = 'Standard Prime';
        let special = null;

        // Check for special prime types
        if (prime < 10) type = 'Single-digit Prime';
        else if (this.isPalindrome(prime)) {
            type = 'Palindromic Prime';
            special = 'Reads the same forwards and backwards';
        } else if (this.isTwinPrime(prime)) {
            type = 'Twin Prime';
            special = 'Part of a twin prime pair (differ by 2)';
        } else if (this.isSophieGermain(prime)) {
            type = 'Sophie Germain Prime';  
            special = '2p + 1 is also prime';
        } else if (this.isSafe(prime)) {
            type = 'Safe Prime';
            special = '(p - 1) / 2 is also prime';
        }

        return { digitSum, type, special };
    }

    isPalindrome(n) {
        const str = n.toString();
        return str === str.split('').reverse().join('');
    }

    isTwinPrime(p) {
        return this.millerRabinTest(p - 2) || this.millerRabinTest(p + 2);
    }

    isSophieGermain(p) {
        return this.millerRabinTest(2 * p + 1);
    }

    isSafe(p) {
        return (p - 1) % 2 === 0 && this.millerRabinTest((p - 1) / 2);
    }

    getOrdinal(n) {
        const j = n % 10;
        const k = n % 100;
        if (j === 1 && k !== 11) return n + 'st';
        if (j === 2 && k !== 12) return n + 'nd';
        if (j === 3 && k !== 13) return n + 'rd';
        return n + 'th';
    }

    getMemoryUsage() {
        if (performance.memory) {
            return {
                used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
                total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
                limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
            };
        }
        return null;
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.primeApp = new PrimeGeneratorApp();
    
    // Add keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            window.primeApp.stopGeneration();
        }
        if (e.ctrlKey && e.key === 'r') {
            e.preventDefault();
            window.primeApp.startGeneration();
        }
    });
    
    console.log('Prime Generator App initialized!');
    console.log(`Using ${navigator.hardwareConcurrency || 4} CPU cores`);
});