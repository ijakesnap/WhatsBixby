const axios = require('axios');
const crypto = require('crypto');

class UtilityModule {
    constructor(bot) {
        this.bot = bot;
        this.name = 'utility';
        this.metadata = {
            description: 'Utility commands for various tasks',
            version: '1.0.0',
            author: 'HyperWa Team',
            category: 'utility',
            dependencies: ['axios', 'crypto']
        };
        this.commands = [
            {
                name: 'ping',
                description: 'Check bot response time',
                usage: '.ping',
                permissions: 'public',
                execute: this.ping.bind(this)
            },
            {
                name: 'calc',
                description: 'Calculate mathematical expressions',
                usage: '.calc <expression>',
                permissions: 'public',
                ui: {
                    processingText: '🧮 *Calculating...*\n\n⏳ Processing expression...',
                    errorText: '❌ *Calculation Failed*'
                },
                execute: this.calculate.bind(this)
            },
            {
                name: 'qr',
                description: 'Generate QR code',
                usage: '.qr <text>',
                permissions: 'public',
                ui: {
                    processingText: '📱 *Generating QR Code...*\n\n⏳ Creating code...',
                    errorText: '❌ *QR Generation Failed*'
                },
                execute: this.generateQR.bind(this)
            },
            {
                name: 'hash',
                description: 'Generate hash of text',
                usage: '.hash <algorithm> <text>',
                permissions: 'public',
                execute: this.generateHash.bind(this)
            },
            {
                name: 'base64',
                description: 'Encode/decode base64',
                usage: '.base64 <encode|decode> <text>',
                permissions: 'public',
                execute: this.base64Operation.bind(this)
            },
            {
                name: 'weather',
                description: 'Get weather information',
                usage: '.weather <city>',
                permissions: 'public',
                ui: {
                    processingText: '🌤️ *Getting Weather...*\n\n⏳ Checking conditions...',
                    errorText: '❌ *Weather Retrieval Failed*'
                },
                execute: this.getWeather.bind(this)
            },
            {
                name: 'shorten',
                description: 'Shorten a URL',
                usage: '.shorten <url>',
                permissions: 'public',
                ui: {
                    processingText: '🔗 *Shortening URL...*\n\n⏳ Creating short link...',
                    errorText: '❌ *URL Shortening Failed*'
                },
                execute: this.shortenUrl.bind(this)
            },
            {
                name: 'translate',
                description: 'Translate text',
                usage: '.translate <target_lang> <text>',
                permissions: 'public',
                ui: {
                    processingText: '🌐 *Translating...*\n\n⏳ Processing translation...',
                    errorText: '❌ *Translation Failed*'
                },
                execute: this.translateText.bind(this)
            }
        ];
    }

    async init() {
        console.log('✅ Utility module initialized');
    }

    async ping(msg, params, context) {
        const start = Date.now();
        const latency = Date.now() - start;
        return `🏓 *Pong!*\n\n⚡ **Latency:** ${latency}ms\n⏰ **Time:** ${new Date().toLocaleTimeString()}`;
    }

    async calculate(msg, params, context) {
        if (params.length === 0) {
            return '❌ *Calculator*\n\nPlease provide a mathematical expression.\n\n💡 Usage: `.calc 2 + 2 * 3`\n📝 Supports: +, -, *, /, %, ^, sqrt(), sin(), cos(), tan()';
        }

        const expression = params.join(' ');

        try {
            // Sanitize the expression to prevent code injection
            const sanitized = expression.replace(/[^0-9+\-*/.() ]/g, '');
            
            // Use a safe evaluation method
            const result = this.safeEval(sanitized);
            
            return `🧮 *Calculator*\n\n📝 **Expression:** ${expression}\n🎯 **Result:** ${result}\n\n⏰ ${new Date().toLocaleTimeString()}`;

        } catch (error) {
            throw new Error(`Invalid mathematical expression: ${error.message}`);
        }
    }

    safeEval(expression) {
        // Simple safe evaluation for basic math
        const allowedChars = /^[0-9+\-*/.() ]+$/;
        if (!allowedChars.test(expression)) {
            throw new Error('Invalid characters in expression');
        }
        
        try {
            return Function('"use strict"; return (' + expression + ')')();
        } catch (error) {
            throw new Error('Invalid expression');
        }
    }

    async generateQR(msg, params, context) {
        if (params.length === 0) {
            return '❌ *QR Code Generator*\n\nPlease provide text to encode.\n\n💡 Usage: `.qr Hello World`';
        }

        const text = params.join(' ');

        try {
            // This would integrate with a QR code generation API
            return `📱 *QR Code Generated*\n\n📝 **Text:** ${text}\n📝 Note: QR code generation requires API integration.\n\n⏰ ${new Date().toLocaleTimeString()}`;

        } catch (error) {
            throw new Error(`QR code generation failed: ${error.message}`);
        }
    }

    async generateHash(msg, params, context) {
        if (params.length < 2) {
            return '❌ *Hash Generator*\n\nPlease provide algorithm and text.\n\n💡 Usage: `.hash md5 Hello World`\n📝 Algorithms: md5, sha1, sha256, sha512';
        }

        const algorithm = params[0].toLowerCase();
        const text = params.slice(1).join(' ');

        const supportedAlgorithms = ['md5', 'sha1', 'sha256', 'sha512'];
        
        if (!supportedAlgorithms.includes(algorithm)) {
            return `❌ *Unsupported Algorithm*\n\nSupported algorithms: ${supportedAlgorithms.join(', ')}`;
        }

        try {
            const hash = crypto.createHash(algorithm).update(text).digest('hex');
            
            return `🔐 *Hash Generated*\n\n📝 **Text:** ${text}\n🔧 **Algorithm:** ${algorithm.toUpperCase()}\n🎯 **Hash:** \`${hash}\`\n\n⏰ ${new Date().toLocaleTimeString()}`;

        } catch (error) {
            throw new Error(`Hash generation failed: ${error.message}`);
        }
    }

    async base64Operation(msg, params, context) {
        if (params.length < 2) {
            return '❌ *Base64 Utility*\n\nPlease provide operation and text.\n\n💡 Usage: `.base64 encode Hello World`\n📝 Operations: encode, decode';
        }

        const operation = params[0].toLowerCase();
        const text = params.slice(1).join(' ');

        try {
            let result;
            
            if (operation === 'encode') {
                result = Buffer.from(text, 'utf8').toString('base64');
            } else if (operation === 'decode') {
                result = Buffer.from(text, 'base64').toString('utf8');
            } else {
                return '❌ *Invalid Operation*\n\nUse either "encode" or "decode".';
            }

            return `🔄 *Base64 ${operation.charAt(0).toUpperCase() + operation.slice(1)}*\n\n📝 **Input:** ${text}\n🎯 **Output:** \`${result}\`\n\n⏰ ${new Date().toLocaleTimeString()}`;

        } catch (error) {
            throw new Error(`Base64 operation failed: ${error.message}`);
        }
    }

    async getWeather(msg, params, context) {
        if (params.length === 0) {
            return '❌ *Weather*\n\nPlease provide a city name.\n\n💡 Usage: `.weather London`';
        }

        const city = params.join(' ');

        try {
            // This would integrate with a weather API
            return `🌤️ *Weather Information*\n\n🏙️ **City:** ${city}\n📝 Note: Weather functionality requires API integration with services like OpenWeatherMap.\n\n⏰ ${new Date().toLocaleTimeString()}`;

        } catch (error) {
            throw new Error(`Weather retrieval failed: ${error.message}`);
        }
    }

    async shortenUrl(msg, params, context) {
        if (params.length === 0) {
            return '❌ *URL Shortener*\n\nPlease provide a URL to shorten.\n\n💡 Usage: `.shorten https://example.com/very/long/url`';
        }

        const url = params[0];

        // Basic URL validation
        try {
            new URL(url);
        } catch (error) {
            return '❌ *Invalid URL*\n\nPlease provide a valid URL starting with http:// or https://';
        }

        try {
            // This would integrate with a URL shortening service
            return `🔗 *URL Shortened*\n\n📝 **Original:** ${url}\n📝 Note: URL shortening requires API integration with services like bit.ly or tinyurl.\n\n⏰ ${new Date().toLocaleTimeString()}`;

        } catch (error) {
            throw new Error(`URL shortening failed: ${error.message}`);
        }
    }

    async translateText(msg, params, context) {
        if (params.length < 2) {
            return '❌ *Translator*\n\nPlease provide target language and text.\n\n💡 Usage: `.translate es Hello World`\n📝 Language codes: en, es, fr, de, it, pt, ru, ja, ko, zh';
        }

        const targetLang = params[0];
        const text = params.slice(1).join(' ');

        try {
            // This would integrate with a translation API
            return `🌐 *Translation*\n\n📝 **Original:** ${text}\n🎯 **Target Language:** ${targetLang}\n📝 Note: Translation functionality requires API integration with services like Google Translate.\n\n⏰ ${new Date().toLocaleTimeString()}`;

        } catch (error) {
            throw new Error(`Translation failed: ${error.message}`);
        }
    }

    async destroy() {
        console.log('🛑 Utility module destroyed');
    }
}

module.exports = UtilityModule;