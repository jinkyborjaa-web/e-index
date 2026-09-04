const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const Teacher = require('../models/Teacher');
const { pool } = require('../config/database');

const validStatuses = new Set(['approved', 'rejected', 'deactivated']);
const validRoles = new Set(['admin', 'teacher']);

async function logAction(req, action, targetId, details = '') {
    await pool.query(
        'INSERT INTO audit_logs (actor_id, actor_name, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?, ?)',
        [req.user.id, req.user.name || 'Admin', action, 'teacher', String(targetId), details]
    );
}

function adminTeacher(teacher) {
    return {
        id: teacher.id,
        name: [teacher.first_name, teacher.last_name].filter(Boolean).join(' '),
        firstName: teacher.first_name,
        lastName: teacher.last_name,
        staffId: teacher.staff_id,
        email: teacher.email,
        role: teacher.role,
        status: teacher.status,
        createdAt: teacher.created_at
    };
}

exports.listTeachers = async (req, res) => {
    try {
        res.json({ success: true, teachers: (await Teacher.listAll()).map(adminTeacher) });
    } catch (error) {
        console.error('List admin teachers error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.updateTeacherStatus = (status) => async (req, res) => {
    if (!validStatuses.has(status)) return res.status(400).json({ success: false, message: 'Invalid teacher status' });
    if (Number(req.params.id) === req.user.id && status !== 'approved') {
        return res.status(400).json({ success: false, message: 'You cannot change your own active status' });
    }
    try {
        const updated = await Teacher.updateStatus(req.params.id, status);
        if (!updated) return res.status(404).json({ success: false, message: 'Teacher not found' });
        await logAction(req, `Set teacher status to ${status}`, req.params.id);
        res.json({ success: true, message: `Teacher ${status}` });
    } catch (error) {
        console.error('Update teacher status error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.deleteTeacher = async (req, res) => {
    if (Number(req.params.id) === req.user.id) {
        return res.status(400).json({ success: false, message: 'You cannot delete your own account' });
    }
    try {
        const deleted = await Teacher.delete(req.params.id);
        if (!deleted) return res.status(404).json({ success: false, message: 'Teacher not found' });
        await logAction(req, 'Deleted teacher account', req.params.id);
        res.json({ success: true, message: 'Teacher deleted' });
    } catch (error) {
        console.error('Delete teacher error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.resetTeacherPassword = async (req, res) => {
    try {
        const teacher = await Teacher.findById(req.params.id);
        if (!teacher) return res.status(404).json({ success: false, message: 'Teacher not found' });
        const temporaryPassword = `Temp-${crypto.randomBytes(6).toString('base64url')}`;
        await Teacher.updatePassword(teacher.id, await bcrypt.hash(temporaryPassword, 12));
        await logAction(req, 'Reset teacher password', req.params.id);
        res.json({ success: true, temporaryPassword });
    } catch (error) {
        console.error('Reset teacher password error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.dashboardStats = async (req, res) => {
    try {
        const [[studentCount]] = await pool.query('SELECT COUNT(*) AS count FROM students');
        const [[teacherCount]] = await pool.query('SELECT COUNT(*) AS count FROM teachers');
        const [[pendingCount]] = await pool.query("SELECT COUNT(*) AS count FROM teachers WHERE status = 'pending'");
        const [recentActivity] = await pool.query('SELECT id, actor_name AS actorName, action, target_type AS targetType, target_id AS targetId, details, created_at AS createdAt FROM audit_logs ORDER BY created_at DESC LIMIT 10');
        res.json({
            success: true,
            stats: {
                totalStudents: studentCount.count,
                totalTeachers: teacherCount.count,
                pendingSignups: pendingCount.count,
                recentActivity
            }
        });
    } catch (error) {
        console.error('Get admin dashboard stats error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.setTeacherRole = async (req, res) => {
    const role = String(req.body.role || '').trim().toLowerCase();
    if (!validRoles.has(role)) {
        return res.status(400).json({ success: false, message: "Role must be 'admin' or 'teacher'" });
    }
    if (Number(req.params.id) === req.user.id && role === 'teacher') {
        return res.status(400).json({ success: false, message: 'You cannot change your own role' });
    }
    try {
        const updated = await Teacher.updateRole(req.params.id, role);
        if (!updated) return res.status(404).json({ success: false, message: 'Teacher not found' });
        await logAction(req, `Set teacher role to ${role}`, req.params.id);
        res.json({ success: true, message: `Teacher role set to ${role}`, role });
    } catch (error) {
        console.error('Set teacher role error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};