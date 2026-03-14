// Theme, Auth & Sidebar Management
const themeManager = {
    init() {
        const savedTheme = localStorage.getItem('pos-theme') || 'dark';
        this.setTheme(savedTheme);
        this.checkAuth();
        this.initSidebar();
    },

    checkAuth() {
        const path = window.location.pathname.split('/').pop();
        const currentPage = path === '' ? 'index.html' : path;
        const raw = sessionStorage.getItem('ruhira_user');
        const user = raw ? JSON.parse(raw) : null;

        // Never redirect on the login page itself
        if (currentPage === 'login.html') return;

        // Not logged in → go to login
        if (!user) {
            window.location.href = 'login.html';
            return;
        }

        // Populate UI name/role elements if they exist
        const nameEl = document.getElementById('logged-username');
        const roleEl = document.getElementById('logged-role');
        const welcomeEl = document.getElementById('welcome-message');
        if (nameEl) nameEl.innerText = user.username;
        if (roleEl) roleEl.innerText = user.role;
        if (welcomeEl) welcomeEl.innerText = `Welcome Back, ${user.name || user.username}`;

        // Show admin-only elements
        document.querySelectorAll('.isAdminOnly').forEach(el => {
            el.style.display = (user.role === 'admin') ? 'flex' : 'none';
        });

        // Role-based page restriction
        const staffPages = ['index.html', 'inventory.html', 'customers.html', 'sales.html',
            'orders.html', 'reports.html', 'analysis.html', 'notes.html', 'settings.html'];
        const adminPages = ['admin.html'];

        if (user.role === 'admin' && staffPages.includes(currentPage)) {
            window.location.href = 'admin.html';
        } else if (user.role === 'staff' && adminPages.includes(currentPage)) {
            window.location.href = 'index.html';
        }
    },

    initSidebar() {
        const toggle = document.getElementById('sidebarToggle');
        const sidebar = document.querySelector('.sidebar');
        
        if (toggle && sidebar) {
            toggle.addEventListener('click', (e) => {
                e.stopPropagation();
                sidebar.classList.toggle('show');
            });

            // Close sidebar when clicking outside
            document.addEventListener('click', (e) => {
                if (sidebar.classList.contains('show') && !sidebar.contains(e.target) && !toggle.contains(e.target)) {
                    sidebar.classList.remove('show');
                }
            });
        }
    },

    setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('pos-theme', theme);
        this.updateIcons(theme);
    },

    toggle() {
        const current = document.documentElement.getAttribute('data-theme');
        this.setTheme(current === 'dark' ? 'light' : 'dark');
    },

    updateIcons(theme) {
        document.querySelectorAll('.theme-toggle-icon').forEach(icon => {
            icon.classList.toggle('fa-sun', theme === 'dark');
            icon.classList.toggle('fa-moon', theme !== 'dark');
        });
    }
};

document.addEventListener('DOMContentLoaded', () => themeManager.init());
