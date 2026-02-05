require('dotenv').config();
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

// Load and combine all prompt files
function loadPrompts() {
    const promptsDir = path.join(__dirname, '../prompts');
    const productsDir = path.join(promptsDir, 'products');

    // Define load order
    const promptFiles = [
        'system.txt',
        'company.txt',
        'services.txt'
    ];

    // Load main prompt files
    const prompts = promptFiles.map(file => {
        const filePath = path.join(promptsDir, file);
        if (fs.existsSync(filePath)) {
            return fs.readFileSync(filePath, 'utf-8');
        }
        return '';
    });

    // Load product files if directory exists
    if (fs.existsSync(productsDir)) {
        const productFiles = fs.readdirSync(productsDir)
            .filter(file => file.endsWith('.txt'))
            .sort(); // Alphabetical: aiden, halo, vera

        productFiles.forEach(file => {
            const filePath = path.join(productsDir, file);
            prompts.push(fs.readFileSync(filePath, 'utf-8'));
        });
    }

    // Load FAQ last
    const faqPath = path.join(promptsDir, 'faq.txt');
    if (fs.existsSync(faqPath)) {
        prompts.push(fs.readFileSync(faqPath, 'utf-8'));
    }

    return prompts.filter(p => p.trim()).join('\n\n---\n\n');
}

// Load combined system prompt at startup
const systemPrompt = loadPrompts();

// Initialize Grok client (OpenAI-compatible API)
const client = new OpenAI({
    apiKey: process.env.GROK_API_KEY,
    baseURL: 'https://api.x.ai/v1'
});

const GROK_MODEL = process.env.GROK_MODEL || 'grok-3-fast';

/**
 * Send a chat message and get a response from Grok
 * @param {string} userMessage - The user's message
 * @param {Array} conversationHistory - Previous messages in the conversation
 * @returns {Promise<string>} - The assistant's response
 */
async function chat(userMessage, conversationHistory = []) {
    // Build messages array
    const messages = [
        { role: 'system', content: systemPrompt },
        ...conversationHistory.slice(-10), // Keep last 10 messages for context
        { role: 'user', content: userMessage }
    ];

    try {
        const response = await client.chat.completions.create({
            model: GROK_MODEL,
            messages: messages,
            max_tokens: 500,
            temperature: 0.7
        });

        return response.choices[0].message.content;
    } catch (error) {
        console.error('LLM Error:', error);
        throw new Error('Failed to get response from AI');
    }
}

module.exports = { chat, systemPrompt };
