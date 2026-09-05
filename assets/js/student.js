import { initializeRecords } from './records.js';
import { showToast } from './utils.js';

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

let currentStudentId = null;

// Initialize the page
document.addEventListener('DOMContentLoaded', async () => {
    if (!await window.authReady) return;
    // Get student ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    currentStudentId = urlParams.get('id');

    if (!currentStudentId) {
        showToast('Student ID not found', 'error');
        return;
    }

    // Load the student and the subjects assigned to the current teacher.
    const student = await loadStudentDetails();
    await loadTeacherSubjects(student);

    // Initialize records
    initializeRecords(currentStudentId);

});

async function loadTeacherSubjects(student) {
    try {
        const response = await fetch(`${API_BASE_URL}/auth/me`);
        if (!response.ok) throw new Error('Failed to load teacher subjects');
        const data = await response.json();
        const subjects = (data.teacher?.subjects || []).filter(item => Number.parseInt(item.yearLevel, 10) === Number(student?.year));
        const subjectSelect = document.getElementById('subjectSelect');
        if (subjectSelect) {
            subjectSelect.innerHTML = '<option value="all">All Subjects</option>';
            [...new Map(subjects.map(item => [item.subject, item])).values()].forEach(item => {
                subjectSelect.add(new Option(item.subject, item.subject));
            });
            subjectSelect.addEventListener('change', () => {
                const selected = subjects.find(item => item.subject === subjectSelect.value);
                const yearLabel = document.getElementById('subjectYearLabel');
                if (yearLabel) yearLabel.textContent = selected ? `${selected.subject} - ${selected.yearLevel}` : '';
            });
        }
        document.querySelectorAll('.record-subject-select').forEach(select => {
            select.innerHTML = '';
            subjects.forEach(item => select.add(new Option(item.subject, item.subject)));
        });
    } catch (error) {
        console.error('Error loading teacher subjects:', error);
        showToast('Error loading assigned subjects', 'error');
    }
}

// Load student details
async function loadStudentDetails() {
    try {
        console.log('Fetching student details for ID:', currentStudentId);
        const response = await fetch(`${API_BASE_URL}/students/${currentStudentId}`);
        console.log('Student details response status:', response.status);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const student = await response.json();
        console.log('Received student data:', student);
        
        if (!student.success) {
            throw new Error(student.message || 'Failed to load student details');
        }
        
        renderStudentDetails(student.student);
        return student.student;
    } catch (error) {
        console.error('Error loading student details:', error);
        showToast('Error loading student details', 'error');
    }
}

// Render student details
function renderStudentDetails(student) {
    const studentInfo = document.getElementById('studentInfo');
    if (!studentInfo) return;

    studentInfo.innerHTML = `
        <div class="info-item">
            <span class="info-label">Name:</span>
            <span class="info-value">${student.fullName}</span>
        </div>
        <div class="info-item">
            <span class="info-label">Student ID:</span>
            <span class="info-value">${student.student_id}</span>
        </div>
        <div class="info-item">
            <span class="info-label">Year:</span>
            <span class="info-value">${student.year}</span>
        </div>
        <div class="info-item">
            <span class="info-label">Section:</span>
            <span class="info-value">${student.section}</span>
        </div>
    `;
} 