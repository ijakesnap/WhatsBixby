const axios = require("axios");
const fs = require("fs");
const path = require("path");
const os = require("os");
const Crypto = require("crypto");
const ffmpeg = require("fluent-ffmpeg");
const { spawn } = require("child_process");
const FormData = require("form-data");
const ID3Writer = require("browser-id3-writer");
const { getRandom, getBuffer, fetchJson, runtime, sleep, isUrl, bytesToSize, getSizeMedia, check } = require("i-nrl");
const config = require('../config');

async function isAdmin(m, sock) {
	if (!m.key.remoteJid.endsWith('@g.us')) return false;
	const metadata = await sock.groupMetadata(m.key.remoteJid).catch(() => ({}));
	const admins = metadata?.participants?.filter(v => v.admin)?.map(v => v.id) || [];
	const participant = m.key.participant || m.key.remoteJid;
	return admins.includes(participant);
}

async function isBotAdmin(m, sock) {
	if (!m.key.remoteJid.endsWith('@g.us')) return false;
	const metadata = await sock.groupMetadata(m.key.remoteJid).catch(() => ({}));
	const admins = metadata?.participants?.filter(v => v.admin)?.map(v => v.id) || [];
	return admins.includes(sock.user.id);
}

function getCompo(digit) {
	if (!digit.includes("x")) return false
	let num = digit.replace(/[0-9]/g, '');
	if (num.length > 3) return false
	if (num.length === 3) {
		let chart = ["000", "001", "002", "003", "004", "005", "006", "007", "008", "009", "010", "011", "012", "013", "014", "015", "016", "017", "018", "019", "020", "021", "022", "023", "024", "025", "026", "027", "028", "029", "030", "031", "032", "033", "034", "035", "036", "037", "038", "039", "040", "041", "042", "043", "044", "045", "046", "047", "048", "049", "050", "051", "052", "053", "054", "055", "056", "057", "058", "059", "060", "061", "062", "063", "064", "065", "066", "067", "068", "069", "070", "071", "072", "073", "074", "075", "076", "077", "078", "079", "080", "081", "082", "083", "084", "085", "086", "087", "088", "089", "090", "091", "092", "093", "094", "095", "096", "097", "098", "099", "100"];
		let number = []
		chart.map((n) => {
			number.push(digit.replaceAll(num, n))
		})
		return number
	} else if (num.length === 2) {
		let chart = ["00", "01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23", "24", "25", "26", "27", "28", "29", "30", "31", "32", "33", "34", "35", "36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "46", "47", "48", "49", "50", "51", "52", "53", "54", "55", "56", "57", "58", "59", "60", "61", "62", "63", "64", "65", "66", "67", "68", "69", "70", "71", "72", "73", "74", "75", "76", "77", "78", "79", "80", "81", "82", "83", "84", "85", "86", "87", "88", "89", "90", "91", "92", "93", "94", "95", "96", "97", "98", "99"];
		let number = []
		chart.map((n) => {
			number.push(digit.replaceAll(num, n))
		})
		return number
	} else if (num.length === 1) {
		let chart = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
		let number = []
		chart.map((n) => {
			number.push(digit.replaceAll(num, n))
		})
		return number
	}
}

function getDate() {
	return new Date().toLocaleDateString("EN", {
		weekday: "long",
		year: "numeric",
		month: "long",
		day: "numeric",
	});
}

function parsedJid(text) {
	return text.match(/[0-9]+(-[0-9]+|)(@g.us|@s.whatsapp.net)/g);
}

const MODE = config.get('features.mode') !== 'public';
const PREFIX = config.get('bot.prefix') || '.';

function extractUrlsFromString(text) {
	if (!text) return false;
	const regexp = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()'@:%_\+.~#?!&//=]*)/gi;
	return text.match(regexp) || false;
}

async function getJson(url, options) {
	try {
		const res = await axios({
			method: "GET",
			url,
			headers: {
				"User-Agent": "Mozilla/5.0"
			},
			...options,
		});
		return res.data;
	} catch (err) {
		return err;
	}
}

const isIgUrl = url => /(?:(?:http|https):\/\/)?(?:www.)?(?:instagram.com|instagr.am|instagr.com)\/(\w+)/gim.test(url);

const getUrl = url => url.match(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)/gi);

function isNumber(num) {
	const int = parseInt(num);
	return typeof int === "number" && !isNaN(int);
}

function MediaUrls(text) {
	if (!text) return false;
	const urls = text.match(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()'@:%_\+.~#?!&//=]*)/gi);
	if (!urls) return false;
	return urls.filter(url => ['jpg', 'jpeg', 'png', 'gif', 'mp4', 'webp'].includes(url.split('.').pop().toLowerCase()));
}

function isInstagramURL(url) {
	return /^https?:\/\/(www\.)?instagram\.com\/.*/i.test(url);
}

function linkPreview(options = {}) {
	const LINK_PREVIEW = config.get('bot.linkPreview') || 'HyperWa;Advanced WhatsApp Bot;https://i.imgur.com/qyvmAzS.jpeg;https://github.com/hyperwa-official';
	if (!LINK_PREVIEW || LINK_PREVIEW.toLowerCase() === 'false' || LINK_PREVIEW.toLowerCase() === 'null') return undefined;
	const [title, body, thumb, source] = LINK_PREVIEW.split(/[;,|]/);
	return {
		showAdAttribution: true,
		title: options.title || title || 'HyperWa',
		body: options.body || body,
		mediaType: 1,
		thumbnailUrl: options.url || thumb || 'https://i.imgur.com/qyvmAzS.jpeg',
		sourceUrl: source || 'https://github.com/hyperwa-official'
	};
}

const format = function(code) {
	let i = -1;
	let byt = ['kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
	do {
		code /= 1024;
		i++
	} while (code > 1024);
	return Math.max(code, 0.1).toFixed(1) + byt[i]
}

async function uploadImageToImgur(imagePath) {
	try {
		const data = new FormData();
		data.append('image', fs.createReadStream(imagePath));
		const headers = {
			'Authorization': `Client-ID 3ca8036b07e0f25`,
			...data.getHeaders()
		};
		const response = await axios.post('https://api.imgur.com/3/upload', data, { headers });
		return response?.data?.data?.link;
	} catch {
		return `invalid location get:bad-get`;
	}
}

async function AudioMetaData(audio, info = {}) {
	let title = info.title || "HyperWa-BOT";
	let body = info.body ? [info.body] : [];
	let img = info.image || 'https://i.imgur.com/DyLAuEh.jpg';
	if (!Buffer.isBuffer(img)) img = await getBuffer(img);
	if (!Buffer.isBuffer(audio)) audio = await getBuffer(audio);
	const writer = new ID3Writer(audio);
	writer
		.setFrame("TIT2", title)
		.setFrame("TPE1", body)
		.setFrame("APIC", {
			type: 3,
			data: img,
			description: "HyperWa-BOT-MD",
		});
	writer.addTag();
	return Buffer.from(writer.arrayBuffer);
}

function addSpace(text, length = 3, align = "left") {
	text = text.toString();
	if (text.length >= length) return text;
	const space = " ";
	if (align !== "left" && align !== "right") {
		const even = length - (text.length % 2 !== 0 ? 1 : 0);
		while (text.length < even) text = space + text + space;
		return text;
	}
	while (text.length < length) {
		text = align === "left" ? text + space : space + text;
	}
	return text;
}

async function sendUrl(message) {
	const api = 'your_imgbb_api_key'; // You need to set this
	if(message.reply_message.sticker) {
		const imageBuffer = await message.reply_message.download();
		const form = new FormData();
		form.append('image', imageBuffer, 'bt.jpg');
		form.append('key', api);
		const response = await axios.post('https://api.imgbb.com/1/upload', form, {
			headers: form.getHeaders()
		}).catch(e=>e.response);
		return await message.send(response.data.data.image.url);
	} else if (message.reply_message.image || message.image) {
		const msg = message.reply_message.image || message.image;
		const url = await uploadImageToImgur(await message.client.downloadAndSaveMediaMessage(msg))
		return await message.send(url);
	} else if (message.reply_message.video || message.video) {
		const msg = message.reply_message.video || message.video
		const url = await uploadImageToImgur(await message.client.downloadAndSaveMediaMessage(msg))
		return await message.send(url);
	} else if (message.reply_message.audio) {
		const msg = message.reply_message.audio;
		let urvideo = await message.client.downloadAndSaveMediaMessage(msg)
		await ffmpeg(urvideo)
			.outputOptions(["-y", "-filter_complex", "[0:a]showvolume=f=1:b=4:w=720:h=68,format=yuv420p[vid]", "-map", "[vid]", "-map 0:a"])
			.save('output.mp4')
			.on('end', async () => {
				const url = await uploadImageToImgur('./output.mp4')
				return await message.send(url);
			});
	}
}

async function send_menu(m) {
    const BOT_INFO = config.get('bot.name') + ';' + config.get('bot.company') + ';https://i.imgur.com/qyvmAzS.jpeg';
    const image = MediaUrls(BOT_INFO);
    let img_url;
    let theam = 'text';
    let botInfoContent = BOT_INFO;
    
    if (image) {
        img_url = image[0];
        theam = img_url.includes('.mp4') ? 'video' : 'image';
        botInfoContent = botInfoContent.replace(img_url, '').trim();
    }
    
    const info_vars = botInfoContent.split(/[;,|]/);
    let date = new Date().toLocaleDateString("EN", {
        year: "numeric",
        month: "long",
        day: "numeric",
    });
    let types = {};
    let menu = `*Owner: ${(info_vars[0] || info_vars || '').replace(/[;,|]/g,'')}*
*User: @${m.number}*
*Plugins: ${m.client?.moduleLoader?.modules?.size || 0}*
*Prefix: ${PREFIX}*
*Date: ${date}*
*Mode: ${config.get('features.mode')}*
*Version: ${config.get('bot.version')}*
*Ram: ${format(os.totalmem()-os.freemem())}*\n\n`;

    // Get commands from modules if available
    if (m.client?.moduleLoader?.modules) {
        for (const [name, moduleInfo] of m.client.moduleLoader.modules) {
            if (moduleInfo.instance.commands) {
                for (const command of moduleInfo.instance.commands) {
                    const type = (command.category || 'misc').toLowerCase();
                    if(!types[type]) types[type] = [];
                    types[type].push(command.name);
                }
            }
        }
    }

    const cmd_list = Object.keys(types);
    cmd_list.forEach((cmmd) => {
        menu += `⭓ ${addSpace('*'+cmmd.toUpperCase()+'*',14,"both")} ⭓`;
        types[cmmd].map(a => {
            menu += `\n• _${a.replace(/[^a-zA-Z0-9-+]/g,'')}_`;
        });
        menu += `\n\n${String.fromCharCode(8206).repeat(4001)}`;
    });

    const options = {
        contextInfo: {
            mentionedJid: [m.sender]
        }
    };

    const linkPrev = linkPreview();
    if(linkPrev){
        options.contextInfo.externalAdReply = linkPrev;
    }

    if (theam == 'text') {
        return await m.client.sendMessage(m.jid, {
            text: menu,
            ...options
        });
    } else {
        return await m.client.sendMessage(m.from, {
            [theam]: {
                url: img_url
            },
            caption: menu,
            ...options
        });
    }
}

async function send_alive(m, ALIVE_DATA) {
	const sstart = new Date().getTime();
	let msg = {
		contextInfo: {}
	}
	const prefix = PREFIX;
	let extractions = ALIVE_DATA.match(/#(.*?)#/g);
	let URLS;
	if (extractions) {
		ALIVE_DATA = ALIVE_DATA.replace(/#([^#]+)#/g, '');
		extractions = extractions.map(m => m.slice(1, -1));
		URLS = MediaUrls(ALIVE_DATA);
		msg.contextInfo.externalAdReply = {
			containsAutoReply: true,
			mediaType: 1,
			previewType: "PHOTO"
		};
		extractions.map(extraction => {
			extraction = extraction.replace('\\', '');
			if (extraction.match(/adattribution/gi)) msg.contextInfo.externalAdReply.showAdAttribution = true;
			if (extraction.match(/adreply/gi)) msg.contextInfo.externalAdReply.showAdAttribution = true;
			if (extraction.match(/largerthumbnail/gi)) msg.contextInfo.externalAdReply.renderLargerThumbnail = true;
			if (extraction.match(/largethumb/gi)) msg.contextInfo.externalAdReply.renderLargerThumbnail = true;
			if (extraction.match(/title/gi)) msg.contextInfo.externalAdReply.title = extraction.replace(/title/gi, '');
			if (extraction.match(/body/gi)) msg.contextInfo.externalAdReply.body = extraction.replace(/body/gi, '');
			if (extraction.match(/thumbnail/gi) && !extraction.match(/largerthumbnail/gi)) msg.contextInfo.externalAdReply.thumbnailUrl = extraction.replace(/thumbnail/gi, '');
			if (extraction.match(/thumb/gi) && !extraction.match(/largerthumbnail/gi) && !extraction.match(/largethumb/gi) && !extraction.match(/thumbnail/gi)) msg.contextInfo.externalAdReply.thumbnailUrl = extraction.replace(/thumb/gi, '');
			if (extraction.match(/sourceurl/gi)) msg.contextInfo.externalAdReply.sourceUrl = extraction.replace(/sourceurl/gi, '');
			if (extraction.match(/mediaurl/gi)) msg.contextInfo.externalAdReply.mediaUrl = extraction.replace(/mediaurl/gi, '');
		});
	} else {
		URLS = MediaUrls(ALIVE_DATA);
	}
	let date = new Date().toLocaleDateString("EN", {
		year: "numeric",
		month: "long",
		day: "numeric",
	});
	const URL = URLS ? URLS[Math.floor(Math.random() * URLS.length)] : null;
	const platform = os.platform();
	const sender = m.sender;
	const user = m.pushName;
	const package = require('../../package.json');
	let text = ALIVE_DATA.replace(/&ram/gi, format(os.totalmem() - os.freemem())).replace(/&sender/gi, `@${sender.replace(/[^0-9]/g,'')}`).replace(/&user/gi, `${user}`).replace(/&version/gi, `${package.version}`).replace(/&prefix/gi, `${prefix}`).replace(/&mode/gi, `${config.get('features.mode')}`).replace(/&platform/gi, `${platform}`).replace(/&date/gi, `${date}`).replace(/&speed/gi, `${sstart-new Date().getTime()}`).replace(/&gif/g, '');
	if (ALIVE_DATA.includes('&sender')) msg.contextInfo.mentionedJid = [sender];
	if (ALIVE_DATA.includes('&gif')) msg.gifPlayback = true;
	if (URL && URL.endsWith('.mp4')) {
		msg.video = {
				url: URL
			},
			msg.caption = URLS.map(url => text = text.replace(url, ''));

	} else if (URL) {
		msg.image = {
				url: URL
			},
			msg.caption = URLS.map(url => text = text.replace(url, ''));

	} else msg.text = text.trim();
	return await m.client.sendMessage(m.jid, msg);
}

async function poll(id) {
	if (!fs.existsSync('./hyperwa/database/poll.json')) return {
		status: false
	}
	const file = JSON.parse(fs.readFileSync('./hyperwa/database/poll.json'));
	const poll_res = file.message.filter(a => id.key.id == Object.keys(a)[0]);
	if (!poll_res[0]) return {
		status: false
	}
	let options = {}
	const vote_id = Object.keys(poll_res[0]);
	const vote_obj = Object.keys(poll_res[0][vote_id].votes);
	let total_votes = 0;
	vote_obj.map(a => {
		options[a] = {
			count: poll_res[0][vote_id].votes[a].length
		};
		total_votes = total_votes + poll_res[0][vote_id].votes[a].length
	});
	const keys = Object.keys(options);
	keys.map(a => options[a].percentage = (options[a].count / total_votes) * 100 + '%');
	return {
		status: true,
		res: options,
		total: total_votes
	}
}

module.exports = {
	isAdmin,
	isBotAdmin,
	getCompo,
	getDate,
	parsedJid,
	PREFIX,
	MODE,
	extractUrlsFromString,
	getJson,
	isIgUrl,
	getUrl,
	isNumber,
	MediaUrls,
	isInstagramURL,
	linkPreview,
	format,
	uploadImageToImgur,
	AudioMetaData,
	addSpace,
	sendUrl,
	send_menu,
	send_alive,
	poll,
	getRandom,
	getBuffer,
	fetchJson,
	runtime,
	sleep,
	isUrl,
	bytesToSize,
	getSizeMedia,
	check
};