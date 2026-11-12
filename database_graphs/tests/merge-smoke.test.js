'use strict';
// Run: node tests/merge-smoke.test.js
// Self-contained API/controller smoke tests. Fake data, no MySQL connection.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const routes = new Map();
let dbQueries = [];
const fakeExpress = () => ({
  get(route, fn) { routes.set(route, fn); },
  use() {},
  listen() {}
});
fakeExpress.static = () => (req, res, next) => next && next();
const fakeMysql = {
  async createConnection() {
    return {
      async query(sql, params) {
        dbQueries.push([sql, params]);
        if (sql.includes('SELECT DISTINCT grade')) return [[{ grade: 3 }, { grade: 4 }]];
        if (sql.includes('SELECT culture')) return [[{ culture: 'Example', cnt: 5 }]];
        if (sql.includes('SELECT gender, grade')) return [[
          { gender: 'M', grade: 3, score: 2 }, { gender: 'M', grade: 3, score: 3 },
          { gender: 'M', grade: 4, score: 4 }, { gender: 'F', grade: 3, score: 6 },
          { gender: 'F', grade: 4, score: 7 }, { gender: 'F', grade: 4, score: 6 },
          { gender: 'O', grade: 3, score: 8 }, { gender: 'P', grade: 4, score: 5 }
        ]];
        if (sql.includes('GROUP BY group_value')) return [[
          { group_value: 'Male', ses_bucket: 'Low', n: 10, mean_score: 2.5 },
          { group_value: 'Female', ses_bucket: 'Low', n: 10, mean_score: 4.5 }
        ]];
        if (sql.includes('COUNT(*) AS n')) return [[{
          n: 20, mean_score: 4.5,
          pct_thriving: 25.0, pct_doing_ok: 50.0, pct_struggling: 25.0,
          pct_nonenglish: 25.0
        }]];
        throw new Error('Unexpected SQL: ' + sql.slice(0, 100));
      },
      async end() {}
    };
  }
};
const context = {
  require(name) {
    if (name === 'dotenv') return { config() {} };
    if (name === 'express') return fakeExpress;
    if (name === 'mysql2/promise') return fakeMysql;
    if (name === 'node:path') return path;
    throw Error('Unknown require ' + name);
  },
  __dirname: path.join(__dirname, '..'),
  process: { env: { DB_NAME: 'mock2023', DB_HOST: 'localhost', DB_USER: 'test' } },
  console: { log() {}, error() {} },
  URLSearchParams,
};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8'), context, {filename:'server.js'});

async function call(route, query) {
  const fn = routes.get(route);
  assert.ok(fn, `Missing route ${route}`);
  let status = 200;
  let payload;
  const res = {
    status(code) { status = code; return this; },
    json(value) { payload = value; return this; },
    redirect(code, value) { status = code; payload = value; return this; }
  };
  await fn({ query }, res);
  return { status, payload };
}

(async () => {
  const filters = await call('/api/filter-options', { year: '2023' });
  assert.equal(filters.status, 200);
  assert.deepEqual(Array.from(filters.payload.years), [2023]);
  assert.deepEqual(Array.from(filters.payload.grades), [3,4]);

  const summary = await call('/api/indicator-summary', {
    indicator: 'depression', year: '2023', gender: ['M','F','O'], grade: ['3','4'], ses: ['Low','Mid','High']
  });
  assert.equal(summary.status, 200);
  assert.equal(summary.payload.pct_thriving, 25);
  assert.equal(summary.payload.top_culture, 'Example');

  const chart = await call('/api/indicator-breakdown', {
    indicator: 'depression', groupBy: 'gender', splitBySes: 'true',
    year: '2023', gender: ['M','F','O'], grade: ['3','4'], ses: ['Low','Mid']
  });
  assert.equal(chart.status, 200);
  assert.equal(chart.payload.splitBySes, true);
  assert.equal(chart.payload.groups.length, 2);

  const narrative = await call('/api/depression-narrative', {
    year: '2023', groupBy: 'gender', gender: ['M','F'], grade: ['3','4'], ses: ['Low','Mid']
  });
  assert.equal(narrative.status, 200);
  assert.equal(narrative.payload.groups.Male.n, 3);
  assert.ok(narrative.payload.comparisons.length >= 1);
  assert.equal(typeof narrative.payload.comparisons[0].mean_significant, 'boolean');
  assert.equal(typeof narrative.payload.comparisons[0].proportion_significant, 'boolean');

  const badYear = await call('/api/indicator-summary', { indicator: 'depression', year: '2022' });
  assert.equal(badYear.status, 400);
  console.log('PASS: filter options, summary, SES chart breakdown, depression statistics, invalid year.');
})().catch(error => {console.error(error); process.exitCode = 1;});
