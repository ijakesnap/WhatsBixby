const logger = require('./logger');
const config = require('../config');
const rateLimiter = require('./rate-limiter');
const { personalDB } = require('../utils/personalDB');
const { groupDB } = require('../utils/groupDB');

class MessageHandler {
    constructor(bot) {
        this.bot = bot;
        this.commandHandlers = new Map();
        this.messageHooks = new Map();
    }

    registerCommandHandler(command, handler) {
        this.commandHandlers.set(command.toLowerCase(), handler);
        logger.debug(`📝 Registered command handler: ${command}`);
    }

    unregisterCommandHandler(command) {
        this.commandHandlers.delete(command.toLowerCase());
        logger.debug(`🗑️ Unregistered command handler: ${command}`);
    }

    registerMessageHook(hookName, handler) {
        if (!this.messageHooks.has(hookName)) {
            this.messageHooks.set(hookName, []);
        }
        this.messageHooks.get(hookName).push(handler);
        logger.debug(`🪝 Registered message hook: ${hookName}`);
    }

    unregisterMessageHook(hookName) {
        this.messageHooks.delete(hookName);
        logger.debug(`🗑️ Unregistered message hook: ${hookName}`);
    }
    async handleMessages({ messages, type }) {
        if (type !== 'notify') return;

        for (const msg of messages) {
            try {
                await this.processMessage(msg);
} catch (error) {
    console.error('[UNCAUGHT ERROR]', error); // Full dump
    logger.error('Error processing message:', error?.stack || error?.message || JSON.stringify(error));
}


        }
    }

    async processMessage(msg) {
        // Check if bot is banned in this chat
        const chatId = msg.key.remoteJid;
        const { ban } = await personalDB(['ban'], { content: {} }, 'get');
        if (ban && ban.includes(chatId)) return;

        // Check if bot is shut off
        const { shutoff } = await personalDB(['shutoff'], { content: {} }, 'get');
        if (shutoff && shutoff === 'true') return;

        // Handle status messages
        if (msg.key.remoteJid === 'status@broadcast') {
            return this.handleStatusMessage(msg);
        }

        // Extract text from message (including captions)
        const text = this.extractText(msg);
        // Check toggle status
        const command = text.slice(config.get('bot.prefix').length).trim().split(/\s+/)[0].toLowerCase();
        const { toggle } = await personalDB(['toggle'], { content: {} }, 'get');
        if (toggle && toggle[command] === 'false') return;

        
        // Check if it's a command (only for text messages, not media with captions)
        const prefix = config.get('bot.prefix');
        const isCommand = text && text.startsWith(prefix) && !this.hasMedia(msg);

        // Check for sticker commands
        if (msg.message?.stickerMessage && !isCommand) {
            await this.handleStickerCommand(msg);
        }
        
        // Execute message hooks
        await this.executeMessageHooks('pre_process', msg, text);
        
        if (isCommand) {
            await this.handleCommand(msg, text);
        } else {
            // Handle non-command messages (including media)
            await this.handleNonCommandMessage(msg, text);
        }

        // Execute post-process hooks
        await this.executeMessageHooks('post_process', msg, text);

        // FIXED: ALWAYS sync to Telegram if bridge is active (this was the main issue)
        if (this.bot.telegramBridge) {
            await this.bot.telegramBridge.syncMessage(msg, text);
        }
    }

    async handleStickerCommand(msg) {
        try {
            const { sticker_cmd } = await personalDB(['sticker_cmd'], { content: {} }, 'get');
            if (!sticker_cmd || Object.keys(sticker_cmd).length === 0) return;

            const stickerHash = msg.message.stickerMessage.fileSha256?.join('');
            if (!stickerHash) return;

            for (const [command, hash] of Object.entries(sticker_cmd)) {
                if (hash === stickerHash) {
                    // Execute the sticker command
                    const handler = this.commandHandlers.get(command);
                    if (handler) {
                        const sender = msg.key.remoteJid;
                        const participant = msg.key.participant || sender;
                        
                        await handler.execute(msg, [], {
                            bot: this.bot,
                            sender,
                            participant,
                            isGroup: sender.endsWith('@g.us')
                        });
                    }
                    break;
                }
            }
        } catch (error) {
            logger.error('Error handling sticker command:', error);
        }
    }

    async executeMessageHooks(hookName, msg, text) {
        const hooks = this.messageHooks.get(hookName) || [];
        for (const hook of hooks) {
            try {
                await hook(msg, text, this.bot);
            } catch (error) {
                logger.error(`Error executing hook ${hookName}:`, error);
            }
        }
    }
    // New method to check if message has media
    hasMedia(msg) {
        return !!(
            msg.message?.imageMessage ||
            msg.message?.videoMessage ||
            msg.message?.audioMessage ||
            msg.message?.documentMessage ||
            msg.message?.stickerMessage ||
            msg.message?.locationMessage ||
            msg.message?.contactMessage
        );
    }

    async handleStatusMessage(msg) {
        if (config.get('features.autoViewStatus')) {
            try {
                await this.bot.sock.readMessages([msg.key]);
                await this.bot.sock.sendMessage(msg.key.remoteJid, {
                    react: { key: msg.key, text: '❤️' }
                });
                logger.debug(`❤️ Liked status from ${msg.key.participant}`);
            } catch (error) {
                logger.error('Error handling status:', error);
            }
        }
        
        // Also sync status messages to Telegram
        if (this.bot.telegramBridge) {
            const text = this.extractText(msg);
            await this.bot.telegramBridge.syncMessage(msg, text);
        }
    }

async handleCommand(msg, text) {
    const sender = msg.key.remoteJid;
    const participant = msg.key.participant || sender;
    const prefix = config.get('bot.prefix');

    const args = text.slice(prefix.length).trim().split(/\s+/);
    const command = args[0].toLowerCase();
    const params = args.slice(1);

if (!this.checkPermissions(msg, command)) {
    if (config.get('features.sendPermissionError', false)) {
        return this.bot.sendMessage(sender, {
            text: '❌ You don\'t have permission to use this command.'
        });
    }
    return; // silently ignore
}

    const userId = participant.split('@')[0];
    if (config.get('features.rateLimiting')) {
        const canExecute = await rateLimiter.checkCommandLimit(userId);
        if (!canExecute) {
            const remainingTime = await rateLimiter.getRemainingTime(userId);
            return this.bot.sendMessage(sender, {
                text: `⏱️ Rate limit exceeded. Try again in ${Math.ceil(remainingTime / 1000)} seconds.`
            });
        }
    }

    const handler = this.commandHandlers.get(command);
    const respondToUnknown = config.get('features.respondToUnknownCommands', false);

    if (handler) {
    // Always add ⏳ reaction for ALL commands
    await this.bot.sock.sendMessage(sender, {
        react: { key: msg.key, text: '⏳' }
    });

    try {
        await handler.execute(msg, params, {
            bot: this.bot,
            sender,
            participant,
            isGroup: sender.endsWith('@g.us')
        });

        // Clear reaction on success for ALL commands
        await this.bot.sock.sendMessage(sender, {
            react: { key: msg.key, text: '' }
        });

        logger.info(`✅ Command executed: ${command} by ${participant}`);

        if (this.bot.telegramBridge) {
            await this.bot.telegramBridge.logToTelegram('📝 Command Executed',
                `Command: ${command}\nUser: ${participant}\nChat: ${sender}`);
        }

    } catch (error) {
        // Keep ❌ reaction on error (don't clear it)
        await this.bot.sock.sendMessage(sender, {
            react: { key: msg.key, text: '❌' }
        });

        logger.error(`❌ Command failed: ${command} | ${error.message || 'No message'}`);
        logger.debug(error.stack || error);

        if (!error._handledBySmartError && error?.message) {
            await this.bot.sendMessage(sender, {
                text: `❌ Command failed: ${error.message}`
            });
        }

        if (this.bot.telegramBridge) {
            await this.bot.telegramBridge.logToTelegram('❌ Command Error',
                `Command: ${command}\nError: ${error.message}\nUser: ${participant}`);
        }
    }


    } else if (respondToUnknown) {
        await this.bot.sendMessage(sender, {
            text: `❓ Unknown command: ${command}\nType *${prefix}menu* for available commands.`
        });
    }
}

    async handleNonCommandMessage(msg, text) {
        // Handle group management features
        if (msg.key.remoteJid?.endsWith('@g.us')) {
            await this.handleGroupFeatures(msg, text);
        }

        // Log media messages for debugging
        if (this.hasMedia(msg)) {
            const mediaType = this.getMediaType(msg);
            logger.debug(`📎 Media message received: ${mediaType} from ${msg.key.participant || msg.key.remoteJid}`);
        } else if (text) {
            logger.debug('💬 Text message received:', text.substring(0, 50));
        }
    }

    async handleGroupFeatures(msg, text) {
        const groupId = msg.key.remoteJid;
        const participant = msg.key.participant || msg.key.remoteJid;
        const userId = participant.split('@')[0];

        try {
            // Get group settings
            const groupSettings = await groupDB(['bot', 'link', 'word', 'fake'], { jid: groupId, content: {} }, 'get');

            // Anti-bot
            if (groupSettings.bot && groupSettings.bot.status === 'true') {
                const isBot = msg.key.id?.startsWith("BAE5") && msg.key.id.length === 16;
                if (isBot && !msg.key.fromMe) {
                    await this.handleAntiFeature(groupId, participant, 'bot', groupSettings.bot.action);
                    return;
                }
            }

            // Anti-link
            if (groupSettings.link && groupSettings.link.status === 'true' && text) {
                const linkRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|chat\.whatsapp\.com\/[^\s]+)/gi;
                if (linkRegex.test(text)) {
                    const isAdmin = await this.isUserAdmin(groupId, participant);
                    if (!isAdmin) {
                        await this.bot.sock.sendMessage(groupId, { delete: msg.key });
                        await this.handleAntiFeature(groupId, participant, 'link', groupSettings.link.action);
                        return;
                    }
                }
            }

            // Anti-word
            if (groupSettings.word && groupSettings.word.status === 'true' && text && groupSettings.word.word) {
                const words = groupSettings.word.word.split(',').map(w => w.trim().toLowerCase());
                const messageWords = text.toLowerCase().split(/\s+/);
                const hasRestrictedWord = words.some(word => messageWords.includes(word));
                
                if (hasRestrictedWord) {
                    const isAdmin = await this.isUserAdmin(groupId, participant);
                    if (!isAdmin) {
                        await this.bot.sock.sendMessage(groupId, { delete: msg.key });
                        await this.handleAntiFeature(groupId, participant, 'word', groupSettings.word.action);
                        return;
                    }
                }
            }

            // Anti-fake
            if (groupSettings.fake && groupSettings.fake.status === 'true' && groupSettings.fake.data) {
                const fakeNumbers = groupSettings.fake.data.split(',').map(n => n.trim());
                const userNumber = userId;
                const isFake = fakeNumbers.some(fake => userNumber.startsWith(fake));
                
                if (isFake) {
                    await this.handleAntiFeature(groupId, participant, 'fake', 'kick');
                    return;
                }
            }

        } catch (error) {
            logger.error('Error handling group features:', error);
        }
    }

    async handleAntiFeature(groupId, participant, type, action) {
        try {
            if (action === 'kick') {
                await this.bot.sock.groupParticipantsUpdate(groupId, [participant], 'remove');
                await this.bot.sendMessage(groupId, {
                    text: `🚫 @${participant.split('@')[0]} removed for violating ${type} rules`,
                    mentions: [participant]
                });
            } else if (action === 'warn') {
                await this.bot.sendMessage(groupId, {
                    text: `⚠️ @${participant.split('@')[0]} warning for violating ${type} rules`,
                    mentions: [participant]
                });
            }
        } catch (error) {
            logger.error(`Error handling anti-${type} action:`, error);
        }
    }

    async isUserAdmin(groupId, userId) {
        try {
            const groupMetadata = await this.bot.sock.groupMetadata(groupId);
            const participant = groupMetadata.participants.find(p => p.id === userId);
            return participant?.admin !== undefined;
        } catch (error) {
            return false;
        }
    }

    getMediaType(msg) {
        if (msg.message?.imageMessage) return 'image';
        if (msg.message?.videoMessage) return 'video';
        if (msg.message?.audioMessage) return 'audio';
        if (msg.message?.documentMessage) return 'document';
        if (msg.message?.stickerMessage) return 'sticker';
        if (msg.message?.locationMessage) return 'location';
        if (msg.message?.contactMessage) return 'contact';
        return 'unknown';
    }

checkPermissions(msg, commandName) {
    const participant = msg.key.participant || msg.key.remoteJid;
    const userId = participant.split('@')[0];
    const ownerId = config.get('bot.owner').split('@')[0]; // Convert full JID to userId
    const isOwner = userId === ownerId || msg.key.fromMe;

    const admins = config.get('bot.admins') || [];

    const mode = config.get('features.mode');
    if (mode === 'private' && !isOwner && !admins.includes(userId)) return false;

    const blockedUsers = config.get('security.blockedUsers') || [];
    if (blockedUsers.includes(userId)) return false;

    const handler = this.commandHandlers.get(commandName);
    if (!handler) return false;

    const permission = handler.permissions || 'public';

    switch (permission) {
        case 'owner':
            return isOwner;

        case 'admin':
            return isOwner || admins.includes(userId);

        case 'public':
            return true;

        default:
            if (Array.isArray(permission)) {
                return permission.includes(userId);
            }
            return false;
    }
}


    extractText(msg) {
        return msg.message?.conversation || 
               msg.message?.extendedTextMessage?.text || 
               msg.message?.imageMessage?.caption ||
               msg.message?.videoMessage?.caption || 
               msg.message?.documentMessage?.caption ||
               msg.message?.audioMessage?.caption ||
               '';
    }
}

module.exports = MessageHandler;
