require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { chat } = require('./lib/llm');
const db = require('./lib/db');
const { sendTranscript, sendConfirmation } = require('./lib/email');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration
const allowedOrigins = (process.env.CORS_ORIGIN || '*').split(',');
app.use(cors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type']
}));

app.use(express.json());

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Chat endpoint
app.post('/api/chat', async (req, res) => {
    try {
        const { message, sessionId } = req.body;

        if (!message || typeof message !== 'string') {
            return res.status(400).json({ error: 'Message is required' });
        }

        // Get or create session
        let currentSessionId = sessionId;
        if (!currentSessionId || !db.getSession(currentSessionId)) {
            currentSessionId = db.createSession();
        }

        // Save user message
        db.addMessage(currentSessionId, 'user', message);

        // Get conversation history for context
        const history = db.getConversationHistory(currentSessionId, 10);
        const formattedHistory = history.slice(0, -1).map(msg => ({
            role: msg.role,
            content: msg.content
        }));

        // Check if user provided an email address in their message
        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
        const emailMatch = message.match(emailRegex);

        let contactCaptured = false;
        if (emailMatch) {
            const detectedEmail = emailMatch[0];
            // Try to extract name (text before the email)
            const nameMatch = message.replace(detectedEmail, '').trim();
            const detectedName = nameMatch.length > 0 && nameMatch.length < 50 ? nameMatch : '';

            // Check if we haven't already captured this contact
            const session = db.getSession(currentSessionId);
            if (!session.visitor_email) {
                db.updateSessionContact(currentSessionId, detectedName, detectedEmail);
                contactCaptured = true;

                // Send emails in background (don't block response)
                const transcript = db.getTranscript(currentSessionId);

                // Send transcript to info@origamias.com
                sendTranscript(transcript).then(() => {
                    console.log(`Transcript sent for: ${detectedEmail}`);
                }).catch(err => {
                    console.error('Failed to send transcript:', err);
                });

                // Send confirmation to visitor
                sendConfirmation(detectedEmail, detectedName).then(() => {
                    console.log(`Confirmation sent to: ${detectedEmail}`);
                }).catch(err => {
                    console.error('Failed to send confirmation:', err);
                });
            }
        }

        // Get AI response
        const response = await chat(message, formattedHistory);

        // Save assistant response
        db.addMessage(currentSessionId, 'assistant', response);

        res.json({
            response,
            sessionId: currentSessionId,
            contactCaptured
        });
    } catch (error) {
        console.error('Chat error:', error);
        res.status(500).json({
            error: 'Failed to process message',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Contact endpoint
app.post('/api/contact', async (req, res) => {
    try {
        const { sessionId, name, email } = req.body;

        if (!sessionId) {
            return res.status(400).json({ error: 'Session ID is required' });
        }

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ error: 'Valid email is required' });
        }

        // Check session exists
        const session = db.getSession(sessionId);
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        // Update session with contact info
        db.updateSessionContact(sessionId, name || '', email);

        // Get transcript and send email
        const transcript = db.getTranscript(sessionId);
        await sendTranscript(transcript);

        console.log(`Contact submitted: ${email} for session ${sessionId}`);

        res.json({
            success: true,
            message: "Thank you! We'll be in touch soon."
        });
    } catch (error) {
        console.error('Contact error:', error);
        res.status(500).json({
            error: 'Failed to submit contact info',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Initialize DB and start server
db.init();
app.listen(PORT, () => {
    console.log(`Origami Chat API running on port ${PORT}`);
});
