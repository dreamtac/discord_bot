const { ButtonBuilder, ButtonStyle, ActionRowBuilder, SlashCommandBuilder } = require('discord.js');

module.exports = {
    run: async ({ interaction }) => {
        console.log('next.js 실행');
        const button = new ButtonBuilder({
            label: '투표 페이지로 이동',
            style: ButtonStyle.Link,
            url: 'http://localhost:3000/vote',
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
