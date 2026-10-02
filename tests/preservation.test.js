'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');
// Public Git blob IDs from the reviewed master commit e5c28f8. These historical
// artifacts deliberately remain byte-for-byte unchanged by the UI redesign.
const preserved = {
  "database/schema.sql": "54620c127e09d024898849ab9c38eb44ef988936",
  "eratosthenes.c": "8e1cf8d9bdec72804740fa5b1d741a1c96c89640",
  "javascript/eratosthenes.js": "df5ab4853702f98c4849a80e3f7ca3d54765775c",
  "javascript/factor.js": "bfdf644d89edb4aec2621e243db1534ea380588b",
  "javascript/index.html": "aab1582bc651839830d89416577086057307c575",
  "javascript/primality.js": "01d856b7ef931d57467bd3d580fd605ba1024ea6",
  "lib/prime-database.js": "21f7be15e8a1411988279268c112e06e6aa1a9db",
  "naturalDecomposition.c": "3765db6c354b7317d649ded82ccf1e31a1661007",
  "obsolete/primality.c": "ed47a135f528f02799c0fd000498162fc0befa2e",
  "obsolete/primeDivisor.c": "42e70749b0bd8f9f990aeb23de87a1e376888a20",
  "obsolete/primeFrequency.c": "f745966cce7e46d8d795b92f43ef72ea2f86f165",
  "package-lock.json": "04809fb0e3490e49b1bce814ffc74ce6b51ebef5",
  "primality.c": "ed47a135f528f02799c0fd000498162fc0befa2e",
  "prime-generator.service": "c3b1b2e7e6fa8d17e7dc5baad41cbe259472f40c",
  "prime.c": "35bd0ffb88eeab70f9380b4e2b67e6c59f6fa8fa",
  "primeDifference.c": "fc9efeb7cc2f5a2ef9520518e6119291ad4751aa",
  "primeFrequency.c": "d2265d54531cb12fbeedcc49ca2c9590f8c5fc3f",
  "primeList.c": "a7fe7b080e323274891500fc959e37cb489ce59c",
  "primeSieveDifference.c": "907c08b1ab62ddffe06b46dea7fbe2f6b0d678df",
  "public/api.html": "869faad4b1c8f56a339faa8ac2439b04663a99e5",
  "public/css/api-styles.css": "3f27df3c06b2c949773f0247d262af559e79beed",
  "public/js/api.js": "a36cc3de4d7180a32ca5bb5485cf495c46a50570",
  "scripts/build-prime-database.js": "3788296fcf21393c8c33ed9c7a7e649ad03d982d",
  "scripts/database-stats.js": "1456f96df2a2ca74c6e4136f365b072445c50433",
  "scripts/fix-status.js": "80960d994e3e6bfa992ea276c06ecf9252ddfac7",
  "server.js": "79c66b2b564f39d04b4fde5fde7ac19cf4e4acc0",
  "theGame.c": "ae3e5c11c9126fdff26603cd22cecbd5126ea16e",
  "timer.h": "0497136583e0296d145522b18d0424dfe084d04a"
};
test('historical experiments, SQLite/API files, service, server and lockfile stay unchanged', () => {
    for (const [file, expected] of Object.entries(preserved)) {
        const bytes = fs.readFileSync(path.join(__dirname, '..', file));
        const actual = crypto.createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
        assert.equal(actual, expected, file);
    }
    const manifest = require('../package.json');
    assert.equal(manifest.optionalDependencies.sqlite3, '^5.1.6');
    assert.equal(manifest.scripts['build-db'], 'node scripts/build-prime-database.js');
    assert.equal(manifest.scripts['db-stats'], 'node scripts/database-stats.js');
    assert.equal(manifest.scripts['fix-status'], 'node scripts/fix-status.js');
});
