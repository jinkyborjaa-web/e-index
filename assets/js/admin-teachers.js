const statusClass = status => `status-badge status-${status}`;

async function request(path, options = {}) {
    return window.auth.request(`/admin${path}`, options);
}

function getMenuActions(teacher) {
    const nextRole = teacher.role === 'admin' ? 'teacher' : 'admin';
    const actions = [
        { label: 'Approve', action: 'approve', enabled: teacher.status !== 'approved', variant: 'approve' },
        { label: 'Reject', action: 'reject', enabled: teacher.status !== 'rejected', variant: 'danger' },
        { label: 'Deactivate', action: 'deactivate', enabled: teacher.status !== 'deactivated', variant: 'neutral' },
        { label: nextRole === 'admin' ? 'Make Admin' : 'Remove Admin', action: 'set-role', enabled: true, role: nextRole, variant: nextRole === 'admin' ? 'approve' : 'danger' },
        { label: 'Reset Password', action: 'reset-password', enabled: true, variant: 'neutral' },
        { label: 'Delete', action: 'delete', enabled: true, variant: 'danger', destructive: true }
    ];

    return actions.map(action => ({
        ...action,
        disabled: !action.enabled
    }));
}

function roleActionButton(teacher) {
    const nextRole = teacher.role === 'admin' ? 'teacher' : 'admin';
    const label = nextRole === 'admin' ? 'Make Admin' : 'Remove Admin';
    return `<button class="btn admin-action ${nextRole === 'admin' ? 'admin-action-approve' : 'admin-action-danger'}" type="button" data-id="${teacher.id}" data-action="set-role" data-role="${nextRole}">${label}</button>`;
}

function actionMenuMarkup(teacher) {
    const menuItems = getMenuActions(teacher)
        .map((action) => {
            const destructiveMarkup = action.destructive ? '<span class="admin-action-menu-separator" aria-hidden="true"></span>' : '';
            const itemClass = [
                'admin-action-menu-item',
                action.variant === 'approve' ? 'admin-action-menu-approve' : '',
                action.variant === 'danger' ? 'admin-action-menu-danger' : '',
                action.variant === 'neutral' ? 'admin-action-menu-neutral' : '',
                action.disabled ? 'is-disabled' : ''
            ].filter(Boolean).join(' ');

            return `${destructiveMarkup}<button class="${itemClass}" type="button" data-id="${teacher.id}" data-action="${action.action}" data-role="${action.role || ''}" ${action.disabled ? 'disabled' : ''} aria-label="${action.label}">${action.label}</button>`;
        })
        .join('');

    return `
        <div class="admin-actions-menu-wrapper">
            <button class="admin-row-menu-toggle" type="button" data-id="${teacher.id}" aria-label="Open teacher actions" aria-expanded="false">
                <span aria-hidden="true">⋮</span>
            </button>
            <div class="admin-action-menu" id="teacher-menu-${teacher.id}" role="menu" hidden>
                ${menuItems}
            </div>
        </div>
    `;
}

async function loadTeachers() {
    const data = await request('/teachers');
    const body = document.querySelector('#teachersTable tbody');
    body.innerHTML = data.teachers.map(teacher => `
      <tr>
        <td>${teacher.name || 'Teacher'}</td>
        <td>${teacher.email}</td>
        <td>${teacher.staffId || '-'}</td>
        <td>${teacher.role}</td>
        <td><span class="${statusClass(teacher.status)}">${teacher.status}</span></td>
        <td class="admin-actions-cell">${actionMenuMarkup(teacher)}</td>
      </tr>
    `).join('');
}

async function loadStats() {
    const data = await request('/dashboard-stats');
    document.getElementById('totalStudents').textContent = data.stats.totalStudents;
    document.getElementById('totalTeachers').textContent = data.stats.totalTeachers;
    document.getElementById('pendingSignups').textContent = data.stats.pendingSignups;
    const activity = document.getElementById('recentActivity');
    activity.innerHTML = data.stats.recentActivity.length
        ? data.stats.recentActivity.map(item => `<li><span class="activity-icon" aria-hidden="true">${item.action.toLowerCase().includes('delet') ? '×' : item.action.toLowerCase().includes('approv') ? '✓' : '•'}</span><div><strong>${item.actorName}</strong> ${item.action}<small>${new Date(item.createdAt).toLocaleString()}</small></div></li>`).join('')
        : '<li>No recent activity</li>';
}

function closeAllTeacherMenus() {
    document.querySelectorAll('.admin-action-menu').forEach(menu => {
        menu.hidden = true;
        const toggle = menu.parentElement?.querySelector('.admin-row-menu-toggle');
        if (toggle) toggle.setAttribute('aria-expanded', 'false');
    });
}

document.addEventListener('click', event => {
    const clickedToggle = event.target.closest('.admin-row-menu-toggle');
    const clickedMenu = event.target.closest('.admin-action-menu');

    if (!clickedToggle && !clickedMenu) {
        closeAllTeacherMenus();
    }
});

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const me = await window.authReady;
        if (!me) return;
        const name = me.teacher?.fullName || me.teacher?.name || 'Admin';
        document.getElementById('adminProfileName').textContent = name;
        document.getElementById('adminRoleLabel').textContent = me.teacher?.role || 'admin';
        document.querySelector('.admin-avatar').textContent = name.charAt(0).toUpperCase();
        await Promise.all([loadTeachers(), loadStats()]);
    } catch (error) {
        console.error('Admin dashboard initialization failed:', error);
        document.getElementById('adminMessage').textContent = error.message;
    }

    document.getElementById('teachersTable').addEventListener('click', async event => {
        const toggle = event.target.closest('.admin-row-menu-toggle');
        if (toggle) {
            const wrapper = toggle.closest('.admin-actions-menu-wrapper');
            const menu = wrapper?.querySelector('.admin-action-menu');
            if (!menu) return;

            const isOpen = !menu.hidden;
            closeAllTeacherMenus();
            if (!isOpen) {
                menu.hidden = false;
                toggle.setAttribute('aria-expanded', 'true');
            }
            return;
        }

        const actionButton = event.target.closest('.admin-action-menu-item');
        if (!actionButton || actionButton.disabled) return;

        const { id, action, role } = actionButton.dataset;
        const row = actionButton.closest('tr');
        const teacherName = row?.querySelector('td')?.textContent?.trim() || 'this teacher';

        if (action === 'delete') {
            const confirmed = window.confirm(`Delete this teacher account for ${teacherName}?`);
            if (!confirmed) {
                closeAllTeacherMenus();
                return;
            }
        }

        if (action === 'set-role') {
            const message = role === 'admin'
                ? `Are you sure you want to make ${teacherName} an admin?`
                : `Are you sure you want to remove admin access from ${teacherName}?`;
            const confirmed = window.confirm(message);
            if (!confirmed) {
                closeAllTeacherMenus();
                return;
            }
        }

        try {
            const options = { method: action === 'delete' ? 'DELETE' : action === 'reset-password' ? 'POST' : 'PUT' };
            if (action === 'set-role') options.body = JSON.stringify({ role });

            const data = await request(`/teachers/${id}/${action}`, options);
            if (data.temporaryPassword) window.alert(`Temporary password: ${data.temporaryPassword}`);
            closeAllTeacherMenus();
            await Promise.all([loadTeachers(), loadStats()]);
        } catch (error) {
            window.alert(error.message);
        }
    });

    document.getElementById('logoutBtn').addEventListener('click', async () => {
        await window.auth.request('/auth/logout', { method: 'POST' });
        window.location.replace('login.html');
    });
});