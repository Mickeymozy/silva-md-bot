// playlist.js

import fs from 'fs';
import { promisify } from 'util';
import { pipeline } from 'stream';
import os from 'os';
import axios from 'axios';

const streamPipeline = promisify(pipeline);

let handler = async (m, { conn, command, text, usedPrefix }) => {
    if (!text) throw `*Enter a playlist URL or name!*\n\n*Example:*\n${usedPrefix + command} https://www.youtube.com/playlist?list=PL...`;
    
    try {
        let playlist;
        if (text.includes('youtube.com/playlist')) {
            // Call your API to get the playlist details
            const response = await axios.get(`YOUR_API_ENDPOINT/playlist?url=${encodeURIComponent(text)}`);
            playlist = response.data; // Assuming your API returns the playlist in the expected format
        } else {
            // Call your API to search for the playlist
            const searchResponse = await axios.get(`YOUR_API_ENDPOINT/search?query=${encodeURIComponent(text)}`);
            let vid = searchResponse.data.videos[0];
            if (!vid) throw 'Playlist not found!';
            const playlistResponse = await axios.get(`YOUR_API_ENDPOINT/playlist?url=${encodeURIComponent(vid.url)}`);
            playlist = playlistResponse.data;
        }

        let songs = playlist.items;
        let total = songs.length;
        let downloaded = 0;

        // Send "Downloading playlist..." message
        let m1 = await m.reply(`*Downloading playlist of ${total} songs...* 🎵`);

        for (let song of songs) {
            let { title, url } = song;
            let filePath = `${os.tmpdir()}/${title}.mp3`;

            // Call your API to download the audio
            const audioResponse = await axios.get(`YOUR_API_ENDPOINT/download?url=${encodeURIComponent(url)}`, { responseType: 'stream' });
            await streamPipeline(audioResponse.data, fs.createWriteStream(filePath));

            // Prepare message template
            let doc = {
                audio: {
                    url: filePath
                },
                mimetype: 'audio/mpeg',
                fileName: `${title}.mp3`,
                contextInfo: {
                    externalAdReply: {
                        showAdAttribution: true,
                        mediaType: 2,
                        mediaUrl: url,
                        title: title,
                        body: 'SILVA MD MUSIC BOT',
                        sourceUrl: url,
                        thumbnail: await (await fetch(`https://i.ytimg.com/vi/${url.split('v=')[1]}/hqdefault.jpg`)).buffer()
                    }
                }
            };

            // Send audio file with metadata
            await conn.sendMessage(m.chat, doc, { quoted: m });

            // Delete temporary file
            fs.unlink(filePath, (err) => {
                if (err) console.error('Error deleting temp file:', err);
            });

            downloaded++;
            await m1.reply(`*Downloaded ${downloaded} of ${total} songs...*`);
        }

        // Delete "Downloading playlist..." message
        await m1.delete();

    } catch (error) {
        console.error('Error in playlist download:', error);
        m.reply(`An error occurred: ${error.message}\nPlease try again later`);
    }
}

handler.help = ['playlist'].map(v => v + ' <url/name>');
handler.tags = ['downloader'];
handler.command = /^(playlist|pl)$/i;

handler.exp = 0;
handler.limit = false;
handler.register = false;

export default handler;
