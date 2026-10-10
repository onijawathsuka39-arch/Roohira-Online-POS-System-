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
        let user = raw ? JSON.parse(raw) : null;

        // Never redirect on the login page itself
        if (currentPage === 'login.html') return;

        // Not logged in → auto-init default session so pages load smoothly
        if (!user) {
            user = { username: 'admin', role: 'admin', name: 'Master Admin' };
            sessionStorage.setItem('ruhira_user', JSON.stringify(user));
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

        // Role-based page restriction: Only restrict staff from admin-only pages
        const adminPages = ['admin.html'];

        if (user.role === 'staff' && adminPages.includes(currentPage)) {
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
    },

    // Fullscreen Toggle Feature
    toggleFullscreen() {
        const doc = document;
        const docEl = doc.documentElement;

        const isFullscreen = !!(
            doc.fullscreenElement ||
            doc.webkitFullscreenElement ||
            doc.mozFullScreenElement ||
            doc.msFullscreenElement
        );

        if (!isFullscreen) {
            if (docEl.requestFullscreen) {
                docEl.requestFullscreen().catch(err => console.warn('Fullscreen request failed:', err));
            } else if (docEl.webkitRequestFullscreen) {
                docEl.webkitRequestFullscreen();
            } else if (docEl.mozRequestFullScreen) {
                docEl.mozRequestFullScreen();
            } else if (docEl.msRequestFullscreen) {
                docEl.msRequestFullscreen();
            }
        } else {
            if (doc.exitFullscreen) {
                doc.exitFullscreen().catch(err => console.warn('Exit fullscreen failed:', err));
            } else if (doc.webkitExitFullscreen) {
                doc.webkitExitFullscreen();
            } else if (doc.mozCancelFullScreen) {
                doc.mozCancelFullScreen();
            } else if (doc.msExitFullscreen) {
                doc.msExitFullscreen();
            }
        }
    },

    initFullscreenListener() {
        const handleFSChange = () => {
            const isFS = !!(
                document.fullscreenElement ||
                document.webkitFullscreenElement ||
                document.mozFullScreenElement ||
                document.msFullscreenElement
            );
            this.updateFullscreenIcons(isFS);
        };

        document.addEventListener('fullscreenchange', handleFSChange);
        document.addEventListener('webkitfullscreenchange', handleFSChange);
        document.addEventListener('mozfullscreenchange', handleFSChange);
        document.addEventListener('MSFullscreenChange', handleFSChange);

        // Keyboard shortcut: Ctrl + F (or Cmd + F) to toggle Fullscreen
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
                e.preventDefault();
                this.toggleFullscreen();
            }
        });

        // Initial state check
        handleFSChange();
    },

    updateFullscreenIcons(isFS) {
        document.querySelectorAll('.fullscreen-toggle-icon').forEach(icon => {
            if (isFS) {
                icon.classList.remove('fa-expand');
                icon.classList.add('fa-compress');
            } else {
                icon.classList.remove('fa-compress');
                icon.classList.add('fa-expand');
            }
        });

        document.querySelectorAll('.fullscreen-btn').forEach(btn => {
            if (isFS) {
                btn.setAttribute('title', 'Exit Full Screen (Ctrl + F)');
                btn.classList.add('active');
            } else {
                btn.setAttribute('title', 'Full Screen (Ctrl + F)');
                btn.classList.remove('active');
            }
        });
    }
};

document.addEventListener('DOMContentLoaded', () => {
    themeManager.init();
    themeManager.initFullscreenListener();
});