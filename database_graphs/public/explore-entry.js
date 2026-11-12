/* The app's own initialiseIndicatorNavigation() now reads URL parameters,
   selects the domain/indicator and updates history. This integration hook
   retains Albert's shared responsive header without clicking buttons twice. */
(() => {
    const script = document.createElement("script");
    script.src = "/explore-header.js";
    document.head.appendChild(script);
})();
