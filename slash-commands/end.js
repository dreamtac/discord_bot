const { EmbedBuilder } = require('discord.js');
const votingStatus = require('../votingStatus');

module.exports = {
    run: async ({ interaction }) => {
        if (votingStatus.isVotingClosed()) {
            interaction.reply({ content: '진행 중인 투표가 없습니다.', ephemeral: true });
            return;
        }
        // 투표 종료 처리
        votingStatus.closeVoting();
        console.log(votingStatus.isVotingClosed());

        // // 투표 종료 알림 임베드
        // const embed = new EmbedBuilder()
        //     .setColor(0xff0000)
        //     .setTitle('투표 종료')
        //     .setDescription('투표가 종료되었습니다. 더 이상 참여할 수 없습니다.')
        //     .setTimestamp();

        // // 현재 메시지를 가져와서 수정
        // const message = await interaction.channel.messages.fetch(interaction.message.id);
        // await message.edit({ embed: [embed], components: [] });

        await interaction.reply({ content: '투표가 종료되었습니다.', ephemeral: true });
    },

    data: {
        name: '종료',
        description: '현재 진행 중인 투표를 종료합니다.',
    },
};
