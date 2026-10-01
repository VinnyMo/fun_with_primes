# 🔢 Fun With Primes

A personal showcase of prime-number experiments, from C command-line programs to an interactive browser app.

[Try the hosted demo](https://vincentmossman.com/prime-generator/)

The current web app generates primes in your browser. Scroll to generate more, then click a prime to explore its properties. This is a legacy learning project; the older C and database experiments are still here to explore.

## Project history

This project started with Vincent T. Mossman's [`funWithPrimes`](https://github.com/VinnyMo/funWithPrimes), the original C and early JavaScript research repository. It remains a legacy showcase of those experiments, including [`threadPartialSieve`](https://github.com/VinnyMo/funWithPrimes/blob/master/eratosthenes.c#L168-L182), which divides sieve-marking work across POSIX threads using a shared flag array.

This later repository carries forward the original C sources and adds the browser app described below. The active browser generator is a separate [JavaScript Web Worker implementation](public/js/prime-worker.js).

## What the web app does

- Generates an initial batch of primes when the page loads
- Adds more primes as you scroll
- Runs prime generation in a Web Worker
- Shows a details modal with a prime's position, binary and hexadecimal representations, digit sum, and prime-type labels

## Run locally

You need Git, Node.js, npm, and a browser with Web Worker support.

```bash
git clone https://github.com/VinnyMo/fun_with_primes.git
cd fun_with_primes
npm install
npm start
```

Open [http://localhost:3007](http://localhost:3007).

There is no frontend build step, and you do not need to build a prime database to use the web app. The `sqlite3` dependency remains in `package.json` for the older database tools.

To check that the server is responding:

```bash
curl http://localhost:3007/test
```

## How it works

- [`server.js`](server.js) uses Express to serve the static files in `public/` on port 3007, with Helmet headers and request rate limiting. It also exposes the `/test` health-check route.
- [`public/index.html`](public/index.html) and [`public/css/styles.css`](public/css/styles.css) provide the page layout and styling.
- [`public/js/app.js`](public/js/app.js) handles scrolling, appends generated primes, and displays the details modal.
- [`public/js/prime-worker.js`](public/js/prime-worker.js) generates primes with a sieve in a browser worker.

The app creates a pool of workers, but the current batch-generation path sends work to the first worker. The active generator uses the simple sieve; a segmented-sieve implementation also remains in the worker source.

The details modal uses a randomized Miller–Rabin check and JavaScript number arithmetic. Treat it as an educational demonstration rather than a tool for cryptography or arbitrary-precision calculations. Long scrolling sessions keep the generated primes in memory, so performance depends on the device and the size of the list.

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

`npm run dev` runs the same `node server.js` command as `npm start`. There are currently no test, lint, or build scripts in `package.json`.

For a basic manual check after changing the web app:

1. Start the server and open `http://localhost:3007`.
2. Confirm that the initial prime list appears.
3. Scroll toward the bottom and check that more primes are added.
4. Click a prime and check the details modal, then close it.
5. Request `/test` and check the JSON response.

## Contributing

Feel free to open issues or submit PRs. Keep changes focused and include the steps used to check them.

## License

MIT License - Built with ❤️ by Vincent Mossman.
