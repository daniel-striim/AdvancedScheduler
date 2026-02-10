/**
 * Validation Module
 * Schema validation for scheduler configuration
 */

const Validator = {
    // Validate entire config
    validateConfig(config) {
        const errors = [];
        
        if (config.global) {
            errors.push(...this.validateGlobal(config.global));
        }
        
        if (config.schedules) {
            config.schedules.forEach((schedule, index) => {
                const scheduleErrors = this.validateSchedule(schedule);
                scheduleErrors.forEach(err => {
                    errors.push(`Schedule ${index + 1} (${schedule.app || 'unnamed'}): ${err}`);
                });
            });
        }
        
        return { valid: errors.length === 0, errors };
    },

    // Validate global settings
    validateGlobal(global) {
        const errors = [];
        
        if (global.maxConcurrentApps !== undefined) {
            if (!Number.isInteger(global.maxConcurrentApps) || global.maxConcurrentApps < 1) {
                errors.push('maxConcurrentApps must be a positive integer');
            }
        }
        
        if (global.defaultStaggerSeconds !== undefined) {
            if (!Number.isInteger(global.defaultStaggerSeconds) || global.defaultStaggerSeconds < 0) {
                errors.push('defaultStaggerSeconds must be a non-negative integer');
            }
        }
        
        if (global.blackoutWindows) {
            global.blackoutWindows.forEach((window, i) => {
                const windowErrors = this.validateTimeWindow(window);
                windowErrors.forEach(err => errors.push(`Blackout window ${i + 1}: ${err}`));
            });
        }
        
        if (global.retryPolicy) {
            errors.push(...this.validateRetryPolicy(global.retryPolicy));
        }
        
        return errors;
    },

    // Validate a single schedule
    validateSchedule(schedule) {
        const errors = [];
        
        // App name is required
        if (!schedule.app || schedule.app.trim() === '') {
            errors.push('Application name is required');
        }
        
        // Priority must be 0-100
        if (schedule.priority !== undefined) {
            if (!Number.isInteger(schedule.priority) || schedule.priority < 0 || schedule.priority > 100) {
                errors.push('Priority must be an integer between 0 and 100');
            }
        }
        
        // Validate windows
        if (schedule.windows && schedule.windows.length > 0) {
            schedule.windows.forEach((window, i) => {
                const windowErrors = this.validateTimeWindow(window);
                windowErrors.forEach(err => errors.push(`Window ${i + 1}: ${err}`));
            });
        }
        
        // Validate cron if present
        if (schedule.cron) {
            const cronErrors = this.validateCron(schedule.cron);
            errors.push(...cronErrors);
        }
        
        // Must have either windows or cron
        if ((!schedule.windows || schedule.windows.length === 0) && !schedule.cron) {
            errors.push('Schedule must have at least one time window or a cron expression');
        }
        
        // Validate runDuration format
        if (schedule.runDuration) {
            if (!this.isValidDuration(schedule.runDuration)) {
                errors.push('runDuration must be in format like "30m", "2h", "1h30m"');
            }
        }
        
        // Validate endAction
        const validEndActions = ['STOP', 'QUIESCE', 'UNDEPLOY', 'STOP_UNDEPLOY'];
        if (schedule.endAction && !validEndActions.includes(schedule.endAction)) {
            errors.push(`endAction must be one of: ${validEndActions.join(', ')}`);
        }
        
        return errors;
    },

    // Validate time window
    validateTimeWindow(window) {
        const errors = [];
        
        // Start time is required
        if (!window.start) {
            errors.push('Start time is required');
        } else if (!this.isValidTime(window.start)) {
            errors.push('Start time must be in HH:MM format');
        }
        
        // End time is optional but must be valid if present
        if (window.end && !this.isValidTime(window.end)) {
            errors.push('End time must be in HH:MM format');
        }
        
        // Validate days of week
        const validDays = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
        if (window.days) {
            window.days.forEach(day => {
                if (!validDays.includes(day.toUpperCase())) {
                    errors.push(`Invalid day of week: ${day}`);
                }
            });
        }
        
        return errors;
    },

    // Validate retry policy
    validateRetryPolicy(policy) {
        const errors = [];
        if (policy.maxRetries !== undefined && (!Number.isInteger(policy.maxRetries) || policy.maxRetries < 0)) {
            errors.push('maxRetries must be a non-negative integer');
        }
        if (policy.retryDelaySeconds !== undefined && (!Number.isInteger(policy.retryDelaySeconds) || policy.retryDelaySeconds < 0)) {
            errors.push('retryDelaySeconds must be a non-negative integer');
        }
        if (policy.backoffMultiplier !== undefined && (typeof policy.backoffMultiplier !== 'number' || policy.backoffMultiplier < 1)) {
            errors.push('backoffMultiplier must be a number >= 1');
        }
        return errors;
    },

    // Validate time format (HH:MM)
    isValidTime(time) {
        return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time);
    },

    // Validate duration format (e.g., "30m", "2h", "1h30m")
    isValidDuration(duration) {
        return /^(\d+h)?(\d+m)?$/.test(duration) && duration.length > 0;
    },

    // Basic cron validation (5 or 6 fields)
    validateCron(cron) {
        const errors = [];
        const parts = cron.trim().split(/\s+/);
        if (parts.length < 5 || parts.length > 6) {
            errors.push('Cron expression must have 5 or 6 fields');
        }
        return errors;
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Validator };
}

