const { ButtonBuilder, ButtonStyle, ActionRowBuilder, SlashCommandBuilder } = require('discord.js');
const jwt = require('jsonwebtoken');

module.exports = {
    run: async ({ interaction }) => {
        console.log('next.js 실행');
        console.log(interaction);

        // JWT 토큰 생성
        const token = jwt.sign(
            {
                userId: interaction.user.id,
                username: interaction.user.username,
                nickname: interaction.member?.nickname || interaction.user.username,
                type: 'vote',
                exp: Math.floor(Date.now() / 1000) + 60 * 60, // 1시간 후 만료
            },
            process.env.JWT_SECRET
        );

        // 토큰이 포함된 투표 URL 생성
        const voteUrl = `${process.env.NEXT_URL}/vote?token=${token}`;

        const button = new ButtonBuilder({
            label: '투표 페이지로 이동',
            style: ButtonStyle.Link,
            url: voteUrl,
        });
        console.log('button 생성');

        await interaction.reply({
            content: '투표 페이지로 이동합니다.',
            components: [new ActionRowBuilder().addComponents(button)],
            ephemeral: true,
        });
        console.log('reply 완료');
    },
    data: new SlashCommandBuilder().setName('링크').setDescription('투표 사이트 링크를 띄웁니다.'),
};
