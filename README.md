# 🔢 Fun With Primes

A personal showcase of prime-number experiments, from C command-line programs to an interactive browser app.

[Try the hosted demo](https://vincentmossman.com/prime-generator/)

The current web app generates primes in your browser. Scroll to generate more, then click a prime to explore its properties. This is a legacy learning project; the older C and database experiments are still here to explore.

## Project history

This project started with Vincent T. Mossman's [`funWithPrimes`](https://github.com/VinnyMo/funWithPrimes), the original C and early JavaScript research repository. It remains a legacy showcase of those experiments, including [`threadPartialSieve`](https://github.com/VinnyMo/funWithPrimes/blob/master/eratosthenes.c#L168-L182), which divides sieve-marking work across POSIX threads using a shared flag array.

This later repository carries forward the original C sources and adds the browser app described below. The active browser generator is a separate [JavaScript Web Worker implementation](public/js/prime-worker.js).

## What the web app does

- Puts the prime sequence first, with a short explanation and optional session statistics
- Generates more primes on your device as you scroll, with manual More / Retry controls
- Uses a single background Web Worker and bounded segmented sieving
- Keeps a reversible window of at most 12 segments; earlier rows regenerate as you scroll back
- Offers keyboard-accessible prime details, reduced-motion support, and a no-JavaScript explanation
- Includes a collapsed museum section: a high-school experiment (c. 2012–2013, Vincent’s recollection), college-era source updated November 5, 2016, and this 2026 browser showcase
- Preserves the original `threadPartialSieve` exhibit separately from the current JavaScript generator

## Run locally

You need Git, Node.js, npm, and a browser with Web Worker support.

```bash
git clone https://github.com/VinnyMo/fun_with_primes.git
cd fun_with_primes
npm ci --omit=optional
npm start
```

Open [http://localhost:3007](http://localhost:3007).

There is no frontend build step, and you do not need to build a prime database to use the web app. The `sqlite3` driver is an optional dependency for the older database tools and is omitted by this quick-start command.

To check that the server is responding:

```bash
curl http://localhost:3007/test
```

## How it works

- [`server.js`](server.js) uses Express to serve the static files in `public/` on port 3007, with Helmet headers and request rate limiting. It also exposes the `/test` health-check route.
- [`public/index.html`](public/index.html) and [`public/css/styles.css`](public/css/styles.css) provide the page layout and styling.
- [`public/js/app.js`](public/js/app.js) handles scrolling, appends generated primes, and displays the details modal.
- [`public/js/prime-worker.js`](public/js/prime-worker.js) generates primes with a sieve in a browser worker.

- [`public/js/prime-math.js`](public/js/prime-math.js) holds the shared segmented sieve and deterministic BigInt primality checks for the detail labels.
- [`public/js/prime-stream.js`](public/js/prime-stream.js) tracks contiguous ranges and absolute prime positions in a reversible, bounded window.

One request scans at most 1,000 integers. The worker retains only base primes up to the square root of the scanned range, and the page retains at most 12 segments. Evicted ranges are regenerated exactly when scrolling backward. The visible row is used as an anchor when older rows are removed or prepended; a visible or focused segment is never evicted. Explicit earlier / more controls support keyboard navigation and browsers without an intersection observer.

Automatic loading is driven by scroll direction. Completion and resize do not recursively request work; at startup only one additional batch may fill a tall viewport. Errors stop automatic loading and offer retry. The app never creates a database, calls a prime API, or starts the historical database builder.

Prime numbers do not end, but this browser session intentionally pauses at **1 trillion** to bound sieve memory and work. Details use exact BigInt arithmetic for their deterministic Miller–Rabin classifications; this remains an educational demonstration, not a cryptographic tool.

## Project layout

```text
server.js                    Static-file server and /test route
public/                      Current browser app and older API-page assets
javascript/                  Earlier JavaScript experiments
*.c, timer.h                 C prime-number experiments
obsolete/                    Older C implementations
lib/prime-database.js         Historical SQLite access layer
database/schema.sql          Historical database schema
scripts/                     Historical database utilities
prime-generator.service      Existing deployment-specific service file
```

## Historical experiments

### Database-backed API

An earlier version served prime lookups from SQLite. The database API routes and statistics panel were removed in [the November 2025 simplification](https://github.com/VinnyMo/fun_with_primes/commit/91ef3334c68656d319d07e64299176eacd5fcf7a).

The database code, schema, utilities, and `public/api.html` assets remain in the repository. They are optional historical material, not part of the current web app's startup path. The current server does not implement the old `/api` and `/stats` routes; the retained API page describes that earlier version.

The eight historical files (`database/schema.sql`, `lib/prime-database.js`, the three database scripts, and the three API-page assets) are preserved byte-for-byte from [commit `847e0b5`](https://github.com/VinnyMo/fun_with_primes/commit/847e0b5b56af29aa5b4b2964623c88e544389d67). Generated databases, installed dependencies, and compiled executables are not included.

To explore the database tools, install their optional native driver first:

```bash
npm ci --include=optional
node -e "require('sqlite3'); console.log('SQLite driver ready')"
```

The driver may need a supported native build toolchain if a prebuilt binary is unavailable. npm can skip an optional dependency when its installation fails, so check that the driver loads before running the database commands. The browser app does not require it.

These scripts are still defined for exploring the database tooling:

```bash
npm run build-db   # Build the historical SQLite prime database
npm run db-stats   # Inspect that database
npm run fix-status # Update its generation-status metadata
```

Review the scripts before running them. The builder currently targets 10 billion primes and can consume substantial time, memory, and disk space. It is not a quick-start step, and the repository does not include the generated `database/primes.db` file.

### C and earlier JavaScript

The C sources include primality tests, sieve implementations, prime lists, prime-gap and frequency experiments, and natural-number decomposition. Several source headers contain build and usage notes. These are historical experiments and may need fixes for a current toolchain; they are not required to run the browser app.

The `javascript/` directory contains earlier browser-based prime and factorization experiments.

## Development checks

`npm run dev` runs the same `node server.js` command as `npm start`. There is no build step or framework dependency.

```bash
npm test       # Dependency-free mathematics, worker/app state, historical source checks
npm run check  # Syntax-check current and retained JavaScript
```

The tests compare prime batches with independent trial division, verify forward/reverse range joins and ordinals, enforce the retention and numeric bounds, and exercise the actual app/worker scripts in a lightweight DOM/worker test double. These state tests do not replace rendered browser testing.

For rendered checks, use an environment with Playwright and its Chromium browser already available, start the app, then run `npm run test:browser`. `PRIME_TEST_URL` can point to a test instance. Playwright is an optional testing tool, not an app dependency. The suite covers 320px/375px mobile, tablet, desktop and short landscape viewports; numbers above the fold; museum/stats disclosures; modal keyboard focus; long/reverse scrolling; reduced motion; and no-JavaScript fallback. See [the review checklist](docs/ux-review.md) for remaining visual acceptance checks.

Do not run `npm run build-db` as a web-app test. It targets a very large historical dataset.

## Contributing

Feel free to open issues or submit PRs. Keep changes focused and include the steps used to check them.

## License

MIT License - Built with ❤️ by Vincent Mossman.
