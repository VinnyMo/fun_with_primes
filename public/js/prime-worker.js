'use strict';
importScripts('prime-math.js?v=2026100201');
self.onmessage = function (event) {
    const { id, start, end } = event.data;
    const began = performance.now();
    try {
        self.postMessage({ type: 'result', id, start, end, primes: PrimeMath.segmentedSieve(start, end), duration: performance.now() - began });
    } catch (error) {
        self.postMessage({ type: 'error', id, error: error.message });
    }
};
