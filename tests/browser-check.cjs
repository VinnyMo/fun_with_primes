/* Opt-in rendered regression checks. Requires Playwright in the testing
   environment and a running npm start. Not part of the dependency-free tests. */
'use strict';
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const url = process.env.PRIME_TEST_URL || 'http://127.0.0.1:3007/';
(async () => {
    const browser = await chromium.launch();
    try {
        for (const size of [{ width: 320, height: 568 }, { width: 375, height: 667 }, { width: 768, height: 1024 }, { width: 1180, height: 757 }, { width: 812, height: 375 }]) {
            const page = await browser.newPage({ viewport: size, reducedMotion: 'reduce' });
            const errors = [];
            page.on('pageerror', error => errors.push(error.message));
            await page.goto(url);
            await page.locator('.prime-number').first().waitFor();
            const first = page.locator('.prime-number').first();
            const box = await first.boundingBox();
            assert.ok(box.y + box.height < size.height, `First prime above fold at ${size.width}×${size.height}`);
            assert.equal(await page.locator('#session-stats').getAttribute('open'), null);
            assert.equal(await page.locator('#project-story').getAttribute('open'), null);
            assert.equal(await first.evaluate(node => getComputedStyle(node).animationName), 'none');
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
            await page.locator('#project-story summary').click();
            await page.locator('#project-story pre').waitFor();
            assert.match(await page.locator('#project-story').innerText(), /2012–2013/);
            assert.match(await page.locator('#project-story').innerText(), /November 5, 2016/);
            assert.match(await page.locator('#project-story').innerText(), /2026/);
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'Open museum must not overflow the page');
            await page.locator('#close-story').click();
            const summary = page.locator('#project-story summary');
            assert.equal(await summary.evaluate(node => node === document.activeElement), true);
            const summaryBox = await summary.boundingBox();
            assert.ok(summaryBox.y >= 0 && summaryBox.y + summaryBox.height <= size.height, 'Story summary visible after closing at bottom');
            await page.locator('#session-stats summary').click();
            await page.keyboard.press('Escape');
            assert.equal(await page.locator('#session-stats').getAttribute('open'), null);
            for (let i = 0; i < 2; i++) {
                await first.focus(); await page.keyboard.press('Enter');
                await page.waitForFunction(() => document.querySelector('#prime-modal').open);
                assert.equal(await page.locator('#close-modal').evaluate(node => node === document.activeElement), true);
                await page.keyboard.press('Tab');
                assert.equal(await page.evaluate(() => document.querySelector('#prime-modal').contains(document.activeElement)), true);
                await page.keyboard.press('Escape');
                assert.equal(await first.evaluate(node => node === document.activeElement), true);
            }
            // Keyboard More puts focus into the newly available sequence.
            await page.locator('#load-more').focus();
            await page.keyboard.press('Enter');
            await page.waitForFunction(() => document.activeElement.matches('.prime-number') && Number(document.activeElement.dataset.prime) > 1001);
            // Exercise repeated/long scrolling past the retention bound.
            for (let i = 0; i < 18; i++) {
                await page.evaluate(() => { document.activeElement.blur(); window.scrollTo(0, document.body.scrollHeight); });
                await page.waitForFunction(() => !window.primeApp.pending);
                await page.locator('#load-more').click();
                await page.waitForFunction(() => !window.primeApp.pending);
            }
            const later = await page.evaluate(() => ({ count: document.querySelectorAll('.prime-batch').length, starts: window.primeApp.stream.segments.map(s => s.start), primes: Array.from(document.querySelectorAll('.prime-number'), n => Number(n.dataset.prime)) }));
            assert.ok(later.count <= 12);
            assert.ok(later.starts[0] > 2);
            assert.equal(new Set(later.primes).size, later.primes.length);
            assert.ok(later.primes.every((n, i) => i === 0 || n > later.primes[i - 1]));
            // Reverse direction while generation is pending, then recover earlier.
            await page.evaluate(() => { document.activeElement.blur(); window.scrollTo(0, 0); });
            await page.waitForFunction(() => !window.primeApp.pending);
            await page.locator('#load-earlier').click();
            await page.waitForFunction(() => !window.primeApp.pending);
            assert.ok(await page.evaluate(start => window.primeApp.stream.segments[0].start < start, later.starts[0]));
            assert.deepEqual(errors, []);
            await page.close();
            // The stock server deliberately rate-limits requests to 10/second.
            await new Promise(resolve => setTimeout(resolve, 1100));
        }
        const noJS = await browser.newPage({ javaScriptEnabled: false });
        await noJS.goto(url);
        assert.equal(await noJS.locator('#stream-footer').isVisible(), false);
        assert.equal(await noJS.locator('noscript').isVisible(), true);
        await noJS.close();
        console.log('Rendered viewport, keyboard, modal, long/reverse scroll, reduced-motion, museum and no-JS checks passed.');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
