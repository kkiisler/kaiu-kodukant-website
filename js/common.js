// Common JavaScript functionality for all pages

document.addEventListener('DOMContentLoaded', function() {
    // Load reusable components
    loadHeader();
    loadFooter();

    // Wait a bit for header to load before setting up mobile menu
    setTimeout(setupMobileMenu, 100);
});

function setupMobileMenu() {
    // Mobile menu functionality
    const hamburger = document.getElementById('hamburger-menu');
    const mobileMenu = document.getElementById('mobile-menu');
    const mobileNavLinks = document.querySelectorAll('.mobile-nav-link');

    if (hamburger && mobileMenu) {
        hamburger.addEventListener('click', () => {
            mobileMenu.classList.toggle('hidden');
        });

        // Close mobile menu when clicking outside
        document.addEventListener('click', (event) => {
            if (!hamburger.contains(event.target) && !mobileMenu.contains(event.target)) {
                mobileMenu.classList.add('hidden');
            }
        });

        // Close mobile menu when clicking a link
        mobileNavLinks.forEach(link => {
            link.addEventListener('click', () => {
                mobileMenu.classList.add('hidden');
            });
        });
    }

    // Smooth scroll for anchor links within the same page
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });
}

/**
 * Load the header component from /components/header.html
 * This allows us to maintain the header in one place
 */
function loadHeader() {
    const headerPlaceholder = document.getElementById('header-placeholder');

    if (!headerPlaceholder) {
        console.warn('Header placeholder not found on this page');
        return;
    }

    fetch('/components/header.html')
        .then(response => {
            if (!response.ok) {
                throw new Error(`Failed to load header: ${response.status}`);
            }
            return response.text();
        })
        .then(html => {
            headerPlaceholder.innerHTML = html;

            // Set active page after header is loaded
            setActivePage();

            // Re-setup mobile menu after header is loaded
            setupMobileMenu();
        })
        .catch(error => {
            console.error('Error loading header component:', error);
            // Fallback: show a minimal header if the component fails to load
            headerPlaceholder.innerHTML = `
                <header class="bg-silk/95 backdrop-blur-md sticky top-0 z-50 border-b-2 border-brand-border shadow-sm">
                    <nav class="px-6 md:px-12 max-w-wide mx-auto flex items-center justify-between py-4">
                        <a href="/">MTÜ Kaiu Kodukant</a>
                    </nav>
                </header>
            `;
        });
}

/**
 * Set active class on current page navigation link
 */
function setActivePage() {
    const currentPath = window.location.pathname;
    const currentPage = currentPath.split('/').pop().replace('.html', '') || 'index';

    // Handle both desktop and mobile nav links
    const navLinks = document.querySelectorAll('.nav-link[data-page], .block[data-page]');

    navLinks.forEach(link => {
        const linkPage = link.getAttribute('data-page');
        if (linkPage === currentPage || (currentPage === '' && linkPage === 'index')) {
            link.classList.add('active');
            // For mobile menu items, change the text color
            if (link.classList.contains('block')) {
                link.classList.remove('text-sirocco');
                link.classList.add('text-cinnamon', 'font-semibold');
            }
        }
    });
}

/**
 * Load the footer component from /components/footer.html
 * This allows us to maintain the footer in one place
 */
function loadFooter() {
    const footerPlaceholder = document.getElementById('footer-placeholder');

    if (!footerPlaceholder) {
        console.warn('Footer placeholder not found on this page');
        return;
    }

    fetch('/components/footer.html')
        .then(response => {
            if (!response.ok) {
                throw new Error(`Failed to load footer: ${response.status}`);
            }
            return response.text();
        })
        .then(html => {
            footerPlaceholder.innerHTML = html;
        })
        .catch(error => {
            console.error('Error loading footer component:', error);
            // Fallback: show a minimal footer if the component fails to load
            footerPlaceholder.innerHTML = `
                <footer class="bg-gray-900 text-white py-8">
                    <div class="global-padding max-w-wide mx-auto text-center">
                        <p class="text-gray-400">&copy; 2025 MTÜ Kaiu Kodukant. Kõik õigused kaitstud.</p>
                    </div>
                </footer>
            `;
        });
}