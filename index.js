require('dotenv/config');
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

new CommandHandler({
    client,
    commandsPath: path.join(__dirname, 'slash-commands'),
    eventsPath: path.join(__dirname, 'events'),
});

client.login(process.env.DICO_TOKEN);

client.on('messageCreate', msg => {
    console.log(`${msg.author.username} : ${msg.content}`);
});
