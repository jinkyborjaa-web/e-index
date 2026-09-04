const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Teacher = require('../models/Teacher');
const TeacherSubject = require('../models/TeacherSubject');
const PasswordReset = require('../models/PasswordReset');
const crypto = require('crypto');
const { pool } = require('../config/database');
const { sendResetEmail } = require('../config/mailer');

const allowedSubjects = ['Comp 111', 'Comp 112', 'IT 111', 'IT 121', 'Comp 121', 'Comp 122', 'IT 211', 'IT 212', 'Comp 211', 'Comp 212', 'IT 221', 'IT 222', 'IT 223', 'Comp 221'];
const allowedYearLevels = ['1st Year', '2nd Year', '3rd Year', '4th Year'];

const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000
};

function normalizeNameParts(teacher) {
    const firstName = String(teacher.first_name || teacher.firstName || '').trim();
    const lastName = String(teacher.last_name || teacher.lastName || '').trim();
    const fullName = [firstName, lastName].filter(Boolean).join(' ') || 'Teacher';

    return {
        firstName,
        lastName,
        fullName,
        name: fullName
    };
}

async function publicTeacher(teacher) {
    const nameParts = normalizeNameParts(teacher);

    return {
        id: teacher.id,
        firstName: nameParts.firstName,
        lastName: nameParts.lastName,
        fullName: nameParts.fullName,
        name: nameParts.name,
        staffId: teacher.staff_id,
        email: teacher.email,
        termsAccepted: Boolean(teacher.terms_accepted),
        role: teacher.role || 'teacher',
        status: teacher.status || 'approved',
        subjects: await TeacherSubject.getSubjectsByTeacher(teacher.id),
        created_at: teacher.created_at,
        createdAt: teacher.created_at
    };
}

function issueToken(teacherId) {
    return jwt.sign({ id: teacherId }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

function hashResetToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

exports.forgotPassword = async (req, res) => {
    const email = String(req.body.email || '').trim().toLowerCase();
    const genericMessage = 'If that email is registered, a reset link has been sent.';
    try {
        const teacher = await Teacher.findByEmail(email);
        if (!teacher) return res.json({ success: true, message: genericMessage });
        if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
            console.error('Password reset email configuration is missing');
            return res.status(500).json({ success: false, message: 'Password reset email is temporarily unavailable' });
        }

        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
        await PasswordReset.create(teacher.id, hashResetToken(token), expiresAt);
        const baseUrl = process.env.FRONTEND_URL || `${req.protocol}://${req.get('host')}`;
        await sendResetEmail(teacher.email, `${baseUrl}/reset-password.html?token=${token}`);
        res.json({ success: true, message: genericMessage });
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ success: false, message: 'Password reset email is temporarily unavailable' });
    }
};

exports.resetPassword = async (req, res) => {
    const token = String(req.body.token || '');
    const password = String(req.body.password || '');
    if (!token || password.length < 8) {
        return res.status(400).json({ success: false, message: 'A valid token and password of at least 8 characters are required' });
    }
    try {
        const reset = await PasswordReset.findValid(hashResetToken(token));
        if (!reset) return res.status(400).json({ success: false, message: 'This reset link is invalid or has expired. Please request a new one.' });
        await Teacher.updatePassword(reset.teacher_id, await bcrypt.hash(password, 12));
        await PasswordReset.delete(reset.id);
        res.json({ success: true, message: 'Your password has been reset successfully.' });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.signup = async (req, res) => {
    const firstName = String(req.body.firstName || req.body.name || '').trim();
    const lastName = String(req.body.lastName || '').trim();
    const staffId = String(req.body.staffId || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const termsAccepted = req.body.termsAccepted === true;
    const subjects = Array.isArray(req.body.subjects) ? req.body.subjects : [];

    if (!firstName) {
        return res.status(400).json({ success: false, message: 'Please enter your first name' });
    }
    if (!lastName) {
        return res.status(400).json({ success: false, message: 'Please enter your last name' });
    }
    if (!staffId || !email || !password || subjects.length < 1) {
        return res.status(400).json({ success: false, message: 'Staff ID, email, password, and at least one subject are required' });
    }
    if (!termsAccepted) {
        return res.status(400).json({ success: false, message: 'You must agree to the Terms of Service and Acceptable Use Policy' });
    }

    const normalizedSubjects = subjects.map(item => ({
        subject: String(item.subject || '').trim(),
        yearLevel: String(item.yearLevel || '').trim()
    }));
    if (normalizedSubjects.some(item => !allowedSubjects.includes(item.subject))) {
        return res.status(400).json({ success: false, message: 'Please select valid subjects' });
    }
    if (normalizedSubjects.some(item => !allowedYearLevels.includes(item.yearLevel))) {
        return res.status(400).json({ success: false, message: 'Please select a valid year level' });
    }

    try {
        if (await Teacher.findByEmail(email)) {
            return res.status(409).json({ success: false, message: 'This email is already registered. Please log in instead.' });
        }

        const passwordHash = await bcrypt.hash(password, 12);
        const id = await Teacher.create({ firstName, lastName, staffId, email, password: passwordHash, termsAccepted });
        await TeacherSubject.addSubjects(id, normalizedSubjects);
        const teacher = await Teacher.findById(id);
        res.status(201).json({ success: true, teacher: await publicTeacher(teacher) });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ success: false, message: 'This email is already registered. Please log in instead.' });
        }
        console.error('Signup error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.login = async (req, res) => {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    try {
        const teacher = await Teacher.findByEmail(email);
        if (!teacher || !(await bcrypt.compare(password, teacher.password))) {
            return res.status(401).json({ success: false, message: 'Invalid email or password' });
        }
        if (teacher.status !== 'approved') {
            return res.status(403).json({ success: false, message: 'Your account is pending admin approval' });
        }

        res.cookie('token', issueToken(teacher.id), cookieOptions);
        res.json({ success: true, teacher: await publicTeacher(teacher) });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.logout = (req, res) => {
    res.clearCookie('token', cookieOptions);
    res.json({ success: true, message: 'Logged out successfully' });
};

exports.getMe = async (req, res) => {
    try {
        const teacher = await Teacher.findById(req.teacher.id);
        if (!teacher) return res.status(401).json({ success: false, message: 'Authentication required' });
        res.json({ success: true, teacher: await publicTeacher(teacher) });
    } catch (error) {
        console.error('Get current teacher error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.getMySubjects = async (req, res) => {
    try {
        res.json({ success: true, subjects: await TeacherSubject.getSubjectsByTeacher(req.teacher.id) });
    } catch (error) {
        console.error('Get teacher subjects error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.updateMySubjects = async (req, res) => {
    const subjects = Array.isArray(req.body.subjects) ? req.body.subjects : [];
    if (subjects.length < 1) {
        return res.status(400).json({ success: false, message: 'At least one subject is required' });
    }

    const normalizedSubjects = subjects.map(item => ({
        subject: String(item.subject || '').trim(),
        yearLevel: String(item.yearLevel || '').trim()
    }));
    if (normalizedSubjects.some(item => !allowedSubjects.includes(item.subject))) {
        return res.status(400).json({ success: false, message: 'Please select valid subjects' });
    }
    if (normalizedSubjects.some(item => !allowedYearLevels.includes(item.yearLevel))) {
        return res.status(400).json({ success: false, message: 'Please select a valid year level' });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();
        await connection.query('DELETE FROM teacher_subjects WHERE teacher_id = ?', [req.teacher.id]);
        await TeacherSubject.addSubjects(req.teacher.id, normalizedSubjects, connection);
        await connection.commit();
        res.json({ success: true, subjects: await TeacherSubject.getSubjectsByTeacher(req.teacher.id) });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Update teacher subjects error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    } finally {
        connection?.release();
    }
};

exports.changePassword = async (req, res) => {
    const currentPassword = String(req.body.currentPassword || '');
    const newPassword = String(req.body.newPassword || '');
    const confirmNewPassword = String(req.body.confirmNewPassword || '');

    if (newPassword.length < 8) {
        return res.status(400).json({ success: false, message: 'New password must be at least 8 characters' });
    }
    if (newPassword !== confirmNewPassword) {
        return res.status(400).json({ success: false, message: 'New passwords do not match' });
    }

    try {
        const teacher = await Teacher.findByIdWithPassword(req.teacher.id);
        if (!teacher || !(await bcrypt.compare(currentPassword, teacher.password))) {
            return res.status(401).json({ success: false, message: 'Current password is incorrect' });
        }

        await Teacher.updatePassword(teacher.id, await bcrypt.hash(newPassword, 12));
        res.json({ success: true, message: 'Password changed successfully' });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};