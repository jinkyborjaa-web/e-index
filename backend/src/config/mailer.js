const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD
    }
});

async function sendResetEmail(toEmail, resetLink) {
    try {
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: toEmail,
            subject: 'Password Reset Request',
            html: `<p>Click below to reset your password:</p>
                   <a href="${resetLink}">${resetLink}</a>
                   <p>This link expires in 30 minutes.</p>`
        });
    } catch (error) {
        console.error('Nodemailer email error:', error);
        throw error;
    }
}

module.exports = { sendResetEmail };
