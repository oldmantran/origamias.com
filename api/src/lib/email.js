require('dotenv').config();

/**
 * Send email via Mailgun API
 * @param {Object} options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.text - Plain text body
 * @param {string} options.html - HTML body (optional)
 */
async function sendEmail({ to, subject, text, html }) {
    const apiKey = process.env.MAILGUN_API_KEY;
    const domain = process.env.MAILGUN_DOMAIN;
    const fromEmail = process.env.MAILGUN_FROM_EMAIL || `chat@${domain}`;
    const fromName = process.env.MAILGUN_FROM_NAME || 'Origami Chat';
    const region = process.env.MAILGUN_REGION || 'us';

    // US vs EU endpoint
    const baseUrl = region === 'eu'
        ? 'https://api.eu.mailgun.net/v3'
        : 'https://api.mailgun.net/v3';

    const formData = new URLSearchParams();
    formData.append('from', `${fromName} <${fromEmail}>`);
    formData.append('to', to);
    formData.append('subject', subject);
    formData.append('text', text);
    if (html) {
        formData.append('html', html);
    }

    const response = await fetch(`${baseUrl}/${domain}/messages`, {
        method: 'POST',
        headers: {
            'Authorization': 'Basic ' + Buffer.from(`api:${apiKey}`).toString('base64')
        },
        body: formData
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Mailgun error: ${error}`);
    }

    return await response.json();
}

/**
 * Format and send a chat transcript
 * @param {Object} transcript - From db.getTranscript()
 */
async function sendTranscript(transcript) {
    const { session, messages } = transcript;

    // Format the transcript
    let textBody = `New chat conversation from origamias.com\n`;
    textBody += `${'='.repeat(50)}\n\n`;

    if (session.visitor_name || session.visitor_email) {
        textBody += `Visitor: ${session.visitor_name || 'Unknown'}\n`;
        textBody += `Email: ${session.visitor_email || 'Not provided'}\n`;
        textBody += `Session ID: ${session.id}\n`;
        textBody += `Started: ${session.created_at}\n\n`;
        textBody += `${'='.repeat(50)}\n\n`;
    }

    textBody += `Conversation:\n\n`;

    for (const msg of messages) {
        const role = msg.role === 'user' ? 'Visitor' : 'Origami';
        const time = new Date(msg.created_at).toLocaleTimeString();
        textBody += `[${time}] ${role}:\n${msg.content}\n\n`;
    }

    // HTML version
    let htmlBody = `
        <h2>New chat conversation from origamias.com</h2>
        <hr>
        <p><strong>Visitor:</strong> ${session.visitor_name || 'Unknown'}</p>
        <p><strong>Email:</strong> ${session.visitor_email || 'Not provided'}</p>
        <p><strong>Session ID:</strong> ${session.id}</p>
        <p><strong>Started:</strong> ${session.created_at}</p>
        <hr>
        <h3>Conversation:</h3>
    `;

    for (const msg of messages) {
        const role = msg.role === 'user' ? 'Visitor' : 'Origami';
        const bgColor = msg.role === 'user' ? '#e3e3e3' : '#f8f8f8';
        htmlBody += `
            <div style="background: ${bgColor}; padding: 12px; margin: 8px 0; border-radius: 8px;">
                <strong>${role}:</strong><br>
                ${msg.content.replace(/\n/g, '<br>')}
            </div>
        `;
    }

    await sendEmail({
        to: 'info@origamias.com',
        subject: `Chat from ${session.visitor_name || 'Website Visitor'} - origamias.com`,
        text: textBody,
        html: htmlBody
    });
}

/**
 * Send confirmation email to visitor
 * @param {string} email - Visitor's email
 * @param {string} name - Visitor's name (optional)
 */
async function sendConfirmation(email, name) {
    const greeting = name ? `Hi ${name}` : 'Hi there';

    const textBody = `${greeting},

Thanks for reaching out to Origami Agentic Solutions! We've received your message and will get back to you within one business day.

In the meantime, feel free to explore our services at https://origamias.com

Best regards,
The Origami Team

---
Origami Agentic Solutions
info@origamias.com
https://origamias.com`;

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; padding: 20px 0; }
        .logo { font-size: 24px; font-weight: bold; color: #1a1a1a; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 8px; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
        a { color: #333; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">Origami Agentic Solutions</div>
        </div>
        <div class="content">
            <p>${greeting},</p>
            <p>Thanks for reaching out to Origami Agentic Solutions! We've received your message and will get back to you within one business day.</p>
            <p>In the meantime, feel free to explore our services at <a href="https://origamias.com">origamias.com</a></p>
            <p>Best regards,<br>The Origami Team</p>
        </div>
        <div class="footer">
            <p>Origami Agentic Solutions<br>
            <a href="mailto:info@origamias.com">info@origamias.com</a> | <a href="https://origamias.com">origamias.com</a></p>
        </div>
    </div>
</body>
</html>`;

    await sendEmail({
        to: email,
        subject: "Thanks for contacting Origami Agentic Solutions",
        text: textBody,
        html: htmlBody
    });
}

module.exports = { sendEmail, sendTranscript, sendConfirmation };
