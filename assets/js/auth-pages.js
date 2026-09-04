// Connect the login and signup forms to the authentication API.
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const message = document.getElementById('authMessage');
    const showError = (text) => {
        message.textContent = text;
        message.className = 'auth-message is-visible';
    };

    loginForm?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const form = new FormData(loginForm);
        try {
            const result = await window.auth.request('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email: form.get('email'), password: form.get('password') })
            });
            window.location.replace(result.teacher?.role === 'admin' ? 'admin-dashboard.html' : 'index.html');
        } catch (error) {
            showError(error.message);
        }
    });

});