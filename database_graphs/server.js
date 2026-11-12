const path = require("node:path");

require("dotenv").config({
  path: path.join(__dirname, ".env")
});

const mysql = require("mysql2/promise");
const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

// The original four-page site uses explicit .html navigation.
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});
app.get("/home.html", (req, res) => {
  res.redirect(302, `/index.html${req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : ""}`);
});
app.get("/explore", (req, res) => {
  res.redirect(302, `/explore.html${req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : ""}`);
});

// Everything the browser needs (index.html, app.js, style.css) lives in
// public/, served flat at the site root — e.g. public/app.js is reachable
// at /app.js. No Flask-style templates/static split, and no {{ url_for(...) }}
// syntax in index.html (Express doesn't understand Jinja) - plain
// <script src="app.js"> and <link href="style.css"> tags instead.
app.use(express.static(path.join(__dirname, "public"), { extensions: ["html"] }));

const TABLES = {
  2023: "student_info_2023",
  2024: "student_info_2024",
  2025: "student_info_2025"
};

function getTable(year = 2023) {
  const table = TABLES[year];

  if (!table) {
    throw new Error(`Table configuration missing for year ${year}`);
  }

  return table;
}

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
const SIGNIFICANCE_THRESHOLD = 0.05;

const GENDER_BUCKETS = [
  { key: "Male", codes: ["M"] },
  { key: "Female", codes: ["F"] },
  {
    key: "Gender diverse / not reported",
    codes: ["O", "P"]
  }
];
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
    column: "ds_score",
    thriving: "ds_score BETWEEN 2 AND 3",
    doingOk: "ds_score BETWEEN 4 AND 5",
    struggling: "ds_score BETWEEN 6 AND 8",
  },

  "connection-to-nature": {
    column: "IINS",
    thriving: "IINS >= 4",
    doingOk: "IINS = 3",
    struggling: "IINS BETWEEN 1 AND 2",
},

  hope: {
    column: "chs_score",
    thriving: "chs_score >= 28",
    doingOk: "chs_score BETWEEN 19 AND 27",
    struggling: "chs_score BETWEEN 6 AND 18",
  },

  // Both spellings are supported so existing frontend references
  // to "anxity" or "anxiety" can work.
  anxity: {
    column: "as_score",
    thriving: "as_score >= 6",
    doingOk: "as_score BETWEEN 4 AND 5",
    struggling: "as_score BETWEEN 2 AND 3",
  },

  anxiety: {
    column: "as_score",
    thriving: "as_score >= 6",
    doingOk: "as_score BETWEEN 4 AND 5",
    struggling: "as_score BETWEEN 2 AND 3",
  },

  "school-engagement": {
    column: "se_score",
    scoreOnly: true,
    responseCategories: ["Never/Rarely", "Sometimes", "Often", "Always"],
  },

  friendship: {
    column: "friendship_score",
    scoreOnly: true,
    responseCategories: ["Never/Rarely", "Sometimes", "Often", "Always"],
  },

  family: {
    column: "fs_score",
    scoreOnly: true,
    responseCategories: ["Never/Rarely", "Sometimes", "Often", "Always"],
  },

  "experience-of-being-bullied": {
    column: "ebb_score",
    scoreOnly: true,
    responseCategories: ["Daily", "Weekly", "Monthly", "Never"],
  },

  "healthy-eating": {
    column: "ry35",
    scoreOnly: true,
  },

  "adequate-sleep": {
    column: "sun3",
    scoreOnly: true,
  },

  "physically-active": {
    column: "ry36",
    scoreOnly: true,
  },
};

// Derived purely from seifa_decile (int, nullable) - confirmed against the
// real schema that student_info_2023 has no separate "ses_level" text
// column (SHOW COLUMNS only returns seifa_decile), so the earlier version
// of this CASE that checked "ses_level IN (...)" first was referencing a
// column that doesn't exist and failed with "Unknown column 'ses_level'"
// the moment SES was actually used in a WHERE clause. NULL seifa_decile
// (missing SEIFA data) falls through to the ELSE, same as any decile
// outside 1-10 would.
const SES_BUCKET_SQL = `
  CASE
    WHEN seifa_decile BETWEEN 1 AND 3 THEN 'Low'
    WHEN seifa_decile BETWEEN 4 AND 7 THEN 'Mid'
    WHEN seifa_decile BETWEEN 8 AND 10 THEN 'High'
    ELSE 'Unknown SES'
  END
`;

// SQL version of the same M/F/"Gender diverse / not reported" bucketing the
// GENDER_BUCKETS array below applies in JS for the narrative endpoint - used
// by /api/indicator-breakdown so a gender-grouped chart shows the same three
// buckets instead of every distinct gender code (M/F/O/P/...) as its own
// group. Keep these two in sync if the bucket definition ever changes.
const GENDER_BUCKET_SQL = `
  CASE
    WHEN gender = 'M' THEN 'Male'
    WHEN gender = 'F' THEN 'Female'
    ELSE 'Gender diverse / not reported'
  END
`;

function toArray(value) {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

const DATABASES = {
  2023: process.env.DB_NAME_2023 || process.env.DB_NAME,
  2024: process.env.DB_NAME_2024,
  2025: process.env.DB_NAME_2025
};
// Only advertise years with configured database connections.
const configuredYears = Object.keys(DATABASES).filter(year => DATABASES[year]).map(Number);
function getConnection(year = 2023) {
  const database = DATABASES[year];

  if (!database) {
    throw new Error(`Database configuration missing for year ${year}`);
  }

  return mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: database,
    port: Number(process.env.DB_PORT || 3306),
  });
}

// Distinct years/grades actually present in the table, so the filter
// dropdown/checkboxes in app.js always match real data.

app.get("/api/filter-options", async (req, res) => {
  const year = Number(req.query.year || 2023);
  let connection;

  try {
    const table = getTable(year);

    connection = await getConnection(year);

    const [gradeRows] = await connection.query(
      `SELECT DISTINCT grade
       FROM ${table}
       WHERE grade IS NOT NULL
       ORDER BY grade`
    );

    res.json({
      years: configuredYears,
      grades: gradeRows.map((row) => row.grade),
    });

  } catch (error) {
    console.error("filter-options error:", error);
    res.status(500).json({
      error: "Could not retrieve filter options."
    });

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
    return res.status(400).json({
      error: `Unknown indicator '${indicator}'`
    });
  }

  const {
    column,
    thriving,
    doingOk,
    struggling,
    scoreOnly,
    responseCategories
  } = config;

  const year = Number(req.query.year || 2023);
  const genders = toArray(req.query.gender);
  const grades = toArray(req.query.grade);
  const sesValues = toArray(req.query.ses);

  let table;

  try {
    table = getTable(year);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

  if (genders.length === 0 || grades.length === 0) {
    return res.json({ n: 0, indicator });
  }

  const whereClauses = ["gender IN (?)", "grade IN (?)"];
  const params = [genders, grades];

  if (sesValues.length > 0) {
    whereClauses.push(`(${SES_BUCKET_SQL}) IN (?)`);
    params.push(sesValues);
  }

  const whereSQL =
    whereClauses.join(" AND ") + ` AND ${column} IS NOT NULL`;

  // Indicators with outcome bands use the thriving / doing OK /
  // struggling percentages. Score-only indicators do not.
  const outcomeFields = scoreOnly
    ? ""
    : `,
        ROUND(
          100.0 * SUM(CASE WHEN ${thriving} THEN 1 ELSE 0 END) / COUNT(*),
          1
        ) AS pct_thriving,

        ROUND(
          100.0 * SUM(CASE WHEN ${doingOk} THEN 1 ELSE 0 END) / COUNT(*),
          1
        ) AS pct_doing_ok,

        ROUND(
          100.0 * SUM(CASE WHEN ${struggling} THEN 1 ELSE 0 END) / COUNT(*),
          1
        ) AS pct_struggling,

        ROUND(
          100.0 * SUM(
            CASE
              WHEN LOWER(TRIM(nonenglish)) IN ${TRUE_VALUES_SQL}
              THEN 1 ELSE 0
            END
          ) / COUNT(*),
          1
        ) AS pct_nonenglish`;

  // Four response-category percentages for indicators that have
  // responseCategories configured.
  const responseCategoryFields = responseCategories
    ? `,
        ROUND(
          100.0 * SUM(
            CASE WHEN ${column} >= 0.5 AND ${column} < 1.5
            THEN 1 ELSE 0 END
          ) / NULLIF(
            SUM(CASE WHEN ${column} >= 0.5 THEN 1 ELSE 0 END),
            0
          ),
          1
        ) AS pct_category_1,

        ROUND(
          100.0 * SUM(
            CASE WHEN ${column} >= 1.5 AND ${column} < 2.5
            THEN 1 ELSE 0 END
          ) / NULLIF(
            SUM(CASE WHEN ${column} >= 0.5 THEN 1 ELSE 0 END),
            0
          ),
          1
        ) AS pct_category_2,

        ROUND(
          100.0 * SUM(
            CASE WHEN ${column} >= 2.5 AND ${column} < 3.5
            THEN 1 ELSE 0 END
          ) / NULLIF(
            SUM(CASE WHEN ${column} >= 0.5 THEN 1 ELSE 0 END),
            0
          ),
          1
        ) AS pct_category_3,

        ROUND(
          100.0 * SUM(
            CASE WHEN ${column} >= 3.5
            THEN 1 ELSE 0 END
          ) / NULLIF(
            SUM(CASE WHEN ${column} >= 0.5 THEN 1 ELSE 0 END),
            0
          ),
          1
        ) AS pct_category_4`
    : "";

  let connection;

  try {
    connection = await getConnection(year);

    const [summaryRows] = await connection.query(
      `
      SELECT
        COUNT(*) AS n,
        ROUND(AVG(${column}), 2) AS mean_score
        ${outcomeFields}
        ${responseCategoryFields}
      FROM ${table}
      WHERE ${whereSQL}
      `,
      params
    );

    const summary = summaryRows[0] || { n: 0 };

    summary.n = Number(summary.n) || 0;

    [
      "mean_score",
      "pct_thriving",
      "pct_doing_ok",
      "pct_struggling",
      "pct_nonenglish",
      "pct_category_1",
      "pct_category_2",
      "pct_category_3",
      "pct_category_4"
    ].forEach((field) => {
      if (summary[field] !== null && summary[field] !== undefined) {
        summary[field] = Number(summary[field]);
      }
    });

    let topCulture = null;
    let topCulturePct = null;

    // Culture calculations apply only to indicators with outcome bands.
    if (summary.n && !scoreOnly) {
      const [cultureRows] = await connection.query(
        `
        SELECT culture, COUNT(*) AS cnt
        FROM ${table}
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
        const nonenglishTotal = Math.round(
          (summary.n * summary.pct_nonenglish) / 100
        );

        topCulture = top.culture;

        topCulturePct = nonenglishTotal
          ? Math.round((100 * top.cnt / nonenglishTotal) * 10) / 10
          : null;
      }
    }

    summary.indicator = indicator;
    summary.top_culture = topCulture;
    summary.top_culture_pct = topCulturePct;

    if (responseCategories) {
      summary.response_categories = responseCategories;
    }

    res.json(summary);

  } catch (error) {
    console.error("indicator-summary error:", error.message);

    res.status(500).json({
      error: "Could not retrieve indicator summary."
    });

  } finally {
    if (connection) await connection.end();
  }
});

// ?indicator=life-satisfaction|depression&groupBy=gender|grade&year=2025&gender=M&gender=F&grade=3&grade=4&ses=Low&splitBySes=true
// Powers the Plotly comparison chart: same filters as /api/indicator-summary,
// but broken out per value of `groupBy` instead of collapsed into one
// aggregate - replaces the old fixed /api/depression route, which always
// averaged the whole table with no filtering at all.
//
// splitBySes adds SES as a SECOND grouping dimension on top of groupBy, so
// the caller gets one row per (groupBy value, SES band) instead of one row
// per groupBy value - e.g. Male/Low, Male/Mid, Male/High, Female/Low, ...
// This is deliberately scoped to depression only for now (same reasoning as
// the rest of this endpoint's depression-specific handling) - any other
// indicator ignores the flag and keeps the single-dimension response it
// always had, so nothing about Life Satisfaction changes.
app.get("/api/indicator-breakdown", async (req, res) => {
  const indicator = req.query.indicator || "life-satisfaction";
  const config = INDICATOR_CONFIG[indicator];

  if (!config) {
    return res.status(400).json({
      error: `Unknown indicator '${indicator}'`
    });
  }

  const groupBy = req.query.groupBy === "grade" ? "grade" : "gender";
  const { column } = config;

  const year = Number(req.query.year || 2023);
  const genders = toArray(req.query.gender);
  const grades = toArray(req.query.grade);
  const sesValues = toArray(req.query.ses);

  let table;

  try {
    table = getTable(year);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

  const splitBySes =
    indicator === "depression" && req.query.splitBySes === "true";

  if (genders.length === 0 || grades.length === 0) {
    return res.json({
      indicator,
      groupBy,
      splitBySes,
      groups: []
    });
  }

  const whereClauses = ["gender IN (?)", "grade IN (?)"];
  const params = [genders, grades];

  if (sesValues.length > 0) {
    whereClauses.push(`(${SES_BUCKET_SQL}) IN (?)`);
    params.push(sesValues);
  }

  const whereSQL =
    whereClauses.join(" AND ") + ` AND ${column} IS NOT NULL`;

  const groupByExpr =
    groupBy === "gender"
      ? `(${GENDER_BUCKET_SQL})`
      : "grade";

  const groupOrderSQL =
    groupBy === "gender"
      ? "FIELD(group_value, 'Male', 'Female', 'Gender diverse / not reported')"
      : "group_value";

  let connection;

  try {
    connection = await getConnection(year);

    let rows;

    if (splitBySes) {
      [rows] = await connection.query(
        `
        SELECT
          ${groupByExpr} AS group_value,
          (${SES_BUCKET_SQL}) AS ses_bucket,
          COUNT(*) AS n,
          ROUND(AVG(${column}), 2) AS mean_score
        FROM ${table}
        WHERE ${whereSQL}
        GROUP BY group_value, ses_bucket
        ORDER BY
          ${groupOrderSQL},
          (FIELD(ses_bucket, 'Low', 'Mid', 'High') = 0),
          FIELD(ses_bucket, 'Low', 'Mid', 'High')
        `,
        params
      );

    } else {
      [rows] = await connection.query(
        `
        SELECT
          ${groupByExpr} AS group_value,
          COUNT(*) AS n,
          ROUND(AVG(${column}), 2) AS mean_score
        FROM ${table}
        WHERE ${whereSQL}
        GROUP BY group_value
        ORDER BY ${groupOrderSQL}
        `,
        params
      );
    }

    const groups = rows.map((row) => {
      const group = {
        group_value: row.group_value,
        n: Number(row.n) || 0,
        mean_score:
          row.mean_score !== null
            ? Number(row.mean_score)
            : null
      };

      if (splitBySes) {
        group.ses = row.ses_bucket;
      }

      return group;
    });

    res.json({
      indicator,
      groupBy,
      splitBySes,
      groups
    });

  } catch (error) {
    console.error("indicator-breakdown error:", error.message);

    res.status(500).json({
      error: "Could not retrieve indicator breakdown."
    });

  } finally {
    if (connection) await connection.end();
  }
});

// Standard normal CDF via the Abramowitz & Stegun 7.1.26 erf approximation
// (|error| < 1.5e-7) - no external stats library needed server-side.
function normalCdf(x) {
  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * absX);
  const y =
    1 -
    (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t +
      0.254829592) *
      t *
      Math.exp(-absX * absX);
  return 0.5 * (1 + sign * y);
}

function twoTailedPFromZ(z) {
  return Math.min(1, Math.max(0, 2 * (1 - normalCdf(Math.abs(z)))));
}

// Mann-Whitney U test on two arrays of raw scores, normal approximation
// with a tie correction (appropriate here - ds_score only takes a handful
// of distinct integer values, so ties are the norm, not the exception).
function mannWhitneyU(sampleA, sampleB) {
  const n1 = sampleA.length;
  const n2 = sampleB.length;
  if (n1 === 0 || n2 === 0) return { p: null, higherGroup: null };

  const combined = sampleA
    .map((v) => ({ v, group: "A" }))
    .concat(sampleB.map((v) => ({ v, group: "B" })))
    .sort((a, b) => a.v - b.v);

  const ranks = new Array(combined.length);
  const tieGroupSizes = [];
  let i = 0;
  while (i < combined.length) {
    let j = i;
    while (j + 1 < combined.length && combined[j + 1].v === combined[i].v) j++;
    const avgRank = (i + j) / 2 + 1; // 1-based, averaged across the tie block
    for (let k = i; k <= j; k++) ranks[k] = avgRank;
    tieGroupSizes.push(j - i + 1);
    i = j + 1;
  }

  let rankSumA = 0;
  combined.forEach((item, idx) => {
    if (item.group === "A") rankSumA += ranks[idx];
  });

  const U1 = rankSumA - (n1 * (n1 + 1)) / 2;
  const U2 = n1 * n2 - U1;
  const U = Math.min(U1, U2);

  const N = n1 + n2;
  const tieSum = tieGroupSizes.reduce((sum, t) => sum + (t ** 3 - t), 0);
  const varU = (n1 * n2 / 12) * (N + 1 - tieSum / (N * (N - 1)));
  const meanU = (n1 * n2) / 2;

  const z = varU > 0 ? (U - meanU) / Math.sqrt(varU) : 0;
  const p = twoTailedPFromZ(z);

  // U1 (rank sum of A) > expected under H0 means A tends to rank higher,
  // i.e. A's scores skew higher than B's - that's "A has the higher mean"
  // for the plain-language direction, even though the test itself compares
  // whole distributions, not means specifically.
  const higherGroup = U1 > n1 * n2 - U1 ? "A" : "B";

  return { p, higherGroup };
}

// Two-proportion z-test comparing "% of students with high symptoms"
// between two groups.
function twoProportionZTest(highA, nA, highB, nB) {
  if (nA === 0 || nB === 0) return { p: null, higherGroup: null };

  const pA = highA / nA;
  const pB = highB / nB;
  const pooled = (highA + highB) / (nA + nB);
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / nA + 1 / nB));

  if (se === 0) return { p: 1, higherGroup: null };

  const z = (pA - pB) / se;
  const p = twoTailedPFromZ(z);
  const higherGroup = pA > pB ? "A" : "B";

  return { p, higherGroup };
}

// Shared by both groupBy modes below: turns {bucketKey: [scores...]} into
// {bucketKey: {n, mean, sd, pct_low, pct_mid, pct_high, _countHigh}}.
function summarizeBuckets(samples) {
  const groups = {};
  Object.keys(samples).forEach((key) => {
    const scores = samples[key];
    const n = scores.length;

    if (n === 0) {
      groups[key] = { n: 0, mean: null, sd: null, pct_low: null, pct_mid: null, pct_high: null, _countHigh: 0 };
      return;
    }

    const mean = scores.reduce((sum, v) => sum + v, 0) / n;
    const variance = n > 1 ? scores.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (n - 1) : 0;
    const sd = Math.sqrt(variance);

    const countLow = scores.filter((v) => v >= 2 && v <= 3).length;
    const countMid = scores.filter((v) => v >= 4 && v <= 5).length;
    const countHigh = scores.filter((v) => v >= 6 && v <= 8).length;

    groups[key] = {
      n,
      mean: Math.round(mean * 100) / 100,
      sd: Math.round(sd * 100) / 100,
      pct_low: Math.round((countLow / n) * 1000) / 10,
      pct_mid: Math.round((countMid / n) * 1000) / 10,
      pct_high: Math.round((countHigh / n) * 1000) / 10,
      _countHigh: countHigh, // used for the proportion test below, not returned
    };
  });
  return groups;
}

// Shared by both groupBy modes: runs both significance tests over every
// pair in `pairs` that actually has data on both sides, strips the
// internal-only _countHigh field from `groups` afterward.
function buildComparisons(pairs, groups, samples) {
  const comparisons = pairs
    .filter(([a, b]) => groups[a] && groups[b] && groups[a].n > 0 && groups[b].n > 0)
    .map(([a, b]) => {
      const meanTest = mannWhitneyU(samples[a], samples[b]);
      const proportionTest = twoProportionZTest(
        groups[a]._countHigh,
        groups[a].n,
        groups[b]._countHigh,
        groups[b].n
      );

      return {
        groupA: a,
        groupB: b,
        mean_p: meanTest.p !== null ? Math.round(meanTest.p * 1000) / 1000 : null,
        mean_significant: meanTest.p !== null && meanTest.p < SIGNIFICANCE_THRESHOLD,
        mean_higher_group: meanTest.higherGroup === "A" ? a : meanTest.higherGroup === "B" ? b : null,
        proportion_p: proportionTest.p !== null ? Math.round(proportionTest.p * 1000) / 1000 : null,
        proportion_significant:
          proportionTest.p !== null && proportionTest.p < SIGNIFICANCE_THRESHOLD,
        proportion_higher_group:
          proportionTest.higherGroup === "A" ? a : proportionTest.higherGroup === "B" ? b : null,
      };
    });

  Object.values(groups).forEach((g) => delete g._countHigh);
  return comparisons;
}


// ?indicator=depression&groupBy=gender|grade&year=2023&grade=3&grade=4&gender=M&ses=Low
//
// groupBy=gender (default): mirrors the chart's Gender comparison mode.
// Gender is what's being compared, so the Gender filter is ignored entirely
// (always all three buckets); Grade/SES/Year narrow the population as usual.
//
// groupBy=grade: mirrors the chart's Grade comparison mode instead. Grade
// is now the breakout dimension (one bucket per selected grade value, e.g.
// "Grade 3", "Grade 4", ...), so the Grade filter picks WHICH grades to
// break out rather than filtering the population; Gender/SES/Year narrow
// the population instead. Comparisons are EVERY pair of selected grades
// (explicit choice - with many grades selected this can be a long
// paragraph, e.g. 10 grades = 45 pairwise sentences).
app.get("/api/depression-narrative", async (req, res) => {
  const year = Number(req.query.year || 2023);
  let table;
  try {
    table = getTable(year);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
  const config = INDICATOR_CONFIG.depression;
  const { column } = config;

  const groupBy = req.query.groupBy === "grade" ? "grade" : "gender";

  const grades = toArray(req.query.grade);
  const genders = toArray(req.query.gender);
  const sesValues = toArray(req.query.ses);

  if (grades.length === 0 || (groupBy === "grade" && genders.length === 0)) {
    return res.json({ groupBy, groups: {}, comparisons: [], significanceThreshold: SIGNIFICANCE_THRESHOLD });
  }

  const whereClauses = ["grade IN (?)", `${column} IS NOT NULL`];
  const params = [grades];

  // Only filter by gender when grade is the breakout dimension - when
  // gender IS the breakout dimension, filtering by it first would defeat
  // the point (see comment above).
  if (groupBy === "grade") {
    whereClauses.push("gender IN (?)");
    params.push(genders);
  }


  if (sesValues.length > 0) {
    whereClauses.push(`(${SES_BUCKET_SQL}) IN (?)`);
    params.push(sesValues);
  }

  const whereSQL = whereClauses.join(" AND ");

  let connection;
  try {
    connection = await getConnection(year);
    // Raw per-row (gender, grade, score), not pre-aggregated - Mann-Whitney
    // U needs the actual distribution, not just a mean. Fine at this scale
    // (one school-level dataset, not a live production analytics query).
    const [rows] = await connection.query(
      `SELECT gender, grade, ${column} AS score FROM ${table} WHERE ${whereSQL}`,
      params
    );

    const samples = {};
    let pairs;

    if (groupBy === "gender") {
      GENDER_BUCKETS.forEach((bucket) => {
        samples[bucket.key] = [];
      });
      rows.forEach((row) => {
        const bucket = GENDER_BUCKETS.find((b) => b.codes.includes(row.gender));
        if (bucket) samples[bucket.key].push(Number(row.score));
      });

      pairs = [
        ["Female", "Male"],
        ["Gender diverse / not reported", "Male"],
        ["Gender diverse / not reported", "Female"],
      ];
    } else {
      // One bucket per distinct grade actually present, sorted numerically
      // (not alphabetically - "Grade 10" would otherwise sort before
      // "Grade 3"), labelled "Grade <n>" so the frontend doesn't need to
      // know this endpoint's bucket-naming convention.
      const distinctGrades = Array.from(new Set(rows.map((r) => r.grade))).sort(
        (a, b) => Number(a) - Number(b)
      );
      const bucketKeys = distinctGrades.map((g) => `Grade ${g}`);
      bucketKeys.forEach((key) => {
        samples[key] = [];
      });
      rows.forEach((row) => {
        samples[`Grade ${row.grade}`].push(Number(row.score));
      });

      // Every pair, ascending (Grade 3 vs 4, 3 vs 5, ..., 4 vs 5, ...) -
      // explicit choice over just consecutive pairs, so this can get long
      // with many grades selected.
      pairs = [];
      for (let i = 0; i < bucketKeys.length; i++) {
        for (let j = i + 1; j < bucketKeys.length; j++) {
          pairs.push([bucketKeys[i], bucketKeys[j]]);
        }
      }
    }

    const groups = summarizeBuckets(samples);
    const comparisons = buildComparisons(pairs, groups, samples);

    res.json({ groupBy, groups, comparisons, significanceThreshold: SIGNIFICANCE_THRESHOLD });
  } catch (error) {
    console.error("depression-narrative error:", error.message);
    res.status(500).json({ error: "Could not compute depression narrative." });
  } finally {
    if (connection) await connection.end();
  }
});

app.listen(PORT, () => {
  console.log(`Dashboard running at http://localhost:${PORT}`);
});
