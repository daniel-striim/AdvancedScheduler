/**
 * Striim API Helper Module
 * Handles authentication and API calls to Striim REST endpoints
 *
 * Authentication Strategy:
 * 1. First try cookie-based auth via /metadata/ endpoint (works if user logged into Striim UI)
 * 2. If cookie auth fails, prompt user to login and use Authorization header for API v2
 *
 * Note: Striim's token cookie is HttpOnly, so we cannot read it via JavaScript.
 * However, the browser will automatically send it with requests to /metadata/ endpoints.
 */

const StriimAPI = {
    // Storage key for token
    TOKEN_KEY: 'striim_auth_token',

    // Track if cookie-based auth is available
    COOKIE_AUTH_KEY: 'striim_cookie_auth',

    // Get auth token from sessionStorage
    getToken() {
        return sessionStorage.getItem(this.TOKEN_KEY);
    },

    // Set auth token
    setToken(token) {
        sessionStorage.setItem(this.TOKEN_KEY, token);
    },

    // Clear auth token
    clearToken() {
        sessionStorage.removeItem(this.TOKEN_KEY);
        sessionStorage.removeItem(this.COOKIE_AUTH_KEY);
    },

    // Check if user is authenticated (either via cookie or token)
    isAuthenticated() {
        return !!this.getToken() || sessionStorage.getItem(this.COOKIE_AUTH_KEY) === 'true';
    },

    // Check if user has a valid Striim session via cookie
    // This tests the /metadata/ endpoint which accepts cookies
    async checkCookieSession() {
        try {
            const response = await fetch('/metadata/', {
                method: 'GET',
                credentials: 'include' // Include cookies
            });
            const text = await response.text();

            // If we get the "please provide an authentication token" message,
            // the user is NOT logged in
            if (text.includes('please provide an authentication token')) {
                sessionStorage.removeItem(this.COOKIE_AUTH_KEY);
                return false;
            }

            // Any other response means the cookie auth worked
            sessionStorage.setItem(this.COOKIE_AUTH_KEY, 'true');
            return true;
        } catch (e) {
            sessionStorage.removeItem(this.COOKIE_AUTH_KEY);
            return false;
        }
    },

    // Authenticate with Striim using credentials
    async authenticate(username, password) {
        try {
            const formData = new URLSearchParams();
            formData.append('username', username);
            formData.append('password', password);

            const response = await fetch('/security/authenticate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: formData
            });

            if (response.status === 401) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || 'Invalid username or password');
            }

            if (!response.ok) {
                throw new Error(`Authentication failed: ${response.status}`);
            }

            const data = await response.json();
            if (data.token) {
                this.setToken(data.token);
                return true;
            }
            throw new Error('No token received from server');
        } catch (error) {
            console.error('Authentication failed:', error);
            throw error;
        }
    },

    // Logout
    async logout() {
        const token = this.getToken();
        if (token) {
            try {
                await fetch('/security/logout', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: `token=${encodeURIComponent(token)}`
                });
            } catch (e) {
                // Ignore logout errors
            }
        }
        this.clearToken();
    },

    // Show login modal - returns promise that resolves when authenticated
    showLoginModal() {
        return new Promise((resolve, reject) => {
            // Check if modal already exists
            let modal = document.getElementById('striim-login-modal');
            if (!modal) {
                modal = document.createElement('div');
                modal.id = 'striim-login-modal';
                modal.className = 'modal';
                modal.innerHTML = `
                    <div class="modal-content" style="max-width: 400px;">
                        <div class="modal-header">
                            <h3>🔐 Striim Login</h3>
                        </div>
                        <div class="modal-body">
                            <p style="margin-bottom: 1rem; color: var(--text-secondary);">
                                Enter your Striim credentials to connect and fetch applications.
                            </p>
                            <div id="login-error" class="form-group" style="display: none;">
                                <div style="color: var(--error); background: rgba(255,82,82,0.1); padding: 0.75rem; border-radius: 4px; margin-bottom: 1rem;">
                                    <span id="login-error-message"></span>
                                </div>
                            </div>
                            <div class="form-group">
                                <label for="striim-username">Username</label>
                                <input type="text" id="striim-username" class="form-input" placeholder="admin" autocomplete="username">
                            </div>
                            <div class="form-group">
                                <label for="striim-password">Password</label>
                                <input type="password" id="striim-password" class="form-input" placeholder="••••••••" autocomplete="current-password">
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button class="btn btn-secondary" id="login-cancel-btn">Cancel</button>
                            <button class="btn btn-primary" id="login-submit-btn">
                                <span id="login-btn-text">Login</span>
                                <span id="login-btn-loading" style="display: none;">Connecting...</span>
                            </button>
                        </div>
                    </div>
                `;
                document.body.appendChild(modal);
            }

            const usernameInput = document.getElementById('striim-username');
            const passwordInput = document.getElementById('striim-password');
            const errorDiv = document.getElementById('login-error');
            const errorMsg = document.getElementById('login-error-message');
            const submitBtn = document.getElementById('login-submit-btn');
            const cancelBtn = document.getElementById('login-cancel-btn');
            const btnText = document.getElementById('login-btn-text');
            const btnLoading = document.getElementById('login-btn-loading');

            // Reset state
            usernameInput.value = '';
            passwordInput.value = '';
            errorDiv.style.display = 'none';
            submitBtn.disabled = false;
            btnText.style.display = 'inline';
            btnLoading.style.display = 'none';

            // Show modal
            modal.style.display = 'flex';
            usernameInput.focus();

            const handleSubmit = async () => {
                const username = usernameInput.value.trim();
                const password = passwordInput.value;

                if (!username || !password) {
                    errorDiv.style.display = 'block';
                    errorMsg.textContent = 'Please enter both username and password';
                    return;
                }

                // Show loading state
                submitBtn.disabled = true;
                btnText.style.display = 'none';
                btnLoading.style.display = 'inline';
                errorDiv.style.display = 'none';

                try {
                    await StriimAPI.authenticate(username, password);
                    modal.style.display = 'none';
                    cleanup();
                    resolve(true);
                } catch (error) {
                    errorDiv.style.display = 'block';
                    errorMsg.textContent = error.message || 'Login failed';
                    submitBtn.disabled = false;
                    btnText.style.display = 'inline';
                    btnLoading.style.display = 'none';
                    passwordInput.focus();
                    passwordInput.select();
                }
            };

            const handleCancel = () => {
                modal.style.display = 'none';
                cleanup();
                reject(new Error('Login cancelled'));
            };

            const handleKeyPress = (e) => {
                if (e.key === 'Enter') {
                    handleSubmit();
                } else if (e.key === 'Escape') {
                    handleCancel();
                }
            };

            const cleanup = () => {
                submitBtn.removeEventListener('click', handleSubmit);
                cancelBtn.removeEventListener('click', handleCancel);
                document.removeEventListener('keydown', handleKeyPress);
            };

            submitBtn.addEventListener('click', handleSubmit);
            cancelBtn.addEventListener('click', handleCancel);
            document.addEventListener('keydown', handleKeyPress);
        });
    },

    // Ensure authenticated - shows login modal if needed
    async ensureAuthenticated() {
        if (!this.isAuthenticated()) {
            return await this.showLoginModal();
        }
        return true;
    },

    // Make authenticated API request
    async request(endpoint, options = {}) {
        const token = this.getToken();

        if (!token) {
            throw new Error('Not authenticated');
        }

        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            ...options.headers
        };

        try {
            const response = await fetch(endpoint, {
                ...options,
                headers
            });

            if (response.status === 401 || response.status === 403) {
                // Token expired or invalid - clear and re-authenticate
                this.clearToken();
                throw new Error('Authentication expired');
            }

            if (!response.ok) {
                throw new Error(`API error: ${response.status} ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    },

    // Get applications using cookie-based auth via /metadata/ endpoint
    async getApplicationsViaCookie() {
        const response = await fetch('/metadata/?type=APP', {
            method: 'GET',
            credentials: 'include'
        });

        const text = await response.text();

        // Check if auth failed
        if (text.includes('please provide an authentication token')) {
            throw new Error('Cookie auth failed');
        }

        const data = JSON.parse(text);

        // Filter to only user applications (exclude System$ and Global namespaces)
        return data
            .filter(app => !app.nsName.startsWith('System$') && app.nsName !== 'Global')
            .map(app => ({
                name: app.name,
                nsName: app.nsName,
                flowStatus: app.metaInfoStatus?.isValid ? 'CREATED' : 'INVALID',
                uuid: app.uuid,
                type: app.type
            }));
    },

    // Get all applications from Striim
    // First tries cookie-based auth (if user is logged into Striim UI)
    // Falls back to token-based auth via login modal
    async getApplications() {
        // First, try cookie-based auth via metadata endpoint
        try {
            const hasCookieSession = await this.checkCookieSession();
            if (hasCookieSession) {
                console.log('Using cookie-based auth via /metadata/ endpoint');
                return await this.getApplicationsViaCookie();
            }
        } catch (e) {
            console.log('Cookie-based auth failed, falling back to token auth');
        }

        // Fall back to token-based auth
        await this.ensureAuthenticated();
        const data = await this.request('/api/v2/applications');
        // API returns array directly, normalize to use nsName for consistency
        const apps = Array.isArray(data) ? data : (data.applications || []);
        return apps.map(app => ({
            ...app,
            nsName: app.nsName || app.namespace,
            flowStatus: app.flowStatus || app.status
        }));
    },

    // Get application details
    async getApplication(appName) {
        const apps = await this.getApplications();
        return apps.find(app =>
            app.name === appName ||
            app.nsName + '.' + app.name === appName ||
            app.namespace + '.' + app.name === appName
        );
    },

    // Get unique namespaces from applications
    async getNamespaces() {
        const apps = await this.getApplications();
        const namespaces = [...new Set(apps.map(app => app.nsName || app.namespace).filter(Boolean))];
        return namespaces.sort();
    },

    // Get application statuses
    getStatusOptions() {
        return ['CREATED', 'DEPLOYED', 'RUNNING', 'QUIESCED', 'STOPPED', 'COMPLETED'];
    },

    // Format app status for display
    formatStatus(status) {
        const statusMap = {
            'RUNNING': { class: 'status-running', label: 'Running' },
            'CREATED': { class: 'status-stopped', label: 'Created' },
            'DEPLOYED': { class: 'status-pending', label: 'Deployed' },
            'QUIESCED': { class: 'status-pending', label: 'Quiesced' },
            'STOPPED': { class: 'status-stopped', label: 'Stopped' },
            'COMPLETED': { class: 'status-stopped', label: 'Completed' }
        };
        return statusMap[status] || { class: 'status-stopped', label: status };
    }
};

// Common timezone options
const TIMEZONES = [
    'America/Los_Angeles',
    'America/Denver',
    'America/Chicago',
    'America/New_York',
    'America/Sao_Paulo',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'Asia/Dubai',
    'Asia/Kolkata',
    'Asia/Singapore',
    'Asia/Tokyo',
    'Asia/Shanghai',
    'Australia/Sydney',
    'Pacific/Auckland',
    'UTC'
];

// Days of week constants
const DAYS_OF_WEEK = [
    { value: 'MONDAY', label: 'Mon', short: 'M' },
    { value: 'TUESDAY', label: 'Tue', short: 'T' },
    { value: 'WEDNESDAY', label: 'Wed', short: 'W' },
    { value: 'THURSDAY', label: 'Thu', short: 'T' },
    { value: 'FRIDAY', label: 'Fri', short: 'F' },
    { value: 'SATURDAY', label: 'Sat', short: 'S' },
    { value: 'SUNDAY', label: 'Sun', short: 'S' }
];

// Months constants
const MONTHS = [
    { value: 'JANUARY', label: 'Jan' },
    { value: 'FEBRUARY', label: 'Feb' },
    { value: 'MARCH', label: 'Mar' },
    { value: 'APRIL', label: 'Apr' },
    { value: 'MAY', label: 'May' },
    { value: 'JUNE', label: 'Jun' },
    { value: 'JULY', label: 'Jul' },
    { value: 'AUGUST', label: 'Aug' },
    { value: 'SEPTEMBER', label: 'Sep' },
    { value: 'OCTOBER', label: 'Oct' },
    { value: 'NOVEMBER', label: 'Nov' },
    { value: 'DECEMBER', label: 'Dec' }
];

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { StriimAPI, TIMEZONES, DAYS_OF_WEEK, MONTHS };
}

