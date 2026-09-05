/**
 * Shows a toast notification
 * @param {string} message - The message to display
 * @param {string} type - The type of toast (success, error, warning, info)
 */
export function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    toast.innerHTML = `
        <div class="toast-content">
            <div class="toast-message">${message}</div>
            <button type="button" class="btn-toast" onclick="this.closest('.toast').remove()">×</button>
        </div>
    `;

    toastContainer.appendChild(toast);

    // Remove toast after 3 seconds
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

/**
 * Formats a date string to a localized date
 * @param {string} dateString - The date string to format
 * @returns {string} Formatted date string
 */
export function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString();
}

/**
 * Formats a date string to a localized time
 * @param {string} dateString - The date string to format
 * @returns {string} Formatted time string
 */
export function formatTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleTimeString();
} 