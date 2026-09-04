import { clearValidation, resetForm, showToast } from './api.js';

// API URL
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

const API_URL = getApiBaseUrl();

let currentRecordId = null;
let currentStudentId = null;
let recordTypeForm = null;
let academicRecordForm = null;
let attendanceRecordForm = null;

// Initialize records functionality
export function initializeRecords(studentId) {
    currentStudentId = studentId;
    console.log('Initializing records for student:', studentId);
    
    // Add event listeners
    const addRecordBtn = document.getElementById('addRecordBtn');
    const saveRecordBtn = document.getElementById('saveRecordBtn');
    const subjectSelect = document.getElementById('subjectSelect');
    const recordTypeSelect = document.getElementById('recordTypeSelect');
    const recordModal = document.getElementById('recordModal');
    const closeRecordModalBtn = document.getElementById('closeRecordModalBtn');
    const cancelRecordBtn = document.getElementById('cancelRecordBtn');

    // Record type selection
    recordTypeSelect?.addEventListener('change', (e) => {
        const recordType = e.target.value;
        console.log('Switching to:', recordType);
        
        // Switch table headers based on record type
        const academicHeaders = document.getElementById('activitiesHeaders');
        const attendanceHeaders = document.getElementById('attendanceHeaders');
        
        if (recordType === 'attendance') {
            academicHeaders.style.display = 'none';
            attendanceHeaders.style.display = 'table-row';
        } else {
            academicHeaders.style.display = 'table-row';
            attendanceHeaders.style.display = 'none';
        }
        
        // Load the appropriate records
        const subject = subjectSelect ? subjectSelect.value : null;
        loadRecordsByType(recordType, currentStudentId, subject);
    });

    // Subject selection
    subjectSelect?.addEventListener('change', (e) => {
        const subject = e.target.value;
        console.log('Filtering by subject:', subject);
        
        // Get the current record type
        const recordTypeSelect = document.getElementById('recordTypeSelect');
        const currentType = recordTypeSelect ? recordTypeSelect.value : 'activities';
        
        // Use the appropriate loading function based on record type
        loadRecordsByType(currentType, currentStudentId, subject);
    });

    // Add Record button click
    addRecordBtn?.addEventListener('click', () => {
        resetForm('recordForm');
        currentRecordId = null;
        const modalTitle = recordModal.querySelector('.modal-header h5');
        const saveBtn = recordModal.querySelector('#saveRecordBtn');
        if (modalTitle) modalTitle.textContent = 'Add New Record';
        if (saveBtn) saveBtn.textContent = 'Save Record';
        
        // Set default values for date and time
        const now = new Date();
        const dateInput = document.querySelector('[name="date"]');
        const timeInput = document.querySelector('[name="time"]');
        
        if (dateInput) {
            const today = now.toISOString().split('T')[0];
            dateInput.value = today;
        }
        
        if (timeInput) {
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            timeInput.value = `${hours}:${minutes}`;
        }
        
        recordModal.classList.add('active');
    });

    // Close modal buttons
    closeRecordModalBtn?.addEventListener('click', () => closeModal(recordModal));
    cancelRecordBtn?.addEventListener('click', () => closeModal(recordModal));

    // Modal backdrop click
    recordModal?.addEventListener('click', (e) => {
        if (e.target === recordModal) {
            closeModal(recordModal);
        }
    });

    saveRecordBtn?.addEventListener('click', handleSaveRecord);
    // Load initial records
    loadRecordsByType(recordTypeSelect?.value || 'attendance', currentStudentId);

    // Form switching functionality
    recordTypeForm = document.getElementById('recordTypeForm');
    academicRecordForm = document.getElementById('academicRecordForm');
    attendanceRecordForm = document.getElementById('attendanceRecordForm');

    recordTypeForm.addEventListener('change', (e) => {
        const recordType = e.target.value;
        if (recordType === 'activities') {
            academicRecordForm.style.display = 'block';
            attendanceRecordForm.style.display = 'none';
        } else {
            academicRecordForm.style.display = 'none';
            attendanceRecordForm.style.display = 'block';
        }
    });
}

// Helper function to close modal
function closeModal(modal) {
    modal.classList.remove('active');
    resetForm('recordForm');
    currentRecordId = null;
}

// Load and display records
export async function loadRecords(studentId, category = null, subject = null) {
    try {
        let url = `${API_URL}/records/${studentId}/records`;
        const params = new URLSearchParams();
        
        // Only add category if it's not null or 'all'
        if (category && category !== 'all') {
            params.append('category', category);
        }
        
        // Only add subject if it's not null or 'all'
        if (subject && subject !== 'all') {
            params.append('subject', subject);
        }
        
        if (params.toString()) {
            url += `?${params.toString()}`;
        }
        
        console.log('Request URL:', url);
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });
        
        console.log('Records response status:', response.status);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Received records data:', data);
        
        if (!data.success) {
            throw new Error(data.message || 'Failed to load records');
        }
        
        console.log('Rendering records table with data:', data.records);
        renderRecordsTable(data.records);
    } catch (error) {
        console.error('Error loading records:', error);
        showToast('Error loading records. Please check if the server is running.', 'error');
    }
}

function renderRecordsTable(records) {
    const tbody = document.querySelector('#studentRecords tbody');
    if (!records || records.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">No records found for this subject</td></tr>';
        return;
    }

    tbody.innerHTML = records
        .map(
            (record) => `
                <tr>
                    <td>${record.subject}</td>
                    <td>${record.category}</td>
                    <td>${record.item_description || ''}</td>
                    <td>${record.score}</td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn btn-light btn-sm edit-record" data-id="${record.id}" title="Edit Record">
                                <img src="assets/icons/edit.svg" alt="Edit" width="16" height="16">
                            </button>
                            <button class="btn btn-light btn-sm delete-record" data-id="${record.id}" title="Delete Record">
                                <img src="assets/icons/delete.svg" alt="Delete" width="16" height="16">
                            </button>
                        </div>
                    </td>
                </tr>
            `
        )
        .join('');

    // Add event listeners to edit buttons
    tbody.querySelectorAll('.edit-record').forEach(button => {
        button.addEventListener('click', () => {
            const recordId = button.dataset.id;
            editRecord(recordId);
        });
    });

    // Add event listeners to delete buttons
    tbody.querySelectorAll('.delete-record').forEach(button => {
        button.addEventListener('click', () => {
            const recordId = button.dataset.id;
            showDeleteRecordConfirmation(recordId, `Record #${recordId}`);
        });
    });
}

// Filter records by category
async function filterRecords(category) {
    try {
        console.log('Filtering records by category:', category);
        
        // Get the current record type and subject
        const recordTypeSelect = document.getElementById('recordTypeSelect');
        const subjectSelect = document.getElementById('subjectSelect');
        const currentType = recordTypeSelect ? recordTypeSelect.value : 'activities';
        const subject = subjectSelect ? subjectSelect.value : null;
        
        // If we're viewing academic records, filter by category
        if (currentType !== 'attendance') {
            await loadRecords(currentStudentId, currentType, subject);
        } else {
            // For attendance records, just reload with current filters
            await loadRecordsByType(currentType, currentStudentId, subject);
        }
    } catch (error) {
        console.error('Error filtering records:', error);
        showToast('Error filtering records', 'error');
    }
}

// Helper function to get student ID from URL
function getStudentIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('id');
}

// Add/Edit record
async function handleSaveRecord() {
    const form = document.getElementById('recordForm');
    const formData = new FormData(form);
    const recordType = formData.get('record_type');

    // Validate form
    if (!validateForm(form)) {
        return;
    }

    try {
        const studentId = getStudentIdFromUrl() || currentStudentId;
        let response;

        if (recordType === 'activities') {
            // Handle academic record
            const academicData = {
                subject: formData.get('subject'),
                category: 'activities',
                item_description: formData.get('item_description'),
                score: formData.get('score')
                // Note: Don't send record_type to backend for academic records
            };
            
            // Use imported functions from api.js
            const { addAcademicRecord, updateAcademicRecord } = await import('./api.js');
            
            // Check if we're editing or adding
            const recordId = form.dataset.recordId;
            if (recordId) {
                response = await updateAcademicRecord(recordId, academicData, studentId);
            } else {
                response = await addAcademicRecord(studentId, academicData);
            }
        } else {
            // Handle attendance record
            const attendanceData = {
                subject: formData.get('attendance_subject'),
                date: formData.get('date'),
                time: formData.get('time'),
                record_type: 'attendance' // Keep record_type for attendance records
            };
            
            // Use imported functions from api.js
            const { addAttendanceRecord, deleteAttendanceRecord } = await import('./api.js');
            
            // Check if we're editing or adding
            const recordId = form.dataset.recordId;
            if (recordId) {
                // For attendance, we need to delete the old record and create a new one
                // since there's no update endpoint
                try {
                    // First delete the old record
                    const deleteResponse = await deleteAttendanceRecord(recordId, studentId);
                    if (!deleteResponse.success) {
                        throw new Error(deleteResponse.message || 'Failed to update attendance record');
                    }
                    
                    // Then create a new one
                    response = await addAttendanceRecord(studentId, attendanceData);
                } catch (error) {
                    console.error('Error updating attendance record:', error);
                    showToast('Failed to update attendance record', 'error');
                    return;
                }
            } else {
                response = await addAttendanceRecord(studentId, attendanceData);
            }
        }

        if (response && response.success) {
            showToast('Record saved successfully', 'success');
            closeModal(document.getElementById('recordModal'));
            
            // Refresh the records table with the correct type
            const recordTypeSelect = document.getElementById('recordTypeSelect');
            const currentType = recordTypeSelect ? recordTypeSelect.value : recordType;
            const subjectSelect = document.getElementById('subjectSelect');
            await loadRecordsByType(currentType, studentId, subjectSelect?.value);
        } else {
            showToast(response?.message || 'Failed to save record', 'error');
        }
    } catch (error) {
        console.error('Error saving record:', error);
        showToast('Failed to save record', 'error');
    }
}

function validateForm(form) {
    let isValid = true;
    clearValidation(form);
    
    const recordType = form.record_type.value;
    
    if (recordType === 'activities') {
        // Validate academic record fields
        if (!form.subject.value) {
            setInvalid('subject', 'Please select a subject');
            isValid = false;
        }
        
        if (!form.category.value) {
            setInvalid('category', 'Please select a category');
            isValid = false;
        }

        if (!form.item_description.value.trim()) {
            setInvalid('item_description', 'Please enter an item description');
            isValid = false;
        }

        const score = parseFloat(form.score.value);
        if (isNaN(score) || score < 0) {
            setInvalid('score', 'Please enter a non-negative score');
            isValid = false;
        }
    } else {
        // Validate attendance record fields
        if (!form.attendance_subject.value) {
            setInvalid('attendance_subject', 'Please select a subject');
            isValid = false;
        }
        
        if (!form.date.value) {
            setInvalid('date', 'Please select a date');
            isValid = false;
        }
        
        if (!form.time.value) {
            setInvalid('time', 'Please select a time');
            isValid = false;
        }
    }

    return isValid;
}

function setInvalid(fieldName, message) {
    const field = document.querySelector(`[name="${fieldName}"]`);
    field.classList.add('is-invalid');
    field.nextElementSibling.textContent = message;
}

// Edit record
async function editRecord(recordId) {
    try {
        const studentId = getStudentIdFromUrl() || currentStudentId;
        const recordType = recordTypeForm.value;
        let record;
        
        // Import API functions
        const { getAcademicRecord, getAttendanceRecord } = await import('./api.js');

        if (recordType === 'activities') {
            record = await getAcademicRecord(recordId, studentId);
        } else {
            record = await getAttendanceRecord(recordId, studentId);
        }

        if (record) {
            const form = document.getElementById('recordForm');
            form.reset();
            
            // Set record type
            recordTypeForm.value = recordType;
            
            if (recordType === 'activities') {
                // Show academic form and populate fields
                academicRecordForm.style.display = 'block';
                attendanceRecordForm.style.display = 'none';
                
                form.querySelector('[name="subject"]').value = record.subject;
                form.querySelector('[name="category"]').value = record.category;
                form.querySelector('[name="item_description"]').value = record.item_description || '';
                form.querySelector('[name="score"]').value = record.score;
            } else {
                // Show attendance form and populate fields
                academicRecordForm.style.display = 'none';
                attendanceRecordForm.style.display = 'block';
                
                form.querySelector('[name="attendance_subject"]').value = record.subject;
                form.querySelector('[name="date"]').value = record.date;
                form.querySelector('[name="time"]').value = record.time;
            }

            // Update modal title and save button
            document.querySelector('#recordModal h5').textContent = 'Edit Record';
            document.getElementById('saveRecordBtn').textContent = 'Update Record';
            
            // Store record ID for update
            form.dataset.recordId = recordId;
            
            // Show modal
            document.getElementById('recordModal').classList.add('active');
        }
    } catch (error) {
        console.error('Error loading record:', error);
        showToast('Failed to load record', 'error');
    }
}

// Delete record
export function showDeleteRecordConfirmation(id, recordName, recordType = 'academic') {
    const deleteModal = document.getElementById('deleteRecordModal');
    const modalBody = deleteModal.querySelector('.modal-body p');
    
    // Update modal content
    modalBody.innerHTML = `Are you sure you want to delete <strong>${recordName}</strong>?`;
    
    // Store record type for deletion
    deleteModal.dataset.recordType = recordType;
    deleteModal.dataset.recordId = id;
    
    // Show modal
    deleteModal.classList.add('active');

    // Get modal buttons
    const closeDeleteModalBtn = document.getElementById('closeDeleteModalBtn');
    const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');

    // Remove any existing event listeners by cloning and replacing elements
    const newCloseBtn = closeDeleteModalBtn.cloneNode(true);
    const newCancelBtn = cancelDeleteBtn.cloneNode(true);
    const newConfirmBtn = confirmDeleteBtn.cloneNode(true);
    
    closeDeleteModalBtn.parentNode.replaceChild(newCloseBtn, closeDeleteModalBtn);
    cancelDeleteBtn.parentNode.replaceChild(newCancelBtn, cancelDeleteBtn);
    confirmDeleteBtn.parentNode.replaceChild(newConfirmBtn, confirmDeleteBtn);

    // Add event listeners to the new buttons
    newCloseBtn.addEventListener('click', closeDeleteModal);
    newCancelBtn.addEventListener('click', closeDeleteModal);
    newConfirmBtn.addEventListener('click', confirmDeleteRecord);

    // Close on backdrop click - using once: true to ensure it only fires once
    const backdropHandler = (e) => {
        if (e.target === deleteModal) {
            closeDeleteModal();
            deleteModal.removeEventListener('click', backdropHandler);
        }
    };
    
    // Remove existing listeners (if any) by cloning the modal
    deleteModal.removeEventListener('click', backdropHandler);
    deleteModal.addEventListener('click', backdropHandler);
}

function closeDeleteModal() {
    const deleteModal = document.getElementById('deleteRecordModal');
    if (deleteModal) {
        deleteModal.classList.remove('active');
    }
}

export async function confirmDeleteRecord() {
    try {
        const deleteModal = document.getElementById('deleteRecordModal');
        const recordId = deleteModal.dataset.recordId;
        const recordType = deleteModal.dataset.recordType;
        const studentId = getStudentIdFromUrl() || currentStudentId;
        
        let response;
        
        if (recordType === 'activities') {
            // Import the deleteAcademicRecord function
            const { deleteAcademicRecord } = await import('./api.js');
            response = await deleteAcademicRecord(recordId, studentId);
        } else {
            // Import the deleteAttendanceRecord function
            const { deleteAttendanceRecord } = await import('./api.js');
            response = await deleteAttendanceRecord(recordId, studentId);
        }
        
        if (response.success) {
            closeDeleteModal();
            
            // Refresh the records table
            const recordTypeSelect = document.getElementById('recordTypeSelect');
            const subjectSelect = document.getElementById('subjectSelect');
            const currentType = recordTypeSelect ? recordTypeSelect.value : 'activities';
            const subject = subjectSelect ? subjectSelect.value : null;
            
            await loadRecordsByType(currentType, studentId, subject);
            showToast('Record deleted successfully', 'success');
        } else {
            showToast(response.message || 'Failed to delete record', 'error');
        }
    } catch (error) {
        console.error('Error deleting record:', error);
        showToast('Error deleting record', 'error');
    }
}

// Make functions globally available
window.editRecord = editRecord;
window.showDeleteRecordConfirmation = showDeleteRecordConfirmation;
window.confirmDeleteRecord = confirmDeleteRecord;

// Load records based on type (academic or attendance)
async function loadRecordsByType(recordType, studentId, subject = null) {
    try {
        // Set the base URL based on the record type
        let url;
        
        if (recordType === 'activities') {
            // For academic records, use the existing endpoint
            url = `${API_URL}/records/${studentId}/records`;
            
            // Add subject as query parameter
            const params = new URLSearchParams();
            if (subject && subject !== 'all') params.set('subject', subject);
            params.set('category', 'activities');
            if (params.toString()) url += `?${params}`;
        } else {
            // For attendance records, use the correct endpoint
            url = `${API_URL}/attendance/students/${studentId}`;
            
            // Add subject as query parameter
            // Note: The backend expects subjectId, not subject
            if (subject && subject !== 'all') {
                url += `?subjectCode=${encodeURIComponent(subject)}`;
            }
        }
        
        console.log('Loading records from:', url);
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Received records data:', data);
        
        if (!data.success) {
            throw new Error(data.message || 'Failed to load records');
        }
        
        if (recordType === 'attendance') {
            renderAttendanceRecordsTable(data.attendance);
        } else {
            renderAcademicRecordsTable(data.records);
        }
    } catch (error) {
        console.error(`Error loading ${recordType} records:`, error);
        showToast(`Error loading ${recordType} records.`, 'error');
    }
}


// Render academic records table
function renderAcademicRecordsTable(records) {
    const tbody = document.querySelector('#studentRecords tbody');
    if (!records || records.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">No records found for this subject</td></tr>';
        return;
    }

    tbody.innerHTML = records
        .map(
            (record) => `
                <tr>
                    <td>${record.subject}</td>
                    <td>${record.category}</td>
                    <td>${record.item_description || ''}</td>
                    <td>${record.score}</td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn btn-light btn-sm edit-record" data-id="${record.id}" data-type="academic" title="Edit Record">
                                <img src="assets/icons/edit.svg" alt="Edit" width="16" height="16">
                            </button>
                            <button class="btn btn-light btn-sm delete-record" data-id="${record.id}" data-type="academic" title="Delete Record">
                                <img src="assets/icons/delete.svg" alt="Delete" width="16" height="16">
                            </button>
                        </div>
                    </td>
                </tr>
            `
        )
        .join('');

    // Add event listeners to buttons
    addTableButtonListeners();
}

// Render attendance records table
function renderAttendanceRecordsTable(records) {
    const tbody = document.querySelector('#studentRecords tbody');
    if (!records || records.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center">No records found for this subject</td></tr>';
        return;
    }

    tbody.innerHTML = records
        .map(
            (record) => {
                // Format date and time from date_time
                const dateTime = new Date(record.date_time);
                const date = dateTime.toLocaleDateString();
                const time = dateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                
                return `
                <tr>
                    <td>${record.subject_code || record.subject}</td>
                    <td>${date}</td>
                    <td>${time}</td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn btn-light btn-sm edit-record" data-id="${record.id}" data-type="attendance" title="Edit Record">
                                <img src="assets/icons/edit.svg" alt="Edit" width="16" height="16">
                            </button>
                            <button class="btn btn-light btn-sm delete-record" data-id="${record.id}" data-type="attendance" title="Delete Record">
                                <img src="assets/icons/delete.svg" alt="Delete" width="16" height="16">
                            </button>
                        </div>
                    </td>
                </tr>
            `;
            }
        )
        .join('');

    // Add event listeners to buttons
    addTableButtonListeners();
}

// Add event listeners to table buttons
function addTableButtonListeners() {
    // Use event delegation for table buttons
    const tbody = document.querySelector('#studentRecords tbody');
    
    // Remove any existing listeners first
    const newTbody = tbody.cloneNode(true);
    tbody.parentNode.replaceChild(newTbody, tbody);
    
    // Add a single event listener to the table body
    newTbody.addEventListener('click', (e) => {
        // Handle edit button clicks
        const button = e.target.closest('.edit-record, .delete-record');
        if (!button) return;

        if (button.classList.contains('edit-record')) {
            const recordId = button.dataset.id;
            const recordType = button.dataset.type;
            
            // Set the form type first, then edit the record
            if (recordTypeForm) {
                recordTypeForm.value = recordType;
                // Trigger the change event to update form visibility
                recordTypeForm.dispatchEvent(new Event('change'));
            }
            editRecord(recordId);
        }
        
        // Handle delete button clicks
        if (button.classList.contains('delete-record')) {
            const recordId = button.dataset.id;
            const recordType = button.dataset.type;
            const recordName = recordType === 'activities' ?
                `Activity Record #${recordId}` :
                `Attendance Record #${recordId}`;
            showDeleteRecordConfirmation(recordId, recordName, recordType);
        }
    });
}
 