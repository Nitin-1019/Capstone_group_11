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
// fold into the "Other/Not Reported" bucket shown in the UI. formatGender()
// below does the reverse mapping (code -> label) for chart axis labels.
const GENDER_CODES = {
    "Male": ["M"],
    "Female": ["F"],
    "Other/Not Reported": ["O", "P"],
};

function genderLabelToCodes(label) {
    return GENDER_CODES[label] || [label];
}

function formatGender(value) {
    const genders = {
        F: "Female",
        M: "Male",
        O: "Other",
        P: "Prefer not to say"
    };

    return genders[value] || value;
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
        const options = await fetchJSON("/api/filter-options");
        availableYears = options.years || [];
        availableGrades = options.grades || [];
    } catch (error) {
        console.error("Error loading filter options:", error);
        availableYears = [2023, 2024, 2025];
        availableGrades = Array.from({ length: 10 }, (_, i) => i + 3); // 3..12
    }

    console.log("Years:", availableYears);
    console.log("Grades:", availableGrades);

    initialiseApp();
}

loadFilterOptions();

function initialiseApp() {

    populateYears();

    updateGroupSelectors();

    setupEvents();

    updateDashboard();

}


function populateYears() {

    const yearSelect =
        document.getElementById("year");

    yearSelect.innerHTML = "";

    availableYears.forEach(year => {

        const option =
            document.createElement("option");

        option.value = year;

        option.textContent = year;

        yearSelect.appendChild(option);

    });

    if (availableYears.length > 0) {
        yearSelect.value =
            Math.max(...availableYears);
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
    const sesAll = document.getElementById("sesAll").checked;

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

    if (!excludeSES && !sesAll) {
        getSelectedSESValues().forEach(ses => params.append("ses", ses));
    }

    return params;
}

// Depression is scoped down on purpose, per instruction: always 2023 data
// regardless of the Year dropdown, and SES is left out of its queries
// entirely regardless of the SES filter buttons. Gender and Grade still
// work normally. (Life Satisfaction is untouched — still uses the full
// buildFilterParams() above with no overrides.)
function buildDepressionFilterParams() {
    return buildFilterParams({ lockYear: "2023", excludeSES: true });
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
        },
        {
            allId: "sesAll",
            containerId: "sesOptions",
            optionSelector: ".ses-option"
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
                group.optionSelector
            );

            updateDashboard();
        });
    });

    // Year selector
    const yearSelect = document.getElementById("year");

    if (yearSelect) {
        yearSelect.addEventListener("change", function () {
            updateDashboard();
        });
    }

    // Reset filters
    const resetButton = document.getElementById("resetFilters");

    if (resetButton) {
        resetButton.addEventListener("click", function () {
            groupingSelect.value = "genderN";
            updateCompareButtons("genderN");
            updateGroupSelectors();

            selectAllOption(
                document.getElementById("sesAll"),
                ".ses-option"
            );

            if (availableYears.length > 0) {
                document.getElementById("year").value =
                    Math.max(...availableYears);
            }

            updateDashboard();
        });
    }

    // Set the initial selected comparison button
    updateCompareButtons(groupingSelect.value || "genderN");
}


// Now async: fetches from the backend instead of filtering rawData. Only
// acts for the indicator actually wired to real data (depression) — every
// other indicator, including Life Satisfaction (removed from the nav but
// kept defensively unwired here too), keeps showing the "Preview only"
// placeholder set by updateIndicatorView() and never calls the API.
async function updateDashboard() {
    if (activeIndicatorId === "depression") {
        await Promise.all([
            loadAndRenderSummary("depression", updateDepressionSummary),
            updateDepressionCharts(),
        ]);
    }
}

async function loadAndRenderSummary(indicator, renderFn) {
    const params = indicator === "depression" ? buildDepressionFilterParams() : buildFilterParams();
    params.set("indicator", indicator);

    try {
        const stats = await fetchJSON(`/api/indicator-summary?${params.toString()}`);
        renderFn(stats);
    } catch (error) {
        console.error(`Error loading ${indicator} summary:`, error);
        renderFn(null);
    }
}


let depressionChartRequestId = 0;

async function updateDepressionCharts() { 

    const chart = document.getElementById("stackedChart"); 

    const grouping = document.getElementById("grouping").value; 

    const groupBy = grouping === "genderN" ? "gender" : "grade"; 

    const requestId = ++depressionChartRequestId; 

    //Update chart title and description 
    const title = document.getElementById("distributionTitle"); 
    const description = document.getElementById("distributionDescription"); 

    title.textContent = groupBy === "gender" 
        ? "Depression: comparison by gender" 
        : "Depression: comparison by grade"; 

    description.textContent = groupBy === "gender" 
        ? "Average depression score by gender, for the selected filters." 
        : "Average depression score by grade, for the selected filters."; 

    // Clear previous chart 
    Plotly.purge(chart); 
    chart.replaceChildren(); 
    chart.classList.remove("chart-placeholder"); 

    try { 

        //Build existing API request 
        const params = buildDepressionFilterParams(); 

        params.set("indicator", "depression"); 
        params.set("groupBy", groupBy); 

        const breakdown = await fetchJSON( 
        `/api/indicator-breakdown?${params.toString()}` 
        ); 

        // Ignore outdated responses after changing filters 
        if (requestId !== depressionChartRequestId) { 
        return; 
        } 

        const groups = breakdown.groups || []; 

        if (groups.length === 0) { 
        chart.textContent = 
        "No data available for the selected filters."; 
        return; 
        } 

        // Gender or Grade labels 
        const labels = groups.map(group => 
        groupBy === "gender" 
        ? formatGender(group.group_value) 
        : String(group.group_value) 
        ); 

        // Average depression scores 
        const values = groups.map(group => group.mean_score);

    // Render both comparisons in the same chart container 
    await Plotly.newPlot( 
        chart, 
        [{ 
            x: labels, 
            y: values, 
            type: "bar", 
            marker: { 
                color: "#5479A5" 
            }, 
            hovertemplate: 
                "%{x}<br>Average score: %{y:.2f}<extra></extra>" 
        }], 
        { 
            title: "", 
            margin: { 
            t: 20, 
            r: 20, 
            b: 60, 
            l: 65 
        }, 
        xaxis: { 
            title: groupBy === "gender" 
                ? "Gender" 
                : "Grade", 
            type: "category" 
        }, 
        yaxis: { 
            title: "Average depression score", 
            rangemode: "tozero" 
            }, 
            autosize: true 
        }, 
        { 
            responsive: true, 
            displaylogo: false 
        } 
    ); 

    } catch (error) { 

        if (requestId !== depressionChartRequestId) { 
            return; 
        } 

        console.error( 
            "Error displaying depression graph:", 
            error 
        ); 

        chart.textContent = 
            "Could not load depression data. Check the API endpoint."; 
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

    if (stats.top_culture) {
        sentence +=
            ` ${stats.pct_nonenglish.toFixed(1)}% of these students come from a home where a language ` +
            `other than English is spoken, most commonly a ${stats.top_culture} background.`;
    } else {
        sentence +=
            ` ${stats.pct_nonenglish.toFixed(1)}% of these students come from a home where a language ` +
            `other than English is spoken.`;
    }

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
// (Low/Mid/High symptoms) that the extension block at the bottom of this
// file renders for it, via the setOutcomeCardStats() hook it exposes, plus
// the plain-language summaryText. This is separate from
// updateDepressionCharts() (the Plotly comparison graph) — one data call
// for the headline numbers, one for the per-group breakdown.
function updateDepressionSummary(stats) {
    if (!stats || !stats.n) {
        if (window.setOutcomeCardStats) {
            window.setOutcomeCardStats("depression", null);
        }

        document.getElementById("summaryText").textContent =
            "No data available for the selected filters.";

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

    // Plain-language narrative, deliberately free of raw scores or scale
    // labels - wording suited to a non-clinical audience (school staff)
    // looking at sensitive wellbeing data. Names the selected gender/grade
    // explicitly, same as updateLifeSatisfaction().
    const groupDescription = describeGroupSelection();

    let sentence =
        `Of the ${stats.n.toLocaleString()} ${groupDescription}students, ${stats.pct_thriving.toFixed(1)}% show ` +
        `few or no signs of low mood and appear to be coping well. A further ${stats.pct_doing_ok.toFixed(1)}% ` +
        `show some signs of low mood that may be worth keeping an eye on, while ${stats.pct_struggling.toFixed(1)}% ` +
        `report frequent low mood and may benefit from additional support.`;

    if (stats.top_culture) {
        sentence +=
            ` ${stats.pct_nonenglish.toFixed(1)}% of these students come from a home where a language ` +
            `other than English is spoken, most commonly a ${stats.top_culture} background.`;
    } else {
        sentence +=
            ` ${stats.pct_nonenglish.toFixed(1)}% of these students come from a home where a language ` +
            `other than English is spoken.`;
    }

    document.getElementById("summaryText").textContent = sentence;
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
            // Life Satisfaction tab stays visible, but it is intentionally
            // not wired to any data - updateDashboard() never fetches for
            // it and updateIndicatorView() gives it the same generic
            // "preview only" treatment as Hope/Anxiety/etc below. Do not
            // give this entry special-cased rendering again.
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
        });

        container.appendChild(button);
    });
}

function updateIndicatorView() {
    const domain = wellbeingDomains.find(
        item => item.id === activeDomainId
    );

    const indicator = domain.indicators.find(
        item => item.id === activeIndicatorId
    );

    // Life Satisfaction is not wired to any real data - updateDashboard()
    // never fetches for it, so it gets the same generic "preview only"
    // title/description/chart treatment as Hope/Anxiety/etc below. The one
    // difference: its three KPI cards (Thriving/Doing OK/Struggling) stay
    // visible for layout consistency with those other preview indicators,
    // but are always reset to the "-" placeholder here, never populated
    // from a fetch.
    const isLifeSatisfaction = indicator.id === "life-satisfaction";

    document.getElementById("indicatorTitle").textContent =
        indicator.label;

    document.getElementById("indicatorDescription").textContent =
        indicator.description;

    document.getElementById("lifeSatisfactionCards").hidden = !isLifeSatisfaction;

    if (isLifeSatisfaction) {
        document.querySelector(".thriving-card .kpi-value").textContent = "-";
        document.querySelector(".doing-card .kpi-value").textContent = "-";
        document.querySelector(".struggling-card .kpi-value").textContent = "-";
    }

    document.getElementById("distributionTitle").textContent =
        `${indicator.label}: overview`;

    document.getElementById("distributionDescription").textContent =
        "Explore the response distribution for this indicator.";

    // Depression draws its own charts from live data in updateDashboard();
    // everything else (including Life Satisfaction, for now) shows the
    // placeholder until it gets the same treatment.
    if (indicator.id !== "depression") { 

    // Invalidate any pending depression chart request 
    depressionChartRequestId++; 

    const chart = document.getElementById("stackedChart"); 

    Plotly.purge(chart); 

    chart.classList.add("chart-placeholder"); 

    chart.textContent = "Chart preview coming soon";
    }

    // Default placeholder - overwritten by updateDashboard() below for any
    // indicator that's actually wired to real data (currently
    // life-satisfaction and depression); stays showing for everything else.
    document.getElementById("summaryText").textContent =
        `${domain.label} / ${indicator.label} — Preview only. Results are not yet displayed.`;

    // Called exactly once here (previously this ran up to three times per
    // view change - once inside the if/else above, and again right after -
    // which triple-fetched the same data on every click for no benefit).
    updateDashboard();
}

function initialiseIndicatorNavigation() {
    renderDomainButtons();
    renderIndicatorButtons();
    updateIndicatorView();
}

if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        initialiseIndicatorNavigation
    );
} else {
    initialiseIndicatorNavigation();
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

function updateAllOption(allCheckbox, optionSelector) {
    const options = Array.from(
        document.querySelectorAll(optionSelector)
    );

    const checkedOptions = options.filter(
        option => option.checked
    );

    if (
        checkedOptions.length === 0 ||
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