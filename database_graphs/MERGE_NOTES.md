# Capstone merge notes (Albert + Prajwal)

## Source and scope

- Base: `Capstone_git/database_graphs` (Albert). Original Home, Explore, Methodology, About, assets, CSS, PDF, and responsive navigation are retained.
- Integrated: `database_graphs-2/public/app.js` and `database_graphs-2/server.js` (Prajwal), preserving the newer multi-year API, expanded indicator summaries and charts, and depression narratives.
- Statistical helper functions (`normalCdf`, `mannWhitneyU`, `twoProportionZTest`, `summarizeBuckets`, `buildComparisons`) were **missing** in Prajwal's active `server.js`; restored from his bundled `server.js.bak-before-dedup`, not independently invented.
- The two codebases' SES UIs differed: retained Albert's **Low/Mid/High multi-select without a separate All**; changed Prajwal's requests/listeners to work with it. All three selected by default.
- Removed redundant navigation clicks from `explore-entry.js`; the integrated `app.js` handles `domain` and `indicator` URL parameters. Unified responsive header still loads. Existing About/Explore methodology shortcuts now point to the independent Methodology page.
- Added Life Satisfaction to the live outcome-card renderer; old original cards remain hidden templates for the new cards.
- Matched API settings to both `.env` formats: `DB_NAME` works as a 2023 fallback; `DB_NAME_2023`, `_2024`, `_2025` are supported. No `.env` is included.

## Remaining verification and limitations

1. Run against a development copy of the actual MySQL schemas. Neither supplied code ZIP includes databases. Any availability of 2024/2025 depends on DB credentials, database names, and table schemas.
2. Test every filter, year, gender/grade group, two/three SES selections, chart, narrative, navigation and PDF. Automated JS syntax and targeted unit/integration checks do not validate real dataset calculations.
3. The UI still uses preview-only placeholders for indicators outside the implemented live chart set (Depression, Life Satisfaction, Hope, Anxiety, Connection to Nature). The backend exposes other indicators, but they are not all fully wired to frontend charts.
4. The existing code groups raw gender `P` (Prefer not to say) with the diverse/not-reported bucket. This is a **known data-governance decision that must be confirmed with RYA**; it has not been silently changed as part of this code merge.
5. Significance testing uses the statistical methods from Prajwal's backup. Confirm score ranges, significance assumptions, sample restrictions and interpretation against the approved scoring documentation before publishing.
6. PDF layout depends on Chrome print settings and the real chart geometry; print-preview QA is necessary.
7. The source ZIPs contain `.env` files. Do **not** commit or share those files. This merged deliverable excludes `.env`, `.git`, `node_modules`, backups and auxiliary patch scripts.

## Local setup (PowerShell)

Do not overwrite your existing Git branch. Make a separate copy of this folder to review. From that folder:

```powershell
npm install
# Create your own .env locally with DB_HOST, DB_PORT, DB_USER, DB_PASSWORD
# and DB_NAME_2023 (or DB_NAME), optionally DB_NAME_2024, DB_NAME_2025
node server.js
```

Test `http://localhost:3000/index.html`, `/explore.html?domain=learning`, `/methodology.html` and `/about.html`. If you want to apply these changes to the existing integration branch, copy **only the reviewed changed source files** from the merged folder into the branch, run your own regression checks, then `git add`/`commit`/`push`.
