const jwt = require('jsonwebtoken');
const Teacher = require('../models/Teacher');

// Reads the JWT from the httpOnly cookie and exposes its claims on req.teacher.
module.exports = async (req, res, next) => {
    const cookies = Object.fromEntries(
        (req.headers.cookie || '').split(';').filter(Boolean).map(cookie => {
            const separator = cookie.indexOf('=');
            return [cookie.slice(0, separator).trim(), decodeURIComponent(cookie.slice(separator + 1))];
        })
    );
    const token = cookies.token;

    if (!token || !process.env.JWT_SECRET) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    try {
        const claims = jwt.verify(token, process.env.JWT_SECRET);
        const teacher = await Teacher.findById(claims.id);
        if (!teacher || teacher.status !== 'approved') {
            return res.status(401).json({ success: false, message: 'Authentication required' });
        }
        req.teacher = teacher;
        req.user = teacher;
        next();
    } catch (error) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
    }
};