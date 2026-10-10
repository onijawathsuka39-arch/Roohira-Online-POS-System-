// Theme Management
const themeManager = {
    init() {
        const savedTheme = localStorage.getItem('pos-theme') || 'dark';
        this.setTheme(savedTheme);
    },

    setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('pos-theme', theme);
        this.updateIcons(theme);
    },

    toggle() {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        this.setTheme(next);
    },

    updateIcons(theme) {
        const icons = document.querySelectorAll('.theme-toggle-icon');
        icons.forEach(icon => {
            if (theme === 'dark') {
                icon.classList.remove('fa-moon');
                icon.classList.add('fa-sun');
            } else {
                icon.classList.remove('fa-sun');
                icon.classList.add('fa-moon');
            }
        });
    },

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
            if (docEl.requestFullscreen) docEl.requestFullscreen().catch(err => console.warn(err));
            else if (docEl.webkitRequestFullscreen) docEl.webkitRequestFullscreen();
            else if (docEl.mozRequestFullScreen) docEl.mozRequestFullScreen();
            else if (docEl.msRequestFullscreen) docEl.msRequestFullscreen();
        } else {
            if (doc.exitFullscreen) doc.exitFullscreen().catch(err => console.warn(err));
            else if (doc.webkitExitFullscreen) doc.webkitExitFullscreen();
            else if (doc.mozCancelFullScreen) doc.mozCancelFullScreen();
            else if (doc.msExitFullscreen) doc.msExitFullscreen();
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
                    btn.setAttribute('title', 'Exit Full Screen');
                    btn.classList.add('active');
                } else {
                    btn.setAttribute('title', 'Full Screen');
                    btn.classList.remove('active');
                }
            });
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

        handleFSChange();
    }
};

document.addEventListener('DOMContentLoaded', () => {
    themeManager.init();
    themeManager.initFullscreenListener();
});
