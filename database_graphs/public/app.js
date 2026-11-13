console.log("APP.JS IS CONNECTED");

// =============================================================================
// DATA LAYER — migrated off client-side CSV loading onto the Node/Express
// API (server.js). Everything that used to filter an in-memory `rawData`
// array now calls /api/filter-options, /api/indicator-summary, and
// /api/indicator-breakdown instead.
// =============================================================================

let availableYears = [];
let availableGrades = [];

// UI shows friendly labels; the real `gender` column stores single-letter
// codes. ASSUMPTION (unconfirmed against the real schema): O and P both
// fold into the "Other/Not Reported" bucket shown in the UI. Used to build
// the gender filter checkboxes and turn the checked labels back into raw
// codes for the WHERE clause (genderLabelToCodes below).
//
// Chart axis/tile labels used to need their own code -> label translation
// here (formatGender()), but /api/indicator-breakdown now returns
// display-ready group values for gender grouping too (see GENDER_BUCKET_SQL
// in server.js, which buckets into the same Male/Female/"Gender diverse /
// not reported" groups the narrative endpoint uses) - so that translation
// moved server-side and this file no longer needs its own copy of it.
const GENDER_CODES = {
    "Male": ["M"],
    "Female": ["F"],
    "Other/Not Reported": ["O", "P"],
};

function genderLabelToCodes(label) {
    return GENDER_CODES[label] || [label];
}

async function fetchJSON(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${url}`);
    }
    return response.json();
}

async function loadFilterOptions() {
    try {
        // Fetch available years and grades from the backend.
        const options = await fetchJSON("/api/filter-options");

        availableYears = options.years || [];
        availableGrades = options.grades || [];

    } catch (error) {
        console.error("Error loading filter options:", error);

        // Use fallback values if the backend request fails.
        availableYears = [2023, 2024, 2025];
        availableGrades = Array.from({ length: 10 }, (_, i) => i + 3);
    }

    console.log("Available years:", availableYears);
    console.log("Available grades:", availableGrades);

    // Populate the year dropdown.
    const yearSelect = document.getElementById("year");

    if (yearSelect && availableYears.length > 0) {
        const currentYear = yearSelect.value;

        yearSelect.replaceChildren();

        availableYears.forEach(year => {
            const option = document.createElement("option");
            option.value = year;
            option.textContent = year;
            yearSelect.appendChild(option);
        });

        // Keep the current year if available; otherwise select the latest year.
        yearSelect.value = availableYears.some(
            year => String(year) === String(currentYear)
        )
            ? currentYear
            : String(Math.max(...availableYears));
    }

    // Load grades for the selected year.
    await refreshGradesForSelectedYear();

    // Refresh the dashboard using the selected filters.
    await updateDashboard();
}

async function refreshGradesForSelectedYear() {
    const yearSelect = document.getElementById("year");
    const year = yearSelect?.value;

    if (!year) return;

    try {
        const options = await fetchJSON(
            `/api/filter-options?year=${encodeURIComponent(year)}`
        );

        availableGrades = options.grades || [];

        console.log(`Grades for ${year}:`, availableGrades);

        updateGroupSelectors();

    } catch (error) {
        console.error(`Could not load grades for ${year}:`, error);
    }
}

function updateGroupSelectors() {
    const grouping =
        document.getElementById("grouping").value;

    const groupOptions =
        document.getElementById("groupOptions");

    const secondaryOptions =
        document.getElementById("secondaryOptions");

    const groupLabel =
        document.getElementById("groupLabel");

    const secondaryLabel =
        document.getElementById("secondaryLabel");

    const genders = Object.keys(GENDER_CODES);

    const grades = availableGrades;

    if (grouping === "genderN") {
        groupLabel.textContent = "Gender";
        secondaryLabel.textContent = "Grade";

        fillCheckboxGroup(
            groupOptions,
            genders,
            "group-option"
        );

        fillCheckboxGroup(
            secondaryOptions,
            grades,
            "secondary-option"
        );
    } else {
        groupLabel.textContent = "Grade";
        secondaryLabel.textContent = "Gender";

        fillCheckboxGroup(
            groupOptions,
            grades,
            "group-option"
        );

        fillCheckboxGroup(
            secondaryOptions,
            genders,
            "secondary-option"
        );
    }

    groupOptions.classList.toggle(
        "grade-options",
        grouping === "grade"
    );

    secondaryOptions.classList.toggle(
        "grade-options",
        grouping === "genderN"
    );

    document
        .getElementById("groupChoiceGrid")
        .classList.toggle(
            "grade-layout",
            grouping === "grade"
        );

    document
        .getElementById("secondaryChoiceGrid")
        .classList.toggle(
            "grade-layout",
            grouping === "genderN"
        );

    document.getElementById("groupAll").checked = true;
    document.getElementById("secondaryAll").checked = true;

    updateCompareButtons(grouping);
}

function fillCheckboxGroup(
    container,
    values,
    className
) {

    container.innerHTML = "";

    values.forEach(value => {

        const label =
            document.createElement("label");

        label.className =
            "option-checkbox filter-chip";


        const checkbox =
            document.createElement("input");

        checkbox.type =
            "checkbox";

        checkbox.value =
            value;

        checkbox.className =
            className;

        checkbox.checked =
            false;


        const text =
            document.createElement("span");

        text.textContent =
            value;


        label.appendChild(
            checkbox
        );

        label.appendChild(
            text
        );

        container.appendChild(
            label
        );

    });

}

// Replaces the old getFilteredData() — instead of filtering an in-memory
// array, this builds the query string shared by /api/indicator-summary and
// /api/indicator-breakdown. The "Compare results by" toggle still only
// changes which checkboxes are labelled "group" vs "secondary" in the UI;
// the backend just wants a gender[] list and a grade[] list either way.
function buildFilterParams(options = {}) {
    const { lockYear, excludeSES } = options;

    const params = new URLSearchParams();

    const year = lockYear || document.getElementById("year").value;
    if (year) params.set("year", year);

    const grouping = document.getElementById("grouping").value;

    const secondaryAll = document.getElementById("secondaryAll").checked;

    const selectedGroups = getSelectedGroupValues();
    const selectedSecondary = secondaryAll ? [] : getSelectedSecondaryValues();

    let genderLabels;
    let grades;

    if (grouping === "genderN") {
        genderLabels = selectedGroups.length ? selectedGroups : Object.keys(GENDER_CODES);
        grades = selectedSecondary.length ? selectedSecondary : availableGrades.map(String);
    } else {
        grades = selectedGroups.length ? selectedGroups : availableGrades.map(String);
        genderLabels = selectedSecondary.length ? selectedSecondary : Object.keys(GENDER_CODES);
    }

    genderLabels
        .flatMap(genderLabelToCodes)
        .forEach(code => params.append("gender", code));

    grades.forEach(grade => params.append("grade", grade));

    // SES is a direct Low/Mid/High multi-select; there is no separate All toggle.
    if (!excludeSES) {
        const selectedSES = getSelectedSESValues();
        // When all three are selected, the API receives all three explicitly.
        // An empty selection is corrected by the SES change listener below.
        selectedSES.forEach(ses => params.append("ses", ses));
    }

    return params;
}

// Depression uses the same selected year, gender, grade and SES filters
// as the other indicators. SES clustering is controlled by shouldSplitBySes().
function buildDepressionFilterParams() {
    return buildFilterParams();
}

// --- SES split-by behaviour ---------------------------------------------
// The separate SES All toggle was removed from the UI by the frontend team.
// One checked SES band produces a normal bar chart; selecting two or three
// bands produces a clustered Depression chart (one bar per selected band).
function shouldSplitBySes() {
    // Compare two or three SES bands inside a single Depression chart.
    return getSelectedSESValues().length > 1;
}


function setupEvents() {
    const groupingSelect = document.getElementById("grouping");

    // Gender and Grade comparison buttons — the click listener is attached
    // exactly once here. (updateCompareButtons() used to also attach a
    // listener every time it ran, including from inside this same listener,
    // which meant every toggle stacked another handler on top of the last
    // one and fired it more times than the click before. Fixed by making
    // updateCompareButtons() a pure visual-state updater — see below.)
    document.querySelectorAll(".compare-button").forEach(button => {
        button.addEventListener("click", function () {
            const grouping = this.dataset.grouping;

            groupingSelect.value = grouping;

            updateCompareButtons(grouping);
            updateGroupSelectors();
            updateDashboard();
        });
    });

    // Handle changes to the grouping dropdown
    groupingSelect.addEventListener("change", function () {
        updateCompareButtons(groupingSelect.value);
        updateGroupSelectors();
        updateDashboard();
    });

    // Filter groups
    const filterGroups = [
        {
            allId: "groupAll",
            containerId: "groupOptions",
            optionSelector: ".group-option"
        },
        {
            allId: "secondaryAll",
            containerId: "secondaryOptions",
            optionSelector: ".secondary-option"
        }
    ];

    filterGroups.forEach(group => {
        const allCheckbox = document.getElementById(group.allId);
        const container = document.getElementById(group.containerId);

        if (!allCheckbox || !container) {
            console.warn("Filter elements not found:", group);
            return;
        }

        allCheckbox.addEventListener("change", function () {
            selectAllOption(
                allCheckbox,
                group.optionSelector
            );

            updateDashboard();
        });

        container.addEventListener("change", function (event) {
            if (!event.target.matches(group.optionSelector)) {
                return;
            }

            updateAllOption(
                allCheckbox,
                group.optionSelector,
                group.collapseWhenFullySelected
            );

            updateDashboard();
        });
    });

    // SES has no separate "All" checkbox. Keep at least one band selected.
    const sesContainer = document.getElementById("sesOptions");
    sesContainer?.addEventListener("change", event => {
        if (!event.target.matches(".ses-option")) return;
        const sesBoxes = [...sesContainer.querySelectorAll(".ses-option")];
        if (!sesBoxes.some(box => box.checked)) {
            event.target.checked = true;
        }
        updateDashboard();
    });

    // The same SES listener drives filtered summaries and clustered charts.

    // Year selector
    const yearSelect = document.getElementById("year");

    if (yearSelect) {
        yearSelect.addEventListener("change", async function () {
            await refreshGradesForSelectedYear();
            await updateDashboard();
        });
    }

    // Reset filters
    const resetButton = document.getElementById("resetFilters");

    if (resetButton) {
        resetButton.addEventListener("click", async function () {
            groupingSelect.value = "genderN";
            updateCompareButtons("genderN");
            

            document.querySelectorAll(".ses-option").forEach(box => {
                box.checked = true;
            });

            if (availableYears.length > 0) {
                document.getElementById("year").value =
                    Math.max(...availableYears);
            }
            await refreshGradesForSelectedYear();

            updateGroupSelectors();
            updateDashboard();
        });
    }

    // Set the initial selected comparison button
    updateCompareButtons(groupingSelect.value || "genderN");
}


// Fetch and render live data for Depression, Life Satisfaction, Hope,
// Anxiety and Connection to Nature. Other indicators remain previews.


function getIndicatorLabel(indicator) {
    const labels = {
        "hope": "Hope",
        "life-satisfaction": "Life Satisfaction",
        "connection-to-nature": "Connection to Nature",
        "anxiety": "Anxiety"
    };

    return labels[indicator] || indicator;
}


async function loadAndRenderSummary(indicator, renderFunction) {
    try {
        const params = buildFilterParams();

        params.set("indicator", indicator);

        const stats = await fetchJSON(
            `/api/indicator-summary?${params.toString()}`
        );

        renderFunction(stats);

    } catch (error) {
        console.error(
            `Error loading ${indicator} summary:`,
            error
        );

        renderFunction(null);
    }
}


async function updateDashboard() {

    if (activeIndicatorId === "depression") {

        await Promise.all([
            loadAndRenderSummary(
                "depression",
                updateDepressionSummary
            ),
            updateDepressionCharts(),
            updateDepressionNarrative()
        ]);

    } else {

        const summaryFunctions = {
            "hope": updateHopeSummary,
            "life-satisfaction": updateLifeSatisfactionSummary,
            "connection-to-nature": updateConnectionToNatureSummary,
            "anxiety": updateAnxietySummary
        };

        const summaryFunction =
            summaryFunctions[activeIndicatorId];

        if (summaryFunction) {

            await Promise.all([
                loadAndRenderSummary(
                    activeIndicatorId,
                    summaryFunction
                ),
                updateIndicatorCharts(activeIndicatorId)
            ]);
        }
    }
}




// Bumped on every updateDepressionCharts() call and captured as that call's
// own requestId. Checking the live counter against the captured id after
// the await below is what stops a race condition that was corrupting the
// chart: clicking two SES checkboxes quickly fires updateDepressionCharts()
// twice in a row, and the two fetches don't necessarily resolve in the
// order they were sent. Without this guard, whichever response happened to
// arrive LAST would always win and get drawn - even if it belonged to an
// earlier, now-outdated filter state - and it would draw on top of
// whatever the actual latest call had already rendered (the clear/purge at
// the top of the function only runs once per call, before its own fetch, not
// again right before its own final DOM write), producing exactly the
// "small-multiple tiles with a stray full-size chart stuck underneath"
// glitch. Now a stale response just bails out instead of touching the DOM.
let depressionChartsRequestId = 0;

async function updateDepressionCharts() {
    // index.html only has ONE chart card (#stackedChart / #distributionTitle
    // / #distributionDescription) — there is no second "meanChart" element
    // for a separate Grade-comparison box. Gender and Grade comparison both
    // redraw the same single chart. When 2 or 3 SES bands are selected, the
    // bars for each gender/grade cluster into sub-bars - one sub-bar per
    // selected SES band, all in the SAME chart (not a separate chart per
    // band/combination) - exactly the clustered layout this already used
    // for 2 bands, just with a 3rd cluster added when High is selected too.
    const requestId = ++depressionChartsRequestId;
    const target = document.getElementById("stackedChart");

    const grouping = document.getElementById("grouping").value;
    const groupBy = grouping === "genderN" ? "gender" : "grade";

    // Clear the chart area and any previous Plotly graph.
    Plotly.purge(target);
    target.replaceChildren();
    target.classList.remove("chart-placeholder");

    // Fixed order + a light->dark sequential ramp, since SES is ordinal
    // (Low/Mid/High) rather than a set of unrelated categories - "Unknown
    // SES" is the odd one out, so it gets a neutral gray and sits last.
    // Each SES band keeps this same color on every tile, so color still
    // identifies the band even though each tile only ever has one bar.
    const SES_ORDER = ["Low", "Mid", "High", "Unknown SES"];
    const SES_COLORS = {
        "Low": "#A9C4DE",
        "Mid": "#5479A5",
        "High": "#2B4A75",
        "Unknown SES": "#9AA5B1"
    };

    try {
        const splitBySes = shouldSplitBySes();

        const params = buildDepressionFilterParams();
        params.set("indicator", "depression");
        params.set("groupBy", groupBy);
        if (splitBySes) {
            params.set("splitBySes", "true");
        }

        const breakdown = await fetchJSON(`/api/indicator-breakdown?${params.toString()}`);

        // A newer call to updateDepressionCharts() has started since this
        // one's fetch went out (e.g. the user checked a second SES box
        // before the first response came back) - that newer call owns the
        // DOM now, so this stale response must not touch it.
        if (requestId !== depressionChartsRequestId || activeIndicatorId !== "depression") return;

        const groups = breakdown.groups || [];

        if (groups.length === 0) {
            target.textContent = "No data available for the selected filters.";
            return;
        }

        target.classList.remove("chart-placeholder");

        // Server echoes back whether it actually honoured the split (it's a
        // no-op for anything but depression) - trust that over the local
        // toggle state so the chart always matches what was really fetched.
        const didSplitBySes = !!breakdown.splitBySes;

        const title = groupBy === "gender"
            ? "Depression: comparison by gender"
            : "Depression: comparison by grade";

        let traces;
        let description;

        if (didSplitBySes) {
            // One SAME chart, one cluster per gender/grade, one sub-bar per
            // selected SES band within each cluster - barmode "group" below
            // is what produces the clustering. This is exactly what already
            // ran for 2 SES bands selected; checking a 3rd band (e.g. High)
            // just adds a 3rd trace below, so a 3rd sub-bar shows up in
            // every cluster, same chart, no separate chart per band.
            const groupValuesInOrder = [];
            groups.forEach(group => {
                if (!groupValuesInOrder.includes(group.group_value)) {
                    groupValuesInOrder.push(group.group_value);
                }
            });

            // group_value is already display-ready from the backend for
            // both gender ("Male"/"Female"/"Gender diverse / not reported" -
            // see GENDER_BUCKET_SQL in server.js) and grade (the raw grade
            // number) - no code-to-label translation needed on this side.
            const labels = groupValuesInOrder.map(value => String(value));

            const sesValuesPresent = SES_ORDER.filter(ses =>
                groups.some(group => group.ses === ses)
            );

            traces = sesValuesPresent.map(ses => ({
                x: labels,
                y: groupValuesInOrder.map(value => {
                    const match = groups.find(
                        group => group.group_value === value && group.ses === ses
                    );
                    return match ? match.mean_score : null;
                }),
                type: "bar",
                name: ses,
                marker: { color: SES_COLORS[ses] || "#5479A5" },
                hovertemplate: `%{x} · ${ses} SES<br>Average score: %{y:.2f}<extra></extra>`
            }));

            description = groupBy === "gender"
                ? "Average depression score by gender, split by SES band, for the selected filters."
                : "Average depression score by grade, split by SES band, for the selected filters.";
        } else {
            const labels = groups.map(group => String(group.group_value));
            const values = groups.map(group => group.mean_score);

            traces = [{
                x: labels,
                y: values,
                type: "bar",
                marker: { color: "#5479A5" },
                hovertemplate: "%{x}<br>Average score: %{y:.2f}<extra></extra>"
            }];

            description = groupBy === "gender"
                ? "Average depression score by gender, for the selected filters."
                : "Average depression score by grade, for the selected filters.";
        }

        await Plotly.newPlot(
            target,
            traces,
            {
                title: "",
                margin: { t: 20, r: 20, b: 60, l: 65 },
                barmode: didSplitBySes ? "group" : undefined,
                showlegend: didSplitBySes,
                legend: didSplitBySes ? { title: { text: "SES" } } : undefined,
                xaxis: {
                    title: groupBy === "gender" ? "Gender" : "Grade"
                },
                yaxis: {
                    title: "Average depression score",
                    rangemode: "tozero"
                },
                autosize: true
            },
            { responsive: true }
        );

        document.getElementById("distributionTitle").textContent = title;
        document.getElementById("distributionDescription").textContent = description;

    } catch (error) {
        if (requestId !== depressionChartsRequestId || activeIndicatorId !== "depression") return;
        console.error("Error displaying depression graph:", error);
        target.textContent = "Could not load depression data. Check the API endpoint.";
    }
}


// Turns the current "group" filter selection into a short phrase to weave
// into the narrative sentences below - e.g. "male ", "female and male ",
// "grade 3 and 4 " - or "" when nothing specific is selected (All), so the
// sentence just reads "students" generically. Only looks at the PRIMARY
// "Compare results by" selection (group), not the secondary filter, to
// keep the sentence from getting unwieldy.
function joinWithAnd(items) {
    if (items.length === 1) return items[0];
    if (items.length === 2) return `${items[0]} and ${items[1]}`;
    return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function describeGroupSelection() {
    const groupAll = document.getElementById("groupAll").checked;
    if (groupAll) return "";

    const selected = getSelectedGroupValues();
    if (selected.length === 0) return "";

    const grouping = document.getElementById("grouping").value;

    if (grouping === "genderN") {
        return `${joinWithAnd(selected.map(label => label.toLowerCase()))} `;
    }

    return `grade ${joinWithAnd(selected)} `;
}

function updateLifeSatisfaction(stats) {
    if (!stats || !stats.n) {
        document.querySelector(".thriving-card .kpi-value").textContent = "-";
        document.querySelector(".doing-card .kpi-value").textContent = "-";
        document.querySelector(".struggling-card .kpi-value").textContent = "-";

        document.getElementById("summaryText").textContent =
            "No data available for the selected filters.";

        const distributionSummary = document.getElementById("distributionSummary");
        const meanSummary = document.getElementById("meanSummary");
        if (distributionSummary) distributionSummary.textContent = "";
        if (meanSummary) meanSummary.textContent = "";

        return;
    }

    document.querySelector(
        ".thriving-card .kpi-value"
    ).textContent = `${stats.pct_thriving.toFixed(1)}%`;

    document.querySelector(
        ".doing-card .kpi-value"
    ).textContent = `${stats.pct_doing_ok.toFixed(1)}%`;

    document.querySelector(
        ".struggling-card .kpi-value"
    ).textContent = `${stats.pct_struggling.toFixed(1)}%`;

    // Plain-language narrative for a non-technical end user — no raw scores
    // or scale ranges, just what the percentages mean in practice. Names
    // the selected gender/grade explicitly (e.g. "male students") instead
    // of a generic "students in this group" when a specific group is picked.
    const groupDescription = describeGroupSelection();

    let sentence =
        `Of the ${stats.n.toLocaleString()} ${groupDescription}students, ${stats.pct_thriving.toFixed(1)}% report ` +
        `high life satisfaction and are thriving overall. A further ${stats.pct_doing_ok.toFixed(1)}% report a ` +
        `moderate level of satisfaction and are generally doing okay, while ${stats.pct_struggling.toFixed(1)}% ` +
        `report low life satisfaction and may be facing difficulties worth a closer look.`;

    // Deliberately doesn't name the most common home-language background -
    // calling out a specific ethnic/cultural group here, especially once a
    // gender/grade filter narrows the group further, risks reading as
    // singling out a small group rather than reporting an aggregate, which
    // cuts against the project's own privacy/aggregation principles.
    sentence +=
        ` ${stats.pct_nonenglish.toFixed(1)}% of these students come from a home where a language ` +
        `other than English is spoken.`;

    document.getElementById("summaryText").textContent = sentence;

    const wellbeingGroups = [
        { name: "Thriving", value: stats.pct_thriving },
        { name: "Doing OK", value: stats.pct_doing_ok },
        { name: "Struggling", value: stats.pct_struggling }
    ];

    const largestGroup = wellbeingGroups.reduce(
        (largest, current) =>
            current.value > largest.value ? current : largest
    );

    const distributionSummary = document.getElementById("distributionSummary");
    if (distributionSummary) {
        distributionSummary.textContent =
            `${largestGroup.name} is the largest group here, making up ${largestGroup.value.toFixed(1)}% of students.`;
    }

    const meanSummary = document.getElementById("meanSummary");
    if (meanSummary) {
        meanSummary.textContent =
            `Based on ${stats.n.toLocaleString()} students, most report a moderate-to-high level of life satisfaction overall.`;
    }
}

// Depression's KPI-style read-out: populates the three "outcome cards"
// (Low/Mid/High symptoms) via the setOutcomeCardStats() hook, AND the blue
// "summary banner" (#summaryText) with a language/culture insight. This is
// separate from updateDepressionCharts() (the Plotly comparison graph) and
// from updateDepressionNarrative() (the #distributionSummary "Key insight"
// box, which now holds the gender/grade comparison narrative instead) —
// one data call for the headline numbers + culture insight, one for the
// per-group breakdown, one for the comparison narrative. No race between
// this and updateDepressionNarrative() even though both run in parallel
// out of updateDashboard() - they now write to two different elements.
function updateDepressionSummary(stats) {
    const cultureEl = document.getElementById("summaryText");

    if (!stats || !stats.n) {
        if (window.setOutcomeCardStats) {
            window.setOutcomeCardStats("depression", null);
        }
        if (cultureEl) {
            cultureEl.textContent = "Select a wellbeing domain and indicator to explore.";
        }
        return;
    }

    // Low symptoms = thriving bucket, High symptoms = struggling bucket.
    if (window.setOutcomeCardStats) {
        window.setOutcomeCardStats("depression", [
            stats.pct_thriving,
            stats.pct_doing_ok,
            stats.pct_struggling,
        ]);
    }

    if (cultureEl) {
        cultureEl.textContent = buildCultureInsightText(stats);
    }
}

// ============================================================
// HOPE SUMMARY
// ============================================================

function updateHopeSummary(stats) {
    updateOutcomeIndicatorSummary(
        "hope",
        stats,
        "Hope"
    );
}


// ============================================================
// LIFE SATISFACTION SUMMARY
// ============================================================

function updateLifeSatisfactionSummary(stats) {
    updateOutcomeIndicatorSummary(
        "life-satisfaction",
        stats,
        "Life Satisfaction"
    );
}


// ============================================================
// CONNECTION TO NATURE SUMMARY
// ============================================================

function updateConnectionToNatureSummary(stats) {
    updateOutcomeIndicatorSummary(
        "connection-to-nature",
        stats,
        "Connection to Nature"
    );
}


// ============================================================
// ANXIETY SUMMARY
// ============================================================

function updateAnxietySummary(stats) {
    updateOutcomeIndicatorSummary(
        "anxiety",
        stats,
        "Anxiety"
    );
}


// ============================================================
// SHARED SUMMARY FUNCTION
// ============================================================

function updateOutcomeIndicatorSummary(indicator, stats, label) {

    const summaryEl = document.getElementById("summaryText");

    // No data available
    if (!stats || !stats.n) {

        if (window.setOutcomeCardStats) {
            window.setOutcomeCardStats(indicator, null);
        }

        if (summaryEl) {
            summaryEl.textContent =
                `No ${label.toLowerCase()} data available for the selected filters.`;
        }

        return;
    }

    // Update outcome percentage cards
    if (window.setOutcomeCardStats) {
        window.setOutcomeCardStats(indicator, [
            stats.pct_thriving,
            stats.pct_doing_ok,
            stats.pct_struggling
        ]);
    }

    // Display summary information
    if (summaryEl) {

        summaryEl.textContent =
            `${label} results: ` +
            `Average score: ${stats.mean_score}. ` +
            `Total responses: ${stats.n}. ` +
            `Thriving: ${stats.pct_thriving}%. ` +
            `Doing OK: ${stats.pct_doing_ok}%. ` +
            `Struggling: ${stats.pct_struggling}%.`;
    }
}





let indicatorChartsRequestId = 0;

async function updateIndicatorCharts(indicator) {
    const requestId = ++indicatorChartsRequestId;

    const target = document.getElementById("stackedChart");

    if (!target) {
        console.error("Chart element #stackedChart was not found.");
        return;
    }

    const grouping = document.getElementById("grouping").value;

    const groupBy = grouping === "genderN"
        ? "gender"
        : "grade";

    const indicatorLabels = {
        "hope": "Hope",
        "life-satisfaction": "Life Satisfaction",
        "connection-to-nature": "Connection to Nature",
        "anxiety": "Anxiety"
    };

    const label = indicatorLabels[indicator];

    if (!label) {
        console.error("Unknown indicator:", indicator);
        return;
    }

    Plotly.purge(target);
    target.replaceChildren();
    target.classList.remove("chart-placeholder");

    try {
        const params = buildFilterParams();

        params.set("indicator", indicator);
        params.set("groupBy", groupBy);

        const breakdown = await fetchJSON(
            `/api/indicator-breakdown?${params.toString()}`
        );

        if (requestId !== indicatorChartsRequestId || activeIndicatorId !== indicator) return;

        const groups = breakdown.groups || [];

        if (groups.length === 0) {
            target.textContent =
                `No ${label.toLowerCase()} data available for the selected filters.`;
            return;
        }

        const chartLabels = groups.map(
            group => String(group.group_value)
        );

        const values = groups.map(
            group => group.mean_score === null
                ? null
                : Number(group.mean_score)
        );

        const traces = [{
            x: chartLabels,
            y: values,
            type: "bar",
            name: label,
            marker: {
                color: "#5479A5"
            },
            hovertemplate:
                "%{x}<br>Average score: %{y:.2f}<extra></extra>"
        }];

        await Plotly.newPlot(
            target,
            traces,
            {
                title: "",
                margin: {
                    t: 20,
                    r: 20,
                    b: 60,
                    l: 65
                },
                showlegend: false,
                xaxis: {
                    title: groupBy === "gender"
                        ? "Gender"
                        : "Grade"
                },
                yaxis: {
                    title: `Average ${label} score`,
                    rangemode: "tozero"
                },
                autosize: true
            },
            {
                responsive: true
            }
        );

        if (requestId !== indicatorChartsRequestId || activeIndicatorId !== indicator) {
            // Another indicator is now active. Do not overwrite its title/summary.
            return;
        }

        const title = document.getElementById("distributionTitle");
        const description = document.getElementById(
            "distributionDescription"
        );

        if (title) {
            title.textContent =
                `${label}: comparison by ${groupBy}`;
        }

        if (description) {
            description.textContent =
                `Average ${label.toLowerCase()} score by ${groupBy}, for the selected filters.`;
        }

    } catch (error) {
        if (requestId !== indicatorChartsRequestId || activeIndicatorId !== indicator) return;

        console.error(`Error displaying ${label} graph:`, error);

        target.textContent =
            `Could not load ${label.toLowerCase()} data. Check the API endpoint.`;
    }
}



// "X% of students in this view are from a non-English speaking background,
// most commonly identifying with the Y culture (Z% of that group)." - a
// plain demographic insight (not a depression comparison), built from
// fields /api/indicator-summary already returns: pct_nonenglish,
// top_culture, top_culture_pct (see server.js's indicator-summary route).
function buildCultureInsightText(stats) {
    const pctNonEnglish = stats.pct_nonenglish;

    if (pctNonEnglish === null || pctNonEnglish === undefined) {
        return "Language background data is not available for the selected filters.";
    }

    if (pctNonEnglish === 0) {
        return "None of the students in this view are from a non-English speaking background.";
    }

    let sentence =
        `${pctNonEnglish.toFixed(1)}% of students in this view are from a non-English speaking background.`;

    if (stats.top_culture && stats.top_culture_pct !== null && stats.top_culture_pct !== undefined) {
        sentence +=
            ` The most common cultural background among them is ${stats.top_culture}, making up ` +
            `${stats.top_culture_pct.toFixed(1)}% of non-English speaking students in this view.`;
    }

    return sentence;
}

// --- Report-style narrative ("Among males, X% reported high depression
// symptoms... A significantly larger proportion of females than males...")
// modelled on the official RYA report excerpt, fed by /api/depression-narrative.
// Mirrors the chart's own "Compare results by" toggle: Gender mode asks the
// endpoint for groupBy=gender, which always breaks the filtered population
// into all three gender buckets regardless of the Gender filter checkboxes
// (see the long comment on that endpoint in server.js for why); Grade mode
// asks for groupBy=grade instead, which breaks out by individual selected
// grade value and filters by Gender instead. Either way, whichever filter
// isn't the active breakout dimension just rides along in the query string
// and is read or ignored server-side as appropriate - this function doesn't
// need to know which.

function summarizeBuckets(rows) {
    if (!Array.isArray(rows) || rows.length === 0) {
        return "No data available.";
    }

    const total = rows.reduce(
        (sum, row) => sum + (Number(row.n) || 0),
        0
    );

    if (total === 0) {
        return "No data available.";
    }

    return rows.map(row => {
        const count = Number(row.n) || 0;
        const percentage = (count / total) * 100;

        return `${row.label || row.bucket}: ${percentage.toFixed(1)}%`;
    }).join(", ");
}

async function updateDepressionNarrative() {
    const narrativeEl = document.getElementById("distributionSummary");
    if (!narrativeEl) return;

    try {
        const grouping = document.getElementById("grouping").value;
        const groupBy = grouping === "genderN" ? "gender" : "grade";

        const params = buildDepressionFilterParams();
        params.set("indicator", "depression");
        params.set("groupBy", groupBy);

        const data = await fetchJSON(`/api/depression-narrative?${params.toString()}`);
        narrativeEl.textContent = buildDepressionNarrativeText(data);
    } catch (error) {
        console.error("Error loading depression narrative:", error);
        narrativeEl.textContent = "Could not load the depression narrative. Check the API endpoint.";
    }
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// p-values reported APA-style: no leading zero, "p < .001" below that
// threshold rather than a long decimal.
function formatP(p) {
    if (p === null || p === undefined) return "p n/a";
    if (p < 0.001) return "p < .001";
    return `p = ${p.toFixed(3).replace(/^0/, "")}`;
}

// Handles both groupBy modes' bucket keys: the fixed gender bucket names
// from groupBy=gender, and the "Grade <n>" keys server.js generates for
// groupBy=grade (one per selected grade, e.g. "Grade 3" -> "grade 3
// students").
function depressionGroupLabel(key) {
    if (key === "Male") return "males";
    if (key === "Female") return "females";
    if (key === "Gender diverse / not reported") return "students in the gender diverse / not reported category";

    const gradeMatch = /^Grade (.+)$/.exec(key);
    if (gradeMatch) return `grade ${gradeMatch[1]} students`;

    return key;
}

// Classifies a group's MEAN depression score into Low/Mid/High, using the
// same boundaries confirmed for per-student scores (2-3 Low, 4-5 Mid, 6-8
// High), applied continuously: anything below 4 is "low", 4 up to (not
// including) 6 is "mid", 6 and up is "high". Matches the official report's
// own worked examples (M=3.67 -> low range, M=4.29 -> mid-range).
function meanScoreRange(mean) {
    if (mean === null || mean === undefined) return null;
    if (mean < 4) return "low";
    if (mean < 6) return "mid";
    return "high";
}

// Collapses a list of grade numbers into consecutive ranges for display -
// e.g. [3,4,5,6,7,8,10,11,12] -> ["3–8", "10–12"] - matching how the
// official report writes a filtered grade selection ("grades 3–8 and
// 10–12") instead of spelling out every number.
function formatGradeRanges(gradeValues) {
    const nums = Array.from(new Set(gradeValues.map(Number))).sort((a, b) => a - b);
    if (nums.length === 0) return [];

    const ranges = [];
    let start = nums[0];
    let prev = nums[0];

    for (let i = 1; i <= nums.length; i++) {
        const current = nums[i];
        if (current === prev + 1) {
            prev = current;
            continue;
        }
        ranges.push(start === prev ? `${start}` : `${start}–${prev}`);
        start = current;
        prev = current;
    }

    return ranges;
}

// The actual Gender selection, regardless of whether Gender is currently
// the primary "Compare results by" control or the secondary one.
function getActiveGenderSelection() {
    const grouping = document.getElementById("grouping").value;
    if (grouping === "genderN") {
        return document.getElementById("groupAll").checked ? [] : getSelectedGroupValues();
    }
    return document.getElementById("secondaryAll").checked ? [] : getSelectedSecondaryValues();
}

// The actual Grade selection, regardless of which control currently holds it.
function getActiveGradeSelection() {
    const grouping = document.getElementById("grouping").value;
    if (grouping === "genderN") {
        return document.getElementById("secondaryAll").checked ? [] : getSelectedSecondaryValues();
    }
    return document.getElementById("groupAll").checked ? [] : getSelectedGroupValues();
}

// "Reported values are for male students and female students in grades
// 3–8 and 10–12 living in low and mid socioeconomic areas." - describes
// the active filters in plain language, the way the Survey Measures
// example does. Gender is only mentioned in Grade mode: in Gender mode the
// /api/depression-narrative endpoint ignores the gender checkboxes
// entirely (it always breaks out all three buckets), so including them
// here would misdescribe what the numbers represent.
function describeActiveFilters(groupBy) {
    const sesValues = getSelectedSESValues();
    const gradeLabels = getActiveGradeSelection();

    const clauses = [];
    let hasGenderClause = false;

    if (groupBy === "grade") {
        const genderLabels = getActiveGenderSelection();
        if (genderLabels.length > 0) {
            clauses.push(joinWithAnd(genderLabels.map(g => `${g.toLowerCase()} students`)));
            hasGenderClause = true;
        }
    }

    if (gradeLabels.length > 0) {
        const ranges = formatGradeRanges(gradeLabels);
        const word = ranges.length > 1 || ranges.some(r => r.includes("–")) ? "grades" : "grade";
        clauses.push(`in ${word} ${joinWithAnd(ranges)}`);
    }

    if (sesValues.length > 0) {
        clauses.push(
            `living in ${joinWithAnd(sesValues.map(s => s.toLowerCase()))} socioeconomic area${sesValues.length > 1 ? "s" : ""}`
        );
    }

    if (clauses.length === 0) return "";

    const subject = hasGenderClause ? clauses.shift() : "students";
    return `Reported values are for ${[subject, ...clauses].join(" ")}.`;
}

// Same "Grade N" keys depressionGroupLabel() handles, but without the
// trailing " students" - needed for "ranged from X% in grade 3 to Y% in
// grade 12", where depressionGroupLabel's "grade 3 students" would read
// oddly ("in grade 3 students to...").
function bareGroupLabel(key) {
    const gradeMatch = /^Grade (.+)$/.exec(key);
    if (gradeMatch) return `grade ${gradeMatch[1]}`;
    return depressionGroupLabel(key);
}

// Shared by both the % high-symptoms sentence and the mean-score sentence:
// describes how the gender-diverse group compares to male and female,
// given each pairwise test's significance. Assumes the same direction vs
// both when both are significant (the expected case) - if they ever
// disagree this still reads sensibly, just less neatly.
function describeDiverseComparison(vsMaleSignificant, vsMaleHigher, vsFemaleSignificant, vsFemaleHigher) {
    if (vsMaleSignificant && vsFemaleSignificant) {
        return { comparedTo: "those of males and females", direction: vsMaleHigher ? "higher" : "lower" };
    }
    if (vsMaleSignificant) {
        return {
            comparedTo: "that of males (though not significantly different from females)",
            direction: vsMaleHigher ? "higher" : "lower",
        };
    }
    if (vsFemaleSignificant) {
        return {
            comparedTo: "that of females (though not significantly different from males)",
            direction: vsFemaleHigher ? "higher" : "lower",
        };
    }
    return null;
}

// Maps a Gender filter checkbox value (see GENDER_CODES) to the group key
// the /api/depression-narrative response uses for it. "Other/Not
// Reported" is the checkbox label; "Gender diverse / not reported" is the
// narrative endpoint's bucket name for the same students.
const GENDER_GROUP_KEY_BY_LABEL = {
    "Male": "Male",
    "Female": "Female",
    "Other/Not Reported": "Gender diverse / not reported",
};

// Which gender groups to actually narrate - respects the Gender filter
// checkboxes instead of always narrating all three. "All" (no individual
// boxes checked) still means all three, same as the chart itself.
function getSelectedGenderGroupKeys() {
    const selection = getActiveGenderSelection();
    if (selection.length === 0) {
        return ["Male", "Female", "Gender diverse / not reported"];
    }
    return selection.map(label => GENDER_GROUP_KEY_BY_LABEL[label]).filter(Boolean);
}

// One paragraph comparing exactly two selected gender groups - no mean
// scores at all, just the % high-range comparison plus a purely
// descriptive % low-range (healthy/thriving) comparison (there's no
// significance test for the low-range proportion, only the high-range
// one, so no "significantly" wording on that second sentence).
function describeTwoGroupComparison(groups, comparisons, keyA, keyB) {
    const a = groups[keyA];
    const b = groups[keyB];
    const cmp = comparisons.find(
        c => (c.groupA === keyA && c.groupB === keyB) || (c.groupA === keyB && c.groupB === keyA)
    );

    let proportionSentence;
    if (cmp && cmp.proportion_significant) {
        const aHigher = cmp.proportion_higher_group === keyA;
        const diff = Math.abs(a.pct_high - b.pct_high);
        const qualifier = diff < 3 ? "slightly but significantly" : "significantly";
        proportionSentence =
            `${a.pct_high.toFixed(1)}% of ${depressionGroupLabel(keyA)} reported high-range depression ` +
            `symptoms, compared with a ${qualifier} ${aHigher ? "lower" : "higher"} ` +
            `${b.pct_high.toFixed(1)}% of ${depressionGroupLabel(keyB)}.`;
    } else {
        proportionSentence =
            `${a.pct_high.toFixed(1)}% of ${depressionGroupLabel(keyA)} and ${b.pct_high.toFixed(1)}% of ` +
            `${depressionGroupLabel(keyB)} reported high-range depression symptoms, with no significant ` +
            `difference between the two groups.`;
    }

    const lowSentence =
        `On the other end of the scale, ${a.pct_low.toFixed(1)}% of ${depressionGroupLabel(keyA)} and ` +
        `${b.pct_low.toFixed(1)}% of ${depressionGroupLabel(keyB)} were in the low (healthy/thriving) range.`;

    return `${proportionSentence} ${lowSentence}`;
}

// Gender mode: narrates only the gender groups actually selected in the
// Gender filter (1, 2, or all 3 of Male / Female / Gender diverse / not
// reported), modelled on the official report's own gender-comparison
// paragraph for the 3-group case - varied natural sentences, no raw
// p-values or M/SD numbers, just "significantly" and a range label.
function buildGenderDepressionNarrative(data) {
    const groups = data.groups || {};
    const comparisons = data.comparisons || [];

    const selectedKeys = getSelectedGenderGroupKeys().filter(
        key => groups[key] && groups[key].n > 0
    );

    if (selectedKeys.length === 0) {
        return "Not enough data for the selected filters.";
    }

    const filterSentence = describeActiveFilters("gender");

    // --- Only one gender group selected: nothing to compare -------------
    if (selectedKeys.length === 1) {
        const key = selectedKeys[0];
        const g = groups[key];
        const sentence =
            `${g.pct_high.toFixed(1)}% of ${depressionGroupLabel(key)} reported high-range depression symptoms, ` +
            `while ${g.pct_low.toFixed(1)}% were in the low (healthy/thriving) range.`;
        return filterSentence ? `${sentence} ${filterSentence}` : sentence;
    }

    // --- Exactly two gender groups selected: direct comparison -----------
    if (selectedKeys.length === 2) {
        const comparisonText = describeTwoGroupComparison(groups, comparisons, selectedKeys[0], selectedKeys[1]);
        return filterSentence ? `${comparisonText} ${filterSentence}` : comparisonText;
    }

    // --- All three gender groups selected: males vs females as the base
    // comparison, then fold in how the gender diverse / not reported
    // group compares to each - same structure as the official report.
    const male = groups["Male"];
    const female = groups["Female"];
    const diverse = groups["Gender diverse / not reported"];

    const findComparison = (a, b) =>
        comparisons.find(c => (c.groupA === a && c.groupB === b) || (c.groupA === b && c.groupB === a));

    const mf = findComparison("Male", "Female");
    const mg = findComparison("Male", "Gender diverse / not reported");
    const fg = findComparison("Female", "Gender diverse / not reported");

    // --- % reporting high symptoms ---------------------------------------
    let proportionSentence;
    if (mf && mf.proportion_significant) {
        const femaleHigher = mf.proportion_higher_group === "Female";
        const diff = Math.abs(female.pct_high - male.pct_high);
        const qualifier = diff < 3 ? "slightly but significantly" : "significantly";
        proportionSentence =
            `${male.pct_high.toFixed(1)}% of males, and a ${qualifier} ${femaleHigher ? "higher" : "lower"} ` +
            `proportion of females (${female.pct_high.toFixed(1)}%), reported high-range symptom levels.`;
    } else {
        proportionSentence =
            `${male.pct_high.toFixed(1)}% of males and ${female.pct_high.toFixed(1)}% of females reported ` +
            `high-range symptom levels, with no significant difference between the two groups.`;
    }

    const proportionDiverse = describeDiverseComparison(
        !!(mg && mg.proportion_significant),
        mg && mg.proportion_higher_group === "Gender diverse / not reported",
        !!(fg && fg.proportion_significant),
        fg && fg.proportion_higher_group === "Gender diverse / not reported"
    );

    proportionSentence += proportionDiverse
        ? ` ${diverse.pct_high.toFixed(1)}% of students in the gender diverse / not reported category reported ` +
          `high depression symptom levels, a significantly ${proportionDiverse.direction} proportion than ` +
          `${proportionDiverse.comparedTo}.`
        : ` ${diverse.pct_high.toFixed(1)}% of students in the gender diverse / not reported category reported ` +
          `high depression symptom levels, not significantly different from male or female students.`;

    // --- Low-range (healthy/thriving) % - purely descriptive, since
    // there's no significance test for this proportion in server.js
    // (only the high-range one), so no "significantly" wording here.
    const lowSentence =
        `On the other end of the scale, ${male.pct_low.toFixed(1)}% of males and ${female.pct_low.toFixed(1)}% ` +
        `of females were in the low (healthy/thriving) range, compared with ${diverse.pct_low.toFixed(1)}% of ` +
        `students in the gender diverse / not reported category.`;

    return filterSentence
        ? `${proportionSentence} ${lowSentence} ${filterSentence}`
        : `${proportionSentence} ${lowSentence}`;
}

// Grade mode: can be many groups, so unlike Gender mode this doesn't spell
// out every pairwise comparison - it states the range across whichever
// grades are selected, the same way your Survey Measures example does for
// "struggling" life satisfaction.
function buildGradeDepressionNarrative(data) {
    const groups = data.groups || {};
    const present = Object.keys(groups).filter(key => groups[key] && groups[key].n > 0);

    if (present.length === 0) {
        return "No data available for the selected filters.";
    }

    const year = document.getElementById("year").value || "2023";
    const filterSentence = describeActiveFilters("grade");

    let rangeSentence;
    if (present.length === 1) {
        const g = present[0];
        rangeSentence =
            `In ${year}, ${groups[g].pct_high.toFixed(1)}% of ${bareGroupLabel(g)} students reported high ` +
            `depression symptoms, while ${groups[g].pct_low.toFixed(1)}% were in the low (healthy/thriving) range.`;
    } else {
        let minKey = present[0];
        let maxKey = present[0];
        present.forEach(key => {
            if (groups[key].pct_high < groups[minKey].pct_high) minKey = key;
            if (groups[key].pct_high > groups[maxKey].pct_high) maxKey = key;
        });

        const highSentence =
            minKey === maxKey
                ? `In ${year}, ${groups[minKey].pct_high.toFixed(1)}% of students reported high depression ` +
                  `symptoms across the selected grades.`
                : `In ${year}, the proportion of students who reported high depression symptoms ranged from ` +
                  `${groups[minKey].pct_high.toFixed(1)}% in ${bareGroupLabel(minKey)} to ` +
                  `${groups[maxKey].pct_high.toFixed(1)}% in ${bareGroupLabel(maxKey)}.`;

        // Same min/max logic, run again on pct_low - the lowest/highest
        // grade for "low-range" isn't necessarily the same grade as for
        // "high-range", so this is computed independently rather than
        // reusing minKey/maxKey above. Purely descriptive - no
        // significance test exists for this proportion, only for pct_high.
        let minLowKey = present[0];
        let maxLowKey = present[0];
        present.forEach(key => {
            if (groups[key].pct_low < groups[minLowKey].pct_low) minLowKey = key;
            if (groups[key].pct_low > groups[maxLowKey].pct_low) maxLowKey = key;
        });

        const lowSentence =
            minLowKey === maxLowKey
                ? `${groups[minLowKey].pct_low.toFixed(1)}% of students were in the low (healthy/thriving) ` +
                  `range across the selected grades.`
                : `On the other end of the scale, the proportion in the low (healthy/thriving) range ranged ` +
                  `from ${groups[minLowKey].pct_low.toFixed(1)}% in ${bareGroupLabel(minLowKey)} to ` +
                  `${groups[maxLowKey].pct_low.toFixed(1)}% in ${bareGroupLabel(maxLowKey)}.`;

        const trendSentence = describeGradeTrend(groups, present);

        rangeSentence = trendSentence
            ? `${highSentence} ${lowSentence} ${trendSentence}`
            : `${highSentence} ${lowSentence}`;
    }

    return filterSentence ? `${rangeSentence} ${filterSentence}` : rangeSentence;
}

// Grade is ordinal, so - unlike gender - a trend across grade levels is a
// meaningful thing to report. Fits a simple least-squares line through
// (grade number, % high-range) for the selected grades and describes its
// direction in plain "tend to" language, not a statistical test (no
// significance claimed) - a near-zero slope is reported as "no clear
// trend" rather than overclaiming on noise. Needs at least 2 selected
// grades with parseable "Grade N" keys to say anything; returns null
// otherwise, so the caller can skip the sentence entirely.
function describeGradeTrend(groups, present) {
    const points = present
        .map(key => {
            const match = /^Grade (\d+)$/.exec(key);
            return match ? { grade: Number(match[1]), pctHigh: groups[key].pct_high } : null;
        })
        .filter(Boolean)
        .sort((a, b) => a.grade - b.grade);

    if (points.length < 2) return null;

    const n = points.length;
    const sumX = points.reduce((s, p) => s + p.grade, 0);
    const sumY = points.reduce((s, p) => s + p.pctHigh, 0);
    const sumXY = points.reduce((s, p) => s + p.grade * p.pctHigh, 0);
    const sumX2 = points.reduce((s, p) => s + p.grade * p.grade, 0);

    const denominator = n * sumX2 - sumX * sumX;
    if (denominator === 0) return null;

    const slope = (n * sumXY - sumX * sumY) / denominator;

    // Anything under ~0.3 percentage points per grade step is treated as
    // noise rather than a trend worth naming - an arbitrary but
    // conservative cutoff, easy to tighten or loosen later.
    if (Math.abs(slope) < 0.3) {
        return "There is no clear trend in high depression symptoms across the selected grade levels.";
    }

    return slope > 0
        ? "The proportion of students reporting high depression symptoms tends to increase with grade level."
        : "The proportion of students reporting high depression symptoms tends to decrease with grade level.";
}

// Short lead-in sentence describing what the chart/graph itself is
// showing, before the comparison text - the "PHQ-2" wording is the same
// wording from the Survey Measures document. Kept to one plain sentence
// so it reads as a caption, not another block of statistics.
function buildDepressionIntroText(groupBy) {
    const breakdown = groupBy === "grade" ? "by grade" : "by gender";
    return (
        "This chart shows depression symptom levels among surveyed students, based on their responses " +
        `to the Patient Health Questionnaire (PHQ-2), compared ${breakdown}.`
    );
}

// Turns one /api/depression-narrative response into the full paragraph -
// a short intro describing what the chart shows, followed by the
// Gender-mode or Grade-mode comparison text depending on which comparison
// mode the chart is currently in.
function buildDepressionNarrativeText(data) {
    if (!data || !data.groups || Object.keys(data.groups).length === 0) {
        return "No data available for the selected filters.";
    }

    const intro = buildDepressionIntroText(data.groupBy);
    const comparison = data.groupBy === "grade"
        ? buildGradeDepressionNarrative(data)
        : buildGenderDepressionNarrative(data);

    return `${intro} ${comparison}`;
}

function getSelectedGroupValues() {

    return Array.from(
        document.querySelectorAll(
            ".group-option:checked"
        )
    ).map(
        checkbox =>
            checkbox.value
    );

}

function getSelectedSecondaryValues() {

    return Array.from(
        document.querySelectorAll(
            ".secondary-option:checked"
        )
    ).map(
        checkbox =>
            checkbox.value
    );

}

function getSelectedSESValues() {

    return Array.from(
        document.querySelectorAll(
            ".ses-option:checked"
        )
    ).map(
        checkbox =>
            checkbox.value
    );

}

const wellbeingDomains = [
    {
        id: "mental",
        label: "Mental Wellbeing",
        indicators: [
            {
                id: "life-satisfaction",
                label: "Life Satisfaction",
                description: "Explore students' overall satisfaction with life."
            },
            {
                id: "hope",
                label: "Hope",
                description: "Explore students' hope for the future."
            },
            {
                id: "anxiety",
                label: "Anxiety",
                description: "Explore students' reported experiences of anxiety."
            },
            {
                id: "depression",
                label: "Depression",
                description: "Explore students' reported experiences of depression."
            },
            {
                id: "connection-to-nature",
                label: "Connection to Nature",
                description: "Explore students' reported experiences of connection to nature."
            }
        ]
    },
    {
        id: "learning",
        label: "Readiness to Learn",
        indicators: [
            {
                id: "school-engagement",
                label: "School Engagement",
                description: "Explore how students engage with school and learning."
            }
        ]
    },
    {
        id: "social",
        label: "Social Environment",
        indicators: [
            {
                id: "friendship",
                label: "Friendship",
                description: "Explore students' experiences of friendship."
            },
            {
                id: "family",
                label: "Family",
                description: "Explore students' experiences of family relationships."
            },
            {
                id: "experience-of-being-bullied",
                label: "Experience of Being Bullied",
                description: "Explore students' experiences of being bullied."
            }
        ]
    },
    {
        id: "health",
        label: "Health Behaviours",
        indicators: [
            {
                id: "healthy-eating",
                label: "Healthy Eating",
                description: "Explore students' reported eating habits."
            },
            {
                id: "adequate-sleep",
                label: "Adequate Sleep",
                description: "Explore students' reported sleep habits."
            },
            {
                id: "physically-active",
                label: "Physically Active",
                description: "Explore students' reported physical activity."
            }
        ]
    },
    {
        id: "social-media",
        label: "Social Media",
        indicators: [
            {
                id: "frequency-of-use",
                label: "Frequency of Use",
                description: "Explore how often students use social media."
            },
            {
                id: "reason-for-use",
                label: "Reason for Use",
                description: "Explore students' reasons for using social media."
            }
        ]
    }
];

let activeDomainId = "mental";
// Depression, not Life Satisfaction, is the default landing view for now -
// that's the indicator actually being worked on and tested.
let activeIndicatorId = "depression";

// Read the domain and indicator from the URL when the page opens.
function loadIndicatorFromUrl() {
    const params = new URLSearchParams(window.location.search);

    const requestedDomain = params.get("domain");
    const requestedIndicator = params.get("indicator");

    const matchingDomain = wellbeingDomains.find(
        domain => domain.id === requestedDomain
    );

    if (matchingDomain) {
        activeDomainId = matchingDomain.id;

        const matchingIndicator = matchingDomain.indicators.find(
            indicator => indicator.id === requestedIndicator
        );

        activeIndicatorId = matchingIndicator
            ? matchingIndicator.id
            : matchingDomain.indicators[0].id;

    } else if (requestedIndicator) {
        // If only an indicator is provided, find which domain contains it.
        const domain = wellbeingDomains.find(item =>
            item.indicators.some(
                indicator => indicator.id === requestedIndicator
            )
        );

        if (domain) {
            activeDomainId = domain.id;
            activeIndicatorId = requestedIndicator;
        }
    }
}

// Update the browser URL without reloading the page.
function updateExploreAddress() {
    const address = new URL(window.location.href);

    address.searchParams.set("domain", activeDomainId);
    address.searchParams.set("indicator", activeIndicatorId);

    window.history.replaceState(null, "", address);
}

function renderDomainButtons() {
    const container = document.getElementById("domainButtons");
    container.replaceChildren();

    wellbeingDomains.forEach(domain => {
        const button = document.createElement("button");

        button.type = "button";
        button.className = "domain-button";
        button.textContent = domain.label;
        button.dataset.domain = domain.id;
        button.setAttribute(
            "aria-pressed",
            String(domain.id === activeDomainId)
        );

        button.addEventListener("click", () => {
            if (activeDomainId === domain.id) return;

            activeDomainId = domain.id;
            activeIndicatorId = domain.indicators[0].id;

            container.querySelectorAll("button").forEach(item => {
                item.setAttribute(
                    "aria-pressed",
                    String(item.dataset.domain === activeDomainId)
                );
            });

            renderIndicatorButtons();
            updateIndicatorView();
            updateExploreAddress();
        });

        container.appendChild(button);
    });
}

function renderIndicatorButtons() {
    const domain = wellbeingDomains.find(
        item => item.id === activeDomainId
    );

    const container = document.getElementById("indicatorButtons");
    container.replaceChildren();

    domain.indicators.forEach(indicator => {
        const button = document.createElement("button");

        button.type = "button";
        button.className = "indicator-button";
        button.textContent = indicator.label;
        button.dataset.indicator = indicator.id;
        button.setAttribute(
            "aria-pressed",
            String(indicator.id === activeIndicatorId)
        );

        button.addEventListener("click", () => {
            activeIndicatorId = indicator.id;

            container.querySelectorAll("button").forEach(item => {
                item.setAttribute(
                    "aria-pressed",
                    String(item.dataset.indicator === activeIndicatorId)
                );
            });

            updateIndicatorView();
            updateExploreAddress();
        });

        container.appendChild(button);
    });
}

function updateIndicatorView() {
    // Invalidate pending fetches from the previously selected indicator.
    depressionChartsRequestId++;
    indicatorChartsRequestId++;
    const domain = wellbeingDomains.find(
        item => item.id === activeDomainId
    );

    const indicator = domain.indicators.find(
        item => item.id === activeIndicatorId
    );

    // The outcome-card extension renders the live cards; the original
    // Life Satisfaction cards remain hidden templates for consistent styling.
    const isLifeSatisfaction = indicator.id === "life-satisfaction";

    document.getElementById("indicatorTitle").textContent =
        indicator.label;

    document.getElementById("indicatorDescription").textContent =
        indicator.description;

    // Keep templates in the DOM for the shared outcome-card renderer; show
    // the live cards through #ryaOutcomeExtension, including Life Satisfaction.
    document.getElementById("lifeSatisfactionCards").hidden = true;

    if (isLifeSatisfaction) {
        document.querySelector(".thriving-card .kpi-value").textContent = "-";
        document.querySelector(".doing-card .kpi-value").textContent = "-";
        document.querySelector(".struggling-card .kpi-value").textContent = "-";
    }

    // index.html has one chart card (#stackedChart / #distributionTitle /
    // #distributionDescription) - there's no second "comparison" card, so
    // this is the only title/description pair to set. updateDepressionCharts()
    // overwrites these again once real data comes back; this is just the
    // placeholder shown before that, or for indicators with no data yet.
    document.getElementById("distributionTitle").textContent =
        `${indicator.label}: group comparison`;

    document.getElementById("distributionDescription").textContent =
        "Compare results across the selected student groups.";

    // Initially show a placeholder; updateDashboard() replaces it with a
    // live Plotly chart for each implemented indicator.
    if (indicator.id !== "depression") {
        const chart = document.getElementById("stackedChart");
        Plotly.purge(chart);
        chart.classList.add("chart-placeholder");
        chart.textContent = "Chart preview coming soon";
    }

    // Default placeholder - overwritten by updateDashboard() below for any
    // indicator that's actually wired to real data (currently
    // life-satisfaction and depression); stays showing for everything else.
    document.getElementById("summaryText").textContent =
        `${domain.label} / ${indicator.label} — Results are loading or not yet available.`;
    document.getElementById("distributionSummary").textContent =
        indicator.id === "depression"
            ? "Preparing the comparison insight…"
            : "Detailed statistical comparisons are not currently available for this indicator.";

    // Called exactly once here (previously this ran up to three times per
    // view change - once inside the if/else above, and again right after -
    // which triple-fetched the same data on every click for no benefit).
    updateDashboard();
}

function initialiseIndicatorNavigation() {

    // Read the requested domain and indicator from the URL.
    loadIndicatorFromUrl();

    // Build the navigation buttons.
    renderDomainButtons();
    renderIndicatorButtons();

    // Display the selected indicator.
    updateIndicatorView();

    // Make sure the URL matches the actual selected indicator.
    updateExploreAddress();
}


function startApp() {
    // 1. Initialise domain and indicator navigation.
    initialiseIndicatorNavigation();

    // 2. Attach filter, comparison and year-selector event listeners.
    setupEvents();

    // 3. Load available years and grades from the backend.
    loadFilterOptions().catch(error => {
        console.error("Application initialisation failed:", error);
    });
}

// Start the application once the HTML has loaded.
if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        startApp,
        { once: true }
    );
} else {
    startApp();
}


// Pure visual-state updater: just reflects which grouping is active. Click
// handling lives entirely in setupEvents() now - this used to also attach
// a fresh click listener to every button on every call (including from
// inside its own listener), so the handler fired more times with each
// toggle. That bug is gone now that this function only ever reads state.
function updateCompareButtons(grouping) {
    document.querySelectorAll(".compare-button").forEach(button => {
        const active = button.dataset.grouping === grouping;

        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", String(active));
    });
}

function selectAllOption(allCheckbox, optionSelector) {
    allCheckbox.checked = true;

    document
        .querySelectorAll(optionSelector)
        .forEach(option => {
            option.checked = false;
        });
}

// collapseWhenFullySelected (default true, matches the original behavior
// for the gender/grade filter groups): when every individual box ends up
// checked, treat that as equivalent to "All" - re-check the All box and
// clear the individual ones, since for those filters the two states mean
// the exact same thing to the backend anyway (no filter applied).
//
// THIS WAS THE BUG behind "I can only select two SES options": the SES
// filter has exactly 3 boxes (Low/Mid/High), and checking the 3rd one to
// compare all three bands used to trigger this same collapse - the instant
// all 3 got checked, this function silently re-checked "All" and unchecked
// all three individual boxes again, making it look like the 3rd box
// refused to stay checked. For SES, "all 3 individually selected" and
// "All" are NOT the same thing - the former drives the 3-band clustered
// chart, the latter means no SES filter/no split at all - so the caller
// passes collapseWhenFullySelected: false for that filter group to skip
// this branch and let all 3 stay checked.
function updateAllOption(allCheckbox, optionSelector, collapseWhenFullySelected = true) {
    const options = Array.from(
        document.querySelectorAll(optionSelector)
    );

    const checkedOptions = options.filter(
        option => option.checked
    );

    if (checkedOptions.length === 0) {
        selectAllOption(allCheckbox, optionSelector);
        return;
    }

    if (
        collapseWhenFullySelected &&
        checkedOptions.length === options.length
    ) {
        selectAllOption(allCheckbox, optionSelector);
        return;
    }

    allCheckbox.checked = false;
}
/* Outcome cards only: the original code above is preserved verbatim, apart
   from the three call sites above that now also trigger updateDashboard()
   on an indicator/domain switch, and the real-data hook added below. */
(() => {
  'use strict';
  const existing = 'assets/images/';
  const icons = `${existing}outcomes/`;
  const threeImages = ['thriving.png', 'doing-ok.png', 'struggling.png'].map(name => existing + name);
  const frequencyImages = ['rarely', 'sometimes', 'often', 'always'].map(name => `${icons}${name}.svg`);
  const categoryNames = ['Category 1', 'Category 2', 'Category 3', 'Category 4'];
  const make = (title, labels, images, kind = 'cards', pending = false) => ({title, labels, images, kind, pending});
  const views = {
    'life-satisfaction': make('Life Satisfaction', ['Thriving', 'Doing OK', 'Struggling'], threeImages),
    hope: make('Hope', ['High hope', 'Mid hope', 'Low hope'], threeImages),
    anxiety: make('Anxiety', ['Low symptoms', 'Mid symptoms', 'High symptoms'], threeImages),
    depression: make('Depression', ['Low symptoms', 'Mid symptoms', 'High symptoms'], threeImages),
    'connection-to-nature': make('Connection to Nature', ['High connection', 'Mid connection', 'Low connection'], threeImages),
    'school-engagement': make('School Engagement', ['Never/Rarely', 'Sometimes', 'Often', 'Always'], ['1', '2', '3', '4'].map(level => `${icons}school-engagement-${level}.svg`)),
    friendship: make('Friendship', ['Never/Rarely', 'Sometimes', 'Often', 'Always'], ['1', '2', '3', '4'].map(level => `${icons}friendship-${level}.svg`)),
    family: make('Family Support', ['Never/Rarely', 'Sometimes', 'Often', 'Always'], ['1', '2', '3', '4'].map(level => `${icons}family-${level}.svg`)),
    'experience-of-being-bullied': make('Experience of Being Bullied', ['Daily', 'Weekly', 'Monthly', 'Never'], ['daily', 'weekly', 'monthly', 'never'].map(name => `${icons}${name}.svg`)),
    'healthy-eating': make('Healthy Eating', categoryNames, [], 'chart', true),
    'adequate-sleep': make('Adequate Sleep', categoryNames, [], 'chart', true),
    'physically-active': make('Physically Active', categoryNames, [], 'chart', true),
    'frequency-of-use': make('Frequency of Use', [], [], 'social', true),
    'reason-for-use': make('Reason for Use', [], [], 'social', true)
  };

  // Real percentages for an indicator, keyed by indicator id, e.g.
  // { depression: [12.4, 48.1, 39.5] } in the same order as that
  // indicator's `labels` array. Populated by updateDepressionSummary() via
  // window.setOutcomeCardStats() below — everything else stays at '—'
  // until a future indicator is wired up the same way.
  const outcomeStats = {};

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function append(parent, ...children) { parent.append(...children); return parent; }
  function card(label, image, index, count, value) {
    // Reuse the exact Life Satisfaction markup and all of its sizing rules.
    const templates = document.querySelectorAll('#lifeSatisfactionCards .kpi-card');
    const node = templates[count === 3 ? index : 0].cloneNode(true);
    node.querySelectorAll('[id]').forEach(item => item.removeAttribute('id'));
    if (count === 4) {
      node.classList.remove('thriving-card');
      node.classList.add('outcome-frequency-card');
    }
    node.querySelector('.kpi-label').textContent = label;
    const img = node.querySelector('.kpi-icon img');
    img.src = image;
    img.alt = '';
    node.querySelector('.kpi-value').textContent =
      value === undefined || value === null ? '—' : `${value.toFixed(1)}%`;
    return node;
  }

  function startOutcomeCards() {
    const main = document.querySelector('.dashboard-main');
    const charts = main?.querySelector('.chart-grid');
    const navigation = document.getElementById('indicatorButtons');
    if (!charts || !navigation || document.getElementById('ryaOutcomeExtension')) return;
    const root = element('section', 'rya-outcome-extension');
    root.id = 'ryaOutcomeExtension';
    main.insertBefore(root, charts);
    function renderOutcomeCards() {
      const id = navigation.querySelector('[aria-pressed="true"]')?.dataset.indicator;
      const view = views[id];
      root.replaceChildren();
      root.hidden = !view || view.kind !== 'cards';
      if (root.hidden) return;
      root.setAttribute('aria-label', view.title + ' outcome categories');
      const grid = element('div', 'kpi-grid rya-outcome-cards');
      if (view.labels.length === 4) grid.classList.add('outcome-four-cards');
      const values = outcomeStats[id];
      view.labels.forEach((label, index) => grid.append(
        card(label, view.images[index], index, view.labels.length, values ? values[index] : null)
      ));
      root.append(grid);
    }
    new MutationObserver(renderOutcomeCards).observe(navigation, {
      childList: true, subtree: true, attributes: true, attributeFilter: ['aria-pressed']
    });
    renderOutcomeCards();

    // Exposed so updateDepressionSummary() (and any future wired-up
    // indicator) can hand this extension real percentages and get an
    // immediate re-render, instead of waiting on the next aria-pressed change.
    window.setOutcomeCardStats = function setOutcomeCardStats(id, values) {
      outcomeStats[id] = values;
      renderOutcomeCards();
    };
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startOutcomeCards, {once: true});
  } else startOutcomeCards();
})();