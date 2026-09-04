async function sendResetEmail(toEmail, resetLink) {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'api-key': process.env.BREVO_API_KEY
        },
        body: JSON.stringify({
            sender: { email: process.env.BREVO_SENDER_EMAIL, name: 'Student E-Index' },
            to: [{ email: toEmail }],
            subject: 'Password Reset Request',
            htmlContent: `<p>Click below to reset your password:</p><a href="${resetLink}">${resetLink}</a><p>This link expires in 30 minutes.</p>`
        })
    });
    
    if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error('Brevo email error:', errorData);
        throw new Error('Failed to send email');
    }
    
    return await response.json();
}

module.exports = { sendResetEmail };
