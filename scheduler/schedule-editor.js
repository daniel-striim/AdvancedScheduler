/**
 * Schedule Editor Page JavaScript
 * Handles creating and editing schedules
 */

let currentSchedule = null;
let tags = [];
let windows = [];
let scheduleType = 'windows';
let isEditMode = false;

document.addEventListener('DOMContentLoaded', function() {
    SchedulerConfig.init();
    initTimezones();
    loadAppsFromStriim();

    // Check if editing existing schedule or creating new
    const params = new URLSearchParams(window.location.search);
    const appName = params.get('app');
    const isNew = params.get('new') === '1';

    if (appName && !isNew) {
        // Editing existing schedule
        loadExistingSchedule(appName);
    } else if (appName && isNew) {
        // Creating new schedule for a specific app (from app-discovery)
        document.getElementById('app-name').value = appName;
        document.getElementById('page-title').textContent = 'New Schedule: ' + appName;
        addWindow(); // Start with one empty window
    } else {
        // Brand new schedule
        addWindow(); // Start with one empty window
    }

    // Tag input handler
    document.getElementById('tags-input').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            addTag(e.target.value.trim());
            e.target.value = '';
        }
    });

    // Set up button event listeners (replacing inline onclick)
    document.getElementById('cancel-btn').addEventListener('click', function() {
        window.location.href = 'index.html';
    });
    document.getElementById('save-btn').addEventListener('click', saveSchedule);
    document.getElementById('tab-windows').addEventListener('click', function() { switchTab('windows'); });
    document.getElementById('tab-cron').addEventListener('click', function() { switchTab('cron'); });
    document.getElementById('add-window-btn').addEventListener('click', addWindow);
    document.getElementById('schedule-enabled').addEventListener('click', toggleEnabled);
    document.getElementById('app-select').addEventListener('change', selectApp);
});

function initTimezones() {
    var select = document.getElementById('schedule-timezone');
    TIMEZONES.forEach(function(tz) {
        var opt = document.createElement('option');
        opt.value = tz;
        opt.textContent = tz;
        select.appendChild(opt);
    });
}

async function loadAppsFromStriim() {
    try {
        var apps = await StriimAPI.getApplications();
        var select = document.getElementById('app-select');
        var dependsOn = document.getElementById('depends-on');
        var dependsOnCompleted = document.getElementById('depends-on-completed');
        var exclusiveWith = document.getElementById('exclusive-with');

        apps.forEach(function(app) {
            var name = app.nsName ? app.nsName + '.' + app.name : app.name;
            [select, dependsOn, dependsOnCompleted, exclusiveWith].forEach(function(sel) {
                var opt = document.createElement('option');
                opt.value = name;
                opt.textContent = name;
                sel.appendChild(opt);
            });
        });

        // If app-name is already set (from URL param), select it in dropdown
        var appNameInput = document.getElementById('app-name').value;
        if (appNameInput) {
            select.value = appNameInput;
        }
    } catch (e) {
        console.log('Could not load apps from Striim API:', e.message);
    }
}

function selectApp() {
    var selected = document.getElementById('app-select').value;
    if (selected) {
        document.getElementById('app-name').value = selected;
    }
}

function loadExistingSchedule(appName) {
    var schedule = SchedulerConfig.getSchedule(appName);
    if (!schedule) {
        alert('Schedule not found: ' + appName);
        window.location.href = 'index.html';
        return;
    }

    isEditMode = true;
    currentSchedule = schedule;
    document.getElementById('page-title').textContent = 'Edit: ' + appName;

    // Populate form
    document.getElementById('app-name').value = schedule.app;
    document.getElementById('schedule-group').value = schedule.group || '';
    document.getElementById('schedule-priority').value = schedule.priority || 50;
    document.getElementById('schedule-timezone').value = schedule.timezone || '';
    document.getElementById('end-action').value = schedule.endAction || 'STOP';
    document.getElementById('run-until-complete').checked = schedule.runUntilComplete || false;

    if (schedule.enabled === false) {
        document.getElementById('schedule-enabled').classList.remove('active');
    }

    // Tags
    tags = schedule.tags || [];
    renderTags();

    // Dependencies
    setMultiSelectValues('depends-on', schedule.dependsOn || []);
    setMultiSelectValues('depends-on-completed', schedule.dependsOnCompleted || []);
    setMultiSelectValues('exclusive-with', schedule.exclusiveWith || []);

    // Schedule type
    if (schedule.cron) {
        switchTab('cron');
        document.getElementById('cron-expression').value = schedule.cron;
        document.getElementById('run-duration').value = schedule.runDuration || '';
    } else {
        windows = schedule.windows || [];
        if (windows.length === 0) windows.push(SchedulerConfig.createEmptyWindow());
        renderWindows();
    }
}

function setMultiSelectValues(id, values) {
    var select = document.getElementById(id);
    Array.from(select.options).forEach(function(opt) {
        opt.selected = values.includes(opt.value);
    });
}

function getMultiSelectValues(id) {
    var select = document.getElementById(id);
    return Array.from(select.selectedOptions).map(function(opt) { return opt.value; });
}

function toggleEnabled() {
    document.getElementById('schedule-enabled').classList.toggle('active');
}

// Tags
function addTag(tag) {
    if (tag && !tags.includes(tag)) {
        tags.push(tag);
        renderTags();
    }
}

function removeTag(tag) {
    tags = tags.filter(function(t) { return t !== tag; });
    renderTags();
}

function renderTags() {
    var container = document.getElementById('tags-container');
    container.innerHTML = tags.map(function(t) {
        return '<span class="chip">' + t + ' <span class="remove" data-tag="' + t + '">×</span></span>';
    }).join('');
    // Add event listeners for remove buttons
    container.querySelectorAll('.remove').forEach(function(btn) {
        btn.addEventListener('click', function() {
            removeTag(this.dataset.tag);
        });
    });
}

// Schedule type tabs
function switchTab(type) {
    scheduleType = type;
    document.getElementById('tab-windows').className = 'btn btn-sm' + (type === 'windows' ? '' : ' btn-secondary');
    document.getElementById('tab-cron').className = 'btn btn-sm' + (type === 'cron' ? '' : ' btn-secondary');
    document.getElementById('windows-section').classList.toggle('hidden', type !== 'windows');
    document.getElementById('cron-section').classList.toggle('hidden', type !== 'cron');
}

// Time Windows
function addWindow() {
    windows.push(SchedulerConfig.createEmptyWindow());
    renderWindows();
}

function removeWindow(index) {
    windows.splice(index, 1);
    renderWindows();
}

function renderWindows() {
    var container = document.getElementById('windows-container');
    container.innerHTML = windows.map(function(w, i) { return renderWindowCard(w, i); }).join('');

    // Add event listeners for all inputs in windows
    container.querySelectorAll('[data-window-index]').forEach(function(el) {
        var index = parseInt(el.dataset.windowIndex);
        var field = el.dataset.field;

        if (el.type === 'checkbox') {
            el.addEventListener('change', function() {
                if (field === 'day') {
                    updateWindowDay(index, el.dataset.value, el.checked);
                } else if (field === 'month') {
                    updateWindowMonth(index, el.dataset.value, el.checked);
                }
            });
        } else {
            el.addEventListener('change', function() {
                if (field === 'daysOfMonth' || field === 'weeksOfMonth') {
                    updateWindowArray(index, field, el.value);
                } else {
                    updateWindow(index, field, el.value);
                }
            });
        }
    });

    // Add event listeners for remove buttons
    container.querySelectorAll('.remove-window-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            removeWindow(parseInt(this.dataset.index));
        });
    });
}

function renderWindowCard(window, index) {
    var daysHtml = DAYS_OF_WEEK.map(function(d) {
        var checked = (window.days || []).includes(d.value) ? 'checked' : '';
        return '<label><input type="checkbox" data-window-index="' + index + '" data-field="day" data-value="' + d.value + '" ' + checked + '> ' + d.label + '</label>';
    }).join('');

    var monthsHtml = MONTHS.map(function(m) {
        var checked = (window.months || []).includes(m.value) ? 'checked' : '';
        return '<label><input type="checkbox" data-window-index="' + index + '" data-field="month" data-value="' + m.value + '" ' + checked + '> ' + m.label + '</label>';
    }).join('');

    return '<div class="card" style="background: var(--striim-bg); margin-bottom: 16px;">' +
        '<div class="flex justify-between items-center mb-4">' +
        '<strong>Window ' + (index + 1) + '</strong>' +
        (windows.length > 1 ? '<button class="btn btn-sm btn-danger remove-window-btn" data-index="' + index + '">🗑️ Remove</button>' : '') +
        '</div>' +
        '<div class="form-row">' +
        '<div class="form-group"><label>Start Time *</label>' +
        '<input type="time" class="form-control" value="' + (window.start || '') + '" data-window-index="' + index + '" data-field="start"></div>' +
        '<div class="form-group"><label>End Time (optional)</label>' +
        '<input type="time" class="form-control" value="' + (window.end || '') + '" data-window-index="' + index + '" data-field="end">' +
        '<p class="form-hint">Leave empty for indefinite run</p></div>' +
        '</div>' +
        '<div class="form-group"><label>Days of Week (empty = all days)</label>' +
        '<div class="checkbox-group">' + daysHtml + '</div></div>' +
        '<div class="form-row">' +
        '<div class="form-group"><label>Days of Month</label>' +
        '<input type="text" class="form-control" value="' + (window.daysOfMonth || []).join(', ') + '" placeholder="e.g., 1, 15, LAST" data-window-index="' + index + '" data-field="daysOfMonth"></div>' +
        '<div class="form-group"><label>Weeks of Month</label>' +
        '<input type="text" class="form-control" value="' + (window.weeksOfMonth || []).join(', ') + '" placeholder="e.g., 1, 2, LAST" data-window-index="' + index + '" data-field="weeksOfMonth"></div>' +
        '</div>' +
        '<div class="form-group"><label>Months (empty = all months)</label>' +
        '<div class="checkbox-group" style="font-size: 12px;">' + monthsHtml + '</div></div>' +
        '<div class="form-row"><div class="form-group"><label>Date Range (optional)</label>' +
        '<div class="flex gap-2 items-center">' +
        '<input type="date" class="form-control" value="' + (window.dateFrom || '') + '" data-window-index="' + index + '" data-field="dateFrom">' +
        '<span>to</span>' +
        '<input type="date" class="form-control" value="' + (window.dateTo || '') + '" data-window-index="' + index + '" data-field="dateTo">' +
        '</div></div></div></div>';
}

function updateWindow(index, field, value) {
    windows[index][field] = value || undefined;
}

function updateWindowDay(index, day, checked) {
    if (!windows[index].days) windows[index].days = [];
    if (checked) {
        if (!windows[index].days.includes(day)) windows[index].days.push(day);
    } else {
        windows[index].days = windows[index].days.filter(function(d) { return d !== day; });
    }
}

function updateWindowMonth(index, month, checked) {
    if (!windows[index].months) windows[index].months = [];
    if (checked) {
        if (!windows[index].months.includes(month)) windows[index].months.push(month);
    } else {
        windows[index].months = windows[index].months.filter(function(m) { return m !== month; });
    }
}

function updateWindowArray(index, field, value) {
    var arr = value.split(',').map(function(v) { return v.trim(); }).filter(Boolean);
    windows[index][field] = arr.length ? arr : undefined;
}

// Save
function saveSchedule() {
    var appName = document.getElementById('app-name').value.trim();
    if (!appName) {
        alert('Application name is required');
        return;
    }

    var schedule = {
        app: appName,
        enabled: document.getElementById('schedule-enabled').classList.contains('active'),
        group: document.getElementById('schedule-group').value || undefined,
        priority: parseInt(document.getElementById('schedule-priority').value) || undefined,
        timezone: document.getElementById('schedule-timezone').value || undefined,
        tags: tags.length ? tags : undefined,
        endAction: document.getElementById('end-action').value,
        runUntilComplete: document.getElementById('run-until-complete').checked || undefined,
        dependsOn: getMultiSelectValues('depends-on'),
        dependsOnCompleted: getMultiSelectValues('depends-on-completed'),
        exclusiveWith: getMultiSelectValues('exclusive-with')
    };

    // Clean empty arrays
    if (!schedule.dependsOn.length) delete schedule.dependsOn;
    if (!schedule.dependsOnCompleted.length) delete schedule.dependsOnCompleted;
    if (!schedule.exclusiveWith.length) delete schedule.exclusiveWith;

    if (scheduleType === 'cron') {
        schedule.cron = document.getElementById('cron-expression').value.trim();
        var duration = document.getElementById('run-duration').value.trim();
        if (duration) schedule.runDuration = duration;
    } else {
        // Clean up windows
        schedule.windows = windows.map(function(w) {
            var clean = { start: w.start };
            if (w.end) clean.end = w.end;
            if (w.days && w.days.length) clean.days = w.days;
            if (w.months && w.months.length) clean.months = w.months;
            if (w.daysOfMonth && w.daysOfMonth.length) clean.daysOfMonth = w.daysOfMonth;
            if (w.weeksOfMonth && w.weeksOfMonth.length) clean.weeksOfMonth = w.weeksOfMonth;
            if (w.dateFrom) clean.dateFrom = w.dateFrom;
            if (w.dateTo) clean.dateTo = w.dateTo;
            return clean;
        }).filter(function(w) { return w.start; });
    }

    // Validate
    var validation = Validator.validateSchedule(schedule);
    if (validation.length > 0) {
        alert('Validation errors:\n' + validation.join('\n'));
        return;
    }

    // If editing and app name changed, delete old
    if (isEditMode && currentSchedule && currentSchedule.app !== appName) {
        SchedulerConfig.deleteSchedule(currentSchedule.app);
    }

    SchedulerConfig.saveSchedule(schedule);
    window.location.href = 'index.html';
}

