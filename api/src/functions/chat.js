const { app } = require('@azure/functions');
const { chat } = require('../lib/llm');
const db = require('../lib/db');

app.http('chat', {
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
            const { message, sessionId } = body;

            if (!message || typeof message !== 'string') {
                return {
                    status: 400,
                    headers: getCorsHeaders(),
                    jsonBody: { error: 'Message is required' }
                };
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

            // Get AI response
            const response = await chat(message, formattedHistory);

            // Save assistant response
            db.addMessage(currentSessionId, 'assistant', response);

            return {
                status: 200,
                headers: getCorsHeaders(),
                jsonBody: {
                    response,
                    sessionId: currentSessionId
                }
            };
        } catch (error) {
            context.error('Chat error:', error);

            return {
                status: 500,
                headers: getCorsHeaders(),
                jsonBody: {
                    error: 'Failed to process message',
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
