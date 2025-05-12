const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
// Mongoose 모델 대신 Prisma 사용
// const MemberDB = require('./models/memberDB');
// const VotingState = require('./models/votingStateDB');
const moment = require('moment-timezone');
const prisma = require('./utils/prisma');

// 메모리 캐시 (성능 최적화용)
let votingStatus = {}; // 각 유저별 투표 상태를 저장할 객체
let order = []; // 투표 순서 기록용 배열
let votingClosed = true; // 투표 종료 상태를 관리하는 변수
let activeVoteId = null; // 현재 활성화된 투표 ID
let votingMessage = null; // 현재 투표 메시지

//투표 종료후 투표 데이터 저장
let lastVotingStatus = null;
let lastOrder = null;
let lastVoteId = null;

// 투표 상태를 DB에서 메모리로 로드하는 함수
async function loadVotingStatusFromDB() {
    try {
        // 활성화된 투표 찾기
        const activeVote = await prisma.vote.findFirst({
            where: { isActive: true },
            include: {
                voteStatus: {
                    include: {
                        user: true,
                    },
                    orderBy: {
                        number: 'asc',
                    },
                },
            },
        });

        if (!activeVote) {
            console.log('활성화된 투표가 없습니다.');
            votingClosed = true;
            votingStatus = {};
            order = [];
            activeVoteId = null;
            return false;
        }

        // 메모리 상태 초기화
        votingClosed = false;
        activeVoteId = activeVote.id;
        votingStatus = {};
        order = [];

        // 투표 상태 로드
        activeVote.voteStatus.forEach(status => {
            const userDisplayName = status.user.displayName;
            votingStatus[userDisplayName] = status.status;

            // 순서 업데이트
            if ((status.status === '우선참여' || status.status === '참여') && status.number) {
                // number 값이 있으면 해당 위치에 삽입
                while (order.length < status.number) {
                    order.push(null);
                }
                order[status.number - 1] = userDisplayName;
            }
        });

        // 배열에서 null 값 제거 (압축)
        order = order.filter(item => item !== null);

        console.log(`투표 상태가 DB에서 로드되었습니다. 총 ${Object.keys(votingStatus).length}명의 상태가 로드됨.`);
        return true;
    } catch (err) {
        console.error('DB에서 투표 상태 로드 중 오류 발생:', err);
        return false;
    }
}

// 큐 시스템 (동시성 문제 방지)
let queue = [];
let queueRunning = false;

const runQueue = async () => {
    while (queue.length > 0) {
        const task = queue.shift();
        await task();
    }
    queueRunning = false;
};

module.exports = {
    // 현재 투표 메시지 설정
    setMessage: async message => {
        votingMessage = message;

        try {
            // 활성화된 투표 재확인
            const activeVote = await prisma.vote.findFirst({
                where: { isActive: true },
            });

            if (activeVote) {
                activeVoteId = activeVote.id;
                console.log(`활성화된 투표 ID:${activeVote.id}에 메시지 연결됨`);
            } else {
                console.log('활성화된 투표가 없습니다.');
            }
        } catch (err) {
            console.error('투표 메시지 설정 중 오류 발생:', err);
        }
    },

    // 메시지 객체 반환
    getMessage: () => votingMessage,

    // 현재 메모리에 있는 투표 상태 반환 (실시간 응답용)
    getStatus: () => votingStatus,

    // 투표 상태 설정 (활성화/비활성화)
    setVotingActiveStatus: status => {
        votingClosed = !status; // status가 true면 votingClosed는 false
        console.log(`투표 상태가 ${status ? '활성화' : '비활성화'}되었습니다.`);
    },

    // 사용자의 투표 상태 설정 (DB 동기화 포함)
    setStatus: async (userId, status) => {
        // userId가 유효한지 확인
        if (!userId) {
            console.error('유효하지 않은 userId:', userId);
            return;
        }

        // 투표가 종료되었는지 확인
        if (votingClosed) {
            console.log('투표가 종료되어 상태를 변경할 수 없습니다.');
            return;
        }

        // 활성화된 투표가 없으면 상태 로드 시도
        if (!activeVoteId) {
            await loadVotingStatusFromDB();
            if (!activeVoteId) {
                console.error('활성화된 투표가 없어 상태를 변경할 수 없습니다.');
                return;
            }
        }

        // 큐에 작업 추가 (비동기 작업 관리)
        await new Promise(resolve => {
            queue.push(async () => {
                try {
                    // 메모리 상태 업데이트
                    votingStatus[userId] = status;

                    // order 배열에서 해당 userId 모두 제거
                    order = order.filter(uid => uid !== userId);

                    let number = null;

                    // 참여 상태일 경우 순서 업데이트
                    if (status === '우선참여' || status === '참여') {
                        order.push(userId);
                        // 여기서 number를 단순히 배열 인덱스 + 1로 할당하지 않고
                        // DB에서 현재 사용 중인 최대 번호를 가져와 중복을 방지
                        try {
                            // 1. 사용자 검색
                            const user = await prisma.user.findFirst({
                                where: { displayName: userId },
                            });

                            if (!user) {
                                console.error(`사용자를 찾을 수 없음: ${userId}`);
                                resolve();
                                return;
                            }

                            // 2. 현재 투표의 최대 number 값 가져오기
                            const maxNumberResult = await prisma.voteStatus.findMany({
                                where: {
                                    voteId: activeVoteId,
                                    number: { not: null },
                                },
                                orderBy: {
                                    number: 'desc',
                                },
                                take: 1,
                            });

                            // 3. 최대값 + 1로 새 번호 할당
                            const maxNumber = maxNumberResult.length > 0 ? maxNumberResult[0].number : 0;
                            number = maxNumber + 1;

                            // 4. 배열 내의 위치도 조정 (필요하면 빈칸을 채워 number와 일치시킴)
                            while (order.length < number) {
                                order.push(null);
                            }
                            // 마지막 위치에 userId 설정
                            order[number - 1] = userId;

                            // 5. null 제거 (압축)
                            order = order.filter(item => item !== null);

                            // 6. 투표 상태 업데이트
                            await prisma.voteStatus.updateMany({
                                where: {
                                    userId: user.id,
                                    voteId: activeVoteId,
                                },
                                data: {
                                    status,
                                    number,
                                    date: new Date(),
                                },
                            });

                            console.log(
                                `${userId}님의 투표 상태가 '${status}'로 업데이트되었습니다. (순번: ${
                                    number || '없음'
                                })`
                            );
                        } catch (dbErr) {
                            console.error('투표 상태 DB 업데이트 중 오류 발생:', dbErr);
                        }
                    } else if (status === '불참' || status === '미투표') {
                        // 불참 또는 미투표인 경우 배열에서 제거만 하면 됨
                        number = null;

                        try {
                            // 사용자 검색
                            const user = await prisma.user.findFirst({
                                where: { displayName: userId },
                            });

                            if (!user) {
                                console.error(`사용자를 찾을 수 없음: ${userId}`);
                                resolve();
                                return;
                            }

                            // 투표 상태 업데이트
                            await prisma.voteStatus.updateMany({
                                where: {
                                    userId: user.id,
                                    voteId: activeVoteId,
                                },
                                data: {
                                    status,
                                    number: null,
                                    date: new Date(),
                                },
                            });

                            console.log(`${userId}님의 투표 상태가 '${status}'로 업데이트되었습니다. (순번: 없음)`);
                        } catch (dbErr) {
                            console.error('투표 상태 DB 업데이트 중 오류 발생:', dbErr);
                        }
                    }
                } catch (err) {
                    console.error('Error processing task:', err);
                } finally {
                    resolve();
                }
            });

            if (!queueRunning) {
                queueRunning = true;
                runQueue();
            }
        });
    },

    // 투표 초기화 및 시작
    openVoting: async () => {
        //************초기화 코드************//
        order = []; // 기존 배열 초기화
        votingStatus = {}; // 유저별 투표 상태 초기화
        queue = []; // 비동기 작업 큐 초기화
        queueRunning = false; // 큐 작업 상태 초기화
        votingClosed = true; // 투표 종료 상태로 초기화
        //************초기화 코드************//

        // 메모리 상태를 DB와 동기화
        await loadVotingStatusFromDB();

        votingClosed = false;
        const krTime = moment().tz('Asia/seoul').format(`YYYY-MM-DD HH:mm:ss`);
        console.log(`투표 시작됨! - ${krTime}`);
    },

    // 투표 종료
    closeVoting: async () => {
        try {
            // 활성화된 투표가 있다면 비활성화
            await prisma.vote.updateMany({
                where: { isActive: true },
                data: { isActive: false },
            });

            lastVotingStatus = { ...votingStatus };
            lastOrder = { ...order };
            lastVoteId = activeVoteId;

            // 메모리 상태 초기화
            activeVoteId = null;
            votingClosed = true;

            const krTime = moment().tz('Asia/seoul').format(`YYYY-MM-DD HH:mm:ss`);
            console.log(`투표 종료됨! - ${krTime}`);
        } catch (err) {
            console.error('투표 종료 중 오류 발생:', err);
        }
    },

    // 투표 종료 상태 확인
    isVotingClosed: () => {
        return votingClosed;
    },

    // DB에서 투표 종료 상태 확인 (필요시 DB 조회)
    checkVotingClosedInDB: async () => {
        // DB에서도 확인
        if (!votingClosed) {
            try {
                const activeVote = await prisma.vote.findFirst({
                    where: { isActive: true },
                });

                // DB에 활성화된 투표가 없으면 종료 상태로 설정
                if (!activeVote) {
                    votingClosed = true;
                    activeVoteId = null;
                }
            } catch (err) {
                console.error('투표 상태 확인 중 오류 발생:', err);
            }
        }

        return votingClosed;
    },

    // 투표 결과 계산
    getResult: (forceRefresh = false) => {
        // DB에서 최신화는 비동기로 별도 함수로 분리
        if (forceRefresh) {
            console.log(
                '※ 강제 새로고침 요청됨 - getResult(true)는 비추천, refreshFromDB() 후 getResult()를 사용하세요.'
            );
        }

        // 현재 메모리에 있는 상태로 결과 계산
        if (votingClosed) {
            votingStatus = lastVotingStatus;
            order = lastOrder;
        }

        const totalUsers = Object.keys(votingStatus).length;
        const specialParticipated = Object.values(votingStatus).filter(status => status === '우선참여').length;
        const participated = Object.values(votingStatus).filter(status => status === '참여').length;
        const notParticipated = Object.values(votingStatus).filter(status => status === '불참').length;
        const notVoted = Object.values(votingStatus).filter(status => status === '미투표').length;
        const voteRate = `${specialParticipated + participated + notParticipated}/${totalUsers}`;

        // 참여자 정렬된 목록 생성
        let specialParticipatedUser = [];
        let participatedUser = [];

        // 순서대로 참여자 추가
        order.forEach(userId => {
            if (votingStatus[userId] === '우선참여') {
                specialParticipatedUser.push(userId);
            } else if (votingStatus[userId] === '참여') {
                participatedUser.push(userId);
            }
        });

        // 순서 없는 경우를 위한 백업 처리
        const allParticipants = Object.entries(votingStatus);

        // 우선참여 사용자 중 누락된 사용자 추가
        allParticipants.forEach(([userId, status]) => {
            if (status === '우선참여' && !specialParticipatedUser.includes(userId)) {
                specialParticipatedUser.push(userId);
            }
        });

        // 참여 사용자 중 누락된 사용자 추가
        allParticipants.forEach(([userId, status]) => {
            if (status === '참여' && !participatedUser.includes(userId)) {
                participatedUser.push(userId);
            }
        });

        // 불참 사용자 목록
        const notParticipatedUser = allParticipants
            .filter(([userId, status]) => status === '불참')
            .map(([userId]) => userId);

        // 미투표 사용자 목록
        const notVotedUser = allParticipants
            .filter(([userId, status]) => status === '미투표')
            .map(([userId]) => userId);

        return {
            totalUsers,
            specialParticipated,
            participated,
            notParticipated,
            notVoted,
            voteRate,
            specialParticipatedUser: specialParticipatedUser || [],
            participatedUser: participatedUser || [],
            notParticipatedUser: notParticipatedUser || [],
            notVotedUser: notVotedUser || [],
        };
    },

    // DB에서 결과 새로고침 후 반환 (비동기 함수)
    getResultFromDB: async () => {
        // DB에서 상태 최신화
        await loadVotingStatusFromDB();
        // 최신화된 상태로 결과 계산
        return module.exports.getResult(false);
    },

    // 서버 재시작 시 투표 상태 복원
    restoreVotingStatus: async client => {
        try {
            // DB에서 상태 로드
            const success = await loadVotingStatusFromDB();

            if (success) {
                // 활성화된 투표가 있을 경우 메시지 재생성
                const activeVote = await prisma.vote.findFirst({
                    where: { isActive: true },
                });

                if (activeVote) {
                    await restoreVotingMessage(client, activeVote);
                    console.log('투표 상태가 복원되었습니다.');
                }
            }
        } catch (err) {
            console.error('투표 상태 복원 중 오류 발생:', err);
        }
    },

    // DB 상태 새로고침
    refreshFromDB: async () => {
        return await loadVotingStatusFromDB();
    },

    // 내부 순서 배열 접근 (닉네임 변경 처리용)
    _getOrder: () => {
        return order;
    },
};

// 투표 메시지 복원 함수
async function restoreVotingMessage(client, activeVote) {
    try {
        // 먼저 DB에서 해당 투표 메시지 ID 확인
        const existingVoteMessage = await prisma.voteMessage.findFirst({
            where: { voteId: activeVote.id },
        });

        // 이미 메시지가 존재하는 경우 복원 작업 중지
        if (existingVoteMessage && existingVoteMessage.messageId) {
            console.log(`이미 투표 메시지가 존재합니다. 메시지 ID: ${existingVoteMessage.messageId}`);

            // 기존 메시지 가져오기 시도
            try {
                const guild =
                    process.env.NODE_ENV === 'development'
                        ? await client.guilds.fetch(process.env.TEST_SERVER_ID)
                        : await client.guilds.fetch(process.env.PRODUCTION_SERVER_ID);

                const channel =
                    process.env.NODE_ENV === 'development'
                        ? await guild.channels.fetch(process.env.TEST_CHANNEL_ID)
                        : await guild.channels.fetch(process.env.PRODUCTION_CHANNEL_ID);

                // 기존 메시지 가져오기 시도
                try {
                    const existingMessage = await channel.messages.fetch(existingVoteMessage.messageId);
                    if (existingMessage) {
                        module.exports.setMessage(existingMessage); // 기존 메시지 저장
                        console.log('기존 투표 메시지를 찾아 연결했습니다.');
                        return; // 함수 종료
                    }
                } catch (fetchError) {
                    console.log('기존 메시지를 가져올 수 없어 새 메시지를 생성합니다:', fetchError.message);
                    // 메시지를 가져오지 못한 경우 새 메시지 생성 진행
                }
            } catch (error) {
                console.error('채널 또는 서버 가져오기 중 오류 발생:', error);
            }
        }

        // 서버 객체 및 채널 객체 가져오기
        const guild =
            process.env.NODE_ENV === 'development'
                ? await client.guilds.fetch(process.env.TEST_SERVER_ID)
                : await client.guilds.fetch(process.env.PRODUCTION_SERVER_ID);

        const channel =
            process.env.NODE_ENV === 'development'
                ? await guild.channels.fetch(process.env.TEST_CHANNEL_ID)
                : await guild.channels.fetch(process.env.PRODUCTION_CHANNEL_ID);

        // 새 메시지 생성을 위한 임베드 및 버튼 설정 - /투표 명령어와 동일한 디자인 사용
        const embed = new EmbedBuilder()
            .setColor(0x5865f2) // 디스코드 브랜드 컬러로 변경
            .setTitle(`📢 공성/거점 투표`)
            .setDescription(`${activeVote.description || '서버 재시작으로 복원된 투표입니다.'}`)
            .addFields(
                { name: '📅 일시', value: `\`${activeVote.date || '정보 없음'}\``, inline: true },
                { name: '🗺️️ 지역', value: `\`${activeVote.region || '정보 없음'}\``, inline: true },
                { name: '\u200B', value: '\u200B', inline: true }, // 빈 필드로 줄 맞춤
                {
                    name: '📌 주의사항',
                    value: '투표 인원이 몰리면 속도가 느려질 수 있습니다.\n투표를 여러번 누르면 순번이 밀려날 수 있으니 주의해주세요.',
                }
            )
            .setFooter({
                text: '상호작용 오류 발생 시 10초 후 다시 시도해주세요',
            });

        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setLabel('우선참여 (특수병)').setCustomId('btnFirstTrue').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setLabel('참여').setCustomId('btnTrue').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setLabel('불참').setCustomId('btnFalse').setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setLabel('참여 현황')
                .setCustomId('btnResultParticipated')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setLabel('불참/미투표 현황')
                .setCustomId('btnResultNotParticipated')
                .setStyle(ButtonStyle.Secondary)
        );

        // 이전 메시지 삭제 시도
        if (votingMessage) {
            try {
                await votingMessage.delete();
                console.log('이전 투표 메시지가 삭제되었습니다.');
            } catch (error) {
                console.error('이전 투표 메시지 삭제 중 오류 발생:', error);
            }
        }

        // 새로운 메시지를 생성하고 저장
        const message = await channel.send({ embeds: [embed], components: [buttons] });
        module.exports.setMessage(message); // 메시지 저장

        // 메시지 ID를 DB에 저장 또는 업데이트
        await prisma.voteMessage.upsert({
            where: { voteId: activeVote.id },
            update: { messageId: message.id },
            create: { voteId: activeVote.id, messageId: message.id },
        });

        console.log(`투표 메시지가 생성되고 ID(${message.id})가 DB에 저장되었습니다.`);
    } catch (err) {
        console.error('투표 메시지 복원 중 오류 발생:', err);
    }
}
