'use strict';
class PrimeGeneratorApp {
    constructor() {
        this.stream = new PrimeStream();
        this.worker = null;
        this.pending = null;
        this.requestId = 0;
        this.errorDirection = null;
        this.lastScrollY = window.scrollY;
        this.scrollFrame = null;
        this.initialFillUsed = false;
        this.returnFocus = null;
        this.ui = {};
        for (const id of ['prime-container', 'generation-state', 'load-more', 'load-earlier', 'earlier-controls', 'window-range', 'stream-footer', 'stat-total-primes', 'stat-largest-prime', 'stat-last-duration', 'prime-modal', 'prime-modal-title', 'modal-position', 'modal-prime-info', 'close-modal', 'session-stats', 'close-stats', 'project-story', 'close-story']) this.ui[id] = document.getElementById(id);
        this.ui['stream-footer'].hidden = false;
        this.ui['close-stats'].hidden = false;
        this.ui['close-story'].hidden = false;
        this.motion = window.matchMedia('(prefers-reduced-motion: reduce)');
        this.revealObserver = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
            for (const entry of entries) {
                if (entry.isIntersecting) {
                    if (!this.motion.matches) entry.target.classList.add('reveal');
                    this.revealObserver.unobserve(entry.target);
                }
            }
        }, { threshold: 0.05 }) : null;
        this.bindEvents();
        this.load('later');
    }

    bindEvents() {
        this.ui['load-more'].addEventListener('click', () => {
            this.ui['load-more'].focus({ preventScroll: true });
            this.load(this.errorDirection || 'later', true);
        });
        this.ui['load-earlier'].addEventListener('click', () => {
            this.ui['load-earlier'].focus({ preventScroll: true });
            this.load('earlier', true);
        });
        this.ui['prime-container'].addEventListener('click', event => {
            const button = event.target.closest('.prime-number');
            if (button) this.showPrime(button);
        });
        this.ui['close-modal'].addEventListener('click', () => this.ui['prime-modal'].close());
        // Native dialog makes the page inert, but a browser may let Tab leave
        // its last control for browser chrome. Keep ordinary Tab traversal in
        // this dialog explicitly; do not intercept browser shortcuts or Escape.
        this.ui['prime-modal'].addEventListener('keydown', event => this.containModalTab(event));
        this.ui['prime-modal'].addEventListener('click', event => {
            if (event.target !== this.ui['prime-modal']) return;
            const rect = this.ui['prime-modal'].getBoundingClientRect();
            if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) this.ui['prime-modal'].close();
        });
        this.ui['prime-modal'].addEventListener('close', () => {
            if (this.returnFocus?.isConnected) this.returnFocus.focus({ preventScroll: true });
        });
        const closeStats = () => {
            this.ui['session-stats'].open = false;
            this.ui['session-stats'].querySelector('summary').focus({ preventScroll: true });
        };
        this.ui['close-stats'].addEventListener('click', closeStats);
        this.ui['session-stats'].addEventListener('keydown', event => {
            if (event.key === 'Escape' && this.ui['session-stats'].open) { event.preventDefault(); closeStats(); }
        });
        const closeStory = () => {
            this.ui['project-story'].open = false;
            this.ui['project-story'].querySelector('summary').focus();
        };
        this.ui['close-story'].addEventListener('click', closeStory);
        this.ui['project-story'].addEventListener('keydown', event => {
            if (event.key === 'Escape' && this.ui['project-story'].open) { event.preventDefault(); closeStory(); }
        });
        window.addEventListener('scroll', () => {
            if (this.scrollFrame !== null) return;
            this.scrollFrame = requestAnimationFrame(() => {
                this.scrollFrame = null;
                const y = window.scrollY;
                const direction = y > this.lastScrollY ? 'later' : y < this.lastScrollY ? 'earlier' : null;
                this.lastScrollY = y;
                if (!direction || this.pending || this.errorDirection || this.ui['prime-modal'].open || document.hidden) return;
                if (direction === 'later' && this.ui['stream-footer'].getBoundingClientRect().top < window.innerHeight + 300) this.load('later');
                if (direction === 'earlier' && this.ui['prime-container'].getBoundingClientRect().top > -300) this.load('earlier');
            });
        }, { passive: true });
        window.addEventListener('pagehide', () => {
            this.worker?.terminate();
            this.worker = null;
            clearTimeout(this.timeout);
            this.pending = null;
        });
        window.addEventListener('pageshow', event => {
            if (event.persisted) {
                this.setBusy(false);
                this.status('Ready when you are. Scroll or select More primes.');
            }
        });
    }

    makeWorker() {
        const worker = new Worker('js/prime-worker.js?v=2026100201');
        worker.onmessage = event => { if (this.worker === worker) this.receive(event.data); };
        worker.onerror = () => { if (this.worker === worker) this.fail('The background generator could not run. Try again.'); };
        worker.onmessageerror = () => { if (this.worker === worker) this.fail('The next batch could not be read. Try again.'); };
        this.worker = worker;
    }

    load(direction, manual = false) {
        if (this.pending || this.ui['prime-modal'].open) return;
        const range = this.stream.nextRange(direction);
        if (!range) {
            if (direction === 'later') this.status('This session reached 1 trillion. Primes keep going; this browser’s calculation limit stops here.');
            return;
        }
        this.errorDirection = null;
        this.pending = { ...range, id: ++this.requestId, direction, manual, focus: document.activeElement };
        this.setBusy(true);
        this.status(this.stream.segments.length ? 'Making more primes on your device…' : 'Making the first primes on your device…');
        try {
            if (!this.worker) this.makeWorker();
            this.worker.postMessage({ id: this.pending.id, start: range.start, end: range.end });
            this.timeout = setTimeout(() => this.fail('That batch took too long. Try again when your device is ready.'), 15000);
        } catch (error) {
            this.fail('Your browser could not start the background generator. Try again, or use a browser with Web Worker support.');
        }
    }

    receive(message) {
        if (!this.pending || message.id !== this.pending.id) return;
        if (message.type === 'error') { this.fail('The next batch could not be generated. Try again.'); return; }
        if (message.type !== 'result') return;
        const request = this.pending;
        clearTimeout(this.timeout);
        // A user may reverse direction while the worker is busy. Never evict a
        // visible or focused block just because it was offscreen at request time.
        const candidate = this.stream.segments.length === this.stream.maxSegments ? (request.direction === 'later' ? this.stream.segments[0] : this.stream.segments.at(-1)) : null;
        const candidateNode = candidate ? document.getElementById(`range-${candidate.start}`) : null;
        if (candidateNode) {
            const rect = candidateNode.getBoundingClientRect();
            if ((rect.bottom > 0 && rect.top < window.innerHeight) || candidateNode.contains(document.activeElement)) {
                this.pending = null;
                this.setBusy(false);
                const focused = candidateNode.contains(document.activeElement);
                this.status(focused
                    ? (request.direction === 'later' ? 'Select More primes to continue beyond the focused number.' : 'Select Load earlier primes to continue beyond the focused number.')
                    : (request.direction === 'later' ? 'Scroll farther down to continue.' : 'Scroll farther up to see earlier primes.'));
                return;
            }
        }
        const anchor = Array.from(this.ui['prime-container'].querySelectorAll('.prime-number')).find(node => node.getBoundingClientRect().bottom > 0 && node.getBoundingClientRect().top < window.innerHeight);
        const anchorTop = anchor?.getBoundingClientRect().top;
        let result;
        try {
            if (message.start !== request.start || message.end !== request.end) throw new Error('Range mismatch');
            result = this.stream.accept(request, message.primes, request.direction);
        } catch (error) { this.fail('The next batch was incomplete. Try again.'); return; }
        const list = this.renderSegment(result.segment);
        if (request.direction === 'earlier') this.ui['prime-container'].prepend(list);
        else this.ui['prime-container'].append(list);
        if (result.removed) {
            const removed = document.getElementById(`range-${result.removed.start}`);
            for (const button of removed.querySelectorAll('.prime-number')) this.revealObserver?.unobserve(button);
            removed.remove();
        }
        this.pending = null;
        this.updateStats(message.duration);
        this.setBusy(false);
        if (anchor?.isConnected) window.scrollTo(window.scrollX, window.scrollY + anchor.getBoundingClientRect().top - anchorTop);
        if (request.manual && document.activeElement === request.focus && !this.ui['prime-modal'].open) {
            const firstNewPrime = list.querySelector('.prime-number');
            if (firstNewPrime) {
                firstNewPrime.focus({ preventScroll: true });
                firstNewPrime.scrollIntoView({ block: 'nearest', behavior: 'instant' });
            }
        }
        this.lastScrollY = window.scrollY;
        this.status(`${message.primes.length.toLocaleString()} ${request.direction === 'earlier' ? 'earlier primes restored' : 'more primes ready'}. ${this.stream.nextRange('later') ? 'Keep scrolling to explore.' : 'This session reached its calculation limit.'}`);
        // At most one extra initial batch for a very tall viewport. There is no
        // observer/resize/completion loop; later work requires scrolling or a click.
        if (!this.initialFillUsed && this.stream.segments.length === 1) {
            this.initialFillUsed = true;
            if (this.ui['stream-footer'].getBoundingClientRect().top < window.innerHeight) this.load('later');
        }
    }

    renderSegment(segment) {
        const list = document.createElement('ol');
        list.className = 'prime-batch';
        list.setAttribute('role', 'list');
        list.id = `range-${segment.start}`;
        list.start = segment.startIndex;
        list.setAttribute('aria-label', `Prime numbers from position ${segment.startIndex.toLocaleString()}`);
        const fragment = document.createDocumentFragment();
        segment.primes.forEach((prime, offset) => {
            const item = document.createElement('li');
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'prime-number';
            button.textContent = prime.toLocaleString();
            button.dataset.prime = String(prime);
            button.dataset.index = String(segment.startIndex + offset);
            button.setAttribute('aria-label', `${prime.toLocaleString()}, prime number ${(segment.startIndex + offset).toLocaleString()}. Show details`);
            item.append(button);
            fragment.append(item);
            this.revealObserver?.observe(button);
        });
        list.append(fragment);
        return list;
    }

    fail(message) {
        this.errorDirection = this.pending?.direction || this.errorDirection || 'later';
        clearTimeout(this.timeout);
        this.worker?.terminate();
        this.worker = null;
        this.pending = null;
        this.setBusy(false);
        this.status(message);
    }

    setBusy(busy) {
        this.ui['prime-container'].setAttribute('aria-busy', String(busy));
        this.ui['load-more'].setAttribute('aria-disabled', String(busy || (!this.errorDirection && !this.stream.nextRange('later'))));
        this.ui['load-earlier'].setAttribute('aria-disabled', String(busy));
        this.ui['load-more'].textContent = busy ? 'Making primes…' : this.errorDirection ? 'Try again' : this.stream.nextRange('later') ? 'More primes ↓' : 'Calculation limit reached';
    }

    status(message) { this.ui['generation-state'].textContent = message; }

    updateStats(duration) {
        this.ui['stat-total-primes'].textContent = this.stream.explored.toLocaleString();
        this.ui['stat-largest-prime'].textContent = this.stream.largest.toLocaleString();
        this.ui['stat-last-duration'].textContent = `${Math.max(0, Math.round(duration || 0))} ms`;
        const first = this.stream.segments[0];
        this.ui['earlier-controls'].hidden = !first || first.start === 2;
        this.ui['window-range'].textContent = first ? `From prime #${first.startIndex.toLocaleString()}` : '';
    }

    modalFocusTargets() {
        // The details dialog currently has only buttons, but include the usual
        // controls so future links or fields preserve the same keyboard order.
        return Array.from(this.ui['prime-modal'].querySelectorAll('button, a[href], input, select, textarea, [tabindex]')).filter(node =>
            !node.disabled && !node.hidden && node.tabIndex >= 0 && node.getClientRects().length > 0
            && window.getComputedStyle(node).visibility === 'visible'
        );
    }

    containModalTab(event) {
        const modal = this.ui['prime-modal'];
        if (!modal.open || event.defaultPrevented || event.key !== 'Tab' || event.ctrlKey || event.metaKey || event.altKey) return;
        const targets = this.modalFocusTargets();
        event.preventDefault();
        if (!targets.length) { this.focusModalControl(this.ui['prime-modal-title']); return; }
        const index = targets.indexOf(document.activeElement);
        const next = index < 0 ? (event.shiftKey ? targets.length - 1 : 0)
            : (index + (event.shiftKey ? -1 : 1) + targets.length) % targets.length;
        this.focusModalControl(targets[next]);
    }

    focusModalControl(target) {
        const modal = this.ui['prime-modal'];
        // Re-focusing an already-focused control does not reliably reveal it.
        // Measure the actual scrollport, then scroll only the dialog; neither
        // focus() nor scrollIntoView() should move the underlying prime list.
        target.focus({ preventScroll: true });
        const viewport = modal.getBoundingClientRect();
        const control = target.getBoundingClientRect();
        const top = viewport.top + modal.clientTop;
        const bottom = top + modal.clientHeight;
        const inset = 8;
        let delta = 0;
        if (control.top < top + inset) delta = control.top - top - inset;
        else if (control.bottom > bottom - inset) delta = control.bottom - bottom + inset;
        if (delta) modal.scrollTop = Math.max(0, modal.scrollTop + delta);
    }

    showPrime(button) {
        const prime = Number(button.dataset.prime);
        const position = Number(button.dataset.index);
        this.returnFocus = button;
        this.ui['prime-modal-title'].textContent = prime.toLocaleString();
        this.ui['modal-position'].textContent = `Prime #${position.toLocaleString()}`;
        const properties = [
            ['Binary', prime.toString(2)],
            ['Hexadecimal', `0x${prime.toString(16).toUpperCase()}`],
            ['Digit sum', String([...String(prime)].reduce((sum, digit) => sum + Number(digit), 0))]
        ];
        const traits = [];
        if (String(prime) === [...String(prime)].reverse().join('')) traits.push('Palindromic: reads the same both ways');
        if (PrimeMath.isPrime(prime - 2) || PrimeMath.isPrime(prime + 2)) traits.push('Twin prime: another prime is two away');
        if (PrimeMath.isPrime(2 * prime + 1)) traits.push('Sophie Germain prime: 2p + 1 is prime');
        if (PrimeMath.isPrime((prime - 1) / 2)) traits.push('Safe prime: (p − 1) / 2 is prime');
        if (traits.length) properties.push(['Worth a look', traits.join(' · ')]);
        this.ui['modal-prime-info'].replaceChildren();
        for (const [label, value] of properties) {
            const row = document.createElement('div');
            const term = document.createElement('dt');
            const description = document.createElement('dd');
            term.textContent = label;
            description.textContent = value;
            row.append(term, description);
            this.ui['modal-prime-info'].append(row);
        }
        // Native dialog supplies inert background and Escape dismissal. Tab
        // containment above is explicit, and never active after it closes.
        this.ui['prime-modal'].showModal();
        this.ui['prime-modal'].scrollTop = 0;
        this.ui['close-modal'].focus({ preventScroll: true });
    }
}
document.addEventListener('DOMContentLoaded', () => { window.primeApp = new PrimeGeneratorApp(); });
