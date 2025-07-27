const TelegramBot = require('node-telegram-bot-api');
const logger = require('../Core/logger');
const config = require('../config');
const TelegramCommands = require('./commands');
const { connectDb } = require('../utils/db');

class TelegramBridge {
    constructor(whatsappBot) {
        this.whatsappBot = whatsappBot;
        this.telegramBot = null;
        this.commands = null;
        this.chatMappings = new Map();
        this.userMappings = new Map();
        this.contactMappings = new Map();
        this.filters = new Set();
        this.isInitialized = false;
        this.db = null;
    }

    async initialize() {
        if (!config.get('telegram.enabled')) {
            logger.info('📱 Telegram bridge disabled');
            return;
        }

        const token = config.get('telegram.botToken');
        if (!token) {
            throw new Error('Telegram bot token not configured');
        }

        try {
            this.telegramBot = new TelegramBot(token, { polling: true });
            this.commands = new TelegramCommands(this);
            this.db = await connectDb();

            await this.setupEventHandlers();
            await this.loadMappingsFromDb();
            await this.commands.registerBotCommands();

            this.isInitialized = true;
            logger.info('✅ Telegram bridge initialized successfully');
        } catch (error) {
            logger.error('❌ Failed to initialize Telegram bridge:', error);
            throw error;
        }
    }

    async setupEventHandlers() {
        this.telegramBot.on('message', async (msg) => {
            try {
                if (msg.text?.startsWith('/')) {
                    await this.commands.handleCommand(msg);
                } else {
                    await this.handleIncomingMessage(msg);
                }
            } catch (error) {
                logger.error('Error handling Telegram message:', error);
            }
        });

        this.telegramBot.on('polling_error', (error) => {
            logger.error('Telegram polling error:', error);
        });
    }

    async setupWhatsAppHandlers() {
        if (!this.whatsappBot?.sock) return;

        // Handle incoming WhatsApp messages
        this.whatsappBot.sock.ev.on('messages.upsert', async ({ messages }) => {
            for (const msg of messages) {
                if (msg.key.fromMe) continue;
                await this.syncMessage(msg);
            }
        });

        // Handle presence updates
        this.whatsappBot.sock.ev.on('presence.update', async (update) => {
            if (config.get('telegram.features.presenceUpdates')) {
                await this.syncPresenceUpdate(update);
            }
        });

        // Handle call events
        this.whatsappBot.sock.ev.on('call', async (calls) => {
            if (config.get('telegram.features.callLogs')) {
                for (const call of calls) {
                    await this.syncCallEvent(call);
                }
            }
        });
    }

    async syncMessage(msg, text = null) {
        if (!this.isInitialized || !config.get('telegram.features.mediaSync')) return;

        try {
            const chatId = config.get('telegram.chatId');
            if (!chatId) return;

            const sender = msg.key.participant || msg.key.remoteJid;
            const isGroup = msg.key.remoteJid?.endsWith('@g.us');
            
            // Extract text if not provided
            if (!text) {
                text = msg.message?.conversation || 
                       msg.message?.extendedTextMessage?.text ||
                       msg.message?.imageMessage?.caption ||
                       msg.message?.videoMessage?.caption || '';
            }

            // Check filters
            if (this.isFiltered(text)) return;

            // Get contact name
            const contactName = await this.getContactName(sender);
            const chatName = isGroup ? await this.getChatName(msg.key.remoteJid) : 'PM';

            let messageText = `📱 *WhatsApp Message*\n\n`;
            messageText += `👤 *From:* ${contactName}\n`;
            messageText += `💬 *Chat:* ${chatName}\n`;
            
            if (text) {
                messageText += `📝 *Message:* ${text}\n`;
            }

            // Handle media
            if (msg.message?.imageMessage) {
                messageText += `📷 *Type:* Image\n`;
            } else if (msg.message?.videoMessage) {
                messageText += `🎥 *Type:* Video\n`;
            } else if (msg.message?.audioMessage) {
                messageText += `🎵 *Type:* Audio\n`;
            } else if (msg.message?.documentMessage) {
                messageText += `📄 *Type:* Document\n`;
            } else if (msg.message?.stickerMessage) {
                messageText += `🎭 *Type:* Sticker\n`;
            }

            messageText += `⏰ *Time:* ${new Date().toLocaleString()}`;

            await this.telegramBot.sendMessage(chatId, messageText, { parse_mode: 'Markdown' });

        } catch (error) {
            logger.error('Error syncing message to Telegram:', error);
        }
    }

    async handleIncomingMessage(msg) {
        if (!config.get('telegram.features.biDirectional')) return;

        const chatId = config.get('telegram.chatId');
        if (msg.chat.id.toString() !== chatId) return;

        // Handle commands or forward to WhatsApp
        if (msg.text && !msg.text.startsWith('/')) {
            // This could be a message to forward to WhatsApp
            // Implementation depends on specific requirements
        }
    }

    async syncPresenceUpdate(update) {
        try {
            const chatId = config.get('telegram.chatId');
            if (!chatId) return;

            const contactName = await this.getContactName(update.id);
            const presence = update.presences?.[update.id]?.lastKnownPresence || 'unavailable';

            const messageText = `👁️ *Presence Update*\n\n👤 *Contact:* ${contactName}\n📊 *Status:* ${presence}\n⏰ *Time:* ${new Date().toLocaleString()}`;

            await this.telegramBot.sendMessage(chatId, messageText, { parse_mode: 'Markdown' });
        } catch (error) {
            logger.error('Error syncing presence update:', error);
        }
    }

    async syncCallEvent(call) {
        try {
            const chatId = config.get('telegram.chatId');
            if (!chatId) return;

            const contactName = await this.getContactName(call.from);
            const callType = call.isVideo ? 'Video Call' : 'Voice Call';

            const messageText = `📞 *${callType}*\n\n👤 *From:* ${contactName}\n📊 *Status:* ${call.status}\n⏰ *Time:* ${new Date().toLocaleString()}`;

            await this.telegramBot.sendMessage(chatId, messageText, { parse_mode: 'Markdown' });
        } catch (error) {
            logger.error('Error syncing call event:', error);
        }
    }

    async getContactName(jid) {
        if (this.contactMappings.has(jid)) {
            return this.contactMappings.get(jid);
        }

        // Try to get name from WhatsApp
        try {
            const contact = await this.whatsappBot.sock.onWhatsApp(jid);
            if (contact?.[0]?.notify) {
                this.contactMappings.set(jid, contact[0].notify);
                return contact[0].notify;
            }
        } catch (error) {
            logger.debug('Could not get contact name:', error);
        }

        // Fallback to phone number
        const phoneNumber = jid.split('@')[0];
        return `+${phoneNumber}`;
    }

    async getChatName(jid) {
        if (jid.endsWith('@g.us')) {
            try {
                const groupMetadata = await this.whatsappBot.sock.groupMetadata(jid);
                return groupMetadata.subject || 'Unknown Group';
            } catch (error) {
                return 'Unknown Group';
            }
        }
        return 'Private Chat';
    }

    async syncContacts() {
        if (!this.whatsappBot?.sock) return;

        try {
            // This would sync contacts from WhatsApp to Telegram bridge
            logger.info('📇 Syncing contacts...');
            
            // Implementation would depend on WhatsApp contact access
            // For now, we'll just log the action
            
        } catch (error) {
            logger.error('Error syncing contacts:', error);
        }
    }

    async addFilter(word) {
        this.filters.add(word.toLowerCase());
        await this.saveMappingsToDb();
    }

    async clearFilters() {
        this.filters.clear();
        await this.saveMappingsToDb();
    }

    isFiltered(text) {
        if (!text) return false;
        const lowerText = text.toLowerCase();
        return Array.from(this.filters).some(filter => lowerText.startsWith(filter));
    }

    async loadMappingsFromDb() {
        try {
            const mappings = await this.db.collection('telegram_mappings').findOne({ _id: 'bridge_data' });
            if (mappings) {
                this.chatMappings = new Map(mappings.chatMappings || []);
                this.userMappings = new Map(mappings.userMappings || []);
                this.contactMappings = new Map(mappings.contactMappings || []);
                this.filters = new Set(mappings.filters || []);
            }
        } catch (error) {
            logger.error('Error loading mappings from DB:', error);
        }
    }

    async saveMappingsToDb() {
        try {
            await this.db.collection('telegram_mappings').replaceOne(
                { _id: 'bridge_data' },
                {
                    _id: 'bridge_data',
                    chatMappings: Array.from(this.chatMappings.entries()),
                    userMappings: Array.from(this.userMappings.entries()),
                    contactMappings: Array.from(this.contactMappings.entries()),
                    filters: Array.from(this.filters),
                    updatedAt: new Date()
                },
                { upsert: true }
            );
        } catch (error) {
            logger.error('Error saving mappings to DB:', error);
        }
    }

    async sendStartMessage() {
        const chatId = config.get('telegram.chatId');
        if (!chatId) return;

        const message = `🚀 *HyperWa Telegram Bridge Started*\n\n✅ Bridge is now active and monitoring WhatsApp messages.\n\n⏰ Started at: ${new Date().toLocaleString()}`;
        
        try {
            await this.telegramBot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        } catch (error) {
            logger.error('Error sending start message:', error);
        }
    }

    async sendQRCode(qr) {
        const chatId = config.get('telegram.chatId');
        if (!chatId) return;

        try {
            const qrcode = require('qrcode');
            const qrBuffer = await qrcode.toBuffer(qr);
            
            await this.telegramBot.sendPhoto(chatId, qrBuffer, {
                caption: '📱 *WhatsApp QR Code*\n\nScan this QR code with your WhatsApp to connect.'
            });
        } catch (error) {
            logger.error('Error sending QR code to Telegram:', error);
        }
    }

    async logToTelegram(title, message) {
        const logChannel = config.get('telegram.logChannel');
        if (!logChannel) return;

        try {
            const logMessage = `📋 *${title}*\n\n${message}\n\n⏰ ${new Date().toLocaleString()}`;
            await this.telegramBot.sendMessage(logChannel, logMessage, { parse_mode: 'Markdown' });
        } catch (error) {
            logger.debug('Error logging to Telegram:', error);
        }
    }

    async syncWhatsAppConnection() {
        const chatId = config.get('telegram.chatId');
        if (!chatId) return;

        try {
            const user = this.whatsappBot.sock?.user;
            if (user) {
                const message = `✅ *WhatsApp Connected*\n\n👤 *User:* ${user.name || 'Unknown'}\n📱 *Number:* ${user.id.split(':')[0]}\n⏰ *Connected at:* ${new Date().toLocaleString()}`;
                await this.telegramBot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
            }
        } catch (error) {
            logger.error('Error syncing WhatsApp connection:', error);
        }
    }

    async shutdown() {
        if (this.telegramBot) {
            await this.telegramBot.stopPolling();
            logger.info('🛑 Telegram bridge stopped');
        }
    }
}

module.exports = TelegramBridge;