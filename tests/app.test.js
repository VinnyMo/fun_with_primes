'use strict';
// These tests execute the real app and worker scripts with a small DOM/Worker
// model. They check lifecycle/state transitions, not browser layout or native
// dialog focus containment; those still need a real-browser smoke test.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const PrimeMath = require('../public/js/prime-math');
const PrimeStream = require('../public/js/prime-stream');
const publicDir = path.join(__dirname, '../public');

function harness({ height = 768, workerFailures = 0 } = {}) {
    const listeners = new Map();
    const roots = [];
    const timers = new Map();
    const frames = [];
    const workers = [];
    let timerId = 0;
    const document = { hidden: false, activeElement: null };
    const window = {
        innerHeight: height, scrollX: 0, scrollY: 0,
        matchMedia: () => ({ matches: false }),
        getComputedStyle: node => ({ visibility: node.visibility || 'visible' }),
        addEventListener(name, fn) { listeners.set(name, fn); },
        scrollTo(x, y) { this.scrollX = x; this.scrollY = Math.max(0, y); }
    };
    class Element {
        constructor(tagName) {
            this.tagName = tagName;
            this.children = [];
            this.parent = null;
            this.events = new Map();
            this.attributes = new Map();
            this.dataset = {};
            this.className = '';
            this.textContent = '';
            this.open = false;
            this.hidden = false;
            this.disabled = false;
            this.scrollTop = 0;
            this.clientTop = 0;
            this.tabIndex = tagName === 'button' ? 0 : -1;
            this.classList = { add: name => { this.className += ` ${name}`; } };
        }
        addEventListener(name, fn) { this.events.set(name, fn); }
        emit(name, extra = {}) { this.events.get(name)?.({ target: this, ...extra }); }
        setAttribute(key, value) { this.attributes.set(key, value); }
        get isConnected() { return roots.some(root => root.contains(this)); }
        contains(node) { return node === this || this.children.some(child => child.contains(node)); }
        append(...nodes) {
            for (const node of nodes) {
                if (node.tagName === '#fragment') { this.append(...node.children.slice()); continue; }
                node.remove(); node.parent = this; this.children.push(node);
            }
        }
        prepend(node) { node.remove(); node.parent = this; this.children.unshift(node); }
        remove() {
            if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1);
            this.parent = null;
        }
        replaceChildren(...nodes) { for (const child of this.children.slice()) child.remove(); this.append(...nodes); }
        matches(selector) {
            if (selector.includes(',')) return selector.split(',').some(part => this.matches(part.trim()));
            if (selector === '[tabindex]') return this.attributes.has('tabindex');
            return selector.startsWith('.') ? this.className.split(' ').includes(selector.slice(1)) : this.tagName === selector;
        }
        querySelectorAll(selector) {
            return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]);
        }
        querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
        closest(selector) { return this.matches(selector) ? this : this.parent?.closest(selector); }
        focus(options) {
            this.lastFocusOptions = options;
            document.activeElement = this;
            listeners.get('document:focusin')?.({ target: this });
        }
        get clientHeight() { return this.getBoundingClientRect().height; }
        getClientRects() { return this.hidden ? [] : [this.getBoundingClientRect()]; }
        showModal() { this.open = true; }
        close() { this.open = false; this.emit('close'); }
        scrollIntoView() { window.scrollY += this.getBoundingClientRect().top; }
        getBoundingClientRect() {
            if (this.rect) return { ...this.rect };
            const container = document.getElementById('prime-container');
            const listHeight = list => Math.ceil(list.children.length / 8) * 78 + 8;
            let top = 300 - window.scrollY, nodeHeight = 40;
            if (this === container) nodeHeight = container.children.reduce((sum, list) => sum + listHeight(list), 0);
            else if (this.id === 'stream-footer') top += container.children.reduce((sum, list) => sum + listHeight(list), 0) + 28;
            else if (this.className === 'prime-batch') {
                const at = container.children.indexOf(this);
                top += container.children.slice(0, at).reduce((sum, list) => sum + listHeight(list), 0);
                nodeHeight = listHeight(this);
            } else if (this.matches('.prime-number')) {
                const item = this.parent, list = item.parent;
                top = list.getBoundingClientRect().top + Math.floor(list.children.indexOf(item) / 8) * 78;
                nodeHeight = 70;
            }
            return { top, bottom: top + nodeHeight, left: 0, right: 1000, height: nodeHeight };
        }
    }
    document.createElement = tag => new Element(tag);
    document.createDocumentFragment = () => new Element('#fragment');
    document.getElementById = id => {
        function find(node) { return node.id === id ? node : node.children.map(find).find(Boolean); }
        return roots.map(find).find(Boolean) || null;
    };
    document.addEventListener = (name, fn) => listeners.set(`document:${name}`, fn);
    // Read IDs from the real document so missing integration elements fail.
    const html = fs.readFileSync(path.join(publicDir, 'index.html'), 'utf8');
    for (const match of html.matchAll(/<([\w-]+)[^>]*\sid="([^"]+)"/g)) {
        const node = new Element(match[1]); node.id = match[2]; roots.push(node);
    }
    for (const root of roots.filter(node => node.tagName === 'details')) root.append(new Element('summary'));
    // Model dialog descendants rather than treating its controls as unrelated
    // roots, so application containment guards execute on a real hierarchy.
    const modal = document.getElementById('prime-modal');
    modal.append(document.getElementById('close-modal'), document.getElementById('prime-modal-title'), document.getElementById('modal-prime-info'));
    document.activeElement = document.getElementById('main-content');
    class Worker {
        constructor(url) {
            if (workerFailures-- > 0) throw new Error('Worker startup failure');
            this.url = url; this.messages = []; this.terminated = false; workers.push(this);
        }
        postMessage(message) {
            // Real workers reject DOM elements and functions. Keep local UI state
            // out of the transport and enforce the minimal numeric wire format.
            assert.deepEqual(Object.keys(message).sort(), ['end', 'id', 'start']);
            for (const value of Object.values(message)) assert.ok(Number.isSafeInteger(value));
            this.messages.push(structuredClone(message));
        }
        terminate() { this.terminated = true; }
        emit(message) { this.onmessage({ data: message }); }
    }
    const context = vm.createContext({
        PrimeMath, PrimeStream, document, window, Worker,
        setTimeout(fn, ms) { const id = ++timerId; timers.set(id, { fn, ms }); return id; },
        clearTimeout(id) { timers.delete(id); },
        requestAnimationFrame(fn) { frames.push(fn); return frames.length; }
    });
    vm.runInContext(fs.readFileSync(path.join(publicDir, 'js/app.js'), 'utf8'), context);
    listeners.get('document:DOMContentLoaded')();
    const app = window.primeApp;
    function complete(overrides = {}, worker = app.worker) {
        const request = worker.messages.at(-1);
        worker.emit({ type: 'result', ...request, primes: PrimeMath.segmentedSieve(request.start, request.end), duration: 2, ...overrides });
    }
    function scroll(y) { window.scrollY = y; listeners.get('scroll')(); frames.splice(0).forEach(fn => fn()); }
    function nearBottom() { window.scrollY += app.ui['stream-footer'].getBoundingClientRect().top - window.innerHeight + 200; }
    function fill(count) { complete(); for (let i = 1; i < count; i++) { app.load('later'); complete(); } }
    return { app, document, window, workers, timers, listeners, frames, complete, scroll, nearBottom, fill };
}

test('real worker imports the shared sieve and returns correlated results and errors', () => {
    const imports = [];
    const messages = [];
    const context = vm.createContext({ self: { postMessage: message => messages.push(message) }, performance });
    context.importScripts = relative => {
        imports.push(relative);
        vm.runInContext(fs.readFileSync(path.join(publicDir, 'js', relative.split('?')[0]), 'utf8'), context);
        context.PrimeMath = context.self.PrimeMath;
    };
    vm.runInContext(fs.readFileSync(path.join(publicDir, 'js/prime-worker.js'), 'utf8'), context);
    context.self.onmessage({ data: { id: 7, start: 2, end: 20 } });
    assert.deepEqual(Array.from(messages[0].primes), [2, 3, 5, 7, 11, 13, 17, 19]);
    assert.equal(messages[0].id, 7);
    assert.equal(messages[0].start, 2);
    assert.equal(messages[0].end, 20);
    assert.equal(messages[0].type, 'result');
    assert.ok(Number.isFinite(messages[0].duration) && messages[0].duration >= 0);
    context.self.onmessage({ data: { id: 8, start: 1, end: 20 } });
    assert.equal(messages[1].type, 'error');
    assert.equal(messages[1].id, 8);
    assert.match(imports[0], /^prime-math\.js\?v=/);
});

test('app serializes requests, rejects stale replies, and resolves workers under the app prefix', () => {
    const h = harness();
    const { app } = h;
    for (let i = 0; i < 10; i++) app.load('later', true);
    assert.equal(h.workers.length, 1);
    assert.equal(app.worker.messages.length, 1);
    assert.equal(h.timers.size, 1);
    const workerURL = new URL(app.worker.url, 'https://example.test/prime-generator/');
    assert.equal(workerURL.pathname, '/prime-generator/js/prime-worker.js');
    app.worker.emit({ id: app.pending.id + 1, type: 'result', start: 2, end: 1001, primes: [2] });
    assert.equal(app.stream.segments.length, 0);
    assert.ok(app.pending);
    h.complete();
    assert.equal(app.pending, null);
    assert.equal(h.timers.size, 0);
    assert.equal(app.stream.segments.length, 1);
    assert.equal(app.ui['prime-container'].querySelectorAll('.prime-number').length, 168);
    assert.equal(app.ui['prime-container'].querySelector('.prime-number').dataset.index, '1');
    assert.equal(app.ui['prime-container'].querySelector('.prime-number').dataset.prime, '2');
    assert.equal(app.ui['load-more'].attributes.get('aria-disabled'), 'false');
});

test('startup errors, timeouts, malformed ranges, and old workers recover without skipping a range', () => {
    const h = harness({ workerFailures: 1 });
    const { app } = h;
    assert.equal(app.pending, null);
    assert.equal(app.errorDirection, 'later');
    app.load('later', true);
    const original = { ...app.pending }, oldWorker = app.worker;
    const timeout = [...h.timers.values()][0];
    assert.equal(timeout.ms, 15000);
    timeout.fn();
    assert.equal(app.pending, null);
    assert.equal(oldWorker.terminated, true);
    assert.equal(app.ui['load-more'].attributes.get('aria-disabled'), 'false');
    app.load('later', true);
    assert.equal(app.pending.start, original.start);
    assert.equal(app.pending.end, original.end);
    assert.ok(app.pending.id > original.id);
    oldWorker.emit({ ...app.pending, type: 'result', primes: [2] });
    assert.equal(app.stream.segments.length, 0);
    h.complete({ start: 3 });
    assert.equal(app.stream.segments.length, 0);
    assert.equal(app.pending, null);
    app.load('later', true);
    h.complete({ primes: [2, 2] });
    assert.equal(app.stream.segments.length, 0);
    app.load('later', true);
    h.complete();
    assert.equal(app.stream.segments[0].start, 2);
    assert.equal(app.stream.segments[0].startIndex, 1);
    assert.equal(app.errorDirection, null);
    assert.equal(h.timers.size, 0);
});

test('worker errors and message errors expose retry and terminate the failed worker', () => {
    for (const event of ['onerror', 'onmessageerror']) {
        const h = harness();
        const worker = h.app.worker;
        worker[event]();
        assert.equal(worker.terminated, true);
        assert.equal(h.app.pending, null);
        assert.equal(h.app.ui['load-more'].textContent, 'Try again');
        h.app.ui['load-more'].emit('click');
        h.complete();
        assert.equal(h.app.stream.segments.length, 1);
    }
});

test('tall viewports get at most two initial batches and scrolling stays user-driven', () => {
    const h = harness({ height: 100000 });
    h.complete();
    assert.equal(h.app.worker.messages.length, 2);
    h.complete();
    assert.equal(h.app.worker.messages.length, 2);
    assert.equal(h.app.pending, null);
    h.scroll(1);
    assert.equal(h.app.worker.messages.length, 3);
    h.complete();
    assert.equal(h.app.worker.messages.length, 3);
    h.document.hidden = true;
    h.scroll(2);
    assert.equal(h.app.worker.messages.length, 3);
});

test('visible and focused eviction candidates are protected when a request finishes', () => {
    for (const protectFocus of [false, true]) {
        const h = harness(); h.fill(12);
        const first = h.app.ui['prime-container'].children[0];
        if (protectFocus) { h.nearBottom(); first.querySelector('.prime-number').focus(); }
        h.app.load('later'); h.complete();
        assert.equal(h.app.stream.segments.length, 12);
        assert.equal(h.app.stream.segments[0].start, 2);
        assert.equal(first.isConnected, true);
        assert.equal(h.app.pending, null);
        assert.equal(h.timers.size, 0);
        assert.equal(h.app.errorDirection, null);
        h.document.activeElement = null;
        h.nearBottom(); h.app.load('later'); h.complete();
        assert.equal(h.app.stream.segments[0].start, 1002);
        assert.equal(first.isConnected, false);
        assert.equal(h.app.ui['prime-container'].children.length, 12);
    }
});

test('pruning and reverse restoration keep visible anchor positions and absolute ordinals', () => {
    const h = harness(); h.fill(12); h.nearBottom();
    const firstVisible = () => h.app.ui['prime-container'].querySelectorAll('.prime-number').find(node => {
        const rect = node.getBoundingClientRect(); return rect.bottom > 0 && rect.top < h.window.innerHeight;
    });
    const anchor = firstVisible(), before = anchor.getBoundingClientRect().top;
    h.app.load('later'); h.complete();
    assert.equal(anchor.getBoundingClientRect().top, before);
    assert.equal(h.app.stream.segments[0].startIndex, 169);
    assert.equal(h.app.ui['prime-container'].querySelector('.prime-number').dataset.index, '169');
    h.window.scrollY = 350;
    const reverseAnchor = firstVisible(), reverseBefore = reverseAnchor.getBoundingClientRect().top;
    h.app.load('earlier'); h.complete();
    assert.equal(reverseAnchor.getBoundingClientRect().top, reverseBefore);
    assert.equal(h.app.stream.segments[0].start, 2);
    assert.equal(h.app.stream.segments[0].startIndex, 1);
    assert.equal(h.app.ui['prime-container'].children.length, 12);
    assert.equal(h.app.ui['earlier-controls'].hidden, true);
    const buttons = h.app.ui['prime-container'].querySelectorAll('.prime-number');
    buttons.forEach((button, index) => assert.equal(Number(button.dataset.index), index + 1));
    assert.equal(new Set(buttons.map(button => button.dataset.prime)).size, buttons.length);
});

test('modal requests pause new work and closing restores the selected prime focus', () => {
    const h = harness(); h.complete();
    const first = h.app.ui['prime-container'].querySelector('.prime-number');
    h.app.showPrime(first);
    assert.equal(h.app.ui['prime-modal'].open, true);
    assert.equal(h.app.ui['prime-modal-title'].textContent, '2');
    assert.equal(h.app.ui['modal-position'].textContent, 'Prime #1');
    assert.equal(h.document.activeElement, h.app.ui['close-modal']);
    h.app.load('later');
    assert.equal(h.app.pending, null);
    h.app.ui['prime-modal'].close();
    assert.equal(h.document.activeElement, first);
    h.app.load('later');
    assert.ok(h.app.pending);
});

test('page lifecycle terminates in-flight work, ignores old replies, and allows a fresh request', () => {
    const h = harness();
    const old = h.app.worker;
    h.listeners.get('pagehide')();
    assert.equal(old.terminated, true);
    assert.equal(h.timers.size, 0);
    assert.equal(h.app.pending, null);
    h.listeners.get('pageshow')({ persisted: true });
    assert.equal(h.app.ui['load-more'].attributes.get('aria-disabled'), 'false');
    assert.equal(h.app.pending, null);
    old.emit({ type: 'result', id: 1, start: 2, end: 1001, primes: [2] });
    assert.equal(h.app.stream.segments.length, 0);
    h.app.load('later'); h.complete();
    assert.equal(h.app.stream.segments[0].start, 2);
    assert.equal(h.workers.length, 2);
});


test('manual More moves keyboard focus into the new batch without stealing a changed focus', () => {
    const h = harness(); h.complete();
    const button = h.app.ui['load-more'];
    button.focus(); button.emit('click');
    assert.equal(h.app.ui['load-more'].attributes.get('aria-disabled'), 'true');
    assert.equal(h.app.pending.focus, button);
    assert.deepEqual(Object.keys(h.app.worker.messages.at(-1)).sort(), ['end', 'id', 'start']);
    button.emit('click');
    assert.equal(h.app.worker.messages.length, 2);
    h.complete();
    const newlyAdded = h.app.ui['prime-container'].children.at(-1).querySelector('.prime-number');
    assert.equal(h.document.activeElement, newlyAdded);
    assert.equal(newlyAdded.dataset.index, '169');
    button.focus(); button.emit('click');
    const summary = h.app.ui['session-stats'].querySelector('summary');
    summary.focus(); h.complete();
    assert.equal(h.document.activeElement, summary);
});

test('manual earlier restores focus into the batch even when its control becomes hidden', () => {
    const h = harness(); h.fill(12); h.nearBottom();
    h.app.load('later'); h.complete();
    h.window.scrollY = 350;
    const earlier = h.app.ui['load-earlier'];
    earlier.focus(); earlier.emit('click'); h.complete();
    const first = h.app.ui['prime-container'].querySelector('.prime-number');
    assert.equal(h.document.activeElement, first);
    assert.equal(first.dataset.prime, '2');
    assert.equal(first.dataset.index, '1');
    assert.equal(h.app.ui['earlier-controls'].hidden, true);
});

test('opening a modal during manual generation preserves modal focus until close', () => {
    const h = harness(); h.complete();
    const more = h.app.ui['load-more'];
    more.focus(); more.emit('click');
    const selected = h.app.ui['prime-container'].querySelector('.prime-number');
    h.app.showPrime(selected); h.complete();
    assert.equal(h.app.ui['prime-modal'].open, true);
    assert.equal(h.document.activeElement, h.app.ui['close-modal']);
    h.app.ui['prime-modal'].close();
    assert.equal(h.document.activeElement, selected);
});

test('retry preserves earlier direction and regenerates the same range and ordinal', () => {
    const h = harness(); h.fill(12); h.nearBottom();
    h.app.load('later'); h.complete();
    h.window.scrollY = 350;
    h.app.load('earlier');
    assert.equal(h.app.pending.start, 2);
    h.app.worker.onerror();
    assert.equal(h.app.errorDirection, 'earlier');
    h.app.ui['load-more'].emit('click');
    assert.equal(h.app.pending.direction, 'earlier');
    assert.equal(h.app.pending.start, 2);
    h.complete();
    assert.equal(h.app.stream.segments[0].startIndex, 1);
    assert.equal(h.app.stream.segments[0].start, 2);
    assert.equal(h.app.errorDirection, null);
});


test('manual controls recover a focused eviction block without relying on native click focus', () => {
    const h = harness(); h.fill(12);
    const oldPrime = h.app.ui['prime-container'].querySelector('.prime-number');
    oldPrime.focus(); h.nearBottom();
    h.app.load('later'); h.complete();
    assert.equal(h.app.stream.segments[0].start, 2);
    assert.equal(h.document.activeElement, oldPrime);
    assert.match(h.app.ui['generation-state'].textContent, /More primes/);
    // emit() deliberately does not focus the clicked control, matching browsers
    // where pointer activation preserves the previously focused prime.
    h.app.ui['load-more'].emit('click');
    assert.equal(h.document.activeElement, h.app.ui['load-more']);
    h.complete();
    assert.equal(oldPrime.isConnected, false);
    assert.equal(h.app.stream.segments[0].start, 1002);
    const newestPrime = h.app.ui['prime-container'].children.at(-1).querySelector('.prime-number');
    assert.equal(h.document.activeElement, newestPrime);
    h.window.scrollY = 350;
    h.app.load('earlier'); h.complete();
    assert.equal(h.app.stream.segments[0].start, 1002);
    assert.equal(h.document.activeElement, newestPrime);
    assert.match(h.app.ui['generation-state'].textContent, /earlier/i);
    h.app.ui['load-earlier'].emit('click');
    assert.equal(h.document.activeElement, h.app.ui['load-earlier']);
    h.complete();
    assert.equal(h.app.stream.segments[0].start, 2);
    assert.equal(h.document.activeElement.dataset.prime, '2');
});


test('open dialog cycles a single control in both Tab directions and ignores browser shortcuts', () => {
    const h = harness(); h.complete();
    const { app, document, listeners } = h;
    const prime = app.ui['prime-container'].querySelector('.prime-number');
    prime.focus();
    app.ui['prime-modal'].scrollTop = 120;
    app.showPrime(prime);
    assert.equal(app.ui['prime-modal'].scrollTop, 0);
    const close = app.ui['close-modal'];
    const keydown = app.ui['prime-modal'].events.get('keydown');
    for (const shiftKey of [false, false, true, true, false]) {
        let prevented = false;
        keydown({ key: 'Tab', shiftKey, preventDefault() { prevented = true; } });
        assert.equal(prevented, true);
        assert.equal(document.activeElement, close);
    }
    for (const event of [{ key: 'Escape' }, { key: 'Tab', ctrlKey: true }, { key: 'Tab', metaKey: true }, { key: 'Tab', altKey: true }, { key: 'Tab', defaultPrevented: true }]) {
        keydown({ ...event, preventDefault() { assert.fail('Must leave shortcuts and already-handled events untouched'); } });
    }
    app.ui['prime-modal'].close();
    assert.equal(document.activeElement, prime);
    keydown({ key: 'Tab', preventDefault() { assert.fail('Closed dialog must not trap Tab'); } });
    app.ui['load-more'].focus();
    assert.equal(document.activeElement, app.ui['load-more']);
});

test('dialog traversal supports multiple controls, filtering and a heading fallback', () => {
    const h = harness(); h.complete();
    const { app, document, listeners } = h;
    const modal = app.ui['prime-modal'];
    const prime = app.ui['prime-container'].querySelector('.prime-number');
    const extra = document.createElement('button');
    const disabled = document.createElement('button'); disabled.disabled = true;
    const hidden = document.createElement('button'); hidden.hidden = true;
    const excluded = document.createElement('button'); excluded.tabIndex = -1;
    const invisible = document.createElement('button'); invisible.visibility = 'hidden';
    modal.append(disabled, extra, hidden, excluded, invisible);
    prime.focus(); app.showPrime(prime);
    const press = shiftKey => modal.events.get('keydown')({ key: 'Tab', shiftKey, preventDefault() {} });
    press(false); assert.equal(document.activeElement, extra);
    press(false); assert.equal(document.activeElement, app.ui['close-modal']);
    press(true); assert.equal(document.activeElement, extra);
    document.activeElement = document.getElementById('main-content');
    press(true); assert.equal(document.activeElement, extra);
    app.ui['close-modal'].hidden = true; extra.hidden = true;
    press(false); assert.equal(document.activeElement, app.ui['prime-modal-title']);
    assert.equal(listeners.has('document:keydown'), false, 'No global keyboard handler');
    assert.equal(listeners.has('document:focusin'), false, 'Native inertness owns background focus');
    modal.close();
    assert.equal(document.activeElement, prime);
});


test('Tab explicitly reveals an already-focused control within a short dialog without moving the page', () => {
    const h = harness(); h.complete();
    const { app, document, window } = h;
    const modal = app.ui['prime-modal'];
    const close = app.ui['close-modal'];
    const prime = app.ui['prime-container'].querySelector('.prime-number');
    app.showPrime(prime);
    modal.rect = { top: 16, bottom: 359, left: 186, right: 626, height: 343 };
    modal.clientTop = 1;
    Object.defineProperty(modal, 'clientHeight', { value: 341 });
    close.getBoundingClientRect = () => ({ top: 41 - modal.scrollTop, bottom: 85 - modal.scrollTop, left: 540, right: 584, height: 44 });
    window.scrollY = 412;
    for (const shiftKey of [false, true]) {
        modal.scrollTop = 220;
        document.activeElement = close; // The precise reported native edge case.
        modal.events.get('keydown')({ key: 'Tab', shiftKey, preventDefault() {} });
        const box = close.getBoundingClientRect();
        assert.equal(document.activeElement, close);
        assert.equal(close.lastFocusOptions.preventScroll, true);
        assert.ok(box.top >= modal.rect.top + modal.clientTop + 8);
        assert.ok(box.bottom <= modal.rect.top + modal.clientTop + modal.clientHeight - 8);
        assert.equal(modal.scrollTop, 16);
        assert.equal(window.scrollY, 412);
    }
    const visibleTop = modal.scrollTop;
    app.focusModalControl(close);
    assert.equal(modal.scrollTop, visibleTop, 'No scroll when the control is already fully visible');
});

test('dialog visibility correction handles a control below the scrollport and clamps at zero', () => {
    const h = harness(); h.complete();
    const { app, document, window } = h;
    const modal = app.ui['prime-modal'];
    const extra = document.createElement('button');
    modal.append(extra);
    modal.rect = { top: 16, bottom: 359, left: 186, right: 626, height: 343 };
    modal.clientTop = 1;
    Object.defineProperty(modal, 'clientHeight', { value: 341 });
    extra.getBoundingClientRect = () => ({ top: 400 - modal.scrollTop, bottom: 444 - modal.scrollTop, left: 200, right: 300, height: 44 });
    window.scrollY = 700;
    app.focusModalControl(extra);
    assert.equal(modal.scrollTop, 94);
    assert.equal(extra.getBoundingClientRect().bottom, 350);
    assert.equal(window.scrollY, 700);
    extra.getBoundingClientRect = () => ({ top: 16, bottom: 60, left: 200, right: 300, height: 44 });
    modal.scrollTop = 1;
    app.focusModalControl(extra);
    assert.equal(modal.scrollTop, 0);
    assert.equal(window.scrollY, 700);
});
