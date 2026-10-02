/* Opt-in rendered regression checks. Requires Playwright/Chromium and npm start.
   Every stage has a deadline and emits state on failure. The scroll diagnostic
   never asks an actionability retry loop to chase an auto-loading footer. */
'use strict';
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const url = process.env.PRIME_TEST_URL || 'http://127.0.0.1:3007/';
const ACTION_MS = 5000;
const PROGRESS_MS = 18000; // Includes the app's 15-second worker timeout.
const STAGE_MS = 45000;
let currentStage = 'browser launch';

async function deadline(promise, milliseconds, label) {
    let timer;
    try {
        return await Promise.race([promise, new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error(`${label}: exceeded ${milliseconds} ms`)), milliseconds);
        })]);
    } finally { clearTimeout(timer); }
}
async function snapshot(page) {
    return deadline(page.evaluate(() => {
        const app = window.primeApp;
        const modal = document.querySelector('#prime-modal');
        const describe = node => node ? { tag: node.tagName, id: node.id, prime: node.dataset?.prime, index: node.dataset?.index, html: node.outerHTML?.slice(0, 240) } : null;
        const rect = node => node ? { top: node.getBoundingClientRect().top, bottom: node.getBoundingClientRect().bottom } : null;
        return {
            readyState: document.readyState, hidden: document.hidden, hasFocus: document.hasFocus(),
            active: describe(document.activeElement), modalOpen: modal?.open,
            modalGeometry: modal ? { viewport: rect(modal), clientTop: modal.clientTop, clientHeight: modal.clientHeight, scrollTop: modal.scrollTop, scrollHeight: modal.scrollHeight, close: rect(document.querySelector('#close-modal')) } : null,
            pending: app?.pending ? { id: app.pending.id, direction: app.pending.direction, start: app.pending.start, end: app.pending.end, manual: app.pending.manual, focus: describe(app.pending.focus) } : null,
            requestId: app?.requestId, scrollFrame: app?.scrollFrame, errorDirection: app?.errorDirection,
            ranges: app?.stream.segments.map(s => ({ start: s.start, end: s.end, index: s.startIndex, count: s.primes.length })),
            scrollY, lastScrollY: app?.lastScrollY, height: innerHeight, documentHeight: document.body.scrollHeight,
            footer: rect(document.querySelector('#stream-footer')), container: rect(document.querySelector('#prime-container')),
            status: document.querySelector('#generation-state')?.textContent,
            batches: document.querySelectorAll('.prime-batch').length, buttons: document.querySelectorAll('.prime-number').length
        };
    }), 3000, 'diagnostic snapshot');
}
async function stage(page, name, run) {
    currentStage = name;
    console.log(`START ${name}`);
    try {
        const result = await deadline(run(), STAGE_MS, name);
        console.log(`PASS ${name}`);
        return result;
    } catch (error) {
        let state;
        try { state = await snapshot(page); } catch (diagnosticError) { state = { unavailable: diagnosticError.message }; }
        console.error(`FAIL ${name}\n${JSON.stringify(state, null, 2)}`);
        throw error;
    }
}
async function frames(page) {
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
async function idle(page) {
    // A !pending check alone can precede the queued scroll/rAF request.
    await frames(page);
    await page.waitForFunction(() => {
        if (window.primeApp?.errorDirection) throw new Error(document.querySelector('#generation-state').textContent);
        return window.primeApp && !window.primeApp.pending && window.primeApp.scrollFrame === null;
    }, null, { timeout: PROGRESS_MS });
    await frames(page);
    assert.equal(await page.evaluate(() => Boolean(window.primeApp.pending || window.primeApp.scrollFrame !== null)), false);
}
async function windowState(page) {
    return page.evaluate(() => {
        const segments = window.primeApp.stream.segments;
        return { first: segments[0].start, last: segments.at(-1).end, requestId: window.primeApp.requestId, count: segments.length };
    });
}
async function assertSequence(page) {
    const state = await page.evaluate(() => {
        const segments = window.primeApp.stream.segments;
        const buttons = Array.from(document.querySelectorAll('.prime-number'));
        return {
            ranges: segments.map(s => ({ start: s.start, end: s.end, index: s.startIndex, count: s.primes.length })),
            values: buttons.map(node => Number(node.dataset.prime)), indices: buttons.map(node => Number(node.dataset.index)),
            expected: segments.flatMap(s => s.primes), batches: document.querySelectorAll('.prime-batch').length
        };
    });
    assert.ok(state.ranges.length > 0 && state.ranges.length <= 12);
    assert.equal(state.batches, state.ranges.length);
    assert.deepEqual(state.values, state.expected);
    assert.equal(new Set(state.values).size, state.values.length);
    assert.ok(state.values.every((n, i) => n >= 2 && (i === 0 || n > state.values[i - 1])));
    state.indices.forEach((n, i) => assert.equal(n, state.ranges[0].index + i));
    for (let i = 1; i < state.ranges.length; i++) {
        assert.equal(state.ranges[i].start, state.ranges[i - 1].end + 1);
        assert.equal(state.ranges[i].index, state.ranges[i - 1].index + state.ranges[i - 1].count);
    }
}
async function waitForProgress(page, before, direction) {
    await page.waitForFunction(({ before, direction }) => {
        const app = window.primeApp;
        if (app.errorDirection) throw new Error(document.querySelector('#generation-state').textContent);
        const progress = direction === 'later' ? app.stream.segments.at(-1).end > before.last : app.stream.segments[0].start < before.first;
        return progress && !app.pending && app.scrollFrame === null;
    }, { before, direction }, { timeout: PROGRESS_MS });
    await idle(page);
    const after = await windowState(page);
    assert.equal(direction === 'later' ? after.last : after.first, (direction === 'later' ? before.last : before.first) + (direction === 'later' ? 1000 : -1000));
    assert.equal(after.requestId, before.requestId + 1, 'One deliberate action should start one request');
    await assertSequence(page);
}
async function scrollStep(page, direction) {
    await idle(page);
    // If already at an edge, move away first so the next gesture has a direction.
    const nudged = await page.evaluate(direction => {
        document.activeElement?.blur();
        const bottom = document.body.scrollHeight - innerHeight;
        if (direction === 'earlier' && scrollY <= 1) { scrollTo(0, 100); return true; }
        if (direction === 'later' && scrollY >= bottom - 1) { scrollTo(0, Math.max(0, bottom - 100)); return true; }
        return false;
    }, direction);
    if (nudged) await idle(page);
    const before = await page.evaluate(direction => {
        const app = window.primeApp, segments = app.stream.segments;
        document.activeElement?.blur();
        scrollTo(0, direction === 'later' ? document.body.scrollHeight : 0);
        const anchor = Array.from(document.querySelectorAll('.prime-number')).find(node => {
            const box = node.getBoundingClientRect(); return box.bottom > 0 && box.top < innerHeight;
        });
        return {
            first: segments[0].start, last: segments.at(-1).end, requestId: app.requestId,
            anchor: anchor ? { prime: anchor.dataset.prime, top: anchor.getBoundingClientRect().top } : null
        };
    }, direction);
    assert.ok(before.anchor, 'A visible prime must be available for the anchor check');
    await waitForProgress(page, before, direction);
    const top = await page.locator(`.prime-number[data-prime="${before.anchor.prime}"]`).evaluate(node => node.getBoundingClientRect().top);
    assert.ok(Math.abs(top - before.anchor.top) <= 2, `Anchor ${before.anchor.prime} moved ${top - before.anchor.top}px`);
}
async function manualStep(page, direction) {
    await idle(page);
    const before = await windowState(page);
    const selector = direction === 'later' ? '#load-more' : '#load-earlier';
    // Keyboard activation avoids pointer auto-scroll chasing the moving footer.
    await page.locator(selector).evaluate(node => node.focus({ preventScroll: true }));
    await page.keyboard.press('Enter');
    await waitForProgress(page, before, direction);
    const focus = await page.evaluate(direction => {
        const segment = direction === 'later' ? window.primeApp.stream.segments.at(-1) : window.primeApp.stream.segments[0];
        return { actual: Number(document.activeElement.dataset.index), expected: segment.startIndex };
    }, direction);
    assert.equal(focus.actual, focus.expected, 'Manual loading should focus the new batch');
}
async function holdWorkerResponse(page) {
    await page.evaluate(() => {
        const worker = window.primeApp.worker;
        window.__primeBrowserGate = { worker, handler: worker.onmessage, messages: [] };
        worker.onmessage = event => window.__primeBrowserGate.messages.push(event);
    });
}
async function releaseWorkerResponse(page) {
    await page.evaluate(() => {
        const gate = window.__primeBrowserGate;
        if (!gate) return;
        gate.worker.onmessage = gate.handler;
        delete window.__primeBrowserGate;
        for (const event of gate.messages) gate.handler.call(gate.worker, event);
    });
}
async function modalFocus(page) {
    const focus = await page.evaluate(() => ({ open: document.querySelector('#prime-modal').open, contained: document.querySelector('#prime-modal').contains(document.activeElement), hasFocus: document.hasFocus(), tag: document.activeElement.tagName, id: document.activeElement.id }));
    assert.ok(focus.open && focus.contained && focus.hasFocus, JSON.stringify(focus));
}

(async () => {
    const watchdog = setTimeout(() => { console.error(`FAIL suite deadline during ${currentStage}`); process.exit(1); }, 240000);
    let browser;
    try {
        browser = await chromium.launch({ timeout: 15000 });
        for (const size of [{ width: 320, height: 568 }, { width: 375, height: 667 }, { width: 768, height: 1024 }, { width: 1180, height: 757 }, { width: 812, height: 375 }]) {
            const label = `${size.width}x${size.height}`;
            const page = await browser.newPage({ viewport: size, reducedMotion: 'reduce' });
            page.setDefaultTimeout(ACTION_MS);
            page.setDefaultNavigationTimeout(10000);
            const errors = [];
            page.on('pageerror', error => errors.push(error.message));
            await stage(page, `${label} load and first screen`, async () => {
                await page.bringToFront();
                const response = await page.goto(url);
                assert.equal(response.status(), 200);
                await page.locator('.prime-number').first().waitFor();
                await idle(page);
                const box = await page.locator('.prime-number').first().boundingBox();
                assert.ok(box.y + box.height < size.height, 'First prime above fold');
                for (const id of ['session-stats', 'project-story']) assert.equal(await page.locator(`#${id}`).getAttribute('open'), null);
                assert.equal(await page.locator('.prime-number').first().evaluate(node => getComputedStyle(node).animationName), 'none');
                assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
            });
            await stage(page, `${label} disclosures`, async () => {
                await page.locator('#project-story summary').click();
                await page.locator('#project-story pre').waitFor();
                for (const text of [/2012–2013/, /November 5, 2016/, /2026/]) assert.match(await page.locator('#project-story').innerText(), text);
                assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
                await page.locator('#close-story').click();
                const summary = page.locator('#project-story summary');
                assert.equal(await summary.evaluate(node => node === document.activeElement), true);
                const box = await summary.boundingBox();
                assert.ok(box.y >= 0 && box.y + box.height <= size.height);
                await page.locator('#session-stats summary').click();
                await page.keyboard.press('Escape');
                assert.equal(await page.locator('#session-stats').getAttribute('open'), null);
            });
            await stage(page, `${label} modal cycling and all exits`, async () => {
                const first = page.locator('.prime-number').first();
                for (const exit of ['Escape', 'Close', 'Backdrop']) {
                    await first.focus();
                    const y = await page.evaluate(() => scrollY);
                    await page.keyboard.press('Enter');
                    await page.waitForFunction(() => document.querySelector('#prime-modal').open);
                    assert.equal(await page.locator('#close-modal').evaluate(node => node === document.activeElement), true);
                    assert.equal(await page.locator('#prime-modal').evaluate(node => node.scrollTop), 0);
                    for (const key of ['Tab', 'Tab', 'Shift+Tab', 'Shift+Tab', 'Tab', 'Shift+Tab']) { await page.keyboard.press(key); await modalFocus(page); }
                    // Short landscape can scroll the only control out of view.
                    // Cycling must reveal that focused control inside the dialog.
                    for (const key of ['Tab', 'Shift+Tab']) {
                        await page.locator('#prime-modal').evaluate(node => { node.scrollTop = node.scrollHeight; });
                        await page.keyboard.press(key);
                        await modalFocus(page);
                        const visibleClose = await page.evaluate(() => {
                            const dialog = document.querySelector('#prime-modal').getBoundingClientRect();
                            const close = document.querySelector('#close-modal').getBoundingClientRect();
                            return close.top >= dialog.top && close.bottom <= dialog.bottom;
                        });
                        assert.equal(visibleClose, true, `${key} reveals Close within the scrollable dialog`);
                        assert.ok(Math.abs(await page.evaluate(() => scrollY) - y) <= 2, 'Internal modal scrolling must not move the page');
                    }
                    await first.evaluate(node => node.focus()); // Background remains inert.
                    await modalFocus(page);
                    if (exit === 'Escape') await page.keyboard.press('Escape');
                    else if (exit === 'Close') await page.locator('#close-modal').click();
                    else await page.mouse.click(1, 1);
                    await page.waitForFunction(() => !document.querySelector('#prime-modal').open);
                    assert.equal(await first.evaluate(node => node === document.activeElement), true);
                    assert.ok(Math.abs(await page.evaluate(() => scrollY) - y) <= 2, 'Closing restores focus without moving the page');
                }
                await page.keyboard.press('Tab');
                assert.equal(await page.evaluate(() => document.activeElement.dataset.index), '2', 'Closed dialog must not trap ordinary Tab');
            });
            await stage(page, `${label} keyboard More`, () => manualStep(page, 'later'));
            for (let i = 0; i < 18; i++) await stage(page, `${label} forward scroll ${i + 1}/18`, () => scrollStep(page, 'later'));
            assert.ok((await windowState(page)).first > 2);
            await stage(page, `${label} reverse while response is pending`, async () => {
                await idle(page);
                const before = await windowState(page);
                await holdWorkerResponse(page);
                try {
                    await page.evaluate(() => { document.activeElement?.blur(); scrollTo(0, document.body.scrollHeight); });
                    await page.waitForFunction(() => window.primeApp.pending && window.__primeBrowserGate.messages.length === 1, null, { timeout: ACTION_MS });
                    await page.evaluate(() => scrollTo(0, 0));
                    await frames(page);
                    await releaseWorkerResponse(page);
                    await idle(page);
                    const after = await windowState(page);
                    assert.equal(after.first, before.first);
                    assert.equal(after.last, before.last, 'Visible oldest segment must not be evicted after reversing');
                    assert.match(await page.locator('#generation-state').innerText(), /Scroll farther down/);
                    await manualStep(page, 'earlier');
                } finally { await releaseWorkerResponse(page); }
            });
            const reverseSteps = ((await windowState(page)).first - 2) / 1000;
            assert.ok(Number.isInteger(reverseSteps) && reverseSteps < 30);
            for (let i = 0; i < reverseSteps; i++) await stage(page, `${label} reverse scroll ${i + 1}/${reverseSteps}`, () => scrollStep(page, 'earlier'));
            assert.equal((await windowState(page)).first, 2);
            await stage(page, `${label} rapid manual requests remain serialized`, async () => {
                await idle(page);
                // Move down first so a legitimate eviction is offscreen.
                await page.evaluate(() => { document.activeElement?.blur(); scrollTo(0, document.body.scrollHeight - innerHeight - 500); });
                await idle(page);
                const before = await windowState(page);
                await holdWorkerResponse(page);
                try {
                    await page.locator('#load-more').evaluate(node => node.focus({ preventScroll: true }));
                    for (let i = 0; i < 5; i++) await page.keyboard.press('Enter');
                    await page.waitForFunction(() => window.__primeBrowserGate.messages.length === 1, null, { timeout: ACTION_MS });
                    assert.equal((await windowState(page)).requestId, before.requestId + 1);
                    await releaseWorkerResponse(page);
                    await waitForProgress(page, before, 'later');
                } finally { await releaseWorkerResponse(page); }
            });
            assert.deepEqual(errors, []);
            await page.close();
            await new Promise(resolve => setTimeout(resolve, 1100)); // Server's 10-request/second limit.
        }
        const noJS = await browser.newPage({ javaScriptEnabled: false });
        noJS.setDefaultTimeout(ACTION_MS);
        await stage(noJS, 'no JavaScript', async () => {
            await noJS.goto(url, { timeout: 10000 });
            assert.equal(await noJS.locator('#stream-footer').isVisible(), false);
            assert.equal(await noJS.locator('noscript').isVisible(), true);
        });
        await noJS.close();
        console.log('Rendered viewport, modal, disclosures, anchored forward/reverse scrolling, serialized requests, reduced-motion and no-JavaScript checks passed.');
    } finally {
        try {
            if (browser) await deadline(browser.close(), 5000, 'browser cleanup');
        } finally { clearTimeout(watchdog); }
    }
})().catch(error => { console.error(`Failure in ${currentStage}:`, error); process.exitCode = 1; });
