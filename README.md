# Twitch Chatbot with Spotify Integration for Song Requests and Clips

This is a Twitch chatbot that integrates with Spotify to provide music-related commands for your Twitch channel. The bot supports the following commands:

- Viewers can use Twitch rewards to make song requests
- `!song`: Posts the current playing song in the chat.
- `!song 2`: Posts the recently played songs, up to 50.
- `!clip`: Creates a clip and posts the link to the clip in the chat.

## Setup

### Requirements

- [Node.js](https://nodejs.org/) (version 12 or higher)
- [tmi.js](https://github.com/tmijs/tmi.js) (Twitch Messaging Interface library)
- Twitch Bot Account (for the bot to connect to Twitch)
- Twitch Client ID and Secret (for authentication with Twitch API)
- Spotify Developer Account (for authentication with Spotify API)
- Spotify Application ID and Secret (for authentication with Spotify API)

### Installation

1. Clone this repository or download the source code.
2. Install the required dependencies by running `npm install` in the project root directory.
3. Create a `.env` file in the project root directory and add the following variables:

```
TWITCH_CHANNEL="ChannelName"
TWITCH_BOT_USERNAME=your_twitch_bot_username
TWITCH_CLIENT_ID=your_twitch_client_id
TWITCH_CLIENT_SECRET=your_twitch_client_secret
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
TWITCH_REWARD_ID=your_twitch_reward_id
SONG_REQUESTS=true
```

TWITCH_CHANNEL accepts a comma separated list: TWITCH_CHANNEL="Channel1,Channl2,Channel3"
You can obtain the `TWITCH_BOT_PASSWORD`, `TWITCH_CLIENT_ID`, and `TWITCH_CLIENT_SECRET` by creating a new Twitch application in the Twitch Developer Dashboard. You can obtain the `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` by creating a new Spotify application in the Spotify Developer Dashboard.

If you want to use the song requests per twitch reward, you also need to set SONG_REQUESTS to true.
Also you have to specify the reward id of the twitch reward, that should trigger the bot to put the song into the queue.

4. After downloading the repository, you will need to generate a certificate and key and place them in the `/src/certificates/` directory.

5. Start the bot by running `npm start` in the project root directory.

### Usage

Once the bot is running, you can log in to the bot account using `https://localhost/twitchLogin`. The bot will automatically refresh its tokens.

To allow the bot to access the Streamer's Spotify account, the Streamer will need to log in using `https://localhost/spotifyLogin`.
The bot will then be able to make song requests and provide information on the currently playing song.

Once the stup is done, the bot will listen for commands in your Twitch chat. Use the following commands to interact with the bot:
- Viewers can use Twitch rewards to make song requests
- `!song`: Posts the current playing song in the chat.
- `!song 2`: Posts the recently played songs, up to 50.
- `!clip`: Creates a clip and posts the link to the clip in the chat. Doesn't require twitch login.

## Credits

This chatbot was created by Janik Ahlers and is licensed under the [MIT License](LICENSE). Please feel free to modify and use this code as you wish.
This bot is built using Node.js and the following libraries:

- tmi.js (https://github.com/tmijs/tmi.js/)
- node-fetch (https://github.com/node-fetch/node-fetch)
- querystring (https://github.com/Gozala/querystring)
- dotenv (https://github.com/motdotla/dotenv)
- `express` module (https://github.com/expressjs/express)
