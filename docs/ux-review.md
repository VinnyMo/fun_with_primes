# Minimal prime showcase: review checklist

## Intent

Make the sequence immediately legible: a compact title, one sentence, and prime numbers. Both Session stats and About this experiment start closed. No opening animation hides the list, and no stats overlay covers it. The museum records c. 2012–2013 as the author’s recollection, November 5, 2016 as the historical source revision, and 2026 as this presentation update; the C excerpt is distinct from the browser engine.

## Automated checks

- `npm test`: numerical correctness, range/order/ordinal invariants, a bounded reverse-navigable window, worker/app state regressions, source preservation
- `npm run check`: syntax checks, including retained historical JavaScript
- `npm run test:browser`: opt-in Playwright rendering and interaction suite, requires Playwright/Chromium and a running server

The implementation environment could run the first two checks. It could **not** render the revised page: Chromium IPC was blocked by the execution environment in prior browser setup. No screenshot or rendered layout approval is claimed. The opt-in suite was authored but must be run in an environment with a working browser before merge/deployment.

## Visual and interaction acceptance

1. At 320×568, 375×667, 768×1024, 1180×757 and 812×375, confirm several primes appear without scrolling and there is no horizontal page overflow.
2. Check default and reduced-motion settings. New tiles should reveal gently once; reduced motion should show them with no animation.
3. Open and close both disclosures with pointer and keyboard, including Escape. Scroll through the long source exhibit on mobile; code should scroll internally. Closing it should return focus to a visible summary.
4. Enter prime details repeatedly by keyboard. Focus should enter the modal, Tab should remain contained, Escape/backdrop/Close should dismiss it, and focus should return to the same prime without moving the page.
5. Scroll quickly forward beyond 12 segments. Watch the same visible prime as old segments leave memory. Reverse far enough to regenerate earlier ranges, then continue forward: no duplicates, skipped primes, lost ordinals, or scroll jumps.
6. Try the explicit More and Load earlier controls, including keyboard activation and repeated rapid clicks. Manual loading should move focus to the new numbers unless you moved focus elsewhere while waiting.
7. Block the worker request or simulate a worker error. The error should remain visible, automatic loading should stop, and Try again should retry the same range. Reload without JavaScript and verify the honest explanation instead of endless loading.
8. Verify `/test` and all relative JS/CSS/worker imports both at `/` locally and behind the production `/prime-generator/` path rewrite.

## Scope preserved

No production service, API route, database, deployment configuration, original C/early JavaScript experiment, historical SQLite source, or old API-page asset is changed. The web quick start still omits optional sqlite3; the historical database scripts remain available for deliberate use.


## Local acceptance follow-up: October 2, 2026

The first local browser run on head `2e4cfb5` failed the detail-dialog Tab containment assertion. First-screen layouts, mobile disclosures, historical content and retry behavior were reported passing; Escape restored focus. Long forward/reverse scrolling was not verified because the extended diagnostic stalled.

The follow-up explicitly cycles plain Tab and Shift+Tab through the open dialog, retains native Escape/background inertness, and restores the original prime after closing. Modified shortcuts and closed-dialog navigation remain untouched. Unit coverage includes the existing single-control dialog, multiple-control ordering, hidden/disabled controls, a focusable heading fallback, and closure. The handler is scoped to the dialog and leaves native background inertness in charge of outside focus.

The revised browser runner uses bounded waits for actual range progress and logs active-element, document-focus, pending-request, range, and scroll state on failure. This avoids treating an idle instant before a scroll animation frame as successful progress, or chasing an automatically moving footer with pointer actionability retries. These are identified harness risks, not a confirmed explanation of the original local stall.

Run the revised rendered suite on the new exact PR head. Its failure, timeout, absence, or an unrun stage is a failed gate; passing script-state tests does not establish native focus or scroll geometry. No revised-browser pass is claimed until that local run completes.


### Landscape visibility correction

A local browser rerun of `230e09a` passed 126 stages, including focus containment and long forward/reverse scrolling in four viewports. It then failed the 812×375 check: scrolling the dialog internally and pressing Tab left Close focused but outside the visible dialog. The remaining landscape stages and no-JavaScript stage were not run; that run is not a complete browser pass.

The next fix explicitly focuses with `preventScroll`, measures the control against the dialog’s client viewport, and adjusts only `dialog.scrollTop` to reveal it with an 8px focus-ring inset. It does not rely on refocusing to trigger native scrolling. Geometry regressions cover above-viewport, below-viewport, already-visible and clamped-top cases without changing page scroll. The original strict rendered visibility and page-position assertions remain; both Tab directions now run them, and failure output includes dialog scroll/rectangle data.

Run the complete browser suite on the new exact head. The landscape fix remains unverified in a real browser until that run passes; previously passing stages must not be substituted for the complete current-head run.
