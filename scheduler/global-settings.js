/**
 * Global Settings Page JavaScript
 * Handles global scheduler configuration
 */

let groupLimits = {};
let blackoutWindows = [];

document.addEventListener('DOMContentLoaded', function() {
    SchedulerConfig.init();
    initTimezones();
    loadSettings();
    updatePreview();

    // Set up button event listeners (replacing inline onclick)
    document.getElementById('reset-defaults-btn').addEventListener('click', resetToDefaults);
    document.getElementById('save-settings-btn').addEventListener('click', saveSettings);
    document.getElementById('add-group-limit-btn').addEventListener('click', addGroupLimit);
    document.getElementById('add-blackout-btn').addEventListener('click', addBlackout);
    document.getElementById('copy-global-config-btn').addEventListener('click', copyGlobalConfig);

    // Update preview on input changes
    document.querySelectorAll('input, select').forEach(function(el) {
        el.addEventListener('change', updatePreview);
        el.addEventListener('input', updatePreview);
    });
});

function initTimezones() {
    var select = document.getElementById('default-timezone');
    TIMEZONES.forEach(function(tz) {
        var opt = document.createElement('option');
        opt.value = tz;
        opt.textContent = tz;
        select.appendChild(opt);
    });
}

function loadSettings() {
    var global = SchedulerConfig.getGlobal();
    
    document.getElementById('max-concurrent').value = global.maxConcurrentApps || 10;
    document.getElementById('default-stagger').value = global.defaultStaggerSeconds || 30;
    document.getElementById('default-timezone').value = global.defaultTimezone || 'America/Los_Angeles';
    
    // Retry policy
    var retry = global.retryPolicy || {};
    document.getElementById('max-retries').value = retry.maxRetries !== undefined ? retry.maxRetries : 3;
    document.getElementById('retry-delay').value = retry.retryDelaySeconds !== undefined ? retry.retryDelaySeconds : 60;
    document.getElementById('backoff-multiplier').value = retry.backoffMultiplier !== undefined ? retry.backoffMultiplier : 2.0;
    
    // Group limits
    groupLimits = Object.assign({}, global.maxConcurrentPerGroup) || {};
    if (Object.keys(groupLimits).length === 0) {
        groupLimits = { critical: 3, normal: 5, low: 2 };
    }
    renderGroupLimits();
    
    // Blackout windows
    blackoutWindows = (global.blackoutWindows || []).slice();
    renderBlackouts();
}

function renderGroupLimits() {
    var container = document.getElementById('group-limits');
    container.innerHTML = Object.keys(groupLimits).map(function(group) {
        var limit = groupLimits[group];
        return '<div class="form-group" style="position: relative;">' +
            '<label>' + group + '</label>' +
            '<div class="flex gap-2">' +
            '<input type="number" class="form-control group-limit-input" data-group="' + group + '" value="' + limit + '" min="1">' +
            '<button class="btn btn-sm btn-danger remove-group-btn" data-group="' + group + '">×</button>' +
            '</div></div>';
    }).join('');

    // Add event listeners
    container.querySelectorAll('.group-limit-input').forEach(function(input) {
        input.addEventListener('change', function() {
            updateGroupLimit(this.dataset.group, this.value);
        });
    });
    container.querySelectorAll('.remove-group-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            removeGroupLimit(this.dataset.group);
        });
    });
}

function updateGroupLimit(group, value) {
    groupLimits[group] = parseInt(value) || 1;
    updatePreview();
}

function removeGroupLimit(group) {
    delete groupLimits[group];
    renderGroupLimits();
    updatePreview();
}

function addGroupLimit() {
    var name = prompt('Enter group name:');
    if (name && !groupLimits[name]) {
        groupLimits[name] = 5;
        renderGroupLimits();
        updatePreview();
    }
}

// Blackout Windows
function renderBlackouts() {
    var container = document.getElementById('blackout-container');
    if (blackoutWindows.length === 0) {
        container.innerHTML = '<p class="text-muted">No blackout windows configured</p>';
        return;
    }
    container.innerHTML = blackoutWindows.map(function(w, i) { return renderBlackoutCard(w, i); }).join('');

    // Add event listeners for blackout inputs
    container.querySelectorAll('.blackout-input').forEach(function(input) {
        input.addEventListener('change', function() {
            updateBlackout(parseInt(this.dataset.index), this.dataset.field, this.value);
        });
    });
    container.querySelectorAll('.blackout-day-checkbox').forEach(function(checkbox) {
        checkbox.addEventListener('change', function() {
            updateBlackoutDay(parseInt(this.dataset.index), this.dataset.day, this.checked);
        });
    });
    container.querySelectorAll('.remove-blackout-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            removeBlackout(parseInt(this.dataset.index));
        });
    });
}

function renderBlackoutCard(window, index) {
    var daysHtml = DAYS_OF_WEEK.map(function(d) {
        var checked = (window.days || []).includes(d.value) ? 'checked' : '';
        return '<label><input type="checkbox" class="blackout-day-checkbox" data-index="' + index + '" data-day="' + d.value + '" ' + checked + '> ' + d.label + '</label>';
    }).join('');

    return '<div class="card" style="background: var(--striim-bg); margin-bottom: 16px;">' +
        '<div class="flex justify-between items-center mb-4">' +
        '<strong>Blackout ' + (index + 1) + '</strong>' +
        '<button class="btn btn-sm btn-danger remove-blackout-btn" data-index="' + index + '">🗑️ Remove</button>' +
        '</div>' +
        '<div class="form-row">' +
        '<div class="form-group"><label>Start Time</label>' +
        '<input type="time" class="form-control blackout-input" data-index="' + index + '" data-field="start" value="' + (window.start || '') + '"></div>' +
        '<div class="form-group"><label>End Time</label>' +
        '<input type="time" class="form-control blackout-input" data-index="' + index + '" data-field="end" value="' + (window.end || '') + '"></div>' +
        '</div>' +
        '<div class="form-group"><label>Days of Week</label>' +
        '<div class="checkbox-group">' + daysHtml + '</div></div></div>';
}

function addBlackout() {
    blackoutWindows.push({ start: '09:00', end: '17:00', days: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'] });
    renderBlackouts();
    updatePreview();
}

function removeBlackout(index) {
    blackoutWindows.splice(index, 1);
    renderBlackouts();
    updatePreview();
}

function updateBlackout(index, field, value) {
    blackoutWindows[index][field] = value;
    updatePreview();
}

function updateBlackoutDay(index, day, checked) {
    if (!blackoutWindows[index].days) blackoutWindows[index].days = [];
    if (checked) {
        if (!blackoutWindows[index].days.includes(day)) blackoutWindows[index].days.push(day);
    } else {
        blackoutWindows[index].days = blackoutWindows[index].days.filter(function(d) { return d !== day; });
    }
    updatePreview();
}

// Preview
function updatePreview() {
    var global = buildGlobalConfig();
    document.getElementById('config-preview').textContent = JSON.stringify({ global: global }, null, 2);
}

function buildGlobalConfig() {
    return {
        maxConcurrentApps: parseInt(document.getElementById('max-concurrent').value) || 10,
        maxConcurrentPerGroup: Object.assign({}, groupLimits),
        defaultTimezone: document.getElementById('default-timezone').value,
        defaultStaggerSeconds: parseInt(document.getElementById('default-stagger').value) || 30,
        blackoutWindows: blackoutWindows.filter(function(w) { return w.start && w.end; }),
        retryPolicy: {
            maxRetries: parseInt(document.getElementById('max-retries').value) || 3,
            retryDelaySeconds: parseInt(document.getElementById('retry-delay').value) || 60,
            backoffMultiplier: parseFloat(document.getElementById('backoff-multiplier').value) || 2.0
        }
    };
}

// Save
function saveSettings() {
    var global = buildGlobalConfig();
    var validation = Validator.validateGlobal(global);
    if (validation.length > 0) {
        alert('Validation errors:\n' + validation.join('\n'));
        return;
    }
    SchedulerConfig.saveGlobal(global);
    alert('Settings saved!');
}

function resetToDefaults() {
    if (confirm('Reset all global settings to defaults?')) {
        document.getElementById('max-concurrent').value = 10;
        document.getElementById('default-stagger').value = 30;
        document.getElementById('default-timezone').value = 'America/Los_Angeles';
        document.getElementById('max-retries').value = 3;
        document.getElementById('retry-delay').value = 60;
        document.getElementById('backoff-multiplier').value = 2.0;
        groupLimits = { critical: 3, normal: 5, low: 2 };
        blackoutWindows = [];
        renderGroupLimits();
        renderBlackouts();
        updatePreview();
    }
}

function copyGlobalConfig() {
    var global = buildGlobalConfig();
    navigator.clipboard.writeText(JSON.stringify({ global: global }, null, 2)).then(function() {
        alert('Global config copied to clipboard!');
    });
}

