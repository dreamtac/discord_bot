const { client } = require('../index');
const dotenv = require('dotenv');

dotenv.config();

const isDevMode = process.env.NODE_ENV === 'development';

// Discord 메시지 전송 함수
async function sendDiscordMessage(messageContent) {
    const channelId = isDevMode ? process.env.TEST_CHANNEL_ID : process.env.PRODUCTION_CHANNEL_ID;

    try {
        client.channels.cache.get(channelId).send(messageContent);
        // // 채널 가져오기
        // const channel = await client.channels.fetch(channelId);

        // // 채널이 존재할 경우 메시지 전송
        // if (channel) {
        //     await channel.send(messageContent);
        //     console.log('Message sent to Discord channel.');
        // } else {
        //     console.error('Channel not found');
        // }
    } catch (error) {
        console.error('Failed to send message to Discord:', error);
    }
}

module.exports = { sendDiscordMessage };
