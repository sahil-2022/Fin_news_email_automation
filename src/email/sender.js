const nodemailer = require('nodemailer');

function createTransporter() {
    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });
}

async function sendEmail(htmlContent) {
    console.log('📧 Sending email...');

    const transporter = createTransporter();

    // Support multiple recipients: comma-separated in EMAIL_TO
    // e.g. EMAIL_TO=user1@gmail.com,user2@gmail.com,user3@gmail.com
    const recipients = (process.env.EMAIL_TO || '')
        .split(',')
        .map(e => e.trim())
        .filter(e => e.length > 0)
        .join(', ');

    console.log(`📧 Sending email to ${recipients.split(',').length} recipient(s)...`);

    const mailOptions = {
        from: `"📈 FINews" <${process.env.EMAIL_USER}>`,
        to: recipients,
        subject: `📊 Daily Market Digest — ${new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}`,
        html: htmlContent,
        text: 'Your daily Indian stock market digest. Please view this email in an HTML-capable email client for the best experience.',
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log(`✅ Email sent successfully! Message ID: ${info.messageId}`);
        return info;
    } catch (error) {
        console.error('❌ Failed to send email:', error.message);
        throw error;
    }
}

module.exports = { sendEmail };
