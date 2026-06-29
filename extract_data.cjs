'use strict';
// This script reads generate_excel_v10.js (ESM), extracts the tasks array,
// wraps it as a CJS module, and saves excel_data.cjs
const fs = require('fs');
const src = fs.readFileSync('generate_excel_v10.js', 'utf8');

// Find the tasks array - between "const tasks = [" and the matching "];"
// The tasks block ends with the last "];" before "// ─── Build"
const buildIdx = src.indexOf('// ─── Build Workbook');
const slicedSrc = src.slice(0, buildIdx);
const startIdx = slicedSrc.indexOf('const tasks = [');
const endIdx = slicedSrc.lastIndexOf('];') + 2;

const tasksBlock = slicedSrc.slice(startIdx, endIdx);
const output = `'use strict';\n${tasksBlock}\nmodule.exports = { tasks };\n`;

fs.writeFileSync('excel_data.cjs', output, 'utf8');
const size = fs.statSync('excel_data.cjs').size;
console.log('excel_data.cjs written, bytes:', size, 'tasks extracted OK');
