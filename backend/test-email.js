require('dotenv').config();
const { sendResetEmail } = require('./src/config/mailer');

const recipient = process.env.EMAIL_TEST_TO_EMAIL || process.env.EMAIL_USER;
const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password.html?token=test`;

sendResetEmail(recipient, resetLink)
  .then(() => console.log('Test email sent.'))
  .catch(error => console.error('Test email failed:', error));