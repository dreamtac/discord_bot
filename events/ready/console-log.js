const moment = require('moment-timezone');
const krTime = moment().tz('Asia/seoul').format(`YYYY-MM-DD HH:mm:ss`);
const cron = require('node-cron');
const prisma = require('../../utils/prisma');
const votingStatus = require('../../votingStatus');
const { default: axios } = require('axios');

module.exports = async client => {
    console.log(`${client.user.username} is online. - ${krTime}`);

    // 투표 상태 복원은 index.js에서 처리합니다. 중복 실행 방지.
    // await restoreVotingStatus(client);

    cron.schedule('0 0 21 * * *', async () => {
        const currentTime = moment().tz('Asia/seoul').format(`YYYY-MM-DD HH:mm:ss`);
        console.log(`매일 밤 9:00 cron 실행 - ${currentTime}`);

        try {
            // 활성화된 투표가 있는지 확인
            const activeVote = await prisma.vote.findFirst({
                where: { isActive: true },
            });

            if (!activeVote) {
                console.log('cron 실행 - 진행 중인 투표가 없습니다.');
                return;
            }

            try {
                // 투표 비활성화 처리
                await prisma.vote.update({
                    where: { id: activeVote.id },
                    data: { isActive: false },
                });

                const voteStatus = await prisma.voteStatus.findMany({
                    where: {
                        voteId: activeVote.id,
                    },
                    select: {
                        status: true,
                        number: true,
                        user: {
                            select: {
                                displayName: true,
                            },
                        },
                    },
                });

                // 호환성을 위해 기존 votingStatus도 종료 처리
                votingStatus.closeVoting();

                await axios.post(process.env.NEXT_URL + '/api/vote/discord', {
                    title: activeVote.title,
                    description: activeVote.description,
                    date: activeVote.data,
                    region: activeVote.region,
                    voteStatus: voteStatus,
                });

                console.log(`cron - 투표 ID:${activeVote.id}가 종료되었습니다.`);
            } catch (err) {
                console.log('cron - 투표 종료 중 오류 발생:', err);
            }
        } catch (error) {
            console.log('cron - 오류 발생:', error);
        }
    });
};
