// Common JavaScript functionality for all pages

document.addEventListener('DOMContentLoaded', function() {
    // Load reusable footer component
    loadFooter();

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

    // Add active class to current page nav link
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const navLinks = document.querySelectorAll('.nav-link');

    navLinks.forEach(link => {
        if (link.getAttribute('href') === currentPage ||
            (currentPage === 'index.html' && link.getAttribute('href') === './')) {
            link.classList.add('active');
        }
    });

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
});

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