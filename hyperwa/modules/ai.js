const axios = require('axios');
const config = require('../config');

class AIModule {
    constructor(bot) {
        this.bot = bot;
        this.name = 'ai';
        this.metadata = {
            description: 'AI-powered features including ChatGPT, image generation, and more',
            version: '1.0.0',
            author: 'HyperWa Team',
            category: 'ai',
            dependencies: ['axios']
        };
        this.commands = [
            {
                name: 'gpt',
                description: 'Chat with ChatGPT',
                usage: '.gpt <your_question>',
                permissions: 'public',
                ui: {
                    processingText: '🤖 *Thinking...*\n\n⏳ Generating response...',
                    errorText: '❌ *AI Response Failed*'
                },
                execute: this.chatGPT.bind(this)
            },
            {
                name: 'imagine',
                description: 'Generate images with AI',
                usage: '.imagine <description>',
                permissions: 'public',
                ui: {
                    processingText: '🎨 *Creating Image...*\n\n⏳ Generating artwork...',
                    errorText: '❌ *Image Generation Failed*'
                },
                execute: this.generateImage.bind(this)
            },
            {
                name: 'gemini',
                description: 'Chat with Google Gemini',
                usage: '.gemini <your_question>',
                permissions: 'public',
                ui: {
                    processingText: '🔮 *Consulting Gemini...*\n\n⏳ Processing query...',
                    errorText: '❌ *Gemini Response Failed*'
                },
                execute: this.geminiChat.bind(this)
            },
            {
                name: 'bard',
                description: 'Chat with Google Bard',
                usage: '.bard <your_question>',
                permissions: 'public',
                ui: {
                    processingText: '📚 *Consulting Bard...*\n\n⏳ Processing query...',
                    errorText: '❌ *Bard Response Failed*'
                },
                execute: this.bardChat.bind(this)
            }
        ];
        this.conversationHistory = new Map();
    }

    async init() {
        console.log('✅ AI module initialized');
    }

    async chatGPT(msg, params, context) {
        if (params.length === 0) {
            return '❌ *ChatGPT*\n\nPlease provide a question or message.\n\n💡 Usage: `.gpt What is artificial intelligence?`';
        }

        const query = params.join(' ');
        const userId = context.participant;

        try {
            // Check if user wants to clear conversation
            if (query.toLowerCase() === 'clear') {
                this.conversationHistory.delete(userId);
                return '✅ *Conversation Cleared*\n\nYour chat history with ChatGPT has been reset.';
            }

            // Get or create conversation history
            let history = this.conversationHistory.get(userId) || [];
            
            // Add user message to history
            history.push({ role: 'user', content: query });

            // Keep only last 10 messages to avoid token limits
            if (history.length > 10) {
                history = history.slice(-10);
            }

            // This would integrate with OpenAI API
            // For now, return a placeholder response
            const response = `🤖 *ChatGPT Response*\n\n**Question:** ${query}\n\n**Answer:** This is a placeholder response. To enable ChatGPT, configure your OpenAI API key in the bot settings.\n\n💡 Use \`.gpt clear\` to reset conversation history.`;

            // Add AI response to history
            history.push({ role: 'assistant', content: response });
            this.conversationHistory.set(userId, history);

            return response;

        } catch (error) {
            throw new Error(`ChatGPT request failed: ${error.message}`);
        }
    }

    async generateImage(msg, params, context) {
        if (params.length === 0) {
            return '❌ *AI Image Generator*\n\nPlease provide a description for the image.\n\n💡 Usage: `.imagine a beautiful sunset over mountains`';
        }

        const prompt = params.join(' ');

        try {
            // This would integrate with an AI image generation API (DALL-E, Midjourney, etc.)
            // For now, return a placeholder response
            return `🎨 *AI Image Generation*\n\n**Prompt:** ${prompt}\n\n📝 Note: Image generation functionality requires API integration with services like DALL-E or Stable Diffusion.\n\n⏰ ${new Date().toLocaleTimeString()}`;

        } catch (error) {
            throw new Error(`Image generation failed: ${error.message}`);
        }
    }

    async geminiChat(msg, params, context) {
        if (params.length === 0) {
            return '❌ *Google Gemini*\n\nPlease provide a question or message.\n\n💡 Usage: `.gemini Explain quantum computing`';
        }

        const query = params.join(' ');

        try {
            // This would integrate with Google Gemini API
            // For now, return a placeholder response
            return `🔮 *Gemini Response*\n\n**Question:** ${query}\n\n**Answer:** This is a placeholder response. To enable Gemini, configure your Google AI API key in the bot settings.\n\n⏰ ${new Date().toLocaleTimeString()}`;

        } catch (error) {
            throw new Error(`Gemini request failed: ${error.message}`);
        }
    }

    async bardChat(msg, params, context) {
        if (params.length === 0) {
            return '❌ *Google Bard*\n\nPlease provide a question or message.\n\n💡 Usage: `.bard What are the latest tech trends?`';
        }

        const query = params.join(' ');

        try {
            // This would integrate with Google Bard API
            // For now, return a placeholder response
            return `📚 *Bard Response*\n\n**Question:** ${query}\n\n**Answer:** This is a placeholder response. To enable Bard, configure your Google AI API key in the bot settings.\n\n⏰ ${new Date().toLocaleTimeString()}`;

        } catch (error) {
            throw new Error(`Bard request failed: ${error.message}`);
        }
    }

    async destroy() {
        this.conversationHistory.clear();
        console.log('🛑 AI module destroyed');
    }
}

module.exports = AIModule;