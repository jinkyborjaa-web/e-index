const eyeIcon = '<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"></path><circle cx="12" cy="12" r="2.5"></circle>';
const eyeSlashIcon = '<path d="M2.5 12s3.5-6 9.5-6c1.6 0 3 .4 4.2 1"></path><path d="M21.5 12s-3.5 6-9.5 6c-1.6 0-3-.4-4.2-1"></path><path d="M3 3l18 18"></path><path d="M10.2 10.2a2.5 2.5 0 0 0 3.6 3.6"></path>';

document.querySelectorAll('[data-password-toggle]').forEach((toggle) => {
    const input = document.getElementById(toggle.dataset.passwordToggle);
    const icon = toggle.querySelector('svg');

    if (!input || !icon) return;

    toggle.addEventListener('click', () => {
        const isVisible = input.type === 'text';
        input.type = isVisible ? 'password' : 'text';
        toggle.setAttribute('aria-label', isVisible ? 'Show password' : 'Hide password');
        toggle.setAttribute('aria-pressed', String(!isVisible));
        icon.innerHTML = isVisible ? eyeIcon : eyeSlashIcon;
    });
});