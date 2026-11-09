(() => {
    function initialiseExploreEntry() {
        const parameters = new URLSearchParams(window.location.search);
        const domainButtons = document.getElementById("domainButtons");
        const indicatorButtons = document.getElementById("indicatorButtons");
        const requestedDomain = parameters.get("domain");
        const requestedIndicator = parameters.get("indicator");
        const domainButton = Array.from(domainButtons.querySelectorAll("button"))
            .find(button => button.dataset.domain === requestedDomain);

        if (domainButton) domainButton.click();

        const indicatorButton = Array.from(indicatorButtons.querySelectorAll("button"))
            .find(button => button.dataset.indicator === requestedIndicator);

        if (indicatorButton) indicatorButton.click();

        const navigationLinks = document.querySelectorAll(".nav-links a");
        const destinations = ["/index.html", "/explore.html", "/index.html#understanding", "/about.html"];

        navigationLinks.forEach((link, index) => {
            link.href = destinations[index] || "/index.html";
        });

        document.querySelectorAll('.survey-info a[href="#"]').forEach(link => {
            link.href = "/index.html#understanding";
        });

        function updateAddress() {
            const domain = domainButtons.querySelector('[aria-pressed="true"]');
            const indicator = indicatorButtons.querySelector('[aria-pressed="true"]');
            const address = new URL(window.location.href);

            if (domain) address.searchParams.set("domain", domain.dataset.domain);
            if (indicator) address.searchParams.set("indicator", indicator.dataset.indicator);

            window.history.replaceState(null, "", address);
        }

        domainButtons.addEventListener("click", updateAddress);
        indicatorButtons.addEventListener("click", updateAddress);
        updateAddress();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initialiseExploreEntry, { once: true });
    } else {
        initialiseExploreEntry();
    }
})();

(() => {
    const headerScript = document.createElement('script');
    headerScript.src = '/explore-header.js';
    document.head.append(headerScript);
})();
