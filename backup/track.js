const { SlashCommandBuilder } = require('discord.js');
const axios = require('axios');
const moment = require('moment');

module.exports = {
    run: async ({ interaction }) => {
        try {
            // 응답 지연 알림
            await interaction.deferReply({ ephemeral: false });

            // 유저명 가져오기
            const username = interaction.options.getString('유저명');

            try {
                // 유저 기본 정보 조회
                const userResponse = await axios.get(`http://localhost:3000/user/${encodeURIComponent(username)}`);
                const userData = userResponse.data;

                // 날짜 포맷 변경
                const formattedDate = moment(userData.updatedAt).format('YYYY - MM - DD');

                // 응답 메시지 구성
                const responseMessage = `
**${username}님의 정보**
${
    userData.guildName
        ? `\n**길드 정보**\n길드명: ${userData.guildName}\n\n최종 업데이트: ${formattedDate}`
        : '\n소속 길드 없음'
}
`;

                await interaction.editReply({
                    content: responseMessage,
                    ephemeral: false,
                });
            } catch (error) {
                if (error.response && error.response.status === 404) {
                    await interaction.editReply({
                        content: `❌ 유저명: ${username}\n해당 유저를 찾을 수 없습니다.`,
                        ephemeral: false,
                    });
                } else {
                    console.error('API 요청 중 에러 발생:', error);
                    await interaction.editReply({
                        content: '❌ 정보를 가져오는 중 오류가 발생했습니다.',
                        ephemeral: false,
                    });
                }
            }
        } catch (error) {
            console.error('명령어 실행 중 에러:', error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ 명령어 실행 중 오류가 발생했습니다.',
                    ephemeral: false,
                });
            } else {
                await interaction.editReply({
                    content: '❌ 명령어 실행 중 오류가 발생했습니다.',
                    ephemeral: false,
                });
            }
        }
    },

    data: new SlashCommandBuilder()
        .setName('추적')
        .setDescription('특정 유저의 정보를 조회합니다.')
        .addStringOption(option =>
            option.setName('유저명').setDescription('조회할 유저의 이름을 입력하세요.').setRequired(true)
        ),
};
