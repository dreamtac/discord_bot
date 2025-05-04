const { EmbedBuilder } = require('discord.js');
const votingStatus = require('../votingStatus');
const prisma = require('../utils/prisma'); // Prisma 싱글톤 인스턴스 가져오기
const { default: axios } = require('axios');

module.exports = {
    run: async ({ interaction }) => {
        await interaction.deferReply({ ephemeral: true });

        // 활성화된 투표가 있는지 확인
        const activeVote = await prisma.vote.findFirst({
            where: { isActive: true },
        });

        if (!activeVote) {
            await interaction.editReply({ content: '진행 중인 투표가 없습니다.', ephemeral: true });
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

            await interaction.editReply({ content: '투표가 종료되었습니다.', ephemeral: true });
            console.log(`투표 ID:${activeVote.id}가 종료되었습니다.`);
        } catch (err) {
            console.error('투표 종료 중 오류 발생:', err);
            await interaction.editReply({ content: '투표 종료 중 오류가 발생했습니다.', ephemeral: true });
        }
    },

    data: {
        name: '종료',
        description: '현재 진행 중인 투표를 종료합니다.',
    },
};
