const { SlashCommandBuilder } = require('discord.js');
const axios = require('axios');
const moment = require('moment');

module.exports = {
    run: async ({ interaction }) => {
        try {
            // 응답 지연 알림
            await interaction.deferReply({ ephemeral: false });

            // 길드명 가져오기
            const guildName = interaction.options.getString('길드명');

            try {
                // 길드 정보 업데이트 요청
                await interaction.editReply({
                    content: `🔄 ${guildName} 길드 정보를 업데이트하는 중입니다...`,
                });

                // POST 요청으로 길드 정보 업데이트
                const updateResponse = await axios.post(
                    `http://localhost:3000/guild/${encodeURIComponent(guildName)}/update`
                );

                console.log(updateResponse.data);

                // 날짜 포맷 변경
                const formattedDate = moment(updateResponse.data.updatedAt).format('YYYY - MM - DD');

                // 응답 메시지 구성
                const responseMessage = `
✅ **${guildName}** 길드 정보가 업데이트되었습니다.

**길드 정보**
길드원 수: ${updateResponse.data.memberCount}명

**길드원 목록**
${updateResponse.data.members.sort().join('\n')}

최종 업데이트: ${formattedDate}
`;

                await interaction.editReply({
                    content: responseMessage,
                });
            } catch (error) {
                console.error('API 요청 중 에러 발생:', error);

                if (error.response) {
                    if (error.response.status === 404) {
                        await interaction.editReply({
                            content: `❌ 길드명: ${guildName}\n해당 길드를 찾을 수 없습니다.`,
                        });
                    } else if (error.response.status === 429) {
                        await interaction.editReply({
                            content: '❌ 잠시 후 다시 시도해주세요. (너무 많은 요청)',
                        });
                    } else {
                        await interaction.editReply({
                            content: '❌ 길드 정보 업데이트 중 오류가 발생했습니다.',
                        });
                    }
                } else {
                    await interaction.editReply({
                        content: '❌ 서버 연결 중 오류가 발생했습니다.',
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
                });
            }
        }
    },

    data: new SlashCommandBuilder()
        .setName('길드')
        .setDescription('특정 길드의 정보를 업데이트합니다.')
        .addStringOption(option =>
            option.setName('길드명').setDescription('업데이트할 길드의 이름을 입력하세요.').setRequired(true)
        ),
};
