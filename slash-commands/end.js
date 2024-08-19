const { EmbedBuilder } = require('discord.js');
const votingStatus = require('../votingStatus');

module.exports = {
    run: async ({ interaction }) => {
        await interaction.deferReply({ ephemeral: true });
        if (votingStatus.isVotingClosed()) {
            await interaction.editReply({ content: '진행 중인 투표가 없습니다.', ephemeral: true });
            return;
        }
        // 투표 종료 처리
        votingStatus.closeVoting();
        console.log(votingStatus.isVotingClosed());
        await interaction.editReply({ content: '투표가 종료되었습니다.', ephemeral: true });
    },

    data: {
        name: '종료',
        description: '현재 진행 중인 투표를 종료합니다.',
    },
};
