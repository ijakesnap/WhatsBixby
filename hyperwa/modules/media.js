const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const fs = require('fs-extra');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');

class MediaModule {
    constructor(bot) {
        this.bot = bot;
        this.name = 'media';
        this.metadata = {
            description: 'Media processing and conversion utilities',
            version: '1.0.0',
            author: 'HyperWa Team',
            category: 'utility',
            dependencies: ['fluent-ffmpeg', '@whiskeysockets/baileys']
        };
        this.commands = [
            {
                name: 'sticker',
                description: 'Convert image/video to sticker',
                usage: '.sticker (reply to image/video)',
                permissions: 'public',
                ui: {
                    processingText: '🎨 *Creating Sticker...*\n\n⏳ Converting to sticker format...',
                    errorText: '❌ *Sticker Creation Failed*'
                },
                execute: this.createSticker.bind(this)
            },
            {
                name: 'photo',
                description: 'Convert sticker to image',
                usage: '.photo (reply to sticker)',
                permissions: 'public',
                ui: {
                    processingText: '📷 *Converting to Image...*\n\n⏳ Processing sticker...',
                    errorText: '❌ *Image Conversion Failed*'
                },
                execute: this.stickerToPhoto.bind(this)
            },
            {
                name: 'mp3',
                description: 'Convert video to audio',
                usage: '.mp3 (reply to video)',
                permissions: 'public',
                ui: {
                    processingText: '🎵 *Converting to Audio...*\n\n⏳ Extracting audio...',
                    errorText: '❌ *Audio Conversion Failed*'
                },
                execute: this.videoToAudio.bind(this)
            },
            {
                name: 'gif',
                description: 'Convert video to GIF',
                usage: '.gif (reply to video)',
                permissions: 'public',
                ui: {
                    processingText: '🎬 *Converting to GIF...*\n\n⏳ Processing animation...',
                    errorText: '❌ *GIF Conversion Failed*'
                },
                execute: this.videoToGif.bind(this)
            }
        ];
        this.tempDir = path.join(__dirname, '../temp/media');
    }

    async init() {
        await fs.ensureDir(this.tempDir);
        console.log('✅ Media module initialized');
    }

    async createSticker(msg, params, context) {
        const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        
        if (!quotedMsg) {
            return '❌ *Sticker Creation*\n\nPlease reply to an image or video to create a sticker.\n\n💡 Usage: Reply to media and type `.sticker`';
        }

        try {
            let mediaBuffer;
            let mediaType;

            if (quotedMsg.imageMessage) {
                const stream = await downloadContentFromMessage(quotedMsg.imageMessage, 'image');
                const chunks = [];
                for await (const chunk of stream) {
                    chunks.push(chunk);
                }
                mediaBuffer = Buffer.concat(chunks);
                mediaType = 'image';
            } else if (quotedMsg.videoMessage) {
                const stream = await downloadContentFromMessage(quotedMsg.videoMessage, 'video');
                const chunks = [];
                for await (const chunk of stream) {
                    chunks.push(chunk);
                }
                mediaBuffer = Buffer.concat(chunks);
                mediaType = 'video';
            } else {
                return '❌ *Unsupported Media*\n\nPlease reply to an image or video file.';
            }

            // Convert to WebP sticker format
            const outputPath = path.join(this.tempDir, `sticker_${Date.now()}.webp`);
            
            if (mediaType === 'image') {
                await this.imageToWebp(mediaBuffer, outputPath);
            } else {
                await this.videoToWebp(mediaBuffer, outputPath);
            }

            const stickerBuffer = await fs.readFile(outputPath);
            
            await context.bot.sendMessage(context.sender, {
                sticker: stickerBuffer
            });

            // Cleanup
            await fs.unlink(outputPath);

            return `✅ *Sticker Created Successfully*\n\n🎨 Type: ${mediaType.toUpperCase()}\n⏰ ${new Date().toLocaleTimeString()}`;

        } catch (error) {
            throw new Error(`Sticker creation failed: ${error.message}`);
        }
    }

    async stickerToPhoto(msg, params, context) {
        const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        
        if (!quotedMsg?.stickerMessage) {
            return '❌ *Photo Conversion*\n\nPlease reply to a sticker to convert it to an image.\n\n💡 Usage: Reply to sticker and type `.photo`';
        }

        try {
            const stream = await downloadContentFromMessage(quotedMsg.stickerMessage, 'sticker');
            const chunks = [];
            for await (const chunk of stream) {
                chunks.push(chunk);
            }
            const stickerBuffer = Buffer.concat(chunks);

            // Convert WebP to PNG
            const outputPath = path.join(this.tempDir, `photo_${Date.now()}.png`);
            await this.webpToPng(stickerBuffer, outputPath);

            const imageBuffer = await fs.readFile(outputPath);
            
            await context.bot.sendMessage(context.sender, {
                image: imageBuffer,
                caption: '📷 *Sticker converted to image*'
            });

            // Cleanup
            await fs.unlink(outputPath);

            return `✅ *Image Created Successfully*\n\n📷 Format: PNG\n⏰ ${new Date().toLocaleTimeString()}`;

        } catch (error) {
            throw new Error(`Photo conversion failed: ${error.message}`);
        }
    }

    async videoToAudio(msg, params, context) {
        const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        
        if (!quotedMsg?.videoMessage) {
            return '❌ *Audio Conversion*\n\nPlease reply to a video to extract audio.\n\n💡 Usage: Reply to video and type `.mp3`';
        }

        try {
            const stream = await downloadContentFromMessage(quotedMsg.videoMessage, 'video');
            const chunks = [];
            for await (const chunk of stream) {
                chunks.push(chunk);
            }
            const videoBuffer = Buffer.concat(chunks);

            const inputPath = path.join(this.tempDir, `input_${Date.now()}.mp4`);
            const outputPath = path.join(this.tempDir, `audio_${Date.now()}.mp3`);

            await fs.writeFile(inputPath, videoBuffer);

            // Convert video to audio using ffmpeg
            await new Promise((resolve, reject) => {
                ffmpeg(inputPath)
                    .toFormat('mp3')
                    .audioCodec('libmp3lame')
                    .audioBitrate(128)
                    .save(outputPath)
                    .on('end', resolve)
                    .on('error', reject);
            });

            const audioBuffer = await fs.readFile(outputPath);
            
            await context.bot.sendMessage(context.sender, {
                audio: audioBuffer,
                mimetype: 'audio/mpeg'
            });

            // Cleanup
            await fs.unlink(inputPath);
            await fs.unlink(outputPath);

            return `✅ *Audio Extracted Successfully*\n\n🎵 Format: MP3\n⏰ ${new Date().toLocaleTimeString()}`;

        } catch (error) {
            throw new Error(`Audio conversion failed: ${error.message}`);
        }
    }

    async videoToGif(msg, params, context) {
        const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        
        if (!quotedMsg?.videoMessage) {
            return '❌ *GIF Conversion*\n\nPlease reply to a video to convert it to GIF.\n\n💡 Usage: Reply to video and type `.gif`';
        }

        try {
            const stream = await downloadContentFromMessage(quotedMsg.videoMessage, 'video');
            const chunks = [];
            for await (const chunk of stream) {
                chunks.push(chunk);
            }
            const videoBuffer = Buffer.concat(chunks);

            const inputPath = path.join(this.tempDir, `input_${Date.now()}.mp4`);
            const outputPath = path.join(this.tempDir, `gif_${Date.now()}.gif`);

            await fs.writeFile(inputPath, videoBuffer);

            // Convert video to GIF using ffmpeg
            await new Promise((resolve, reject) => {
                ffmpeg(inputPath)
                    .toFormat('gif')
                    .videoFilters('fps=10,scale=320:-1:flags=lanczos')
                    .duration(10) // Limit to 10 seconds
                    .save(outputPath)
                    .on('end', resolve)
                    .on('error', reject);
            });

            const gifBuffer = await fs.readFile(outputPath);
            
            await context.bot.sendMessage(context.sender, {
                video: gifBuffer,
                gifPlayback: true,
                caption: '🎬 *Video converted to GIF*'
            });

            // Cleanup
            await fs.unlink(inputPath);
            await fs.unlink(outputPath);

            return `✅ *GIF Created Successfully*\n\n🎬 Duration: Max 10s\n⏰ ${new Date().toLocaleTimeString()}`;

        } catch (error) {
            throw new Error(`GIF conversion failed: ${error.message}`);
        }
    }

    async imageToWebp(imageBuffer, outputPath) {
        const inputPath = path.join(this.tempDir, `temp_${Date.now()}.jpg`);
        await fs.writeFile(inputPath, imageBuffer);

        return new Promise((resolve, reject) => {
            ffmpeg(inputPath)
                .toFormat('webp')
                .videoFilters('scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:white')
                .save(outputPath)
                .on('end', () => {
                    fs.unlink(inputPath);
                    resolve();
                })
                .on('error', (err) => {
                    fs.unlink(inputPath);
                    reject(err);
                });
        });
    }

    async videoToWebp(videoBuffer, outputPath) {
        const inputPath = path.join(this.tempDir, `temp_${Date.now()}.mp4`);
        await fs.writeFile(inputPath, videoBuffer);

        return new Promise((resolve, reject) => {
            ffmpeg(inputPath)
                .toFormat('webp')
                .videoFilters('fps=15,scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:white')
                .duration(6) // Max 6 seconds for animated stickers
                .save(outputPath)
                .on('end', () => {
                    fs.unlink(inputPath);
                    resolve();
                })
                .on('error', (err) => {
                    fs.unlink(inputPath);
                    reject(err);
                });
        });
    }

    async webpToPng(webpBuffer, outputPath) {
        const inputPath = path.join(this.tempDir, `temp_${Date.now()}.webp`);
        await fs.writeFile(inputPath, webpBuffer);

        return new Promise((resolve, reject) => {
            ffmpeg(inputPath)
                .toFormat('png')
                .save(outputPath)
                .on('end', () => {
                    fs.unlink(inputPath);
                    resolve();
                })
                .on('error', (err) => {
                    fs.unlink(inputPath);
                    reject(err);
                });
        });
    }

    async destroy() {
        await fs.remove(this.tempDir);
        console.log('🛑 Media module destroyed');
    }
}

module.exports = MediaModule;