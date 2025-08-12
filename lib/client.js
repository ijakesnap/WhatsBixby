/* Copyright (C) 2025 Codex.
Licensed under the MIT License;
you may not use this file except in compliance with the License.
Codex - Ziyan
*/

const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    jidNormalizedUser,
    getContentType,
    Browsers,
    delay,
    makeCacheableSignalKeyStore
} = require("@c-o-d-e-xx/baileys-revamped");

const { serialize, WAConnection, makeInMemoryStore } = require("./core");
const { Boom } = require("@hapi/boom");
const pino = require("pino");
const fs = require("fs");
const path = require("path");
const qrcode = require("qrcode-terminal");
const chalk = require("chalk");
const config = require("../config");
const { personalDB, groupDB } = require("./db");
const greetings = require("./greetings");
const { commands } = require("./events");

class WhatsApp extends WAConnection {
    constructor(sessionId) {
        super();
        this.sessionId = sessionId;
        this.store = makeInMemoryStore({
            logger: pino().child({ level: "silent", stream: "store" })
        });
        this.logger = pino({ level: "silent" });
        this.authDir = path.join(__dirname, "../session");
        this.isConnected = false;
        this.qrRetries = 0;
        this.maxQrRetries = 5;
    }

    async init() {
        // Ensure session directory exists
        if (!fs.existsSync(this.authDir)) {
            fs.mkdirSync(this.authDir, { recursive: true });
        }

        // Initialize auth state
        const { state, saveCreds } = await useMultiFileAuthState(this.authDir);
        this.authState = state;
        this.saveCreds = saveCreds;

        // Initialize store
        this.store.poll_message = { message: [] };
        this.store.wcg = {};

        console.log(chalk.blue("🤖 WhatsBixby Bot Initializing..."));
        console.log(chalk.yellow("📱 Preparing WhatsApp connection..."));
    }

    async connect() {
        try {
            this.sock = makeWASocket({
                auth: {
                    creds: this.authState.creds,
                    keys: makeCacheableSignalKeyStore(this.authState.keys, this.logger)
                },
                printQRInTerminal: false, // We'll handle QR display ourselves
                logger: this.logger,
                browser: Browsers.macOS("Desktop"),
                generateHighQualityLinkPreview: true,
                markOnlineOnConnect: config.ALLWAYS_ONLINE,
                getMessage: async (key) => {
                    if (this.store) {
                        const msg = await this.store.loadMessage(key.remoteJid, key.id);
                        return msg?.message || undefined;
                    }
                    return { conversation: "Hello" };
                }
            });

            // Bind store to socket events
            this.store.bind(this.sock.ev);

            // Handle connection updates
            this.sock.ev.on("connection.update", async (update) => {
                await this.handleConnectionUpdate(update);
            });

            // Handle credentials update
            this.sock.ev.on("creds.update", this.saveCreds);

            // Handle messages
            this.sock.ev.on("messages.upsert", async (m) => {
                await this.handleMessages(m);
            });

            // Handle group updates
            this.sock.ev.on("group-participants.update", async (m) => {
                await this.handleGroupUpdates(m);
            });

            // Handle message deletions
            this.sock.ev.on("messages.delete", async (m) => {
                await this.handleMessageDeletion(m);
            });

            // Handle call events
            this.sock.ev.on("call", async (call) => {
                await this.handleCalls(call);
            });

            // Handle poll votes
            this.sock.ev.on("messages.reaction", async (reactions) => {
                await this.handlePollVotes(reactions);
            });

        } catch (error) {
            console.error(chalk.red("❌ Connection error:"), error);
            throw error;
        }
    }

    async handleConnectionUpdate(update) {
        const { connection, lastDisconnect, qr } = update;

        // Handle QR code display
        if (qr) {
            this.qrRetries++;
            console.log(chalk.cyan("\n📱 QR Code Generated! Scan with WhatsApp:"));
            console.log(chalk.gray("=" * 50));
            
            // Display QR code in terminal
            qrcode.generate(qr, { small: true });
            
            console.log(chalk.gray("=" * 50));
            console.log(chalk.yellow(`📱 Scan the QR code above with WhatsApp`));
            console.log(chalk.yellow(`🔄 QR Code attempt: ${this.qrRetries}/${this.maxQrRetries}`));
            console.log(chalk.cyan("💡 Open WhatsApp > Linked Devices > Link a Device"));
            
            if (this.qrRetries >= this.maxQrRetries) {
                console.log(chalk.red("❌ Maximum QR code retries reached. Restarting..."));
                process.exit(1);
            }
        }

        if (connection === "close") {
            const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            const reason = lastDisconnect?.error?.output?.statusCode;
            
            console.log(chalk.red("🔌 Connection closed:"), this.getDisconnectReason(reason));
            
            if (shouldReconnect) {
                console.log(chalk.yellow("🔄 Reconnecting..."));
                await delay(3000);
                await this.connect();
            } else {
                console.log(chalk.red("❌ Bot logged out. Please restart and scan QR code again."));
                process.exit(1);
            }
        } else if (connection === "open") {
            this.isConnected = true;
            this.qrRetries = 0;
            
            console.log(chalk.green("✅ Successfully connected to WhatsApp!"));
            console.log(chalk.blue(`🤖 Bot Name: ${this.sock.user.name}`));
            console.log(chalk.blue(`📱 Bot Number: ${this.sock.user.id.split(':')[0]}`));
            console.log(chalk.green("🚀 WhatsBixby is now ready to receive messages!"));
            
            // Set bot presence
            if (config.BOT_PRESENCE) {
                await this.sock.sendPresenceUpdate(config.BOT_PRESENCE);
            }

            // Load plugins
            await this.loadPlugins();
        } else if (connection === "connecting") {
            console.log(chalk.yellow("🔄 Connecting to WhatsApp..."));
        }
    }

    getDisconnectReason(reason) {
        const reasons = {
            [DisconnectReason.badSession]: "Bad Session File, Delete session and Scan Again",
            [DisconnectReason.connectionClosed]: "Connection closed, reconnecting...",
            [DisconnectReason.connectionLost]: "Connection Lost from Server, reconnecting...",
            [DisconnectReason.connectionReplaced]: "Connection Replaced, Another New Session Opened, Please Close Current Session First",
            [DisconnectReason.loggedOut]: "Device Logged Out, Please Scan Again And Run.",
            [DisconnectReason.restartRequired]: "Restart Required, Restarting...",
            [DisconnectReason.timedOut]: "Connection TimedOut, Reconnecting...",
            [DisconnectReason.multideviceMismatch]: "Multi device mismatch, please scan again"
        };
        return reasons[reason] || `Unknown DisconnectReason: ${reason}`;
    }

    async loadPlugins() {
        const pluginDir = path.join(__dirname, "../plugins");
        const pluginFiles = fs.readdirSync(pluginDir).filter(file => file.endsWith('.js'));
        
        console.log(chalk.cyan(`📦 Loading ${pluginFiles.length} plugins...`));
        
        for (const file of pluginFiles) {
            try {
                require(path.join(pluginDir, file));
                console.log(chalk.green(`✅ Loaded: ${file}`));
            } catch (error) {
                console.log(chalk.red(`❌ Failed to load ${file}:`, error.message));
            }
        }
        
        console.log(chalk.green(`🎉 Successfully loaded ${commands.length} commands!`));
    }

    async handleMessages(m) {
        if (!m.messages) return;
        
        for (const message of m.messages) {
            if (!message.message) continue;
            
            try {
                const msg = await this.sock.serializeM(message);
                if (!msg) continue;

                // Check if bot is banned in this chat
                const { ban } = await personalDB(['ban'], { content: {} }, 'get');
                if (ban && ban.includes(msg.jid)) return;

                // Check if bot is shut off
                const { shutoff } = await personalDB(['shutoff'], { content: {} }, 'get');
                if (shutoff === 'true') return;

                // Process commands
                await this.processCommand(msg);

                // Handle filters
                await this.handleFilters(msg);

                // Handle anti-features
                await this.handleAntiFeatures(msg);

            } catch (error) {
                console.error(chalk.red("Message processing error:"), error);
            }
        }
    }

    async processCommand(message) {
        const { toggle } = await personalDB(['toggle'], { content: {} }, 'get');
        const { sticker_cmd } = await personalDB(['sticker_cmd'], { content: {} }, 'get');

        // Handle sticker commands
        if (message.sticker && sticker_cmd) {
            const stickerHash = message.msg?.fileSha256?.join("");
            for (const cmd in sticker_cmd) {
                if (sticker_cmd[cmd] === stickerHash) {
                    message.body = config.PREFIX + cmd;
                    break;
                }
            }
        }

        // Process regular commands
        for (const command of commands) {
            if (!command.pattern) continue;

            const match = this.matchCommand(message.body, command.pattern);
            if (!match) continue;

            // Check if command is toggled off
            if (toggle && toggle[command.pattern.replace(/[^a-zA-Z0-9]/g, '')] === 'false') continue;

            // Check permissions
            if (command.fromMe && !message.isCreator) continue;
            if (command.onlyGroup && !message.isGroup) continue;
            if (command.root && !message.isCreator) continue;

            try {
                await command.function(message, match[1] || '', command.pattern, m);
            } catch (error) {
                console.error(chalk.red(`Command error (${command.pattern}):`), error);
                if (config.ERROR_MSG) {
                    await message.send(`❌ Command error: ${error.message}`);
                }
            }
            break;
        }
    }

    matchCommand(text, pattern) {
        const prefixRegex = new RegExp(`^[${config.PREFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]`);
        if (!prefixRegex.test(text)) return null;
        
        const cleanText = text.replace(prefixRegex, '');
        const regex = new RegExp(`^${pattern}$`, 'i');
        return cleanText.match(regex);
    }

    async handleFilters(message) {
        if (!message.isGroup) return;
        
        const { filter } = await groupDB(['filter'], { jid: message.jid, content: {} }, 'get');
        if (!filter) return;

        for (const pattern in filter) {
            if (message.body.toLowerCase().includes(pattern.toLowerCase())) {
                const filterData = filter[pattern];
                await message.send(filterData.chat, {}, filterData.type || 'text');
                break;
            }
        }
    }

    async handleAntiFeatures(message) {
        if (!message.isGroup || message.isCreator) return;

        // Anti-link
        const { antilink } = await groupDB(['link'], { jid: message.jid, content: {} }, 'get');
        if (antilink?.status === 'true' && this.containsLink(message.body)) {
            await this.executeAntiAction(message, antilink.action, "link sharing");
        }

        // Anti-word
        const { antiword } = await groupDB(['word'], { jid: message.jid, content: {} }, 'get');
        if (antiword?.status === 'true' && antiword.word) {
            const words = antiword.word.split(',');
            if (words.some(word => message.body.toLowerCase().includes(word.toLowerCase()))) {
                await this.executeAntiAction(message, antiword.action, "restricted word usage");
            }
        }

        // Anti-fake
        const { antifake } = await groupDB(['fake'], { jid: message.jid, content: {} }, 'get');
        if (antifake?.status === 'true' && antifake.data) {
            const fakeCodes = antifake.data.split(',');
            if (fakeCodes.some(code => message.number.startsWith(code))) {
                await this.executeAntiAction(message, 'kick', "fake number");
            }
        }
    }

    containsLink(text) {
        const linkRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|[^\s]+\.(com|org|net|edu|gov|mil|int|co|io|me|tv|cc|tk|ml|ga|cf))/gi;
        return linkRegex.test(text);
    }

    async executeAntiAction(message, action, reason) {
        if (action === 'kick') {
            if (await this.isBotAdmin(message)) {
                await this.sock.groupParticipantsUpdate(message.jid, [message.sender], 'remove');
                await message.send(`❌ @${message.number} removed for ${reason}`, {
                    mentions: [message.sender]
                });
            }
        } else if (action === 'warn') {
            // Implement warning system
            await message.send(`⚠️ @${message.number} warned for ${reason}`, {
                mentions: [message.sender]
            });
        }
    }

    async handleGroupUpdates(m) {
        try {
            const { welcome, exit } = await groupDB(['welcome', 'exit'], { jid: m.id, content: {} }, 'get');
            await greetings(m, this.sock, { welcome, exit });
        } catch (error) {
            console.error(chalk.red("Group update error:"), error);
        }
    }

    async handleMessageDeletion(m) {
        // Handle anti-delete functionality
        for (const deletion of m) {
            try {
                const { antidelete } = await groupDB(['delete'], { jid: deletion.key.remoteJid, content: {} }, 'get');
                if (antidelete === 'true') {
                    const deletedMsg = this.store.loadMessage(deletion.key.remoteJid, deletion.key.id);
                    if (deletedMsg) {
                        await this.sock.sendMessage(deletion.key.remoteJid, {
                            text: `🗑️ Deleted message detected:\n\n${deletedMsg.body || 'Media message'}`
                        });
                    }
                }
            } catch (error) {
                console.error(chalk.red("Anti-delete error:"), error);
            }
        }
    }

    async handleCalls(call) {
        if (config.REJECT_CALL === 'true') {
            for (const c of call) {
                if (c.status === 'offer') {
                    await this.sock.rejectCall(c.id, c.from);
                    console.log(chalk.yellow(`📞 Rejected call from ${c.from}`));
                }
            }
        }
    }

    async handlePollVotes(reactions) {
        // Handle poll vote processing
        for (const reaction of reactions) {
            try {
                // Process poll votes here
                console.log(chalk.blue("📊 Poll vote received"));
            } catch (error) {
                console.error(chalk.red("Poll vote error:"), error);
            }
        }
    }

    async isBotAdmin(message) {
        if (!message.isGroup) return false;
        try {
            const metadata = await this.sock.groupMetadata(message.jid);
            const admins = metadata.participants.filter(v => v.admin).map(v => v.id);
            return admins.includes(this.sock.user.id);
        } catch {
            return false;
        }
    }
}

module.exports = WhatsApp;