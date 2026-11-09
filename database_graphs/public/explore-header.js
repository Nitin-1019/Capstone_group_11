(() => {
    function initialiseSharedHeader() {
        const header = document.querySelector('.top-nav');
        if (!header || header.classList.contains('rya-unified-header')) return;

        const brand = header.querySelector('.brand');
        const navigation = header.querySelector('.nav-links');
        const actions = header.querySelector('.nav-actions');
        if (!brand || !navigation || !actions) return;

        const stylesheet = document.createElement('link');
        stylesheet.rel = 'stylesheet';
        stylesheet.href = '/explore-header.css';
        document.head.append(stylesheet);

        const container = document.createElement('div');
        container.className = 'rya-header-inner';

        const homeLink = document.createElement('a');
        homeLink.className = 'rya-brand-link';
        homeLink.href = '/index.html';
        homeLink.setAttribute('aria-label', 'Resilient Youth Australia — Home');
        homeLink.append(brand);
        brand.querySelector('img')?.setAttribute('alt', '');

        navigation.id = 'rya-main-navigation';
        navigation.setAttribute('aria-label', 'Main navigation');
        const destinations = ['/index.html', '/explore.html', '/index.html#understanding', '/about.html'];
        navigation.querySelectorAll('a').forEach((link, index) => {
            if (destinations[index]) link.href = destinations[index];
            if (link.classList.contains('active')) link.setAttribute('aria-current', 'page');
        });

        const menuButton = document.createElement('button');
        menuButton.type = 'button';
        menuButton.className = 'rya-menu-toggle';
        menuButton.setAttribute('aria-expanded', 'false');
        menuButton.setAttribute('aria-controls', navigation.id);
        menuButton.append('Menu ');
        const menuIcon = document.createElement('span');
        menuIcon.setAttribute('aria-hidden', 'true');
        menuIcon.textContent = '☰';
        menuButton.append(menuIcon);

        function closeMenu() {
            menuButton.setAttribute('aria-expanded', 'false');
            navigation.classList.remove('is-open');
        }

        menuButton.addEventListener('click', () => {
            const expanded = menuButton.getAttribute('aria-expanded') !== 'true';
            menuButton.setAttribute('aria-expanded', String(expanded));
            navigation.classList.toggle('is-open', expanded);
        });
        navigation.addEventListener('click', event => {
            if (event.target.closest('a')) closeMenu();
        });
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape' && menuButton.getAttribute('aria-expanded') === 'true') {
                closeMenu();
                menuButton.focus();
            }
        });

        actions.querySelector('.help-button')?.setAttribute('aria-label', 'Help exploring wellbeing data');
        container.append(homeLink, menuButton, navigation, actions);
        header.append(container);
        header.classList.add('rya-unified-header');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialiseSharedHeader, { once: true });
    } else {
        initialiseSharedHeader();
    }
})();
