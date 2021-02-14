//////////////////////////////////////////
//////////////// LOGGING /////////////////
//////////////////////////////////////////
function getCurrentDateString() {
    return (new Date()).toISOString() + ' ::';
};
__originalLog = console.log;
console.log = function () {
    var args = [].slice.call(arguments);
    __originalLog.apply(console.log, [getCurrentDateString()].concat(args));
};
//////////////////////////////////////////
//////////////////////////////////////////



const fs = require('fs');
const util = require('util');
const path = require('path');
const request = require('request');
const https = require('https');
const gTTS = require('gtts');
const { Readable } = require('stream');
//////////////////////////////////////////
///////////////// VARIA //////////////////
//////////////////////////////////////////

function necessary_dirs() {
    if (!fs.existsSync('./data/')) {
        fs.mkdirSync('./data/');
    }
}
necessary_dirs()

function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

async function convert_audio(input) {
    try {
        // stereo to mono channel
        const data = new Int16Array(input)
        const ndata = new Int16Array(data.length / 2)
        for (let i = 0, j = 0; i < data.length; i += 4) {
            ndata[j++] = data[i]
            ndata[j++] = data[i + 1]
        }
        return Buffer.from(ndata);
    } catch (e) {
        console.log(e)
        console.log('convert_audio: ' + e)
        throw e;
    }
}
//////////////////////////////////////////
//////////////////////////////////////////
//////////////////////////////////////////


//////////////////////////////////////////
//////////////// CONFIG //////////////////
//////////////////////////////////////////

const SETTINGS_FILE = 'settings.json';

let DISCORD_TOK = null;
let WITAPIKEY = null;
let SPOTIFY_TOKEN_ID = null;
let SPOTIFY_TOKEN_SECRET = null;

function loadConfig() {
    if (fs.existsSync(SETTINGS_FILE)) {
        const CFG_DATA = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
        DISCORD_TOK = CFG_DATA.discord_token;
        WITAPIKEY = CFG_DATA.wit_ai_token;
        SPOTIFY_TOKEN_ID = CFG_DATA.spotify_token_id;
        SPOTIFY_TOKEN_SECRET = CFG_DATA.spotify_token_secret;
        tarkkey = CFG_DATA.tarkkey;
    } else {
        DISCORD_TOK = process.env.DISCORD_TOK;
        WITAPIKEY = process.env.WITAPIKEY;
        SPOTIFY_TOKEN_ID = process.env.SPOTIFY_TOKEN_ID;
        SPOTIFY_TOKEN_SECRET = process.env.SPOTIFY_TOKEN_SECRET;
        tarkkey = CFG_DATA.tarkkey
    }
    if (!DISCORD_TOK || !WITAPIKEY)
        throw 'failed loading config #113 missing keys!'

}
loadConfig()


//const https = require('https')
function listWitAIApps(cb) {
    const options = {
        hostname: 'api.wit.ai',
        port: 443,
        path: '/apps?offset=0&limit=100',
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + WITAPIKEY,
        },
    }

    const req = https.request(options, (res) => {
        res.setEncoding('utf8');
        let body = ''
        res.on('data', (chunk) => {
            body += chunk
        });
        res.on('end', function () {
            cb(JSON.parse(body))
        })
    })

    req.on('error', (error) => {
        console.error(error)
        cb(null)
    })
    req.end()
}
function updateWitAIAppLang(appID, lang, cb) {
    const options = {
        hostname: 'api.wit.ai',
        port: 443,
        path: '/apps/' + appID,
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + WITAPIKEY,
        },
    }
    const data = JSON.stringify({
        lang
    })

    const req = https.request(options, (res) => {
        res.setEncoding('utf8');
        let body = ''
        res.on('data', (chunk) => {
            body += chunk
        });
        res.on('end', function () {
            cb(JSON.parse(body))
        })
    })
    req.on('error', (error) => {
        console.error(error)
        cb(null)
    })
    req.write(data)
    req.end()
}

//////////////////////////////////////////
//////////////////////////////////////////
//////////////////////////////////////////


const Discord = require('discord.js')
const DISCORD_MSG_LIMIT = 2000;
const discordClient = new Discord.Client()
discordClient.on('ready', () => {
    console.log(`Logged in as ${discordClient.user.tag}!`)
})
discordClient.login(DISCORD_TOK)

const PREFIX = '!';
const _CMD_HELP = PREFIX + 'help';
const _CMD_JOIN = PREFIX + 'join';
const _CMD_LEAVE = PREFIX + 'leave';
const _CMD_PRICE = PREFIX + 'price';
const _CMD_DEBUG = PREFIX + 'debug';
const _CMD_TEST = PREFIX + 'test';
const _CMD_LANG = PREFIX + 'lang';
const TARK_CMDS = [_CMD_PRICE];

const guildMap = new Map();

discordClient.on('message', async (msg) => {
    try {
        if (!('guild' in msg) || !msg.guild) return; // prevent private messages to bot
        const mapKey = msg.guild.id;
        if (msg.content.trim().toLowerCase() == _CMD_JOIN) {
            if (!msg.member.voice.channelID) {
                msg.reply('Error: please join a voice channel first.')
            } else {
                if (!guildMap.has(mapKey))
                    await connect(msg, mapKey)
                else
                    msg.reply('Already connected')
            }
        } else if (msg.content.trim().toLowerCase() == _CMD_LEAVE) {
            if (guildMap.has(mapKey)) {
                let val = guildMap.get(mapKey);
                if (val.voice_Channel) val.voice_Channel.leave()
                if (val.voice_Connection) val.voice_Connection.disconnect()
                if (val.musicYTStream) val.musicYTStream.destroy()
                guildMap.delete(mapKey)
                msg.reply("Disconnected.")
            } else {
                msg.reply("Cannot leave because not connected.")
            }
        }
        else if (TARK_CMDS.indexOf(msg.content.trim().toLowerCase().split('\n')[0].split(' ')[0]) >= 0) {
            if (!msg.member.voice.channelID) {
                msg.reply('Error: please join a voice channel first.')
            } else {
                if (!guildMap.has(mapKey))
                    await connect(msg, mapKey)
                tark_message(msg, mapKey);
            }
        } else if (msg.content.trim().toLowerCase() == _CMD_HELP) {
            msg.reply(getHelpString());
        }
        else if (msg.content.trim().toLowerCase() == _CMD_DEBUG) {
            console.log('toggling debug mode')
            let val = guildMap.get(mapKey);
            if (val.debug)
                val.debug = false;
            else
                val.debug = true;
        }
        else if (msg.content.trim().toLowerCase() == _CMD_TEST) {
            msg.reply('hello back =)')
        }
        else if (msg.content.split('\n')[0].split(' ')[0].trim().toLowerCase() == _CMD_LANG) {
            const lang = msg.content.replace(_CMD_LANG, '').trim().toLowerCase()
            listWitAIApps(data => {
                if (!data.length)
                    return msg.reply('no apps found! :(')
                for (const x of data) {
                    updateWitAIAppLang(x.id, lang, data => {
                        if ('success' in data)
                            msg.reply('succes!')
                        else if ('error' in data && data.error !== 'Access token does not match')
                            msg.reply('Error: ' + data.error)
                    })
                }
            })
        }
    } catch (e) {
        console.log('discordClient message: ' + e)
        msg.reply('Error#180: Something went wrong, try again or contact the developers if this keeps happening.');
    }
})

function getHelpString() {
    let out = '**VOICE COMMANDS:**\n'
    out += '```'
    out += 'get price help\n'

    out += '**TEXT COMMANDS:**\n'
    out += '```'
    out += _CMD_HELP + '\n'
    out += _CMD_JOIN + '/' + _CMD_LEAVE + '\n'
    out += _CMD_PRICE + ' [query]\n'
    out += '```'
    return out;
}

async function connect(msg, mapKey) {
    try {
        let voice_Channel = await discordClient.channels.fetch(msg.member.voice.channelID);
        if (!voice_Channel) return msg.reply("Error: The voice channel does not exist!");
        let text_Channel = await discordClient.channels.fetch(msg.channel.id);
        if (!text_Channel) return msg.reply("Error: The text channel does not exist!");
        let voice_Connection = await voice_Channel.join();
        voice_Connection.play('sound.mp3', { volume: 0.5 });
        guildMap.set(mapKey, {
            'text_Channel': text_Channel,
            'voice_Channel': voice_Channel,
            'voice_Connection': voice_Connection,
            'musicQueue': [],
            'musicDispatcher': null,
            'musicYTStream': null,
            'currentPlayingTitle': null,
            'currentPlayingQuery': null,
            'debug': false,
        });
        speak_impl(voice_Connection, mapKey)
        voice_Connection.on('disconnect', async (e) => {
            if (e) console.log(e);
            guildMap.delete(mapKey);
        })
        msg.reply('connected!')
    } catch (e) {
        console.log('connect: ' + e)
        msg.reply('Error: unable to join your voice channel.');
        throw e;
    }
}

function speak_impl(voice_Connection, mapKey) {
    voice_Connection.on('speaking', async (user, speaking) => {
        if (speaking.bitfield == 0 || user.bot) {
            return
        }
        console.log(`I'm listening to ${user.username}`)
        // this creates a 16-bit signed PCM, stereo 48KHz stream
        const audioStream = voice_Connection.receiver.createStream(user, { mode: 'pcm' })
        audioStream.on('error', (e) => {
            console.log('audioStream: ' + e)
        });
        let buffer = [];
        audioStream.on('data', (data) => {
            buffer.push(data)
        })
        audioStream.on('end', async () => {
            buffer = Buffer.concat(buffer)
            const duration = buffer.length / 48000 / 4;
            console.log("duration: " + duration)

            if (duration < 1.0 || duration > 19) { // 20 seconds max dur
                console.log("TOO SHORT / TOO LONG; SKPPING")
                return;
            }

            try {
                let new_buffer = await convert_audio(buffer)
                let out = await transcribe(new_buffer);
                if (out != null)
                    process_commands_query(out, mapKey, user.id);
            } catch (e) {
                console.log('tmpraw rename: ' + e)
            }


        })
    })
}

function process_commands_query(query, mapKey, userid) {
    if (!query || !query.length)
        return;

    let out = null;

    const regex = /^get ([a-zA-Z]+)(.+?)?$/;
    const m = query.toLowerCase().match(regex);
    if (m && m.length) {
        const cmd = (m[1] || '').trim();
        const args = (m[2] || '').trim();

        switch (cmd) {
            case 'help':
                out = _CMD_HELP;
                break;
            case 'price':
                out = _CMD_PRICE;
                break;
        }
        if (out == null)
            out = '<bad command: ' + query + '>';
    }
    if (out != null && out.length) {
        // out = '<@' + userid + '>, ' + out;
        console.log('text_Channel out: ' + out)
        const val = guildMap.get(mapKey);
        val.text_Channel.send(out)
    }
}

async function tark_message(message, mapKey, voice_Connection) {
    let replymsgs = [];
    let val = guildMap.get(mapKey)
    const market = 'tarkov-market.com'
    const path = '/api/v1/item?q='
    const messes = message.content.split('\n');
    for (let mess of messes) {
        const args = mess.split(' ');

        if (args[0] == _CMD_PRICE && args.length) {
            if (item) {
                if (item.includes(' ')) {
                    var str1 = item.replace(" ", "+")
                }
                else {
                    var str1 = item
                }
                var req = path + str1;
                var options = {
                    host: market,
                    port: 443,
                    path: req,
                    headers: { 'x-api-key': tarkkey }
                };
                callback = function (response) {
                    var str = ''
                    response.on('data', function (chunk) {
                        str += chunk;
                    });
                    response.on('end', function () {
                        try {
                            var mJson = JSON.parse(str);
                            var mName = mJson[0].name
                            var mPrice = mJson[0].avg24hPrice
                            var speech = 'The price of ' + mName + 'is ' + mPrice;
                            var gtts = new gTTS(speech, 'en');
                            gtts.save('./data/tmp.mp3', function (err, result) {
                                if (err) { throw new Error(err); }
                                console.log("speech saved");
                                val.voice_Connection.play('./data/tmp.mp3', { volume: 0.5 });
                            });
                        }
                        catch (e) {
                            var speech = 'Item not found'
                            var gtts = new gTTS(speech, 'en');
                            gtts.save('./data/notofound.mp3', function (err, result) {
                                if (err) { throw new Error(err); }
                                console.log("speech saved");
                                val.voice_Connection.play('./data/notfound.mp3', { volume: 0.5 });
                            });
                        }
                    });
                }
                var mReq = https.get(options, callback).end()
            } else {
                var speech = 'Error!'
                var gtts = new gTTS(speech, 'en');
                gtts.save('./data/err.mp3', function (err, result) {
                    if (err) { throw new Error(err); }
                    console.log("err saved")
                    val.voice_Connection.play('./data/err.mp3', { volume: 0.5 })
                })
            }
        }
    }
}

function message_chunking(msg, MAXL) {
    const msgs = msg.split('\n');
    const chunks = [];

    let outmsg = '';
    while (msgs.length) {
        let a = msgs.shift() + '\n';
        if (a.length > MAXL) {
            console.log(a)
            throw new Error('error#418: max single msg limit');
        }

        if ((outmsg + a + 6).length <= MAXL) {
            outmsg += a;
        } else {
            chunks.push('```' + outmsg + '```')
            outmsg = ''
        }
    }
    if (outmsg.length) {
        chunks.push('```' + outmsg + '```')
    }
    return chunks;
}

function callback(error, response, body) {
    if (!error && response.statusCode == 200) {
        var info = JSON.parse(body)
        console.log(info)
    }
};

async function transcribe(buffer) {

    return transcribe_witai(buffer)
    // return transcribe_gspeech(buffer)
}

// WitAI
let witAI_lastcallTS = null;
const witClient = require('node-witai-speech');
async function transcribe_witai(buffer) {
    try {
        // ensure we do not send more than one request per second
        if (witAI_lastcallTS != null) {
            let now = Math.floor(new Date());
            while (now - witAI_lastcallTS < 1000) {
                console.log('sleep')
                await sleep(100);
                now = Math.floor(new Date());
            }
        }
    } catch (e) {
        console.log('transcribe_witai 837:' + e)
    }

    try {
        console.log('transcribe_witai')
        const extractSpeechIntent = util.promisify(witClient.extractSpeechIntent);
        var stream = Readable.from(buffer);
        const contenttype = "audio/raw;encoding=signed-integer;bits=16;rate=48k;endian=little"
        const output = await extractSpeechIntent(WITAPIKEY, stream, contenttype)
        witAI_lastcallTS = Math.floor(new Date());
        console.log(output.text)
        var thing = output.text
        item = thing.split("get price ")[1]
        console.log(item)
        stream.destroy()
        if (output && '_text' in output && output._text.length)
            return output._text
        if (output && 'text' in output && output.text.length)
            return output.text
        return output;
    } catch (e) { console.log('transcribe_witai 851:' + e); console.log(e) }
}

