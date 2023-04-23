require('dotenv').config();

const fetch = require('node-fetch');
const tmi = require('tmi.js');
const fs = require('fs');

const twitchClientID = process.env.TWITCH_CLIENT_ID;
const botUsername = process.env.TWITCH_BOT_USERNAME;
const channels = process.env.TWITCH_CHANNELS.split(';');
const rewardID = process.env.TWITCH_REWARD_ID;
const processSongRequests = process.env.SONG_REQUESTS;

var spotifyToken = "";
var twitchToken = "";

module.exports = {

    runBot: function () {
        getTwitchToken('src/bot/tokens/twitchOAuthToken.txt');
        const client = new tmi.Client({
            identity: {
                username: botUsername,
                password: twitchToken
            },
            connection: {
                reconnect: true
            },
            channels: channels
        });

        client.connect().catch();

        // Handle Song requests bought with twitch reward points
        client.on('redeem', async (channel, username, rewardType, tags, message) => {
            channel = channel.substring(1);

            if(rewardType != rewardID || processSongRequests === "false") return;
            
            getTwitchToken();
            const isOnline = await isStreamerLive(channel);

            if (isOnline) {
                client.say(channel, "Song requests are not processed, while the stream is offline.");
                return;
            }

            if (message.includes("https://open.spotify.com/track/")) {
                var songID = message.substring(message.indexOf("track/") + 6, message.lastIndexOf("?"));
                console.log(`Processing song request: ${rewardType}`);

                getSpotifyToken();
                const hasBeenAdded = await addSongToQueue(songID, spotifyToken);

                if (!hasBeenAdded) {
                    client.say(channel, "The Song ID is not correct. Check your link.");
                    return;
                }

                client.say(channel, "The song has been added to the queue.");
            }
            else client.say(channel, "Error while adding song to queue. Only Spotify links are supported.");
        });

        client.on('message', async (channel, context, message) => {
            channel = channel.substring(1);
            
            getTwitchToken();
            getSpotifyToken()
            const isOnline = await isStreamerLive(channel);
            const isNotBot = context.username.toLowerCase() !== "maccesdj";

            var regexSongCmd = /^!song\s*(\d+)?/;
            var regexClipCmd = /^!clip\s*$/;
            var matchSongCmd = message.match(regexSongCmd);
            var matchClipCmd = message.match(regexClipCmd);

            if (!isOnline && isNotBot && (matchSongCmd || matchClipCmd)) {
                client.say(channel, "Stream is offline. As long as the stream is offline, this bot will not process !song commands or song requests.");
                return;
            }

            if (matchSongCmd) {
                const reqOffset = matchSongCmd[1] ? parseInt(matchSongCmd[1]) : null;

                if (reqOffset > 0) {
                    if(reqOffset > 50)
                    {
                        client.say(channel, "The 50 recent played songs are supported. Please use 50 as max offset. Example: !song 50");
                        return;
                    }
                    const response = await fetch(`https://api.spotify.com/v1/me/player/recently-played?limit=${reqOffset}`, {
                        method: 'GET',
                        headers: headers = {
                            'Authorization': `Bearer ${spotifyToken}`,
                            'Content-Type': 'application/json'
                        }
                    });

                    if (!response.ok) {
                        client.say(channel, "The Spotify API returned an error while getting the requested track.");
                        console.log('Something went wrong while getting the requested track.');
                    }

                    const data = await response.json();

                    if (!data.items) {
                        client.say(channel, `Couldn't retrieve the requested Song. Spotify returned an empty Array[]`);
                        return;
                    }

                    const songItem = data.items[reqOffset - 1];
                    const artistNames = songItem.track.artists.map(artist => artist.name).join(', ');
                    const spotifyLink = songItem.track.external_urls.spotify;

                    const date = new Date(songItem.played_at);
                    const playedAt = date.toLocaleString("de-DE", options = { timeZone: "Europe/Berlin", hour12: false });

                    client.say(channel, `${songItem.track.name} \nby ${artistNames} \nfrom the album ${songItem.track.album.name} \nLink: ${spotifyLink} \nPlayed at: ${playedAt}`);
                    return;
                }

                const response = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
                    headers: headers = {
                        'Authorization': `Bearer ${spotifyToken}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (!response.ok) {
                    client.say(channel, "The Spotify API returned an error while getting the current playing song.");
                    console.log('Something went wrong when retrieving the current playing track');
                }

                const data = await response.json();
                if (!data.item) {
                    client.say(channel, "No track is currently playing.");
                    return;
                }

                const { name: title, artists, album, external_urls } = data.item;
                const artistNames = artists.map(artist => artist.name).join(', ');
                const albumName = album.name;
                const spotifyLink = external_urls.spotify;
                client.say(channel, `${title} \nby ${artistNames} \nfrom the album ${albumName} \nLink: ${spotifyLink}`);
            }

            if (matchClipCmd) {
                var response = await fetch(`https://api.twitch.tv/helix/users?login=${channel}`, {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        'Client-Id': twitchClientID
                    }
                });

                var json = await response.json();
                var user = json.data[0];

                response = await fetch(`https://api.twitch.tv/helix/clips?broadcaster_id=${user.id}`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        'Client-Id': twitchClientID
                    }
                });
                
                if (response.status == 403){
                    console.log("Forbidden to get the broadcaster_id from the streamer.");
                    client.say(channel, "Forbidden to get the broadcaster_id from the streamer.");
                    return;
                }

                json = await response.json();
                var respData = json.data[0];

                var isCreated = false;
                let count = 0;

                client.say(channel, `Generating the clip... This can take up to 15 seconds.`);
                const intervalId = setInterval(async () => {
                    response = await fetch(`https://api.twitch.tv/helix/clips?id=${respData.id}`, {
                        headers: {
                            Authorization: `Bearer ${accessToken}`,
                            'Client-Id': twitchClientID
                        }
                    });
                    json = await response.json();
                    var clip = json.data[0];
                    try {
                        if (clip.url != null) isCreated = true;
                    } catch (error) {
                        console.log(`Waiting for clip... `);
                    }

                    if (isCreated) {
                        client.say(channel, `Clip was successfully created: ${clip.url}`);
                        clearInterval(intervalId);
                    }
                    if (count >= 5 && !isCreated) {
                        client.say(channel, `Error while creating the clip.`);
                        clearInterval(intervalId);
                    }
                    count++;
                }, 2500);
            }
        });
    }
};

function getSpotifyToken() {
    try {
        spotifyToken = fs.readFileSync("src/bot/tokens/spotifyAccessToken.txt", 'utf8');
    } catch (err) {
        writeLog('log/twitchBot.log', err);
    }
}

function getTwitchToken() {
    try {
        twitchToken = fs.readFileSync("src/bot/tokens/twitchOAuthToken.txt", 'utf8');
    } catch (err) {
        writeLog('log/twitchBot.log', err);
    }
}

async function addSongToQueue(songID, token) {

    const response = await fetch(`https://api.spotify.com/v1/me/player/queue?uri=spotify%3Atrack%3A${songID}`, {
        method: 'POST',
        headers: headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });

    if(response.status == 204) return true;
    return false;
}

function writeLog(fileName, content) {
    const fs = require('fs');
    var currentDatetime = new Date();
    currentDatetime.setHours(currentDatetime.getHours() + 2)

    fs.appendFile(fileName, currentDatetime.toISOString().replace(/T/, ' ').replace(/\..+/, '') + content, err => {
        if (err) {
            console.error(err);
        }
    });
}

async function isStreamerLive(streamer) {
    const response = await fetch(`https://api.twitch.tv/helix/streams?user_login=${streamer}`, {
        headers: {
            'Client-ID': twitchClientID,
            'Authorization': 'Bearer ' + twitchToken
        }
    });

    const data = await response.json();
    if (data.data.length !== 0) return true;
    return false;
}
