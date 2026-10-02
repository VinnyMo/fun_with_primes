'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const roots = ['public/js', 'lib', 'scripts', 'tests', 'javascript'];
const files = ['server.js'];
for (const root of roots) {
    for (const name of fs.readdirSync(root)) if (/\.(?:js|cjs)$/.test(name)) files.push(path.join(root, name));
}
for (const file of files) {
    const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
    if (result.status !== 0) process.exit(result.status || 1);
}
console.log(`Syntax checked ${files.length} JavaScript files.`);
