// Track section position without changing anchor links or keyboard focus.
(() => {
    const links = [...document.querySelectorAll('.methodology-sidebar a[href^="#"]')];
    const sections = links.map(link => document.getElementById(link.hash.slice(1)));
    if (!links.length || sections.some(section => !section)) return;

    let scheduled = false;
    function updateActiveSection() {
        scheduled = false;
        let active = 0;
        sections.forEach((section, index) => {
            if (section.getBoundingClientRect().top <= 100) active = index;
        });
        // The last section may be too short to reach the top of the viewport.
        if (window.scrollY > 0 && window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) {
            active = sections.length - 1;
        }
        links.forEach((link, index) => {
            if (index === active) link.setAttribute('aria-current', 'location');
            else link.removeAttribute('aria-current');
        });
    }
    function scheduleUpdate() {
        if (scheduled) return;
        scheduled = true;
        window.requestAnimationFrame(updateActiveSection);
    }
    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate);
    window.addEventListener('hashchange', scheduleUpdate);
    window.addEventListener('load', scheduleUpdate);
    // Expanding optional content changes section positions without scrolling.
    document.querySelectorAll('.methodology-details').forEach(details => {
        details.addEventListener('toggle', scheduleUpdate);
    });
    updateActiveSection();
})();

// Domain metadata mirrors wellbeingDomains in app.js; keep IDs, labels and order in sync.
(() => {
    const domains = [
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
    const explanations = {
        'life-satisfaction': {
            description: "Students' overall view of their life.",
            meaning: 'How satisfied students feel with their lives overall.',
            direction: 'Higher scores indicate greater life satisfaction.',
            results: 'The dashboard shows an average score and the share of included students in the Thriving, Doing OK and Struggling groups.'
        },
        hope: {
            description: "Students' sense of hope and possibility.",
            meaning: 'Reported hope for the future.',
            direction: 'Higher scores indicate greater reported hope.',
            results: 'The dashboard shows an average score and high, mid and low hope outcomes.'
        },
        anxiety: {
            description: "Students' reported anxiety symptoms.",
            meaning: 'Reported experiences of anxiety in the survey.',
            direction: 'The score direction and category mapping await verification against approved RYA scoring guidance. Interpret current labels with caution.',
            results: 'The dashboard displays an average score and symptom outcome labels. Those labels should not be treated as verified until the mapping is confirmed.'
        },
        depression: {
            description: "Students' reported depressive symptoms.",
            meaning: 'Reported experiences of depressive symptoms in the survey.',
            direction: 'Higher scores indicate more reported symptoms, rather than better wellbeing.',
            results: 'The dashboard shows average scores, low, mid and high symptom outcomes, and supported group comparisons. These categories are not clinical diagnoses.'
        },
        'connection-to-nature': {
            description: "Students' connection with the natural environment.",
            meaning: 'How connected students report feeling to nature.',
            direction: 'Higher scores indicate stronger reported connection.',
            results: 'The dashboard shows an average score and high, mid and low connection outcomes.'
        },
        'school-engagement': { meaning: "Students' reported engagement with school and learning." },
        friendship: { meaning: "Students' reported experiences of friendship." },
        family: { meaning: "Students' reported experiences of family relationships." },
        'experience-of-being-bullied': { meaning: "Students' reported experiences of being bullied." },
        'healthy-eating': { meaning: "Students' reported eating habits." },
        'adequate-sleep': { meaning: "Students' reported sleep habits." },
        'physically-active': { meaning: "Students' reported physical activity." },
        'frequency-of-use': { meaning: 'How often students report using social media.' },
        'reason-for-use': { meaning: 'Why students report using social media.' }
    };
    const browser = document.getElementById('measure-browser');
    if (!browser) return;
    const domainButtons = document.getElementById('measure-domains');
    const indicatorButtons = document.getElementById('measure-indicators');
    const announcement = document.getElementById('measure-announcement');
    const lastSelection = new Map();
    const resultIndicators = new Set(['life-satisfaction', 'hope', 'anxiety', 'depression', 'connection-to-nature']);

    // These are ordinary toggle buttons like Explore Data, not ARIA tabs.
    // Native Tab/Enter/Space interaction is retained for both navigation levels.
    function createButton(label, selected, onSelect) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = label;
        button.setAttribute('aria-pressed', String(selected));
        button.setAttribute('aria-controls', 'measure-panel');
        button.addEventListener('click', onSelect);
        return button;
    }
    function selectIndicator(domain, indicator, notify = true) {
        lastSelection.set(domain.id, indicator.id);
        indicatorButtons.querySelectorAll('button').forEach(button => {
            button.setAttribute('aria-pressed', String(button.dataset.indicator === indicator.id));
        });
        const copy = explanations[indicator.id];
        const implemented = resultIndicators.has(indicator.id);
        document.getElementById('measure-title-text').textContent = indicator.label;
        const query = new URLSearchParams({ domain: domain.id, indicator: indicator.id });
        document.getElementById('measure-title-link').href = `explore.html?${query}`;
        document.getElementById('measure-description').textContent = copy.description || indicator.description;
        document.getElementById('measure-meaning').textContent = copy.meaning;
        document.getElementById('measure-direction').textContent = copy.direction || 'Score interpretation and categories need the approved RYA scoring guidance. No verified scoring range is provided here.';
        document.getElementById('measure-results').textContent = copy.results || 'Explore Data currently offers a preview for this indicator. Preview illustrations are not survey findings; live results are not yet connected in this view.';
        const status = document.getElementById('measure-status');
        status.textContent = implemented ? 'Results view · availability depends on the selected dataset' : 'Preview only · live results not connected';
        status.classList.toggle('is-preview', !implemented);
        if (notify) announcement.textContent = `${domain.label}: ${indicator.label} explanation selected. ${implemented ? 'Results view.' : 'Preview only.'}`;
    }
    function selectDomain(domain, notify = true) {
        domainButtons.querySelectorAll('button').forEach(button => {
            button.setAttribute('aria-pressed', String(button.dataset.domain === domain.id));
        });
        indicatorButtons.replaceChildren();
        const selected = lastSelection.get(domain.id) || domain.indicators[0].id;
        domain.indicators.forEach(indicator => {
            const button = createButton(indicator.label, indicator.id === selected, () => selectIndicator(domain, indicator));
            button.dataset.indicator = indicator.id;
            indicatorButtons.appendChild(button);
        });
        selectIndicator(domain, domain.indicators.find(indicator => indicator.id === selected), notify);
    }
    domains.forEach((domain, index) => {
        const button = createButton(domain.label, index === 0, () => selectDomain(domain));
        button.dataset.domain = domain.id;
        domainButtons.appendChild(button);
    });
    selectDomain(domains[0], false);
    browser.hidden = false;
})();
