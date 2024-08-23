const { SlashCommandBuilder } = require(`discord.js`);
const votingStatus = require('../votingStatus');

module.exports = {
    run: async ({ interaction }) => {
        if (!votingStatus.isVotingClosed()) {
            await interaction.reply({
                content: `투표가 진행 중입니다. 먼저 투표를 종료해 주세요.`,
                ephemeral: true,
            });
            return;
        }

        try {
            await votingStatus.initData(); //데이터 초기화
            await interaction.reply({
                content: `투표 데이터가 초기화되었습니다.`,
                ephemeral: true,
            });
        } catch (err) {
            console.log('초기화 중 오류 발생', err);
            await interaction.reply({
                content: `초기화 중 오류가 발생했습니다.`,
                ephemeral: true,
            });
        }
    },

    data: new SlashCommandBuilder()
        .setName('초기화')
        .setDescription('투표 상태를 초기화합니다. 투표 시작전 꼭 초기화 해주세요.'),
};
