const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
// Mongoose 모델 대신 Prisma 사용
// const MemberDB = require('./models/memberDB');
// const VotingState = require('./models/votingStateDB');
const moment = require('moment-timezone');
const { PrismaClient } = require('./generated/prisma');

// Prisma 클라이언트 초기화
const prisma = new PrismaClient();

let votingStatus = {}; // 각 유저별 투표 상태를 저장할 객체
let order = []; // 투표 순서 기록용 배열
let votingClosed = true; // 투표 종료 상태를 관리하는 변수

let queue = [];
let queueRunning = false;
let votingMessage = null;

// 큐에 있는 작업들(task) 가 0개가 될 때까지 하나씩 꺼내서 실행.
// 작업들은 유저가 우선참여, 참여, 불참 버튼을 눌렀을때 수행하는 작업들을 의미.
const runQueue = async () => {
    while (queue.length > 0) {
        // console.log('큐 작업중...');
        const task = queue.shift();
        await task();
    }
    queueRunning = false;
};

module.exports = {
    setMessage: async message => {
        // todo: db에 객체 저장
        votingMessage = message;

        // Mongoose 대신 Prisma 사용
        // await VotingState.findOneAndUpdate({}, { closed: false }, { upsert: true });

        // 실제 구현에서는 활성화된 투표가 있는지 찾아서 메시지를 연결
        try {
            const activeVote = await prisma.vote.findFirst({
                where: { isActive: true },
            });

            if (activeVote) {
                console.log(`활성화된 투표 ID:${activeVote.id}에 메시지 연결됨`);
            } else {
                console.log('활성화된 투표가 없습니다.');
            }
        } catch (err) {
            console.error('투표 메시지 설정 중 오류 발생:', err);
        }
    },
    getMessage: () => votingMessage,
    getStatus: () => votingStatus,
    setVotingActiveStatus: status => {
        votingClosed = !status; // status가 true면 votingClosed는 false
        console.log(`투표 상태가 ${status ? '활성화' : '비활성화'}되었습니다.`);
    },
    setStatus: async (userId, status) => {
        // userId가 유효한지 확인
        if (!userId) {
            console.error('유효하지 않은 userId:', userId);
            return; // 유효하지 않으면 처리하지 않음
        }

        if (!votingClosed) {
            // console.log('큐에 작업 추가 중...');
            await new Promise(resolve => {
                queue.push(async () => {
                    try {
                        // console.log('Processing queue task for: ', userId);
                        votingStatus[userId] = status;
                        const existingIndex = order.indexOf(userId);

                        if (status === '우선참여' || status === '참여') {
                            if (existingIndex === -1) {
                                order.push(userId);
                            } else {
                                order[existingIndex] = null;
                                order.push(userId);
                            }

                            const krTime = moment().tz('Asia/seoul').format(`YYYY-MM-DD HH:mm:ss`);
                            let number = order.length;

                            // 이 부분은 실제 API 사용 시에 구현 필요
                            // Prisma를 사용한 업데이트는 각 명령어 파일에서 처리

                            /* Mongoose 코드 주석 처리
                            await MemberDB.findOneAndUpdate(
                                { nickName: userId },
                                { status, number: number, date: krTime },
                                { upsert: true, new: true }
                            );
                            */
                        } else if (status === '불참' || status === '미투표') {
                            if (existingIndex !== -1) {
                                order[existingIndex] = null;
                            }
                            const krTime = moment().tz('Asia/seoul').format(`YYYY-MM-DD HH:mm:ss`);

                            /* Mongoose 코드 주석 처리
                            await MemberDB.findOneAndUpdate(
                                { nickName: userId },
                                { status, number: null, date: krTime },
                                { upsert: true, new: true }
                            );
                            */
                        }
                    } catch (err) {
                        console.error('Error processing task:', err);
                    } finally {
                        // console.log('작업 완료');
                        resolve();
                    }
                });

                // console.log('queue:', queue);
                // console.log('큐 실행 준비 중...');
                if (!queueRunning) {
                    // console.log('큐 실행 시작');
                    queueRunning = true;
                    runQueue();
                }
            });
        }
    },
    openVoting: async () => {
        //************초기화 코드************//
        order = []; //기존 배열 초기화
        votingStatus = {}; // 유저별 투표 상태 초기화
        queue = []; //비동기 작업 큐 초기화
        queueRunning = false; // 큐 작업 상태 초기화
        votingClosed = true; // 투표 종료 상태로 초기화

        // Mongoose 코드 주석 처리
        // await MemberDB.collection.drop(); //컬렉션 삭제
        // await VotingState.findOneAndUpdate({}, { closed: true }, { upsert: true });

        const krTime = moment().tz('Asia/seoul').format(`YYYY-MM-DD HH:mm:ss`);
        console.log(`투표 데이터 초기화 완료! - ${krTime}`);
        //************초기화 코드************//

        votingClosed = false;
        // Mongoose 코드 주석 처리
        // await VotingState.findOneAndUpdate({}, { closed: false }, { upsert: true }); // db 투표 진행 상황 초기화
        console.log(`투표 시작됨! - ${krTime}`);
    },
    closeVoting: async () => {
        // Mongoose 코드 주석 처리
        // await VotingState.findOneAndUpdate({}, { closed: true }, { upsert: true });

        try {
            // 활성화된 투표가 있다면 비활성화
            await prisma.vote.updateMany({
                where: { isActive: true },
                data: { isActive: false },
            });
        } catch (err) {
            console.error('투표 종료 중 오류 발생:', err);
        }

        const krTime = moment().tz('Asia/seoul').format(`YYYY-MM-DD HH:mm:ss`);
        console.log(`투표 종료됨! - ${krTime}`);
        votingClosed = true;
    },
    isVotingClosed: () => {
        return votingClosed;
    },
    getResult: () => {
        const totalUsers = Object.keys(votingStatus).length;
        const specialParticipated = Object.values(votingStatus).filter(status => status === '우선참여').length;
        const participated = Object.values(votingStatus).filter(status => status === '참여').length;
        const notParticipated = Object.values(votingStatus).filter(status => status === '불참').length;
        const notVoted = Object.values(votingStatus).filter(status => status === '미투표').length;
        const voteRate = `${specialParticipated + participated + notParticipated}/${totalUsers}`;

        let specialParticipatedUser = [];
        let participatedUser = [];

        order.forEach(userId => {
            if (votingStatus[userId] === '우선참여') {
                specialParticipatedUser.push(userId);
            } else if (votingStatus[userId] === '참여') {
                participatedUser.push(userId);
            }
        });

        // 투표 상태가 '불참'인 유저 목록을 필터링
        const notParticipatedUser = Object.entries(votingStatus)
            .filter(([userId, status]) => status === '불참')
            .map(([userId]) => userId); // 참여한 유저들의 ID 목록

        // 투표 상태가 '미투표'인 유저 목록을 필터링
        const notVotedUser = Object.entries(votingStatus)
            .filter(([userId, status]) => status === '미투표')
            .map(([userId]) => userId); // 미투표 유저들의 ID 목록

        return {
            totalUsers,
            specialParticipated,
            participated,
            notParticipated,
            notVoted,
            voteRate,
            specialParticipatedUser,
            participatedUser,
            notParticipatedUser,
            notVotedUser,
        };
    },

    //서버 재시작 시 투표 상태 복원
    restoreVotingStatus: async client => {
        try {
            // Mongoose 코드 주석 처리
            // const votingState = await VotingState.findOne({});
            // if (votingState && !votingState.closed) {

            // Prisma를 사용하여 활성화된 투표 확인
            const activeVote = await prisma.vote.findFirst({
                where: { isActive: true },
                include: {
                    voteStatus: {
                        include: {
                            user: true,
                        },
                    },
                },
            });

            if (activeVote) {
                votingClosed = false; //투표가 종료되지 않았다면 투표를 자동으로 활성화 상태로 변경

                // 투표 상태 메모리에 복원
                order = [];
                votingStatus = {};

                activeVote.voteStatus.forEach(status => {
                    const userDisplayName = status.user.displayName;
                    votingStatus[userDisplayName] = status.status;

                    if (status.status === '우선참여' || status.status === '참여') {
                        // status.number가 정의되어 있는 경우에만 배열에 추가
                        if (status.number !== null && status.number !== undefined) {
                            order[status.number - 1] = userDisplayName;
                        }
                    }
                });

                await restoreVotingMessage(client, activeVote);
                console.log('투표 상태가 복원되었습니다.');
            }
        } catch (err) {
            console.error('투표 상태 복원 중 오류 발생:', err);
        }
    },
};

async function restoreVotingMessage(client, activeVote) {
    const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle('공성/거점 투표')
        .addFields(
            { name: '일시', value: activeVote.date || '서버 재시작 후 투표 복구됨' },
            { name: '안내 사항', value: activeVote.description || '예기치 못한 에러로 복구된 투표입니다.' }
        )
        .setFooter({ text: '• 상호작용 실패 문구가 뜨면 잠시후(10초) 다시 시도해 주세요 •' });

    const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel('우선참여 (특수병)').setCustomId('btnFirstTrue').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setLabel('참여').setCustomId('btnTrue').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setLabel('불참').setCustomId('btnFalse').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setLabel('참여 현황').setCustomId('btnResultParticipated').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setLabel('불참/미투표 현황')
            .setCustomId('btnResultNotParticipated')
            .setStyle(ButtonStyle.Secondary)
    );

    // 이전 메시지 삭제
    if (votingMessage) {
        try {
            await votingMessage.delete(); // 이전 메시지 삭제
            console.log('이전 투표 메시지가 삭제되었습니다.');
        } catch (error) {
            console.error('이전 투표 메시지 삭제 중 오류 발생:', error);
        }
    }

    const guild =
        process.env.NODE_ENV === 'development'
            ? await client.guilds.fetch(process.env.TEST_SERVER_ID)
            : await client.guilds.fetch(process.env.PRODUCTION_SERVER_ID); // 서버 ID 가져오기

    const channel =
        process.env.NODE_ENV === 'development'
            ? await guild.channels.fetch(process.env.TEST_CHANNEL_ID)
            : await guild.channels.fetch(process.env.PRODUCTION_CHANNEL_ID); // 채널 ID 가져오기

    // 새로운 메시지를 생성하고 저장
    const message = await channel.send({ embeds: [embed], components: [buttons] });
    module.exports.setMessage(message); // 메시지 저장
    console.log('투표 메시지가 복구되었습니다.');
}
