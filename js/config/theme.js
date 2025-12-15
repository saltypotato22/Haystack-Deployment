/**
 * Theme Configuration
 * Color tokens and theme utilities for light/dark mode
 */
(function(window) {
    'use strict';

    var STORAGE_KEY = 'haystack-theme';

    // Theme color definitions
    var themes = {
        light: {
            bgPrimary: '#ffffff',
            bgSecondary: '#f9fafb',
            bgTertiary: '#f3f4f6',
            bgCanvas: '#f5f5f5',
            textPrimary: '#111827',
            textSecondary: '#374151',
            textTertiary: '#4b5563',
            textMuted: '#6b7280',
            textFaint: '#9ca3af',
            borderPrimary: '#e5e7eb',
            borderSecondary: '#d1d5db',
            borderStrong: '#888888',
            accentPrimary: '#3b82f6',
            accentHover: '#2563eb',
            nodeBg: '#ffffff',
            nodeBorder: '#333333',
            edgeColor: '#333333',
            shadowColor: 'rgba(0, 0, 0, 0.1)'
        },
        dark: {
            bgPrimary: '#1f2937',
            bgSecondary: '#111827',
            bgTertiary: '#374151',
            bgCanvas: '#1e293b',
            textPrimary: '#f9fafb',
            textSecondary: '#e5e7eb',
            textTertiary: '#d1d5db',
            textMuted: '#9ca3af',
            textFaint: '#6b7280',
            borderPrimary: '#374151',
            borderSecondary: '#4b5563',
            borderStrong: '#6b7280',
            accentPrimary: '#60a5fa',
            accentHover: '#3b82f6',
            nodeBg: '#374151',
            nodeBorder: '#9ca3af',
            edgeColor: '#9ca3af',
            shadowColor: 'rgba(0, 0, 0, 0.3)'
        }
    };

    /**
     * Get current theme name
     * @returns {string} 'light' or 'dark'
     */
    function getCurrentTheme() {
        return document.documentElement.getAttribute('data-theme') || 'light';
    }

    /**
     * Get current theme colors object
     * @returns {Object} Theme color tokens
     */
    function getThemeColors() {
        var themeName = getCurrentTheme();
        return themes[themeName] || themes.light;
    }

    /**
     * Read CSS variable value from computed styles
     * @param {string} varName - CSS variable name (without --)
     * @returns {string} The CSS variable value
     */
    function getCssVar(varName) {
        return getComputedStyle(document.documentElement)
            .getPropertyValue('--' + varName)
            .trim();
    }

    /**
     * Set theme and update DOM
     * @param {string} themeName - 'light' or 'dark'
     */
    function setTheme(themeName) {
        if (themeName !== 'light' && themeName !== 'dark') {
            themeName = 'light';
        }

        document.documentElement.setAttribute('data-theme', themeName);

        if (themeName === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }

        localStorage.setItem(STORAGE_KEY, themeName);

        // Dispatch custom event for components to react
        window.dispatchEvent(new CustomEvent('themechange', {
            detail: { theme: themeName }
        }));
    }

    /**
     * Toggle between light and dark themes
     * @returns {string} The new theme name
     */
    function toggleTheme() {
        var current = getCurrentTheme();
        var newTheme = current === 'light' ? 'dark' : 'light';
        setTheme(newTheme);
        return newTheme;
    }

    /**
     * Initialize theme from localStorage or system preference
     */
    function initTheme() {
        var saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            setTheme(saved);
        }
        // If no saved preference, early detection script already handled system preference
    }

    /**
     * Listen for system preference changes
     */
    function listenForSystemPreference() {
        var mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        mediaQuery.addEventListener('change', function(e) {
            // Only auto-switch if user hasn't set a manual preference
            if (!localStorage.getItem(STORAGE_KEY)) {
                setTheme(e.matches ? 'dark' : 'light');
            }
        });
    }

    // Export to namespace
    window.GraphApp.config.theme = {
        themes: themes,
        getCurrentTheme: getCurrentTheme,
        getThemeColors: getThemeColors,
        getCssVar: getCssVar,
        setTheme: setTheme,
        toggleTheme: toggleTheme,
        initTheme: initTheme,
        listenForSystemPreference: listenForSystemPreference,
        STORAGE_KEY: STORAGE_KEY
    };

    // Initialize on load
    listenForSystemPreference();

})(window);
