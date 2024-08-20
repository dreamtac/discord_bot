require('dotenv/config');
const votingStatus = require('./votingStatus');
const mongoose = require('mongoose');
const { Client, IntentsBitField, GatewayIntentBits } = require('discord.js');
const { CommandHandler } = require('djs-commander');
const path = require('path');

const client = new Client({
    intents: [
        IntentsBitField.Flags.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.Guilds,
    ],
});

async function connectDB() {
    try {
        await mongoose.connect(process.env.DB_URI);
        await votingStatus.restoreVotingStatus();
        console.log('Connected to mongoDB');
        // client.login(process.env.DICO_TOKEN);
        client.login(process.env.DICO_TOKEN_TEST);
    } catch (err) {
        console.log(`Error connecting to DB: ${err}`);
    }
}

new CommandHandler({
    client,
    commandsPath: path.join(__dirname, 'slash-commands'),
    eventsPath: path.join(__dirname, 'events'),
});

connectDB();

client.on('messageCreate', msg => {
    const moment = require('moment-timezone');
    const krTime = moment().tz('Asia/seoul').format(`YYYY-MM-DD HH:mm:ss`);
    console.log(`${msg.author.username} : ${msg.content} - ${krTime}`);
});
