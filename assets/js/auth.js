// Resolve the API location for both local development and deployed hosting.
function getAuthApiUrl() {
    const configuredUrl = window.__API_URL__ || window.API_URL;
    if (configuredUrl) return configuredUrl;
    return ['localhost', '127.0.0.1', ''].includes(window.location.hostname)
        ? 'http://localhost:3000/api'
        : '/api';
}

const authApiUrl = getAuthApiUrl();
const originalFetch = window.fetch.bind(window);

// Ensure the httpOnly authentication cookie travels with every API request.
window.fetch = (resource, options = {}) => originalFetch(resource, {
    ...options,
    credentials: options.credentials || 'include'
});

window.auth = {
    apiUrl: authApiUrl,
    async request(path, options = {}) {
        const response = await window.fetch(`${authApiUrl}${path}`, {
            ...options,
            headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
        });
        const responseText = await response.text();
        let data;
        try {
            data = responseText ? JSON.parse(responseText) : {};
        } catch (error) {
            throw new Error(`API request failed (${response.status}). Check the deployed backend URL: ${authApiUrl}`);
        }
        if (!response.ok) {
            const error = new Error(data.message || 'Request failed');
            error.status = response.status;
            throw error;
        }
        return data;
    },
    async requireRole(role, nonAdminRedirect = 'index.html') {
        try {
            const result = await this.request('/auth/me');
            if (result.teacher?.role !== role) {
                window.location.replace(nonAdminRedirect);
                return null;
            }
            document.body.classList.add('auth-authorized');
            return result;
        } catch (error) {
            window.location.replace(error.status === 401 ? 'login.html' : nonAdminRedirect);
            return null;
        }
    }
};

// Protected pages verify the session before their feature scripts run.
const protectedPage = ['/', '/index.html', '/student.html', '/profile.html'].includes(window.location.pathname);
const adminPage = window.location.pathname.endsWith('/admin-dashboard.html') || window.location.pathname === 'admin-dashboard.html';
window.authReady = adminPage
    ? window.auth.requireRole('admin')
    : protectedPage
    ? window.auth.request('/auth/me').catch(() => {
        window.location.replace('login.html');
        return null;
    })
    : Promise.resolve(null);