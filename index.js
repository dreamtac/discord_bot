require('dotenv/config');
const votingStatus = require('./votingStatus');
const mongoose = require('mongoose');
const { Client, IntentsBitField, GatewayIntentBits } = require('discord.js');
const { CommandHandler } = require('djs-commander');
const path = require('path');
const moment = require('moment-timezone');

const client = new Client({
    intents: [
        IntentsBitField.Flags.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
    ],
});

async function connectDB() {
    try {
        await mongoose.connect(process.env.DB_URI, {
            dbName: process.env.NODE_ENV === 'development' ? 'testDB' : 'productionDB',
        });

        await client.login(
            process.env.NODE_ENV === 'development' ? process.env.DICO_TOKEN_TEST : process.env.DICO_TOKEN
        );
        console.log('Connected to Discord');

        // client가 ready 상태가 된 후에 투표 복구를 시도
        // client.once('ready', async () => {
        //     console.log('Bot is ready');
        //     try {
        //         await votingStatus.restoreVotingStatus(client);
        //         console.log('Voting status restored successfully');
        //     } catch (error) {
        //         console.error('Error restoring voting status:', error);
        //     }
        // });

        console.log('Connected to mongoDB');
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

const voiceUser = [];

client.on('voiceStateUpdate', (oldState, newState) => {
    const user = newState.member.displayName;
    // console.log(newState.member.nickname);
    // 유저가 음성 채널에 새로 들어온 경우
    if (!oldState.channelId && newState.channelId) {
        voiceUser.push(user);
        console.log(
            `${user} has joined the voice channel: ${newState.channel.name} at ${moment()
                .tz('Asia/seoul')
                .format('YYYY-MM-DD HH:mm:ss')}`
        );
    }

    // 유저가 음성 채널에서 나간 경우
    if (oldState.channelId && !newState.channelId) {
        voiceUser.splice(voiceUser.indexOf(user), 1);
        console.log(
            `${user} has left the voice channel: ${oldState.channel.name} at ${moment()
                .tz('Asia/seoul')
                .format('YYYY-MM-DD HH:mm:ss')}`
        );
    }

    // 유저가 음성 채널을 이동한 경우
    if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
        console.log(
            `${user} moved from ${oldState.channel.name} to ${newState.channel.name} at ${moment()
                .tz('Asia/seoul')
                .format('YYYY-MM-DD HH:mm:ss')}`
        );
    }
});

module.exports = { voiceUser, client };
