const { ButtonBuilder, ButtonStyle, ActionRowBuilder, SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    run: async ({ interaction }) => {
        console.log('next.js 실행 - ', interaction.member.displayName);
        const isDev = process.env.NODE_ENV === 'development';

        // 공개 임베드 생성 (모두에게 보이는 메시지)
        const publicEmbed = new EmbedBuilder()
            .setColor(0x0099ff)
            .setTitle('🗳️ 투표 시스템 안내')
            .setDescription(
                `투표 시스템에 참여하기 위해서는 개인 인증이 필요합니다.\n\n**토큰 발급 버튼**을 클릭하시면 투표 사이트 접속을 위한 개인 링크가 발급됩니다.`
            )
            .addFields(
                { name: '🔐 토큰 용도', value: '투표 시스템 접속 시 본인 인증을 위해 사용됩니다.', inline: true },
                { name: '📊 수집 정보', value: '디스코드 ID와 닉네임만 수집합니다.', inline: true },
                { name: '⏱️ 유효 시간', value: '발급된 토큰은 10분간 유효합니다.', inline: false }
            )
            .setFooter({ text: '아래 버튼을 클릭하여 개인 링크를 발급받으세요.' });

        // 토큰 발급 버튼
        const tokenButton = new ButtonBuilder()
            .setLabel('토큰 발급')
            .setStyle(ButtonStyle.Primary)
            .setCustomId('generate_token');

        // 공개 메시지 전송 (모두에게 보이는 메시지)
        await interaction.reply({
            embeds: [publicEmbed],
            components: [new ActionRowBuilder().addComponents(tokenButton)],
            ephemeral: isDev,
        });
        console.log('공개 메시지 전송 완료');
    },
    data: new SlashCommandBuilder().setName('링크').setDescription('투표 사이트 링크를 띄웁니다.'),
};
