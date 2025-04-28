require('dotenv/config');
const votingStatus = require('./votingStatus');
// const mongoose = require('mongoose'); // Mongoose 대신 Prisma 사용
const { Client, IntentsBitField, GatewayIntentBits, Events } = require('discord.js');
const { CommandHandler } = require('djs-commander');
const path = require('path');
const moment = require('moment-timezone');
const prisma = require('./utils/prisma'); // Prisma 싱글톤 인스턴스 가져오기
const guildMemberUpdateHandler = require('./events/guildMemberUpdate/guildMemberUpdate');
const guildMemberAddHandler = require('./events/guildMemberAdd/guildMemberAdd');

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

// 음성 채널에 참여한 사용자 목록
const voiceUser = [];

// 봇의 ready 이벤트가 이미 처리되었는지 추적
let isReadyEventHandled = false;

// 서버 재시작 시 현재 음성 채널에 있는 유저들의 정보를 가져오는 함수
async function initVoiceUsers() {
    try {
        // 서버 ID 가져오기
        const serverId =
            process.env.NODE_ENV === 'development' ? process.env.TEST_SERVER_ID : process.env.PRODUCTION_SERVER_ID;

        // 서버 정보 가져오기
        const guild = await client.guilds.fetch(serverId);
        if (!guild) {
            console.error('서버를 찾을 수 없습니다.');
            return;
        }

        // 음성 채널 상태 확인
        const voiceChannels = guild.channels.cache.filter(channel => channel.type === 2 /* 음성 채널 타입 */);

        // voiceUser 배열 초기화
        voiceUser.length = 0;

        // 각 음성 채널에 있는 사용자 정보 수집
        voiceChannels.forEach(channel => {
            channel.members.forEach(member => {
                if (!voiceUser.includes(member.displayName)) {
                    voiceUser.push(member.displayName);
                    console.log(`음성 채널 초기화: ${member.displayName}님이 ${channel.name} 채널에 접속 중입니다.`);
                }
            });
        });

        console.log(`음성 채널 초기화 완료: 총 ${voiceUser.length}명의 사용자가 음성 채널에 접속 중입니다.`);
    } catch (error) {
        console.error('음성 채널 사용자 초기화 중 오류 발생:', error);
    }
}

async function connectDB() {
    try {
        // 기존 Mongoose 연결 코드 주석 처리
        // await mongoose.connect(process.env.DB_URI, {
        //     dbName: process.env.NODE_ENV === 'development' ? 'testDB' : 'productionDB',
        // });

        // Prisma는 자동으로 .env의 DATABASE_URL을 사용하여 연결하므로 별도의 연결 코드가 필요 없음
        // 단, Prisma 클라이언트가 정상적으로 연결되었는지 테스트
        try {
            // MongoDB에 적합한 연결 테스트
            await prisma.$connect();
            console.log('Connected to MongoDB via Prisma');
        } catch (prismaErr) {
            console.error('Prisma connection test failed:', prismaErr);
        }

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

        // console.log('Connected to mongoDB');
    } catch (err) {
        console.log(`Error connecting to services: ${err}`);
    }
}

new CommandHandler({
    client,
    commandsPath: path.join(__dirname, 'slash-commands'),
    eventsPath: path.join(__dirname, 'events'),
});

connectDB();

// 봇이 준비되면 음성 채널 사용자 초기화
client.once('ready', async () => {
    // 중복 실행 방지
    if (isReadyEventHandled) {
        console.log('Ready 이벤트가 이미 처리되었습니다. 중복 실행 방지');
        return;
    }

    isReadyEventHandled = true;
    console.log(`${client.user.tag} is online. - ${moment().tz('Asia/seoul').format('YYYY-MM-DD HH:mm:ss')}`);

    // 음성 채널 사용자 초기화
    await initVoiceUsers();

    // 투표 상태 복원
    try {
        await votingStatus.restoreVotingStatus(client);
        console.log('투표 상태 복원 완료');
    } catch (error) {
        console.error('투표 상태 복원 중 오류 발생:', error);
    }
});

client.on('messageCreate', msg => {
    const moment = require('moment-timezone');
    const krTime = moment().tz('Asia/seoul').format(`YYYY-MM-DD HH:mm:ss`);
    console.log(`${msg.author.username} : ${msg.content} - ${krTime}`);
});

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

// 닉네임 변경 이벤트 감지
client.on(Events.GuildMemberUpdate, guildMemberUpdateHandler);

// 새 멤버 입장 감지
client.on(Events.GuildMemberAdd, guildMemberAddHandler);

// 애플리케이션 종료 시 Prisma 클라이언트 연결 종료
process.on('beforeExit', async () => {
    await prisma.$disconnect();
    console.log('Disconnected from Prisma');
});

module.exports = { voiceUser, client, prisma }; // prisma 클라이언트도 내보내기
