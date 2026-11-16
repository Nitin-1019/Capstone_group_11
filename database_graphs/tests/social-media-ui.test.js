const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const publicDirectory = path.join(__dirname, '..', 'public');

function loadApp(search = '') {
    const context = vm.createContext({
        console: { log() {}, error() {} },
        document: { readyState: 'loading', addEventListener() {} },
        window: { location: { search } },
        URLSearchParams
    });
    vm.runInContext(fs.readFileSync(path.join(publicDirectory, 'app.js'), 'utf8'), context);
    return context;
}

test('Social Media exposes one daily-use indicator without altering other domains', () => {
    const context = loadApp();
    const domains = JSON.parse(vm.runInContext('JSON.stringify(wellbeingDomains)', context));
    assert.deepEqual(domains.map(domain => domain.indicators.length), [5, 1, 3, 3, 1]);
    assert.deepEqual(domains.at(-1).indicators, [{
        id: 'frequency-of-use',
        label: 'Daily Social Media Use',
        description: 'Time spent per day.'
    }]);
});

test('old Social Media links resolve to the single retained indicator', () => {
    for (const indicator of ['frequency-of-use', 'reason-for-use', '']) {
        const context = loadApp(`?domain=social-media&indicator=${indicator}`);
        vm.runInContext('loadIndicatorFromUrl()', context);
        assert.equal(vm.runInContext('activeDomainId', context), 'social-media');
        assert.equal(vm.runInContext('activeIndicatorId', context), 'frequency-of-use');
    }
});

test('a late summary response cannot overwrite a different indicator', async () => {
    const context = loadApp();
    context.buildFilterParams = () => new URLSearchParams();
    let resolveResponse;
    context.fetchJSON = () => new Promise(resolve => { resolveResponse = resolve; });
    vm.runInContext("activeIndicatorId = 'depression'", context);
    let rendered = false;
    const pending = context.loadAndRenderSummary('depression', () => { rendered = true; });
    vm.runInContext("activeIndicatorId = 'frequency-of-use'", context);
    resolveResponse({ n: 100 });
    await pending;
    assert.equal(rendered, false);
});

test('a late depression narrative cannot appear in Social Media', async () => {
    const context = loadApp();
    const narrative = { textContent: 'Daily use categories' };
    context.document.getElementById = id => id === 'distributionSummary' ? narrative : { value: 'genderN' };
    context.buildDepressionFilterParams = () => new URLSearchParams();
    let resolveResponse;
    context.fetchJSON = () => new Promise(resolve => { resolveResponse = resolve; });
    vm.runInContext("activeIndicatorId = 'depression'", context);
    const pending = context.updateDepressionNarrative();
    vm.runInContext("activeIndicatorId = 'frequency-of-use'", context);
    resolveResponse({});
    await pending;
    assert.equal(narrative.textContent, 'Daily use categories');
});

test('shared-page footers contain the same two credit lines', () => {
    let credits;
    const footer = {
        replaceChildren(...paragraphs) { credits = paragraphs.map(paragraph => paragraph.textContent); },
        classList: { add() {} }
    };
    const button = { addEventListener() {} };
    const context = vm.createContext({
        document: {
            querySelector(selector) {
                if (selector === '.menu-toggle') return button;
                if (selector === 'footer.site-footer') return footer;
                return null;
            },
            querySelectorAll() { return []; },
            getElementById() { return button; },
            addEventListener() {},
            createElement() { return {}; }
        }
    });
    vm.runInContext(fs.readFileSync(path.join(publicDirectory, 'home.js'), 'utf8'), context);
    assert.deepEqual(credits, ['Survey data: Resilient Youth Australia', 'Research: Adelaide University']);
});
