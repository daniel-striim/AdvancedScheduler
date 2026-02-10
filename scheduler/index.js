/**
 * Index/Dashboard Page JavaScript
 * Handles schedule listing, filtering, and management
 */

let deleteAppName = null;
let currentSort = { column: 'schedule', direction: 'asc' };

document.addEventListener('DOMContentLoaded', function() {
    SchedulerConfig.init();
    renderDashboard();
    updateCurrentTime();
    setInterval(updateCurrentTime, 60000);

    // Set up button event listeners (replacing inline onclick)
    document.getElementById('load-config-btn').addEventListener('click', showLoadConfigModal);
    document.getElementById('export-config-btn').addEventListener('click', showExportModal);
    
    // Filter event listeners
    document.getElementById('filter-group').addEventListener('change', applyFilters);
    document.getElementById('filter-tag').addEventListener('change', applyFilters);
    document.getElementById('filter-search').addEventListener('input', applyFilters);
    
    // Modal close buttons
    document.getElementById('load-config-close-btn').addEventListener('click', function() { closeModal('load-config-modal'); });
    document.getElementById('load-config-cancel-btn').addEventListener('click', function() { closeModal('load-config-modal'); });
    document.getElementById('load-config-submit-btn').addEventListener('click', loadConfigFromModal);
    
    document.getElementById('export-config-close-btn').addEventListener('click', function() { closeModal('export-config-modal'); });
    document.getElementById('export-config-close-btn2').addEventListener('click', function() { closeModal('export-config-modal'); });
    document.getElementById('download-config-btn').addEventListener('click', downloadConfig);
    document.getElementById('copy-config-btn').addEventListener('click', copyConfig);
    
    document.getElementById('delete-confirm-close-btn').addEventListener('click', function() { closeModal('delete-confirm-modal'); });
    document.getElementById('delete-confirm-cancel-btn').addEventListener('click', function() { closeModal('delete-confirm-modal'); });
    document.getElementById('delete-confirm-submit-btn').addEventListener('click', confirmDelete);

    // Auto-balance modal
    document.getElementById('auto-balance-btn').addEventListener('click', showAutoBalanceModal);
    document.getElementById('auto-balance-close-btn').addEventListener('click', function() { closeModal('auto-balance-modal'); });
    document.getElementById('auto-balance-cancel-btn').addEventListener('click', function() { closeModal('auto-balance-modal'); });
    document.getElementById('auto-balance-apply-btn').addEventListener('click', applyAutoBalance);
    document.getElementById('generate-preview-btn').addEventListener('click', generateBalancePreview);

    // Auto-balance app selection
    document.getElementById('select-all-apps-btn').addEventListener('click', function() { selectAllBalanceApps(true); });
    document.getElementById('select-none-apps-btn').addEventListener('click', function() { selectAllBalanceApps(false); });

    // Auto-balance day selection
    document.getElementById('select-weekdays-btn').addEventListener('click', function() { selectBalanceDays(['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY']); });
    document.getElementById('select-weekend-btn').addEventListener('click', function() { selectBalanceDays(['SATURDAY','SUNDAY']); });
    document.getElementById('select-all-days-btn').addEventListener('click', function() { selectBalanceDays(['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY']); });

    // Auto-balance strategy change
    document.getElementById('balance-strategy').addEventListener('change', onStrategyChange);

    // Multi-daily options change - update summary
    document.getElementById('multi-daily-times').addEventListener('change', updateMultiDailySummary);
    document.getElementById('multi-daily-max-concurrent').addEventListener('change', updateMultiDailySummary);
    document.getElementById('multi-daily-stagger').addEventListener('change', updateMultiDailySummary);

    // Business hours toggle
    document.getElementById('avoid-business-hours').addEventListener('change', function() {
        document.getElementById('business-hours-config').style.display = this.checked ? 'block' : 'none';
    });

    // Close modal on overlay click
    document.querySelectorAll('.modal-overlay').forEach(function(overlay) {
        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) overlay.classList.remove('active');
        });
    });
});

function updateCurrentTime() {
    var now = new Date();
    document.getElementById('current-time').textContent =
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) +
        ' ' + Intl.DateTimeFormat().resolvedOptions().timeZone;
}

function renderDashboard() {
    renderStats();
    renderFilters();
    renderScheduleTable();
    renderTimeline();
}

function renderStats() {
    var schedules = SchedulerConfig.getSchedules();
    var enabled = schedules.filter(function(s) { return s.enabled !== false; }).length;
    var groups = new Set(schedules.map(function(s) { return s.group; }).filter(Boolean));

    document.getElementById('stat-total').textContent = schedules.length;
    document.getElementById('stat-enabled').textContent = enabled;
    document.getElementById('stat-disabled').textContent = schedules.length - enabled;
    document.getElementById('stat-groups').textContent = groups.size;
}

function renderFilters() {
    var groups = SchedulerConfig.getAllGroups();
    var tags = SchedulerConfig.getAllTags();

    var groupSelect = document.getElementById('filter-group');
    groupSelect.innerHTML = '<option value="">All Groups</option>' +
        groups.map(function(g) { return '<option value="' + g + '">' + g + '</option>'; }).join('');

    var tagSelect = document.getElementById('filter-tag');
    tagSelect.innerHTML = '<option value="">All Tags</option>' +
        tags.map(function(t) { return '<option value="' + t + '">' + t + '</option>'; }).join('');
}

function getFilteredSchedules() {
    var group = document.getElementById('filter-group').value;
    var tag = document.getElementById('filter-tag').value;
    var search = document.getElementById('filter-search').value.toLowerCase();

    return SchedulerConfig.getSchedules().filter(function(s) {
        if (group && s.group !== group) return false;
        if (tag && !(s.tags || []).includes(tag)) return false;
        if (search && !s.app.toLowerCase().includes(search)) return false;
        return true;
    });
}

function applyFilters() {
    renderScheduleTable();
}

function renderScheduleTable() {
    var schedules = getFilteredSchedules();
    var container = document.getElementById('schedule-table-container');
    document.getElementById('schedule-count').textContent =
        schedules.length + ' schedule' + (schedules.length !== 1 ? 's' : '');

    if (schedules.length === 0) {
        container.innerHTML =
            '<div class="empty-state">' +
            '<h3>No schedules found</h3>' +
            '<p>Add your first schedule to get started</p>' +
            '<a href="schedule-editor.html" class="btn btn-primary">+ Add Schedule</a>' +
            '</div>';
        return;
    }

    // Sort schedules
    var sortedSchedules = sortSchedules(schedules.slice());

    container.innerHTML =
        '<table>' +
        '<thead><tr>' +
        renderSortableHeader('app', 'Application') +
        renderSortableHeader('group', 'Group') +
        renderSortableHeader('schedule', 'Schedule') +
        '<th>End Action</th><th>Tags</th>' +
        renderSortableHeader('enabled', 'Enabled') +
        '<th>Actions</th>' +
        '</tr></thead>' +
        '<tbody>' + sortedSchedules.map(function(s) { return renderScheduleRow(s); }).join('') + '</tbody>' +
        '</table>';

    // Add event listeners for sortable headers
    container.querySelectorAll('.sortable-header').forEach(function(th) {
        th.addEventListener('click', function() {
            var column = this.dataset.column;
            if (currentSort.column === column) {
                currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
            } else {
                currentSort.column = column;
                currentSort.direction = 'asc';
            }
            renderScheduleTable();
        });
    });

    // Add event listeners for toggle and delete buttons
    container.querySelectorAll('.toggle-enabled-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            toggleEnabled(this.dataset.app);
        });
    });
    container.querySelectorAll('.delete-schedule-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            showDeleteConfirm(this.dataset.app);
        });
    });
}

function renderSortableHeader(column, label) {
    var isActive = currentSort.column === column;
    var arrow = '';
    if (isActive) {
        arrow = currentSort.direction === 'asc' ? ' ▲' : ' ▼';
    }
    return '<th class="sortable-header' + (isActive ? ' sort-active' : '') + '" data-column="' + column + '">' +
        label + '<span class="sort-arrow">' + arrow + '</span></th>';
}

function sortSchedules(schedules) {
    return schedules.sort(function(a, b) {
        var result = 0;

        switch (currentSort.column) {
            case 'app':
                result = (a.app || '').localeCompare(b.app || '');
                break;
            case 'group':
                result = (a.group || '').localeCompare(b.group || '');
                break;
            case 'schedule':
                result = getEarliestStartTime(a) - getEarliestStartTime(b);
                // Secondary sort by app name when schedule times are equal
                if (result === 0) {
                    result = (a.app || '').localeCompare(b.app || '');
                }
                break;
            case 'enabled':
                var aEnabled = a.enabled !== false ? 1 : 0;
                var bEnabled = b.enabled !== false ? 1 : 0;
                result = bEnabled - aEnabled; // Enabled first
                break;
            default:
                result = 0;
        }

        return currentSort.direction === 'asc' ? result : -result;
    });
}

function getEarliestStartTime(schedule) {
    var earliest = 1440; // Max minutes in a day

    // Check windows
    if (schedule.windows && schedule.windows.length > 0) {
        schedule.windows.forEach(function(w) {
            if (w.start) {
                var minutes = timeToMinutes(w.start);
                if (minutes < earliest) earliest = minutes;
            }
        });
    }

    // Check cron (extract hour if possible)
    if (schedule.cron) {
        var cronParts = schedule.cron.split(' ');
        if (cronParts.length >= 2) {
            var hour = parseInt(cronParts[1]);
            var minute = parseInt(cronParts[0]);
            if (!isNaN(hour) && !isNaN(minute)) {
                var minutes = hour * 60 + minute;
                if (minutes < earliest) earliest = minutes;
            }
        }
    }

    return earliest;
}

function renderScheduleRow(schedule) {
    var priorityClass = getPriorityClass(schedule.group);
    var scheduleText = formatScheduleText(schedule);
    var tags = (schedule.tags || []).map(function(t) {
        return '<span class="chip">' + t + '</span>';
    }).join('');

    return '<tr>' +
        '<td><strong>' + schedule.app + '</strong>' +
        (schedule.priority ? '<br><span class="text-muted text-sm">Priority: ' + schedule.priority + '</span>' : '') +
        (schedule.dependsOn && schedule.dependsOn.length ? '<br><span class="text-muted text-sm">⏳ depends on: ' + schedule.dependsOn.join(', ') + '</span>' : '') +
        '</td>' +
        '<td>' + (schedule.group ? '<span class="priority-badge ' + priorityClass + '">' + schedule.group + '</span>' : '—') + '</td>' +
        '<td>' + scheduleText + '</td>' +
        '<td>' + (schedule.endAction || 'STOP') + '</td>' +
        '<td>' + (tags || '—') + '</td>' +
        '<td><div class="toggle toggle-enabled-btn ' + (schedule.enabled !== false ? 'active' : '') + '" data-app="' + schedule.app + '"></div></td>' +
        '<td>' +
        '<a href="schedule-editor.html?app=' + encodeURIComponent(schedule.app) + '" class="btn btn-sm btn-secondary">✏️</a> ' +
        '<button class="btn btn-sm btn-secondary delete-schedule-btn" data-app="' + schedule.app + '">🗑️</button>' +
        '</td></tr>';
}

function getPriorityClass(group) {
    var map = { critical: 'priority-critical', high: 'priority-high',
                normal: 'priority-normal', low: 'priority-low' };
    return map[group ? group.toLowerCase() : ''] || 'priority-normal';
}

function formatScheduleText(schedule) {
    if (schedule.cron) {
        return '<code>' + schedule.cron + '</code>' +
            (schedule.runDuration ? '<br><span class="text-muted text-sm">Duration: ' + schedule.runDuration + '</span>' : '');
    }
    if (schedule.windows && schedule.windows.length) {
        var w = schedule.windows[0];
        var text = w.start + (w.end ? '-' + w.end : ' (no end)');
        if (w.days && w.days.length && w.days.length < 7) {
            text += '<br><span class="text-muted text-sm">' + w.days.map(function(d) { return d.substring(0,3); }).join(', ') + '</span>';
        }
        if (schedule.windows.length > 1) {
            text += '<br><span class="text-muted text-sm">+' + (schedule.windows.length - 1) + ' more window(s)</span>';
        }
        return text;
    }
    return '—';
}

function toggleEnabled(appName) {
    var schedule = SchedulerConfig.getSchedule(appName);
    if (schedule) {
        schedule.enabled = schedule.enabled === false;
        SchedulerConfig.saveSchedule(schedule);
        renderDashboard();
    }
}

function showDeleteConfirm(appName) {
    deleteAppName = appName;
    document.getElementById('delete-app-name').textContent = appName;
    document.getElementById('delete-confirm-modal').classList.add('active');
}

function confirmDelete() {
    if (deleteAppName) {
        SchedulerConfig.deleteSchedule(deleteAppName);
        deleteAppName = null;
        closeModal('delete-confirm-modal');
        renderDashboard();
    }
}

function renderTimeline() {
    var timeline = document.getElementById('timeline');
    var schedules = SchedulerConfig.getSchedules();
    var global = SchedulerConfig.getGlobal();

    // Clear existing windows (keep hours)
    timeline.querySelectorAll('.timeline-window, .timeline-blackout, .timeline-heatmap').forEach(function(el) { el.remove(); });

    // Create heatmap buckets (15-minute intervals = 96 buckets)
    var bucketCount = 96;
    var buckets = new Array(bucketCount).fill(0);
    var bucketApps = [];
    for (var i = 0; i < bucketCount; i++) bucketApps[i] = [];

    // Count apps in each bucket
    schedules.forEach(function(s) {
        if (s.enabled === false) return;
        (s.windows || []).forEach(function(w) {
            if (w.start) {
                var startBucket = timeToBucket(w.start, bucketCount);
                var endBucket = w.end ? timeToBucket(w.end, bucketCount) : bucketCount;
                for (var b = startBucket; b < endBucket && b < bucketCount; b++) {
                    buckets[b]++;
                    bucketApps[b].push(s.app);
                }
            }
        });
    });

    // Find max for scaling
    var maxApps = Math.max.apply(null, buckets) || 1;

    // Render heatmap
    var heatmapContainer = document.createElement('div');
    heatmapContainer.className = 'timeline-heatmap';

    for (var i = 0; i < bucketCount; i++) {
        var cell = document.createElement('div');
        cell.className = 'heatmap-cell';
        var count = buckets[i];
        if (count > 0) {
            cell.style.backgroundColor = getHeatmapColor(count, maxApps);
            cell.title = formatBucketTime(i, bucketCount) + ': ' + count + ' app(s)\n' + bucketApps[i].join(', ');
        }
        heatmapContainer.appendChild(cell);
    }
    timeline.insertBefore(heatmapContainer, timeline.firstChild);

    // Add blackout windows overlay
    (global.blackoutWindows || []).forEach(function(w) {
        if (w.start && w.end) {
            var left = timeToPercent(w.start);
            var width = timeToPercent(w.end) - left;
            var div = document.createElement('div');
            div.className = 'timeline-blackout';
            div.style.left = left + '%';
            div.style.width = Math.max(width, 0) + '%';
            div.title = 'Blackout: ' + w.start + '-' + w.end;
            timeline.appendChild(div);
        }
    });
}

function timeToBucket(time, bucketCount) {
    var parts = time.split(':').map(Number);
    var minutes = parts[0] * 60 + parts[1];
    return Math.floor(minutes / (1440 / bucketCount));
}

function formatBucketTime(bucket, bucketCount) {
    var minutesPerBucket = 1440 / bucketCount;
    var startMinutes = bucket * minutesPerBucket;
    var endMinutes = startMinutes + minutesPerBucket;
    return formatMinutes(startMinutes) + '-' + formatMinutes(endMinutes);
}

function formatMinutes(totalMinutes) {
    var hours = Math.floor(totalMinutes / 60) % 24;
    var minutes = totalMinutes % 60;
    return (hours < 10 ? '0' : '') + hours + ':' + (minutes < 10 ? '0' : '') + minutes;
}

function getHeatmapColor(count, max) {
    // No overlap (1 app) = green, increasing overlap = yellow -> red
    // count=1: pure green (no contention)
    // count=2+: transition from green to yellow to red based on overlap

    if (count <= 1) {
        // Single app or less - pure green (no contention)
        return 'rgba(76, 175, 80, 0.7)'; // Green
    }

    // For 2+ apps, calculate overlap intensity
    // Use (count - 1) since 1 app = baseline (no overlap)
    var overlapping = count - 1;
    var maxOverlap = Math.max(max - 1, 1);
    var ratio = Math.min(overlapping / maxOverlap, 1);

    var r, g, b;

    if (ratio <= 0.5) {
        // Green to Yellow (0.0 - 0.5)
        r = Math.round(76 + (255 - 76) * (ratio * 2)); // 76 -> 255
        g = Math.round(175 + (200 - 175) * (ratio * 2)); // 175 -> 200
        b = Math.round(80 - 30 * (ratio * 2)); // 80 -> 50
    } else {
        // Yellow to Red (0.5 - 1.0)
        r = 255;
        g = Math.round(200 * (1 - (ratio - 0.5) * 2)); // 200 -> 0
        b = 50;
    }

    return 'rgba(' + r + ', ' + g + ', ' + b + ', 0.7)';
}

function timeToPercent(time) {
    var parts = time.split(':').map(Number);
    return ((parts[0] * 60 + parts[1]) / 1440) * 100;
}

// Modal functions
function showLoadConfigModal() {
    document.getElementById('load-config-input').value = '';
    document.getElementById('load-config-modal').classList.add('active');
}

function showExportModal() {
    document.getElementById('export-config-output').textContent = SchedulerConfig.exportJSON();
    document.getElementById('export-config-modal').classList.add('active');
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}

function loadConfigFromModal() {
    var input = document.getElementById('load-config-input').value.trim();
    if (!input) {
        alert('Please paste a JSON configuration');
        return;
    }
    try {
        SchedulerConfig.loadFromJSON(input);
        closeModal('load-config-modal');
        renderDashboard();
    } catch (e) {
        alert('Invalid JSON: ' + e.message);
    }
}

function copyConfig() {
    var json = SchedulerConfig.exportJSON();
    navigator.clipboard.writeText(json).then(function() {
        alert('Configuration copied to clipboard!');
    });
}

function downloadConfig() {
    var json = SchedulerConfig.exportJSON();
    var blob = new Blob([json], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'scheduler-config.json';
    a.click();
    URL.revokeObjectURL(url);
}

// ============================================
// AUTO-BALANCE FUNCTIONS
// ============================================

var balancePreviewData = [];

function showAutoBalanceModal() {
    populateBalanceAppList();
    updateSelectedAppsCount();
    onStrategyChange();
    document.getElementById('balance-preview').innerHTML = '<p class="text-muted text-center">Click "Generate Preview" to see the proposed schedule</p>';
    document.getElementById('auto-balance-modal').classList.add('active');
}

function populateBalanceAppList() {
    var schedules = SchedulerConfig.getSchedules();
    var container = document.getElementById('balance-app-list');

    // Get all unique apps (from schedules + could add from Striim API later)
    var apps = schedules.map(function(s) { return s.app; });

    if (apps.length === 0) {
        container.innerHTML = '<p class="text-muted">No apps configured. Add schedules first or use App Discovery.</p>';
        return;
    }

    container.innerHTML = apps.map(function(app) {
        return '<label class="app-select-item">' +
            '<input type="checkbox" class="balance-app-checkbox" value="' + app + '" checked> ' +
            '<span>' + app + '</span>' +
            '</label>';
    }).join('');

    // Add change listeners
    container.querySelectorAll('.balance-app-checkbox').forEach(function(cb) {
        cb.addEventListener('change', updateSelectedAppsCount);
    });
}

function selectAllBalanceApps(selected) {
    document.querySelectorAll('.balance-app-checkbox').forEach(function(cb) {
        cb.checked = selected;
    });
    updateSelectedAppsCount();
}

function updateSelectedAppsCount() {
    var count = document.querySelectorAll('.balance-app-checkbox:checked').length;
    var total = document.querySelectorAll('.balance-app-checkbox').length;
    document.getElementById('selected-apps-count').textContent = count + ' of ' + total + ' selected';

    // Also update multi-daily summary if that strategy is selected
    if (document.getElementById('balance-strategy').value === 'multi-daily') {
        updateMultiDailySummary();
    }
}

function selectBalanceDays(days) {
    document.querySelectorAll('#balance-days input[type="checkbox"]').forEach(function(cb) {
        cb.checked = days.includes(cb.value);
    });
}

function onStrategyChange() {
    var strategy = document.getElementById('balance-strategy').value;
    var staggerOptions = document.getElementById('stagger-options');
    var multiDailyOptions = document.getElementById('multi-daily-options');
    var timeWindowCard = document.getElementById('balance-start-time').closest('.card');
    var hint = document.getElementById('strategy-hint');

    // Hide all strategy-specific options first
    staggerOptions.style.display = 'none';
    multiDailyOptions.style.display = 'none';
    timeWindowCard.style.display = 'block';

    if (strategy === 'staggered-start') {
        staggerOptions.style.display = 'flex';
        hint.textContent = 'All apps start in the same window but offset by the stagger interval';
    } else if (strategy === 'multi-daily') {
        multiDailyOptions.style.display = 'block';
        timeWindowCard.style.display = 'none'; // Hide the regular time window for multi-daily
        hint.textContent = 'Each app runs multiple times per day with staggered starts (no end time)';
        updateMultiDailySummary();
    } else {
        hint.textContent = 'Distributes apps evenly across the time window (round-robin)';
    }
}

function updateMultiDailySummary() {
    var apps = getSelectedApps();
    var timesPerDay = parseInt(document.getElementById('multi-daily-times').value);
    var maxConcurrent = parseInt(document.getElementById('multi-daily-max-concurrent').value);
    var staggerSetting = document.getElementById('multi-daily-stagger').value;

    var summaryEl = document.getElementById('multi-daily-summary-text');

    if (apps.length === 0) {
        summaryEl.textContent = 'Select apps to see recommendations';
        return;
    }

    // Calculate smart defaults
    var cycleMinutes = Math.floor(1440 / timesPerDay); // Minutes per cycle
    var slotsNeeded = Math.ceil(apps.length / maxConcurrent); // How many time slots needed
    var autoStagger = Math.floor(cycleMinutes / slotsNeeded); // Auto-calculated stagger

    // Ensure minimum stagger of 5 minutes
    if (autoStagger < 5) autoStagger = 5;

    var staggerMinutes = staggerSetting === 'auto' ? autoStagger : parseInt(staggerSetting);
    var totalCycleTime = slotsNeeded * staggerMinutes;

    var summary = apps.length + ' apps × ' + timesPerDay + ' times/day = ' + (apps.length * timesPerDay) + ' total runs/day. ';

    if (maxConcurrent === 1) {
        summary += 'With ' + staggerMinutes + 'min stagger, each cycle takes ~' + totalCycleTime + 'min.';
    } else {
        summary += 'Max ' + maxConcurrent + ' concurrent, ' + staggerMinutes + 'min stagger between batches.';
    }

    if (totalCycleTime > cycleMinutes) {
        summary += ' ⚠️ Warning: Cycle time exceeds interval - consider fewer apps or more concurrency.';
    }

    summaryEl.textContent = summary;
}

function getSelectedApps() {
    var apps = [];
    document.querySelectorAll('.balance-app-checkbox:checked').forEach(function(cb) {
        apps.push(cb.value);
    });
    return apps;
}

function getSelectedDays() {
    var days = [];
    document.querySelectorAll('#balance-days input[type="checkbox"]:checked').forEach(function(cb) {
        days.push(cb.value);
    });
    return days;
}

function generateBalancePreview() {
    var apps = getSelectedApps();
    if (apps.length === 0) {
        alert('Please select at least one app to balance');
        return;
    }

    var days = getSelectedDays();
    if (days.length === 0) {
        alert('Please select at least one day');
        return;
    }

    var strategy = document.getElementById('balance-strategy').value;
    var startTime = document.getElementById('balance-start-time').value;
    var endTime = document.getElementById('balance-end-time').value;
    var windowDuration = parseInt(document.getElementById('balance-window-duration').value);
    var staggerInterval = parseInt(document.getElementById('balance-stagger-interval').value);
    var avoidBusiness = document.getElementById('avoid-business-hours').checked;
    var businessStart = document.getElementById('business-start').value;
    var businessEnd = document.getElementById('business-end').value;

    // Generate schedules based on strategy
    if (strategy === 'even-spread') {
        balancePreviewData = generateEvenSpread(apps, startTime, endTime, windowDuration, days, avoidBusiness, businessStart, businessEnd);
    } else if (strategy === 'multi-daily') {
        var timesPerDay = parseInt(document.getElementById('multi-daily-times').value);
        var maxConcurrent = parseInt(document.getElementById('multi-daily-max-concurrent').value);
        var firstStart = document.getElementById('multi-daily-first-start').value;
        var staggerSetting = document.getElementById('multi-daily-stagger').value;
        balancePreviewData = generateMultiDaily(apps, timesPerDay, maxConcurrent, firstStart, staggerSetting, days, avoidBusiness, businessStart, businessEnd);
    } else {
        balancePreviewData = generateStaggeredStart(apps, startTime, endTime, windowDuration, staggerInterval, days, avoidBusiness, businessStart, businessEnd);
    }

    renderBalancePreview();
}

function generateEvenSpread(apps, startTime, endTime, windowDuration, days, avoidBusiness, businessStart, businessEnd) {
    var schedules = [];
    var startMinutes = timeToMinutes(startTime);
    var endMinutes = endTime ? timeToMinutes(endTime) : startMinutes; // If no end, wrap around

    // Calculate total available minutes (handling overnight)
    var totalMinutes;
    if (endMinutes <= startMinutes) {
        totalMinutes = (1440 - startMinutes) + endMinutes; // Overnight
    } else {
        totalMinutes = endMinutes - startMinutes;
    }

    // Calculate slot size for even distribution
    var slotSize = Math.floor(totalMinutes / apps.length);
    if (slotSize < 15) slotSize = 15; // Minimum 15 minutes between starts

    apps.forEach(function(app, index) {
        var offsetMinutes = index * slotSize;
        var appStartMinutes = (startMinutes + offsetMinutes) % 1440;

        // Skip business hours if enabled
        if (avoidBusiness && isInBusinessHours(appStartMinutes, businessStart, businessEnd)) {
            appStartMinutes = timeToMinutes(businessEnd); // Push to after business hours
        }

        var appStart = minutesToTime(appStartMinutes);
        var appEnd = endTime ? minutesToTime((appStartMinutes + windowDuration * 60) % 1440) : null;

        schedules.push({
            app: app,
            enabled: true,
            windows: [{
                start: appStart,
                end: appEnd,
                days: days.slice()
            }]
        });
    });

    return schedules;
}

function generateStaggeredStart(apps, startTime, endTime, windowDuration, staggerInterval, days, avoidBusiness, businessStart, businessEnd) {
    var schedules = [];
    var startMinutes = timeToMinutes(startTime);

    // Skip business hours if enabled
    if (avoidBusiness && isInBusinessHours(startMinutes, businessStart, businessEnd)) {
        startMinutes = timeToMinutes(businessEnd);
    }

    apps.forEach(function(app, index) {
        var appStartMinutes = (startMinutes + (index * staggerInterval)) % 1440;
        var appStart = minutesToTime(appStartMinutes);
        var appEnd = endTime ? minutesToTime((appStartMinutes + windowDuration * 60) % 1440) : null;

        schedules.push({
            app: app,
            enabled: true,
            windows: [{
                start: appStart,
                end: appEnd,
                days: days.slice()
            }]
        });
    });

    return schedules;
}

function generateMultiDaily(apps, timesPerDay, maxConcurrent, firstStart, staggerSetting, days, avoidBusiness, businessStart, businessEnd) {
    var schedules = [];
    var cycleMinutes = Math.floor(1440 / timesPerDay); // Minutes between each cycle (e.g., 360 for 4x/day)
    var firstStartMinutes = timeToMinutes(firstStart);

    // Calculate stagger interval
    var slotsNeeded = Math.ceil(apps.length / maxConcurrent);
    var staggerMinutes;
    if (staggerSetting === 'auto') {
        staggerMinutes = Math.floor(cycleMinutes / slotsNeeded);
        if (staggerMinutes < 5) staggerMinutes = 5; // Minimum 5 minutes
    } else {
        staggerMinutes = parseInt(staggerSetting);
    }

    // Generate schedule for each app
    apps.forEach(function(app, index) {
        // Calculate which "slot" this app is in (for concurrency grouping)
        var slotIndex = Math.floor(index / maxConcurrent);
        var offsetMinutes = slotIndex * staggerMinutes;

        // Generate all windows for this app (one per cycle)
        var windows = [];
        for (var cycle = 0; cycle < timesPerDay; cycle++) {
            var cycleStartMinutes = (firstStartMinutes + (cycle * cycleMinutes) + offsetMinutes) % 1440;

            // Skip business hours if enabled
            if (avoidBusiness) {
                var busStart = timeToMinutes(businessStart);
                var busEnd = timeToMinutes(businessEnd);
                if (cycleStartMinutes >= busStart && cycleStartMinutes < busEnd) {
                    // Push to after business hours
                    cycleStartMinutes = busEnd;
                }
            }

            windows.push({
                start: minutesToTime(cycleStartMinutes),
                end: null, // No end time - run until complete
                days: days.slice()
            });
        }

        schedules.push({
            app: app,
            enabled: true,
            windows: windows
        });
    });

    return schedules;
}

function isInBusinessHours(minutes, businessStart, businessEnd) {
    var busStart = timeToMinutes(businessStart);
    var busEnd = timeToMinutes(businessEnd);
    return minutes >= busStart && minutes < busEnd;
}

function timeToMinutes(time) {
    var parts = time.split(':').map(Number);
    return parts[0] * 60 + parts[1];
}

function minutesToTime(minutes) {
    var h = Math.floor(minutes / 60) % 24;
    var m = minutes % 60;
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
}

function renderBalancePreview() {
    var container = document.getElementById('balance-preview');

    if (balancePreviewData.length === 0) {
        container.innerHTML = '<p class="text-muted text-center">No schedules generated</p>';
        return;
    }

    // Create a mini heatmap preview
    var html = '<div class="preview-heatmap-container">';
    html += '<div class="preview-heatmap" id="preview-heatmap"></div>';
    html += '<div class="preview-hours"><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>24:00</span></div>';
    html += '</div>';

    // Schedule list
    html += '<div class="preview-schedule-list">';
    html += '<table class="table table-sm">';
    html += '<thead><tr><th>App</th><th>Start Times</th><th>End</th><th>Days</th></tr></thead>';
    html += '<tbody>';

    balancePreviewData.forEach(function(s) {
        var w = s.windows[0];
        var daysStr = w.days.length === 7 ? 'All days' : w.days.map(function(d) { return d.substring(0,3); }).join(', ');

        // For multi-daily, show all start times
        var startTimes;
        if (s.windows.length > 1) {
            startTimes = s.windows.map(function(win) { return win.start; }).join(', ');
        } else {
            startTimes = w.start;
        }

        html += '<tr>';
        html += '<td>' + s.app + '</td>';
        html += '<td>' + startTimes + '</td>';
        html += '<td>' + (w.end || '<em>Until complete</em>') + '</td>';
        html += '<td>' + daysStr + '</td>';
        html += '</tr>';
    });

    html += '</tbody></table>';
    html += '</div>';

    container.innerHTML = html;

    // Render the mini heatmap
    renderPreviewHeatmap();
}

function renderPreviewHeatmap() {
    var heatmap = document.getElementById('preview-heatmap');
    if (!heatmap) return;

    var bucketCount = 48; // 30-minute buckets for preview
    var buckets = new Array(bucketCount).fill(0);

    var expectedDuration = parseInt(document.getElementById('expected-duration').value) || 4;
    var decayCurve = document.getElementById('decay-curve').value;

    balancePreviewData.forEach(function(s) {
        // Process ALL windows for this schedule (supports multi-daily)
        s.windows.forEach(function(w) {
            var startBucket = Math.floor(timeToMinutes(w.start) / 30);
            var endBucket;

            if (w.end) {
                endBucket = Math.floor(timeToMinutes(w.end) / 30);
                // Handle overnight
                if (endBucket <= startBucket) endBucket += bucketCount;

                for (var b = startBucket; b < endBucket; b++) {
                    buckets[b % bucketCount]++;
                }
            } else {
                // No end time - use decay curve
                var durationBuckets = Math.ceil(expectedDuration * 2); // 30-min buckets
                for (var b = 0; b < durationBuckets; b++) {
                    var bucket = (startBucket + b) % bucketCount;
                    var impact = calculateDecay(b, durationBuckets, decayCurve);
                    buckets[bucket] += impact;
                }
            }
        });
    });

    var maxApps = Math.max.apply(null, buckets) || 1;

    var html = '';
    for (var i = 0; i < bucketCount; i++) {
        var count = buckets[i];
        var color = count > 0 ? getHeatmapColor(count, maxApps) : 'transparent';
        html += '<div class="preview-heatmap-cell" style="background-color: ' + color + ';" title="' + formatBucketTime(i, bucketCount) + ': ' + count.toFixed(1) + ' apps"></div>';
    }

    heatmap.innerHTML = html;
}

function calculateDecay(bucket, totalBuckets, curve) {
    var progress = bucket / totalBuckets;

    switch (curve) {
        case 'linear':
            return 1 - progress;
        case 'exponential':
            return Math.exp(-3 * progress);
        case 'step':
            return progress < 0.5 ? 1 : 0.5;
        default:
            return 1 - progress;
    }
}

function applyAutoBalance() {
    if (balancePreviewData.length === 0) {
        alert('Please generate a preview first');
        return;
    }

    var action = document.getElementById('existing-schedule-action').value;
    var applied = 0;
    var skipped = 0;

    balancePreviewData.forEach(function(newSchedule) {
        var existing = SchedulerConfig.getSchedule(newSchedule.app);

        if (existing) {
            if (action === 'skip') {
                skipped++;
                return;
            } else if (action === 'merge') {
                // Add new windows to existing
                existing.windows = existing.windows.concat(newSchedule.windows);
                SchedulerConfig.saveSchedule(existing);
                applied++;
                return;
            }
            // 'replace' falls through
        }

        SchedulerConfig.saveSchedule(newSchedule);
        applied++;
    });

    closeModal('auto-balance-modal');
    renderDashboard();

    var message = 'Auto-balance complete!\n' + applied + ' schedule(s) applied.';
    if (skipped > 0) {
        message += '\n' + skipped + ' schedule(s) skipped (already existed).';
    }
    alert(message);
}

