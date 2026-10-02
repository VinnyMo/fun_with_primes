'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { segmentedSieve, isPrime, MAX_VALUE } = require('../public/js/prime-math');
const PrimeStream = require('../public/js/prime-stream');
function trial(n) {
    if (n < 2) return false;
    for (let i = 2; i * i <= n; i++) if (n % i === 0) return false;
    return true;
}
function reference(start, end) { return Array.from({ length: end - start + 1 }, (_, i) => start + i).filter(trial); }

test('segmented sieve agrees with independent trial division at joins and square boundaries', () => {
    for (const [start, end] of [[2, 1001], [1002, 2001], [2002, 3001], [49, 121], [997, 1996], [99901, 100900], [1_000_001, 1_001_000], [90, 96]]) {
        assert.deepEqual(segmentedSieve(start, end), reference(start, end));
    }
});
test('sieve and deterministic primality cover known strong pseudoprimes and upper limit', () => {
    for (let i = 0; i < 10000; i++) assert.equal(isPrime(i), trial(i), String(i));
    for (const n of [561, 1105, 1729, 3215031751, 341550071728321, Number.MAX_SAFE_INTEGER]) assert.equal(isPrime(n), false, String(n));
    assert.equal(isPrime(999999999989), true);
    assert.deepEqual(segmentedSieve(MAX_VALUE - 30, MAX_VALUE), reference(MAX_VALUE - 30, MAX_VALUE));
    for (const range of [[0, 100], [2, 1002], [2.5, 100], [100, 2], [MAX_VALUE, MAX_VALUE + 1], [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER + 1]]) assert.throws(() => segmentedSieve(...range), RangeError);
    for (const n of [NaN, Infinity, 1.5, -7, Number.MAX_SAFE_INTEGER + 1]) assert.equal(isPrime(n), false);
});
test('bounded stream preserves exact ordinals through long forward and reverse exploration', () => {
    const stream = new PrimeStream();
    const all = reference(2, 40001);
    function step(direction) {
        const range = stream.nextRange(direction);
        if (!range) return;
        const primes = segmentedSieve(range.start, range.end);
        stream.accept(range, primes, direction);
        assert.ok(stream.segments.length <= 12);
        const flat = stream.segments.flatMap(segment => segment.primes);
        const index = stream.segments[0].startIndex - 1;
        assert.deepEqual(flat, all.slice(index, index + flat.length));
        assert.equal(new Set(flat).size, flat.length);
        for (let i = 1; i < stream.segments.length; i++) assert.equal(stream.segments[i].start, stream.segments[i - 1].end + 1);
    }
    for (let i = 0; i < 40; i++) step('later');
    for (let i = 0; i < 28; i++) step('earlier');
    assert.equal(stream.segments[0].startIndex, 1);
    assert.equal(stream.nextRange('earlier'), null);
    for (let i = 0; i < 28; i++) { step('later'); if (i % 3 === 0) { step('earlier'); step('later'); } }
    assert.equal(stream.explored, all.length);
});
test('empty segments advance the scanned range without corrupting ordinals', () => {
    const stream = new PrimeStream();
    stream.segments = [{ start: 2, end: 89, startIndex: 1, primes: reference(2, 89) }];
    const range = stream.nextRange('later');
    stream.accept(range, [], 'later');
    assert.equal(stream.nextRange('later').start, range.end + 1);
    assert.equal(stream.segments[1].startIndex, 25);
});
test('rejects stale, duplicate and unordered batches without mutating the window', () => {
    const stream = new PrimeStream();
    const range = stream.nextRange('later');
    for (const primes of [[2, 2], [3, 2], [1], [1009], [2.2], null]) assert.throws(() => stream.accept(range, primes, 'later'));
    assert.equal(stream.segments.length, 0);
    stream.accept(range, segmentedSieve(range.start, range.end), 'later');
    assert.throws(() => stream.accept(range, [2], 'later'));
    assert.equal(stream.segments.length, 1);
});
test('last range clamps at the declared bound and never crosses safe integer space', () => {
    const stream = new PrimeStream();
    stream.segments = [{ start: MAX_VALUE - 1500, end: MAX_VALUE - 501, startIndex: 1, primes: [] }];
    const range = stream.nextRange('later');
    assert.deepEqual(range, { start: MAX_VALUE - 500, end: MAX_VALUE });
    stream.accept(range, segmentedSieve(range.start, range.end), 'later');
    assert.equal(stream.nextRange('later'), null);
});
