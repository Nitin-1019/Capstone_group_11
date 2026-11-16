(() => {
    const menuButton = document.querySelector(".menu-toggle");
    const navigation = document.getElementById("primary-navigation");
    const helpDialog = document.getElementById("help-dialog");

    function closeMenu() {
        menuButton.setAttribute("aria-expanded", "false");
        navigation.classList.remove("is-open");
    }

    menuButton.addEventListener("click", () => {
        const expanded = menuButton.getAttribute("aria-expanded") !== "true";
        menuButton.setAttribute("aria-expanded", String(expanded));
        navigation.classList.toggle("is-open", expanded);
    });

    navigation.addEventListener("click", event => {
        if (event.target.closest("a")) closeMenu();
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && menuButton.getAttribute("aria-expanded") === "true") {
            closeMenu();
            menuButton.focus();
        }
    });

    document.querySelectorAll("[data-open-help]").forEach(button => {
        button.addEventListener("click", () => helpDialog.showModal());
    });
})();

(() => {
    const homeFooter = document.querySelector("footer#about.site-footer");
    homeFooter?.querySelectorAll("p").forEach(paragraph => {
        if (paragraph.textContent.trim().startsWith("Research:")) {
            paragraph.textContent = "Research: Adelaide University";
        }
    });

    const methodologyButton = document.querySelector("#understanding button.text-button[data-open-help]");
    if (methodologyButton) {
        const methodologyLink = document.createElement("a");
        methodologyLink.className = methodologyButton.className;
        methodologyLink.href = "/methodology.html";
        methodologyLink.append(...methodologyButton.childNodes);
        methodologyButton.replaceWith(methodologyLink);
    }
})();

(() => {
    const footer = document.querySelector('footer.site-footer');
    if (!footer) return;

    const credits = [
        'Survey data: Resilient Youth Australia',
        'Research: Adelaide University'
    ].map(text => {
        const paragraph = document.createElement('p');
        paragraph.textContent = text;
        return paragraph;
    });
    footer.replaceChildren(...credits);
    footer.classList.add('rya-unified-footer');
})();
