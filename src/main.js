#!/usr/bin/env node

require('dotenv').config();

const fetch = require('node-fetch');
const express = require('express');
const crypto = require('crypto');
const https = require('https');
const fs = require('fs');

const twitchClientID = process.env.TWITCH_CLIENT_ID;
const twitchClientSecret = process.env.TWITCH_CLIENT_SECRET;

const spotifyClientID = process.env.SPOTIFY_CLIENT_ID;
const spotifyClientSecret = process.env.SPOTIFY_CLIENT_SECRET;
const authHeader = `Basic ${Buffer.from(`${spotifyClientID}:${spotifyClientSecret}`).toString('base64')}`;

const serverOptions = {
    key: fs.readFileSync('src/certificates/key.pem'),  // path to your private key file
    cert: fs.readFileSync('src/certificates/cert.pem') // path to your certificate file
};

fs.unlink("src/bot/tokens/twitchOAuthToken.txt", (err) => {
    if (err) {
      if (err.code === 'ENOENT') {
        console.log(`No Twitch OAuth token to delete.`);
      } else {
        console.error(err.message);
      }
    } else {
      console.log(`Twitch OAuth token deleted.`);
    }
});

const bot = require('./bot/bot');
const app = express();

var rndTwitchState = "";
var rndSpotifyState = "";

/* Redirect to Twitch login for bot account. Gets a user access token for calls to the API.
For example: Posting into stream chat or creating clips as the user (bot) */
app.get('/twitchLogin', (req, res) => {
    rndTwitchState = crypto.randomBytes(15).toString('base64').slice(0, 30);
    const queryParams = new URLSearchParams({
        client_id: twitchClientID,
        redirect_uri: "https://localhost/twitchCallback",
        response_type: 'code',
        scope: 'chat:edit chat:read clips:edit',
        state: rndTwitchState
    });

    const authorizationUrl = `https://id.twitch.tv/oauth2/authorize?${queryParams}`;

    res.redirect(authorizationUrl);
    writeLog("log/webApp.log", "Received request and redirected to twitch login")
});

/* After login, retrieve user access token from Twitch and save it into token dir */
app.get('/twitchCallback', async (req, res) => {
    const { code, state } = req.query;

    // Verify the state parameter to prevent CSRF attacks
    if (state !== rndTwitchState) {
        res.status(401).send('Invalid state parameter');
        return;
    }

    // Exchange the authorization code for an access token and refresh token
    const response = await fetch('https://id.twitch.tv/oauth2/token', {
        method: 'POST',
        body: new URLSearchParams({
            client_id: twitchClientID,
            client_secret: twitchClientSecret,
            code,
            grant_type: 'authorization_code',
            redirect_uri: "https://localhost/twitchCallback"
        }),
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    });

    const json = await response.json();

    // Store the access token
    accessToken = json.access_token;
    refreshToken = json.refresh_token;
    expires_in = json.expires_in;

    if (!accessToken) {
        res.send('Could not retrieve twitchAccessToken.<br><a href="https://localhost/twitchLogin">Try again</a><br><a href="https://localhost/spotifyLogin">Spotify login</a>');
        writeLog("log/webApp.log", `Could not retrieve twitchAccessToken: ${json}`);
        console.log(`Could not retrieve twitchAccessToken: ${json}`);
        return;
    }
    writeToken('src/bot/tokens/twitchOAuthToken.txt', accessToken);
    writeToken('src/bot/tokens/twitchRefreshToken.txt', refreshToken);
    writeLog("log/webApp.log", `Retrieved twitchAccessToken`);
    console.log(`Retrieved twitchAccessToken`);
    res.send('Twitch login was successful<br><a href="https://localhost/spotifyLogin">Spotify login</a>')

    // Refresh the tokens every 2 hours
    setInterval(async () => {
        refreshToken = getToken('src/bot/tokens/twitchRefreshToken.txt');
        const response = await fetch('https://id.twitch.tv/oauth2/token', {
            method: 'POST',
            body: new URLSearchParams({
                client_id: twitchClientID,
                client_secret: twitchClientSecret,
                grant_type: 'refresh_token',
                refresh_token: refreshToken
            }),
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        const refreshJson = await response.json();
        accessToken = refreshJson.access_token;
        refreshToken = refreshJson.refresh_token;
        if (!accessToken) {
            writeLog("log/webApp.log", `Could not refresh twitchAccessToken: ${json}`);
            console.log(`Could not refresh twitchAccessToken: ${json}`);
            return;
        }

        writeToken('src/bot/tokens/twitchOAuthToken.txt', accessToken);
        writeToken('src/bot/tokens/twitchRefreshToken.txt', refreshToken);
        writeLog("log/webApp.log", `Refreshed twitchAccessToken`);
        console.log(`Refreshed twitchAccessToken`);
    }, expires_in / 2 * 1000);

});

app.get('/spotifyLogin', (req, res) => {
    rndSpotifyState = crypto.randomBytes(15).toString('base64').slice(0, 30);

    const queryParams = new URLSearchParams({
        client_id: spotifyClientID,
        redirect_uri: "https://localhost/spotifyCallback",
        response_type: 'code',
        scope: 'user-read-currently-playing user-read-recently-played user-read-playback-state user-modify-playback-state',
        state: rndSpotifyState
    });
    const authorizationUrl = `https://accounts.spotify.com/authorize?${queryParams}`;

    res.redirect(authorizationUrl);
    writeLog("log/webApp.log", "Received request and redirected to spotify login");
    console.log("Received request and redirected to spotify login");
});

app.get('/spotifyCallback', async (req, res) => {
    const { code, state, error } = req.query;

    if (error) {
        console.log(`spotify: ${error}`);
        res.send(`Error while login: ${error} <a href="https://localhost/spotifyLogin">Try again</a><br><a href="https://localhost/twitchLogin">Twitch login</a>`);
    };
    // Verify the state parameter to prevent CSRF attacks
    if (state !== rndSpotifyState) {
        res.status(401).send('Invalid state parameter');
        return;
    }

    const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        body: new URLSearchParams({
            code,
            grant_type: 'authorization_code',
            redirect_uri: "https://localhost/spotifyCallback"
        }),
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': authHeader
        }
    });

    const json = await response.json();

    // Store the access token
    accessToken = json.access_token;
    refreshToken = json.refresh_token;
    expires_in = json.expires_in;

    if (!accessToken) {
        res.send('Could not retrieve spotifyAccessToken.<br><a href="https://localhost/spotifyLogin">Try again</a><br><a href="https://localhost/twitchLogin">Twitch login</a>');
        writeLog("log/webApp.log", `Could not retrieve spotifyAccessToken: ${json}`);
        console.log(`Could not retrieve spotifyAccessToken: ${json}`);
        return;
    }
    writeToken('src/bot/tokens/spotifyAccessToken.txt', accessToken);
    writeToken('src/bot/tokens/spotifyRefreshToken.txt', refreshToken);
    writeLog("log/webApp.log", `Retrieved spotifyAccessToken: ${json}`);
    console.log(`Retrieved spotifyAccessToken`);
    res.send('Spotify login was successful<br><a href="https://localhost/twitchLogin">Twitch login</a>')

    // Refresh the tokens every 2 hours
    setInterval(async () => {
        refreshToken = getToken('src/bot/tokens/spotifyRefreshToken.txt');
        const response = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            body: new URLSearchParams({
                client_id: twitchClientID,
                client_secret: twitchClientSecret,
                grant_type: 'refresh_token',
                refresh_token: refreshToken
            }),
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': authHeader
            }
        });
        const refreshJson = await response.json();
        accessToken = refreshJson.access_token;
        refreshToken = refreshJson.refresh_token;

        if (!accessToken) {
            writeLog("log/webApp.log", `Could not refresh spotifyAccessToken: ${json}`);
            console.log(`Could not refresh spotifyAccessToken: ${json}`);
            return;
        }
        writeToken('src/bot/tokens/spotifyAccessToken.txt', accessToken);
        writeToken('src/bot/tokens/spotifyRefreshToken.txt', refreshToken);
        writeLog("log/webApp.log", "Refreshed spotifyToken");
        console.log("Refreshed spotifyToken");
    }, expires_in / 2 * 1000);
});

https.createServer(serverOptions, app).listen(443, () => {
    console.log('Server started on https://localhost:443');
  });

const intervalId = setInterval(async () => {
    fs.access("src/bot/tokens/twitchOAuthToken.txt", fs.constants.F_OK, (err) => {
        if (err) {
            console.log("Waiting for twitch login");
            return;
        }
        
        console.log("Received twitch access token. Starting the twitch bot, but don't forget spotify login.");
        bot.runBot();
        clearInterval(intervalId);
    });
}, 2000);



// ##### Functions #####
function writeLog(fileName, content) {
    var currentDatetime = new Date();
    currentDatetime.setHours(currentDatetime.getHours() + 2)

    fs.appendFile(fileName, currentDatetime.toISOString().replace(/T/, ' ').replace(/\..+/, '') + content, err => {
        if (err) {
            console.error(err);
        }
    });
}

function writeToken(path, token) {
    if (token) {
        fs.writeFile(path, token, err => {
            if (err) {
                writeLog('log/webApp.log', err);
            }
        });
    }
}

function getToken(path) {
    try {
        const data = fs.readFileSync(path, 'utf8');
        return data;
    } catch (err) {
        writeLog('log/webApp.log', err);
    }
}
