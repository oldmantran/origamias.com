require('dotenv').config();
const Database = require('better-sqlite3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Database path - use DB_PATH env var for Azure File Share mount
const dbPath = process.env.DB_PATH || path.join(__dirname, '../../data/chat.db');

let db = null;

/**
 * Initialize database connection and create tables
 */
function init() {
    if (db) return db;

    db = new Database(dbPath);

    // Create tables if they don't exist
    db.exec(`
        CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            visitor_name TEXT,
            visitor_email TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            role TEXT CHECK (role IN ('user', 'assistant')) NOT NULL,
            content TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (session_id) REFERENCES sessions(id)
        );

        CREATE INDEX IF NOT EXISTS idx_messages_session
        ON messages(session_id, created_at);
    `);

    return db;
}

/**
 * Create a new chat session
 * @returns {string} - Session ID
 */
function createSession() {
    const db = init();
    const id = uuidv4();

    db.prepare('INSERT INTO sessions (id) VALUES (?)').run(id);

    return id;
}

/**
 * Get a session by ID
 * @param {string} sessionId
 * @returns {Object|null}
 */
function getSession(sessionId) {
    const db = init();
    return db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
}

/**
 * Update session with contact info
 * @param {string} sessionId
 * @param {string} name
 * @param {string} email
 */
function updateSessionContact(sessionId, name, email) {
    const db = init();
    db.prepare(`
        UPDATE sessions
        SET visitor_name = ?, visitor_email = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `).run(name, email, sessionId);
}

/**
 * Add a message to a session
 * @param {string} sessionId
 * @param {string} role - 'user' or 'assistant'
 * @param {string} content
 * @returns {string} - Message ID
 */
function addMessage(sessionId, role, content) {
    const db = init();
    const id = uuidv4();

    db.prepare(`
        INSERT INTO messages (id, session_id, role, content)
        VALUES (?, ?, ?, ?)
    `).run(id, sessionId, role, content);

    // Update session timestamp
    db.prepare('UPDATE sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(sessionId);

    return id;
}

/**
 * Get conversation history for a session
 * @param {string} sessionId
 * @param {number} limit - Max messages to return
 * @returns {Array}
 */
function getConversationHistory(sessionId, limit = 20) {
    const db = init();

    return db.prepare(`
        SELECT role, content, created_at
        FROM messages
        WHERE session_id = ?
        ORDER BY created_at ASC
        LIMIT ?
    `).all(sessionId, limit);
}

/**
 * Get full transcript for a session (for email)
 * @param {string} sessionId
 * @returns {Object}
 */
function getTranscript(sessionId) {
    const db = init();

    const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
    const messages = db.prepare(`
        SELECT role, content, created_at
        FROM messages
        WHERE session_id = ?
        ORDER BY created_at ASC
    `).all(sessionId);

    return { session, messages };
}

module.exports = {
    init,
    createSession,
    getSession,
    updateSessionContact,
    addMessage,
    getConversationHistory,
    getTranscript
};
