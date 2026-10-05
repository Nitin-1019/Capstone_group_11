console.log("APP.JS IS CONNECTED");

let rawData = [];

function numberOrNull(value) {
    if (value === null || value === undefined || String(value).trim() === "") {
        return null;
    }

    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

function getSES(row) {
    const existingSES =
        String(row.ses ?? "").trim();

    if (
        existingSES === "Low" ||
        existingSES === "Mid" ||
        existingSES === "High"
    ) {
        return existingSES;
    }

    const decile =
        numberOrNull(row.seifa_decile);

    if (decile >= 1 && decile <= 3) {
        return "Low";
    }

    if (decile >= 4 && decile <= 7) {
        return "Mid";
    }

    if (decile >= 8 && decile <= 10) {
        return "High";
    }

    return "Unknown SES";
}

function getResponseYear(timestamp) {
    if (timestamp instanceof Date) {
        return timestamp.getFullYear();
    }

    const match = String(timestamp ?? "").match(/\b(?:19|20)\d{2}\b/);
    return match ? Number(match[0]) : null;
}

async function loadDashboardData() {
    try {
        const files = [
            { path: "data/RYA_Dashboard_2023.csv", year: 2023 },
            { path: "data/RYA_Dashboard_2024.csv", year: 2024 },
            { path: "data/RYA_Dashboard_2025.csv", year: 2025 }
        ];

        const datasets = await Promise.all(
            files.map(async ({ path, year }) => {
                const response = await fetch(path);

                if (!response.ok) {
                    throw new Error(`Failed to load ${path}: ${response.status}`);
                }

                const text = await response.text();

                const workbook = XLSX.read(text, {
                    type: "string"
                });

                const firstSheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[firstSheetName];

                const rows = XLSX.utils.sheet_to_json(sheet, {
                    defval: null
                });

                return rows.map(row => {
                    const gender = String(
                        row.genderN ?? row.gender ?? ""
                    ).trim().toUpperCase();

                    return {
                        ...row,

                        age: numberOrNull(row.age),
                        grade: numberOrNull(row.grade),
                        cantril: numberOrNull(row.cantril),

                        // Use year in CSV if it exists.
                        // Otherwise use the year from the filename.
                        year: numberOrNull(row.year) ?? year,

                        genderN:
                            gender === "F" || gender === "FEMALE"
                                ? "Female"
                                : gender === "M" || gender === "MALE"
                                    ? "Male"
                                    : "Other/Not Reported",

                        // Keep the cleaned SES value if it already exists
                        ses: getSES(row)
                    };
                });
            })
        );

        rawData = datasets.flat();

        console.log("First row:", rawData[0]);
        console.log("Columns:", Object.keys(rawData[0]));
        console.log(
            "Cantril rows:",
            rawData.filter(row => row.cantril !== null).length
        );

        console.log("Loaded dashboard data:", rawData);
        console.log("Total rows:", rawData.length);
        console.log("Years:", [...new Set(rawData.map(row => row.year))]);

        initialiseApp();

        } catch (error) {
            console.error("Error loading dashboard data:", error);
        }
        }

loadDashboardData();

function initialiseApp() {

    populateYears();

    updateGroupSelectors();

    setupEvents();

    updateDashboard();

}


function populateYears() {

    const yearSelect =
        document.getElementById("year");


    const years = [
        ...new Set(
            rawData
                .map(row => row.year)
                .filter(year => year !== null)
        )
    ].sort();


    yearSelect.innerHTML = "";


    years.forEach(year => {

        const option =
            document.createElement("option");

        option.value = year;

        option.textContent = year;

        yearSelect.appendChild(option);

    });


    yearSelect.value =
        Math.max(...years);

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

    const genders = [
        "Male",
        "Female",
        "Other/Not Reported"
    ];

    const grades = [
        ...new Set(
            rawData
                .map(row => row.grade)
                .filter(
                    grade =>
                        grade !== null &&
                        !Number.isNaN(grade)
                )
        )
    ].sort((a, b) => a - b);

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

function getFilteredData() {

    let data = [...rawData];


    const year =
        Number(
            document.getElementById("year").value
        );


    const grouping =
        document.getElementById("grouping").value;


    const secondaryAll =
        document.getElementById("secondaryAll").checked;


    // =========================
    // YEAR
    // =========================

    data = data.filter(
        row => row.year === year
    );


    // =========================
    // MAIN GROUP
    // =========================

    const selectedGroups =
        getSelectedGroupValues();


    if (selectedGroups.length > 0) {

        if (grouping === "genderN") {

            data = data.filter(
                row =>
                    selectedGroups.includes(
                        row.genderN
                    )
            );

        } else {

            data = data.filter(
                row =>
                    selectedGroups.includes(
                        String(row.grade)
                    )
            );

        }

    }


    // =========================
    // SECONDARY FILTER
    // =========================

    if (!secondaryAll) {

        const selectedSecondary =
            getSelectedSecondaryValues();


        if (grouping === "genderN") {

            // Display by Gender
            // Secondary filter = Grade

            data = data.filter(
                row =>
                    selectedSecondary.includes(
                        String(row.grade)
                    )
            );

        } else {

            // Display by Grade
            // Secondary filter = Gender

            data = data.filter(
                row =>
                    selectedSecondary.includes(
                        row.genderN
                    )
            );

        }

    }

    // =========================
    // SES FILTER
    // =========================

    const sesAll =
        document.getElementById("sesAll").checked;


    if (!sesAll) {

        const selectedSES =
            getSelectedSESValues();


        data = data.filter(
            row =>
                selectedSES.includes(
                    row.ses
                )
        );

    }

    return data;

}

function setupEvents() {
    const groupingSelect =
        document.getElementById("grouping");

    document
        .querySelectorAll(".compare-button")
        .forEach(button => {
            button.addEventListener("click", function() {
                groupingSelect.value =
                    this.dataset.grouping;

                groupingSelect.dispatchEvent(
                    new Event("change")
                );
            });
        });

    groupingSelect.addEventListener("change", function() {
        updateGroupSelectors();
        updateDashboard();
    });

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
        const allCheckbox =
            document.getElementById(group.allId);

        allCheckbox.addEventListener("change", function() {
            selectAllOption(
                allCheckbox,
                group.optionSelector
            );

            updateDashboard();
        });

        document
            .getElementById(group.containerId)
            .addEventListener("change", function(event) {
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

    document
    .getElementById("year")
    .addEventListener("change", updateDashboard);

    document
        .getElementById("resetFilters")
        .addEventListener("click", function() {
            groupingSelect.value = "genderN";
            updateGroupSelectors();

            selectAllOption(
                document.getElementById("sesAll"),
                ".ses-option"
            );

            const years = Array.from(
                document.getElementById("year").options
            ).map(option => Number(option.value));

            if (years.length > 0) {
                document.getElementById("year").value =
                    Math.max(...years);
            }

            updateDashboard();
        });
}

function testFilteredData() {

    const filteredData =
        getFilteredData();


    console.log(
        "Filtered rows:",
        filteredData.length
    );


    console.log(
        filteredData.slice(0, 5)
    );

}

function updateDashboard() {
    const filteredData = getFilteredData();

    console.log("Filtered rows:", filteredData.length);

    if (activeIndicatorId === "life-satisfaction") {
        updateLifeSatisfaction(filteredData);
    }
}


function updateLifeSatisfaction(data) {
    const validData = data.filter(row =>
        row.cantril !== null &&
        row.cantril >= 1 &&
        row.cantril <= 8
    );

    const total = validData.length;

    if (total === 0) {
        document.querySelector(".thriving-card .kpi-value").textContent = "-";
        document.querySelector(".doing-card .kpi-value").textContent = "-";
        document.querySelector(".struggling-card .kpi-value").textContent = "-";

        document.getElementById("summaryText").textContent =
            "No data available for the selected filters.";

        return;
    }

    const thriving = validData.filter(
        row => row.cantril >= 7
    ).length;

    const doingOK = validData.filter(
        row => row.cantril >= 5 && row.cantril <= 6
    ).length;

    const struggling = validData.filter(
        row => row.cantril >= 1 && row.cantril <= 4
    ).length;

    const thrivingPercent = thriving / total * 100;
    const doingOKPercent = doingOK / total * 100;
    const strugglingPercent = struggling / total * 100;

    const mean =
        validData.reduce(
            (sum, row) => sum + row.cantril,
            0
        ) / total;

    document.querySelector(
        ".thriving-card .kpi-value"
    ).textContent = `${thrivingPercent.toFixed(1)}%`;

    document.querySelector(
        ".doing-card .kpi-value"
    ).textContent = `${doingOKPercent.toFixed(1)}%`;

    document.querySelector(
        ".struggling-card .kpi-value"
    ).textContent = `${strugglingPercent.toFixed(1)}%`;

    document.getElementById("summaryText").textContent =
        `Based on ${total.toLocaleString()} students, the average life satisfaction score is ${mean.toFixed(2)}.`;
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

function updateSecondaryVisibility() {
    const secondaryOptions =
        document.getElementById("secondaryOptions");

    secondaryOptions.style.removeProperty("display");
}

const wellbeingDomains = [
    {
        id: "mental",
        label: "Mental Wellbeing",
        indicators: [
            {
                id: "life-satisfaction",
                label: "Life Satisfaction",
                description: "Explore how students rate their overall life satisfaction."
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
let activeIndicatorId = "life-satisfaction";

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

    const isLifeSatisfaction = indicator.id === "life-satisfaction";

    document.getElementById("indicatorTitle").textContent =
        indicator.label;

    document.getElementById("indicatorDescription").textContent =
        indicator.description;

    document.getElementById("lifeSatisfactionCards").hidden =
        !isLifeSatisfaction;

    document.getElementById("distributionTitle").textContent =
        isLifeSatisfaction
            ? "How are students feeling?"
            : `${indicator.label}: overview`;

    document.getElementById("distributionDescription").textContent =
        isLifeSatisfaction
            ? "Percentage of students in each wellbeing group"
            : "Explore the response distribution for this indicator.";

    document.getElementById("comparisonTitle").textContent =
        isLifeSatisfaction
            ? "Average life satisfaction (mean score)"
            : `${indicator.label}: group comparison`;

    document.getElementById("comparisonDescription").textContent =
        isLifeSatisfaction
            ? "Mean (M) with 95% confidence interval (95% CI)"
            : "Compare results across the selected student groups.";

    document.getElementById("comparisonInfoButton").textContent =
        isLifeSatisfaction
            ? "About confidence intervals"
            : "About this indicator";

    ["stackedChart", "meanChart"].forEach(id => {
        const chart = document.getElementById(id);
        chart.classList.add("chart-placeholder");
        chart.textContent = "Chart preview coming soon";
    });

    document.getElementById("summaryText").textContent =
        `${domain.label} / ${indicator.label} — Preview only. Results are not yet displayed.`;
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

function updateCompareButtons(grouping) {
    document
        .querySelectorAll(".compare-button")
        .forEach(button => {
            const active =
                button.dataset.grouping === grouping;

            button.classList.toggle("active", active);

            button.setAttribute(
                "aria-pressed",
                String(active)
            );
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