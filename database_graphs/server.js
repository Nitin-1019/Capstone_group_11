require("dotenv").config({ path: "./.env" });
 
const mysql = require("mysql2/promise");
const express = require("express");
 
const app = express();
const PORT = process.env.PORT || 3000;
 
// Everything the browser needs (index.html, app.js, style.css) lives in
// public/, served flat at the site root — e.g. public/app.js is reachable
// at /app.js. No Flask-style templates/static split, and no {{ url_for(...) }}
// syntax in index.html (Express doesn't understand Jinja) - plain
// <script src="app.js"> and <link href="style.css"> tags instead.
app.use(express.static("public"));
 
const TABLE = "student_info_2023";
 
// Same tolerant "flagged true" matching used in the Python/notebook
// versions for the `nonenglish` column. This is a FIXED constant, never
// user input, so it's safe to inline directly into the query text rather
// than bind as a "?" parameter - and it has to be inlined, not bound: it
// sits inside the SELECT clause, which appears in the query text BEFORE
// the WHERE clause's own "?" placeholders, so binding it as just another
// array parameter shifted every later placeholder by one position and
// corrupted the query (this was the cause of the "year = (...)" syntax
// error - mysql2 binds "?" in the order they appear in the text, not in
// the order the WHERE clause is built in JS).
const TRUE_VALUES_SQL = "('yes', 'y', '1', 'true', 't')";
 
// One entry per indicator this endpoint can compute - the Node equivalent
// of INDICATOR_CONFIG in app.py. Each indicator's three SQL fragments
// should be mutually exclusive and cover every non-null value of `column`.
const INDICATOR_CONFIG = {
  "life-satisfaction": {
    column: "cantril",
    thriving: "cantril >= 7",
    doingOk: "cantril BETWEEN 5 AND 6",
    struggling: "cantril BETWEEN 1 AND 4",
  },
  depression: {
    // Confirmed cutoffs (do not change without new instruction): 2-3
    // Thriving/low symptoms, 4-5 Doing OK/mid, 6-8 Struggling/high symptoms.
    column: "ds_score",
    thriving: "ds_score BETWEEN 2 AND 3",
    doingOk: "ds_score BETWEEN 4 AND 5",
    struggling: "ds_score BETWEEN 6 AND 8",
  },
};
 
// Same SES-bucket derivation as before: prefer an existing Low/Mid/High
// text value, otherwise derive it from seifa_decile.
const SES_BUCKET_SQL = `
  CASE
    WHEN ses_level IN ('Low','Mid','High') THEN ses_level
    WHEN seifa_decile BETWEEN 1 AND 3 THEN 'Low'
    WHEN seifa_decile BETWEEN 4 AND 7 THEN 'Mid'
    WHEN seifa_decile BETWEEN 8 AND 10 THEN 'High'
    ELSE 'Unknown SES'
  END
`;
 
function toArray(value) {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}
 
function getConnection() {
  return mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT || 3306),
  });
}
 
// Distinct years/grades actually present in the table, so the filter
// dropdown/checkboxes in app.js always match real data.
app.get("/api/filter-options", async (req, res) => {
  let connection;
  try {
    connection = await getConnection();
 
    const [yearRows] = await connection.query(
      `SELECT DISTINCT year FROM ${TABLE} WHERE year IS NOT NULL ORDER BY year`
    );
    const [gradeRows] = await connection.query(
      `SELECT DISTINCT grade FROM ${TABLE} WHERE grade IS NOT NULL ORDER BY grade`
    );
 
    res.json({
      years: yearRows.map((row) => row.year),
      grades: gradeRows.map((row) => row.grade),
    });
  } catch (error) {
    console.error("filter-options error:", error.message);
    res.status(500).json({ error: "Could not retrieve filter options." });
  } finally {
    if (connection) await connection.end();
  }
});
 
// ?indicator=life-satisfaction|depression&year=2025&gender=M&gender=F&grade=3&grade=4&ses=Low
// Exactly the same contract app.js already calls - this route replaces
// the old fixed /api/depression route entirely.
app.get("/api/indicator-summary", async (req, res) => {
  const indicator = req.query.indicator || "life-satisfaction";
  const config = INDICATOR_CONFIG[indicator];
 
  if (!config) {
    return res.status(400).json({ error: `Unknown indicator '${indicator}'` });
  }
 
  const { column, thriving, doingOk, struggling } = config;
 
  const year = req.query.year;
  const genders = toArray(req.query.gender);
  const grades = toArray(req.query.grade);
  const sesValues = toArray(req.query.ses);
 
  if (genders.length === 0 || grades.length === 0) {
    return res.json({ n: 0, indicator });
  }
 
  // mysql2 expands an array passed for a single "?" into a parenthesized,
  // comma-separated, properly-escaped list - "gender IN (?)" with params
  // [genders] becomes "gender IN ('M','F')" safely, no manual placeholder
  // building needed (unlike the Python version's _in_clause() helper).
  const whereClauses = ["gender IN (?)", "grade IN (?)"];
  const params = [genders, grades];
 
  if (year) {
    whereClauses.push("year = ?");
    params.push(year);
  }
 
  if (sesValues.length > 0) {
    whereClauses.push(`(${SES_BUCKET_SQL}) IN (?)`);
    params.push(sesValues);
  }
 
  const whereSQL = whereClauses.join(" AND ") + ` AND ${column} IS NOT NULL`;
 
  let connection;
  try {
    connection = await getConnection();
 
    const [summaryRows] = await connection.query(
      `
      SELECT
        COUNT(*) AS n,
        ROUND(AVG(${column}), 2) AS mean_score,
        ROUND(100.0 * SUM(CASE WHEN ${thriving} THEN 1 ELSE 0 END) / COUNT(*), 1) AS pct_thriving,
        ROUND(100.0 * SUM(CASE WHEN ${doingOk} THEN 1 ELSE 0 END) / COUNT(*), 1) AS pct_doing_ok,
        ROUND(100.0 * SUM(CASE WHEN ${struggling} THEN 1 ELSE 0 END) / COUNT(*), 1) AS pct_struggling,
        ROUND(100.0 * SUM(CASE WHEN LOWER(TRIM(nonenglish)) IN ${TRUE_VALUES_SQL} THEN 1 ELSE 0 END) / COUNT(*), 1) AS pct_nonenglish
      FROM ${TABLE}
      WHERE ${whereSQL}
      `,
      params
    );
 
    const summary = summaryRows[0] || { n: 0 };
 
    // mysql2 returns DECIMAL/AVG results as strings by default, not JS
    // numbers - same underlying issue as the Python Decimal-to-string bug
    // we hit earlier, just Node's version of it. Cast explicitly so the
    // JSON response carries real numbers (app.js calls .toFixed() on these).
    summary.n = Number(summary.n) || 0;
    ["mean_score", "pct_thriving", "pct_doing_ok", "pct_struggling", "pct_nonenglish"].forEach((field) => {
      if (summary[field] !== null && summary[field] !== undefined) {
        summary[field] = Number(summary[field]);
      }
    });
 
    let topCulture = null;
    let topCulturePct = null;
 
    if (summary.n) {
      const [cultureRows] = await connection.query(
        `
        SELECT culture, COUNT(*) AS cnt
        FROM ${TABLE}
        WHERE ${whereSQL}
          AND LOWER(TRIM(nonenglish)) IN ${TRUE_VALUES_SQL}
        GROUP BY culture
        ORDER BY cnt DESC
        LIMIT 1
        `,
        params
      );
 
      const top = cultureRows[0];
      if (top) {
        const nonenglishTotal = Math.round((summary.n * summary.pct_nonenglish) / 100);
        topCulture = top.culture;
        topCulturePct = nonenglishTotal
          ? Math.round(((100 * top.cnt) / nonenglishTotal) * 10) / 10
          : null;
      }
    }
 
    summary.indicator = indicator;
    summary.top_culture = topCulture;
    summary.top_culture_pct = topCulturePct;
 
    res.json(summary);
  } catch (error) {
    console.error("indicator-summary error:", error.message);
    res.status(500).json({ error: "Could not retrieve indicator summary." });
  } finally {
    if (connection) await connection.end();
  }
});
 
// ?indicator=life-satisfaction|depression&groupBy=gender|grade&year=2025&gender=M&gender=F&grade=3&grade=4&ses=Low
// Powers the Plotly comparison chart: same filters as /api/indicator-summary,
// but broken out per value of `groupBy` instead of collapsed into one
// aggregate - replaces the old fixed /api/depression route, which always
// averaged the whole table with no filtering at all.
app.get("/api/indicator-breakdown", async (req, res) => {
  const indicator = req.query.indicator || "life-satisfaction";
  const config = INDICATOR_CONFIG[indicator];
 
  if (!config) {
    return res.status(400).json({ error: `Unknown indicator '${indicator}'` });
  }
 
  const groupBy = req.query.groupBy === "grade" ? "grade" : "gender";
  const { column } = config;
 
  const year = req.query.year;
  const genders = toArray(req.query.gender);
  const grades = toArray(req.query.grade);
  const sesValues = toArray(req.query.ses);
 
  if (genders.length === 0 || grades.length === 0) {
    return res.json({ groupBy, groups: [] });
  }
 
  const whereClauses = ["gender IN (?)", "grade IN (?)"];
  const params = [genders, grades];
 
  if (year) {
    whereClauses.push("year = ?");
    params.push(year);
  }
 
  if (sesValues.length > 0) {
    whereClauses.push(`(${SES_BUCKET_SQL}) IN (?)`);
    params.push(sesValues);
  }
 
  const whereSQL = whereClauses.join(" AND ") + ` AND ${column} IS NOT NULL`;
 
  let connection;
  try {
    connection = await getConnection();
 
    const [rows] = await connection.query(
      `
      SELECT
        ${groupBy} AS group_value,
        COUNT(*) AS n,
        ROUND(AVG(${column}), 2) AS mean_score
      FROM ${TABLE}
      WHERE ${whereSQL}
      GROUP BY ${groupBy}
      ORDER BY ${groupBy}
      `,
      params
    );
 
    const groups = rows.map((row) => ({
      group_value: row.group_value,
      n: Number(row.n) || 0,
      mean_score: row.mean_score !== null ? Number(row.mean_score) : null,
    }));
 
    res.json({ indicator, groupBy, groups });
  } catch (error) {
    console.error("indicator-breakdown error:", error.message);
    res.status(500).json({ error: "Could not retrieve indicator breakdown." });
  } finally {
    if (connection) await connection.end();
  }
});
 
app.listen(PORT, () => {
  console.log(`Dashboard running at http://localhost:${PORT}`);
});

