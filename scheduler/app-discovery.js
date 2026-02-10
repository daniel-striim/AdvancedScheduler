/**
 * App Discovery Page JavaScript
 * Handles loading and displaying Striim applications
 */

let allApps = [];
let selectedApps = new Set();

document.addEventListener('DOMContentLoaded', () => {
    SchedulerConfig.init();
    loadApps();

    // Set up event listeners (replacing inline onclick handlers)
    document.getElementById('refresh-btn').addEventListener('click', refreshApps);
    document.getElementById('add-selected-btn').addEventListener('click', addSelectedToSchedule);
    document.getElementById('filter-namespace').addEventListener('change', applyFilters);
    document.getElementById('filter-status').addEventListener('change', applyFilters);
    document.getElementById('filter-search').addEventListener('input', applyFilters);
});

async function loadApps() {
    const status = document.getElementById('connection-status');
    status.className = 'alert alert-info';
    status.innerHTML = '<span class="spinner"></span> Checking Striim connection...';

    try {
        allApps = await StriimAPI.getApplications();
        const usedCookieAuth = sessionStorage.getItem('striim_cookie_auth') === 'true';
        updateConnectionStatus(true, null, usedCookieAuth);
        populateNamespaceFilter();
        renderAppTable();
    } catch (e) {
        if (e.message === 'Login cancelled') {
            const hasCookie = await StriimAPI.checkCookieSession();
            if (hasCookie) {
                updateConnectionStatus(false, 'Login cancelled - but you appear to have a Striim session. Try refreshing.');
            } else {
                updateConnectionStatus(false, 'Not logged in. Please login to Striim first, or use the Login button below.');
            }
        } else if (e.message === 'Authentication expired') {
            updateConnectionStatus(false, 'Session expired - please login again');
        } else if (e.message === 'Cookie auth failed') {
            updateConnectionStatus(false, 'Not logged into Striim. Please login to Striim UI first, or use the Login button below.');
        } else {
            updateConnectionStatus(false, e.message);
        }
        renderOfflineMode();
    }
}

function updateConnectionStatus(connected, error, usedCookieAuth) {
    const status = document.getElementById('connection-status');
    if (connected) {
        status.className = 'alert alert-success';
        const authMethod = usedCookieAuth ? 'Using Striim session cookie' : 'Authenticated via login';
        status.innerHTML = '✅ Connected to Striim <span class="text-muted" style="font-size: 0.85em; margin-left: 1rem;">(' + authMethod + ')</span>' +
            '<span class="ml-auto"><button class="btn btn-sm btn-secondary" id="logout-btn">Logout</button></span>';
        document.getElementById('logout-btn').addEventListener('click', handleLogout);
    } else {
        status.className = 'alert alert-warning';
        status.innerHTML = '⚠️ ' + (error || 'Not connected to Striim') +
            '<span class="ml-auto"><button class="btn btn-primary" id="login-btn">🔐 Login to Striim</button></span>';
        document.getElementById('login-btn').addEventListener('click', handleLogin);
    }
}

async function handleLogin() {
    try {
        await StriimAPI.showLoginModal();
        await loadApps();
    } catch (e) {
        // Login cancelled or failed
    }
}

async function handleLogout() {
    await StriimAPI.logout();
    allApps = [];
    updateConnectionStatus(false, 'Logged out');
    renderOfflineMode();
}

function populateNamespaceFilter() {
    const namespaces = [...new Set(allApps.map(a => a.nsName).filter(Boolean))].sort();
    const select = document.getElementById('filter-namespace');
    select.innerHTML = '<option value="">All Namespaces</option>' +
        namespaces.map(ns => '<option value="' + ns + '">' + ns + '</option>').join('');
}

function getFilteredApps() {
    const namespace = document.getElementById('filter-namespace').value;
    const status = document.getElementById('filter-status').value;
    const search = document.getElementById('filter-search').value.toLowerCase();

    return allApps.filter(app => {
        if (namespace && app.nsName !== namespace) return false;
        if (status && app.flowStatus !== status) return false;
        const fullName = (app.nsName + '.' + app.name).toLowerCase();
        if (search && !fullName.includes(search)) return false;
        return true;
    });
}

function applyFilters() {
    renderAppTable();
}

async function refreshApps() {
    if (!StriimAPI.isAuthenticated()) {
        await handleLogin();
        return;
    }
    document.getElementById('connection-status').className = 'alert alert-info';
    document.getElementById('connection-status').innerHTML = '<span class="spinner"></span> Refreshing...';
    await loadApps();
}

function renderAppTable() {
    const apps = getFilteredApps();
    const scheduledApps = new Set(SchedulerConfig.getSchedules().map(s => s.app));
    const container = document.getElementById('app-table-container');

    const scheduledCount = apps.filter(a => scheduledApps.has(a.nsName + '.' + a.name)).length;
    document.getElementById('app-count').textContent = apps.length + ' found, ' + scheduledCount + ' already scheduled';

    if (apps.length === 0) {
        container.innerHTML = '<div class="empty-state"><h3>No applications found</h3>' +
            '<p>Try adjusting your filters or check the Striim connection</p></div>';
        return;
    }

    let tableHtml = '<table><thead><tr>' +
        '<th style="width: 40px;"><input type="checkbox" id="select-all"></th>' +
        '<th>Application Name</th><th>Namespace</th><th>Status</th><th>Created</th><th>Scheduled?</th>' +
        '</tr></thead><tbody>';

    apps.forEach(app => {
        tableHtml += renderAppRow(app, scheduledApps);
    });

    tableHtml += '</tbody></table>';
    container.innerHTML = tableHtml;

    // Add event listener for select-all checkbox
    document.getElementById('select-all').addEventListener('change', function() {
        toggleSelectAll(this.checked);
    });

    // Add event listeners for individual checkboxes
    container.querySelectorAll('input[data-app-name]').forEach(cb => {
        cb.addEventListener('change', function() {
            toggleAppSelection(this.dataset.appName, this.checked);
        });
    });
}

function renderAppRow(app, scheduledApps) {
    const fullName = app.nsName + '.' + app.name;
    const isScheduled = scheduledApps.has(fullName);
    const statusInfo = StriimAPI.formatStatus(app.flowStatus);
    const created = app.ctime ? new Date(app.ctime).toLocaleDateString() : '—';
    const isSelected = selectedApps.has(fullName);

    return '<tr class="' + (isSelected ? 'selected' : '') + '">' +
        '<td><input type="checkbox" data-app-name="' + fullName + '" ' +
        (isScheduled ? 'disabled' : '') + ' ' + (isSelected ? 'checked' : '') + '></td>' +
        '<td><strong>' + fullName + '</strong></td>' +
        '<td>' + (app.nsName || '—') + '</td>' +
        '<td><span class="status-badge ' + statusInfo.class + '">' + statusInfo.label + '</span></td>' +
        '<td>' + created + '</td>' +
        '<td>' + (isScheduled ? '<span class="text-success">✓ Scheduled</span>' : '<span class="text-muted">—</span>') + '</td>' +
        '</tr>';
}

function toggleSelectAll(checked) {
    const scheduledApps = new Set(SchedulerConfig.getSchedules().map(s => s.app));
    const apps = getFilteredApps();

    apps.forEach(app => {
        const fullName = app.nsName + '.' + app.name;
        if (!scheduledApps.has(fullName)) {
            if (checked) {
                selectedApps.add(fullName);
            } else {
                selectedApps.delete(fullName);
            }
        }
    });

    renderAppTable();
    updateAddButton();
}

function toggleAppSelection(appName, checked) {
    if (checked) {
        selectedApps.add(appName);
    } else {
        selectedApps.delete(appName);
    }
    updateAddButton();
}

function updateAddButton() {
    const btn = document.getElementById('add-selected-btn');
    btn.disabled = selectedApps.size === 0;
    btn.textContent = selectedApps.size > 0 ? 'Add ' + selectedApps.size + ' to Schedule' : 'Add Selected to Schedule';
}

function addSelectedToSchedule() {
    if (selectedApps.size === 0) return;

    if (selectedApps.size === 1) {
        const appName = [...selectedApps][0];
        window.location.href = 'schedule-editor.html?app=' + encodeURIComponent(appName) + '&new=1';
    } else {
        const defaultWindow = { start: '02:00', end: '06:00' };
        selectedApps.forEach(appName => {
            const schedule = SchedulerConfig.createEmptySchedule(appName);
            schedule.windows = [defaultWindow];
            SchedulerConfig.saveSchedule(schedule);
        });

        alert('Created ' + selectedApps.size + ' schedules with default time window (02:00-06:00).\n\nYou can edit each schedule individually from the dashboard.');
        window.location.href = 'index.html';
    }
}

function renderOfflineMode() {
    const container = document.getElementById('app-table-container');
    container.innerHTML = '<div class="empty-state">' +
        '<h3>Offline Mode</h3>' +
        '<p>Could not connect to Striim API. You can still:</p>' +
        '<ul style="text-align: left; display: inline-block; margin: 16px 0;">' +
        '<li>Manually enter app names in the Schedule Editor</li>' +
        '<li>Use wildcard patterns (e.g., prod.IBR*)</li>' +
        '<li>Import an existing configuration</li>' +
        '</ul>' +
        '<a href="schedule-editor.html" class="btn btn-primary">+ Create Schedule Manually</a>' +
        '</div>';
    document.getElementById('app-count').textContent = 'Offline';
}

