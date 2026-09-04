import { showToast } from './utils.js';

let currentStudentId = null;
function getApiBaseUrl() {
    const configuredUrl = window.__API_URL__ || window.API_URL;
    if (configuredUrl) {
        return configuredUrl;
    }

    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '') {
        return 'http://localhost:3000/api';
    }

    return '/api';
}

const API_BASE_URL = getApiBaseUrl();

export function initializeAttendance(studentId) {
    currentStudentId = studentId;
    loadAttendanceRecords(studentId);
    loadSubjects();
}

export async function loadAttendanceRecords(studentId, subjectId = null) {
    try {
        let url = `${API_BASE_URL}/attendance/students/${studentId}`;
        if (subjectId) {
            url += `?subjectId=${subjectId}`;
        }
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to load attendance records');
        const data = await response.json();
        renderAttendanceTable(data.attendance);
    } catch (error) {
        console.error('Error loading attendance records:', error);
        showToast('Error loading attendance records', 'error');
    }
}

async function loadSubjects() {
    try {
        const response = await fetch(`${API_BASE_URL}/attendance/subjects`);
        if (!response.ok) throw new Error('Failed to load subjects');
        const data = await response.json();
        updateSubjectSelect(data.subjects);
    } catch (error) {
        console.error('Error loading subjects:', error);
        showToast('Error loading subjects', 'error');
    }
}

function updateSubjectSelect(subjects) {
    const subjectSelect = document.getElementById('subjectSelect');
    if (!subjectSelect) return;

    // Keep the "All Subjects" option
    const allOption = subjectSelect.querySelector('option[value="all"]');
    subjectSelect.innerHTML = '';
    if (allOption) subjectSelect.appendChild(allOption);

    // Add subject options
    subjects.forEach(subject => {
        const option = document.createElement('option');
        option.value = subject.id;
        option.textContent = subject.code;
        subjectSelect.appendChild(option);
    });
}

function renderAttendanceTable(records) {
    const tbody = document.querySelector('#studentRecords tbody');
    if (!tbody) return;

    if (!records.length) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center">No attendance records found</td></tr>';
        return;
    }

    tbody.innerHTML = records.map(record => `
        <tr>
            <td>${record.subject_code}</td>
            <td>${formatDate(record.date_time)}</td>
            <td>${formatTime(record.date_time)}</td>
            <td>
                <button class="btn btn-light btn-sm delete-attendance" data-id="${record.id}" data-subject="${record.subject_code}">
                    Delete
                </button>
            </td>
        </tr>
    `).join('');

    // Add event listeners to delete buttons
    tbody.querySelectorAll('.delete-attendance').forEach(button => {
        button.addEventListener('click', () => {
            const recordId = button.dataset.id;
            const subjectCode = button.dataset.subject;
            showDeleteConfirmation(recordId, subjectCode);
        });
    });
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString();
}

function formatTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleTimeString();
}

function showDeleteConfirmation(recordId, subjectCode) {
    const deleteModal = document.getElementById('deleteRecordModal');
    const modalTitle = deleteModal.querySelector('.modal-header h5');
    const modalBody = deleteModal.querySelector('.modal-body p');
    const closeDeleteModalBtn = deleteModal.querySelector('#closeDeleteModalBtn');
    const cancelDeleteBtn = deleteModal.querySelector('#cancelDeleteBtn');
    const confirmDeleteBtn = deleteModal.querySelector('#confirmDeleteBtn');

    // Update modal content
    modalTitle.textContent = 'Delete Attendance Record';
    modalBody.textContent = `Are you sure you want to delete this attendance record for ${subjectCode}?`;

    // Show modal
    deleteModal.classList.add('active');

    // Event listeners
    closeDeleteModalBtn?.addEventListener('click', () => closeDeleteModal());
    cancelDeleteBtn?.addEventListener('click', () => closeDeleteModal());
    confirmDeleteBtn?.addEventListener('click', () => confirmDelete(recordId));

    // Close on backdrop click
    deleteModal?.addEventListener('click', (e) => {
        if (e.target === deleteModal) {
            closeDeleteModal();
        }
    });
}

function closeDeleteModal() {
    const deleteModal = document.getElementById('deleteRecordModal');
    if (deleteModal) {
        deleteModal.classList.remove('active');
    }
}

async function confirmDelete(recordId) {
    try {
        const response = await fetch(`${API_BASE_URL}/attendance/${recordId}`, {
            method: 'DELETE'
        });
        if (!response.ok) throw new Error('Failed to delete attendance record');
        showToast('Attendance record deleted successfully', 'success');
        loadAttendanceRecords(currentStudentId);
        closeDeleteModal();
    } catch (error) {
        console.error('Error deleting attendance record:', error);
        showToast('Error deleting attendance record', 'error');
    }
} 