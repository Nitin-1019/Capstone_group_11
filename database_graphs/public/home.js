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
