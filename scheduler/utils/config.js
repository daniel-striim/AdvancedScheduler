/**
 * Configuration Management Module
 * Handles loading, saving, and managing scheduler configuration
 */

const SchedulerConfig = {
    // Current configuration state
    config: {
        global: {
            maxConcurrentApps: 10,
            maxConcurrentPerGroup: {},
            defaultTimezone: 'America/Los_Angeles',
            defaultStaggerSeconds: 30,
            blackoutWindows: [],
            retryPolicy: {
                maxRetries: 3,
                retryDelaySeconds: 60,
                backoffMultiplier: 2.0
            }
        },
        schedules: []
    },

    // Local storage key
    STORAGE_KEY: 'scheduler-config',

    // Initialize config from localStorage or defaults
    init() {
        const saved = localStorage.getItem(this.STORAGE_KEY);
        if (saved) {
            try {
                this.config = JSON.parse(saved);
                console.log('Loaded config from localStorage');
            } catch (e) {
                console.warn('Failed to parse saved config, using defaults');
            }
        }
        return this.config;
    },

    // Get current config
    getConfig() {
        return this.config;
    },

    // Get global settings
    getGlobal() {
        return this.config.global;
    },

    // Get all schedules
    getSchedules() {
        return this.config.schedules || [];
    },

    // Get schedule by app name
    getSchedule(appName) {
        return this.config.schedules.find(s => s.app === appName);
    },

    // Add or update a schedule
    saveSchedule(schedule) {
        const index = this.config.schedules.findIndex(s => s.app === schedule.app);
        if (index >= 0) {
            this.config.schedules[index] = schedule;
        } else {
            this.config.schedules.push(schedule);
        }
        this.persist();
        return schedule;
    },

    // Delete a schedule
    deleteSchedule(appName) {
        this.config.schedules = this.config.schedules.filter(s => s.app !== appName);
        this.persist();
    },

    // Update global settings
    saveGlobal(global) {
        this.config.global = { ...this.config.global, ...global };
        this.persist();
        return this.config.global;
    },

    // Save to localStorage
    persist() {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.config));
    },

    // Load config from JSON string
    loadFromJSON(jsonString) {
        const parsed = JSON.parse(jsonString);
        
        // Handle both array format and full config format
        if (Array.isArray(parsed)) {
            this.config.schedules = parsed;
        } else {
            if (parsed.global) {
                this.config.global = { ...this.config.global, ...parsed.global };
            }
            if (parsed.schedules) {
                this.config.schedules = parsed.schedules;
            }
        }
        this.persist();
        return this.config;
    },

    // Export config as JSON string
    exportJSON(pretty = true) {
        return JSON.stringify(this.config, null, pretty ? 2 : 0);
    },

    // Export only schedules array (simple format)
    exportSchedulesJSON(pretty = true) {
        return JSON.stringify(this.config.schedules, null, pretty ? 2 : 0);
    },

    // Clear all config
    clear() {
        this.config = {
            global: {
                maxConcurrentApps: 10,
                maxConcurrentPerGroup: {},
                defaultTimezone: 'America/Los_Angeles',
                defaultStaggerSeconds: 30,
                blackoutWindows: [],
                retryPolicy: { maxRetries: 3, retryDelaySeconds: 60, backoffMultiplier: 2.0 }
            },
            schedules: []
        };
        this.persist();
    },

    // Get unique tags from all schedules
    getAllTags() {
        const tags = new Set();
        this.config.schedules.forEach(s => {
            (s.tags || []).forEach(t => tags.add(t));
        });
        return [...tags].sort();
    },

    // Get unique groups from all schedules
    getAllGroups() {
        const groups = new Set();
        this.config.schedules.forEach(s => {
            if (s.group) groups.add(s.group);
        });
        return [...groups].sort();
    },

    // Create empty schedule template
    createEmptySchedule(appName = '') {
        return {
            app: appName,
            enabled: true,
            windows: [],
            priority: 50,
            group: '',
            tags: [],
            endAction: 'STOP'
        };
    },

    // Create empty time window template
    createEmptyWindow() {
        return { start: '00:00', end: '', days: [] };
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SchedulerConfig };
}

