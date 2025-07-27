const axios = require("axios");
const fs = require("fs");
const path = require("path");
const os = require("os");
const Crypto = require("crypto");
const ffmpeg = require("fluent-ffmpeg");
const { spawn } = require("child_process");
const FormData = require("form-data");
const ID3Writer = require("browser-id3-writer");

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

async function getBuffer(url) {
	try {
		const response = await axios({
			method: 'GET',
			url,
			responseType: 'arraybuffer'
		});
		return Buffer.from(response.data);
	} catch (error) {
		throw new Error(`Failed to get buffer: ${error.message}`);
	}
}

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

function isUrl(text) {
	try {
		new URL(text);
		return true;
	} catch {
		return false;
	}
}

function bytesToSize(bytes) {
	const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
	if (bytes === 0) return '0 Byte';
	const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
	return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
}

function runtime(seconds) {
	seconds = Number(seconds);
	var d = Math.floor(seconds / (3600 * 24));
	var h = Math.floor(seconds % (3600 * 24) / 3600);
	var m = Math.floor(seconds % 3600 / 60);
	var s = Math.floor(seconds % 60);
	var dDisplay = d > 0 ? d + (d == 1 ? " day, " : " days, ") : "";
	var hDisplay = h > 0 ? h + (h == 1 ? " hour, " : " hours, ") : "";
	var mDisplay = m > 0 ? m + (m == 1 ? " minute, " : " minutes, ") : "";
	var sDisplay = s > 0 ? s + (s == 1 ? " second" : " seconds") : "";
	return dDisplay + hDisplay + mDisplay + sDisplay;
}

function getRandom(ext) {
	return `${Math.floor(Math.random() * 10000)}${ext}`;
}

function check(word) {
	// Simple word validation - in real implementation, use a dictionary API
	return word && word.length > 2;
}

function linkPreview(options = {}) {
	const config = require('../config');
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

async function send_menu(message) {
    const config = require('../config');
    const BOT_INFO = config.get('bot.name') + ';' + config.get('bot.company') + ';https://i.imgur.com/qyvmAzS.jpeg';
    const image = MediaUrls(BOT_INFO);
    let img_url;
    let theam = 'text';
    let botInfoContent = BOT_INFO;
    
    if (image) {
        img_url = image[0];
        theam = img_url.video ? 'video' : 'image';
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
*User: @${message.number}*
*Plugins: ${message.client.moduleLoader?.modules?.size || 0}*
*Prefix: ${config.get('bot.prefix')}*
*Date: ${date}*
*Mode: ${config.get('features.mode')}*
*Version: ${config.get('bot.version')}*
*Ram: ${format(os.totalmem()-os.freemem())}*\n\n`;

    // Get modules and their commands
    if (message.client.moduleLoader?.modules) {
        for (const [name, moduleInfo] of message.client.moduleLoader.modules) {
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
            mentionedJid: [message.sender]
        }
    };

    const linkPrev = linkPreview();
    if(linkPrev){
        options.contextInfo.externalAdReply = linkPrev;
    }

    if (theam == 'text') {
        return await message.client.sendMessage(message.jid, {
            text: menu,
            ...options
        });
    } else {
        return await message.client.sendMessage(message.from, {
            [theam]: {
                url: img_url
            },
            caption: menu,
            ...options
        });
    }
}

async function send_alive(message, ALIVE_DATA) {
	const config = require('../config');
	const sstart = new Date().getTime();
	let msg = {
		contextInfo: {}
	}
	const prefix = config.get('bot.prefix') == "false" ? '' : config.get('bot.prefix');
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
	const sender = message.sender;
	const user = message.pushName;
	let text = ALIVE_DATA.replace(/&ram/gi, format(os.totalmem() - os.freemem())).replace(/&sender/gi, `@${sender.replace(/[^0-9]/g,'')}`).replace(/&user/gi, `${user}`).replace(/&version/gi, `${config.get('bot.version')}`).replace(/&prefix/gi, `${prefix}`).replace(/&mode/gi, `${config.get('features.mode')}`).replace(/&platform/gi, `${platform}`).replace(/&date/gi, `${date}`).replace(/&speed/gi, `${sstart-new Date().getTime()}`).replace(/&gif/g, '');
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
	return await message.client.sendMessage(message.jid, msg);
}

module.exports = {
	isAdmin,
	isBotAdmin,
	getCompo,
	getDate,
	parsedJid,
	extractUrlsFromString,
	getJson,
	isIgUrl,
	getUrl,
	isNumber,
	MediaUrls,
	isInstagramURL,
	format,
	uploadImageToImgur,
	AudioMetaData,
	addSpace,
	getBuffer,
	sleep,
	isUrl,
	bytesToSize,
	runtime,
	getRandom,
	check,
	linkPreview,
	send_menu,
	send_alive
};