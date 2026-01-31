const { app } = require('@azure/functions');
const db = require('../lib/db');
const { sendTranscript } = require('../lib/email');

app.http('contact', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        // Handle CORS preflight
        if (request.method === 'OPTIONS') {
            return {
                status: 204,
                headers: getCorsHeaders()
            };
        }

        try {
            const body = await request.json();
            const { sessionId, name, email } = body;

            if (!sessionId) {
                return {
                    status: 400,
                    headers: getCorsHeaders(),
                    jsonBody: { error: 'Session ID is required' }
                };
            }

            if (!email || !isValidEmail(email)) {
                return {
                    status: 400,
                    headers: getCorsHeaders(),
                    jsonBody: { error: 'Valid email is required' }
                };
            }

            // Check session exists
            const session = db.getSession(sessionId);
            if (!session) {
                return {
                    status: 404,
                    headers: getCorsHeaders(),
                    jsonBody: { error: 'Session not found' }
                };
            }

            // Update session with contact info
            db.updateSessionContact(sessionId, name || '', email);

            // Get transcript and send email
            const transcript = db.getTranscript(sessionId);
            await sendTranscript(transcript);

            context.log(`Contact submitted: ${email} for session ${sessionId}`);

            return {
                status: 200,
                headers: getCorsHeaders(),
                jsonBody: {
                    success: true,
                    message: 'Thank you! We\'ll be in touch soon.'
                }
            };
        } catch (error) {
            context.error('Contact error:', error);

            return {
                status: 500,
                headers: getCorsHeaders(),
                jsonBody: {
                    error: 'Failed to submit contact info',
                    details: process.env.NODE_ENV === 'development' ? error.message : undefined
                }
            };
        }
    }
});

function getCorsHeaders() {
    const allowedOrigins = (process.env.CORS_ORIGIN || '*').split(',');
    return {
        'Access-Control-Allow-Origin': allowedOrigins[0],
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
