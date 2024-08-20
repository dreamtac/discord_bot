const {
    ActionRowBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    EmbedBuilder,
    ButtonBuilder,
    ButtonStyle,
    SlashCommandBuilder,
} = require('discord.js');
const votingStatus = require('../votingStatus'); // votingStatus 모듈 불러오기

module.exports = {
    run: async ({ interaction }) => {
        // const subcommand = interaction.options.getSubcommand();

        if (!votingStatus.isVotingClosed()) {
            await interaction.reply({
                content: `투표가 이미 진행중입니다.\n'/종료' 를 입력해 진행중인 투표를 종료해주세요.`,
                ephemeral: true,
            });
            return;
        }

        // 모달 생성
        const modal = new ModalBuilder({
            customId: `voteModal`,
            title: `투표`,
        });

        const voteTitle = new TextInputBuilder({
            customId: `inputDate`,
            label: `공성/거점이 열리는 날짜를 입력해주세요.`,
            placeholder: `ex) 08/20 or 2024-08-20(화)`,
            style: TextInputStyle.Short,
            required: true,
        });

        const voteDescription = new TextInputBuilder({
            customId: `inputDescription`,
            label: `공성/거점 정보를 입력해주세요.`,
            placeholder: `ex) 08/20 칼페온/카마실비아 거점 투표`,
            style: TextInputStyle.Paragraph,
            required: true,
        });

        const firstActionRow = new ActionRowBuilder().addComponents(voteTitle);
        const secondActionRow = new ActionRowBuilder().addComponents(voteDescription);

        modal.addComponents(firstActionRow, secondActionRow);

        await interaction.showModal(modal);

        // 제출 처리
        const filter = interaction => interaction.customId === `voteModal`;

        interaction
            .awaitModalSubmit({ filter, time: 600000 })
            .then(async modalInteraction => {
                votingStatus.openVoting(); //투표 상태를 진행으로 변경
                const guild = interaction.guild;
                const members = await guild.members.fetch(); // 모든 멤버 정보를 가져옴
                // 모든 멤버의 상태를 '미투표'로 초기화
                members.forEach(member => {
                    if (!member.user.bot) {
                        // 봇은 제외
                        votingStatus.setStatus(member.nickname ? member.nickname : member.user.username, '미투표');
                    }
                });

                const date = modalInteraction.fields.getTextInputValue('inputDate');
                const description = modalInteraction.fields.getTextInputValue('inputDescription');

                const button = new ButtonBuilder()
                    .setLabel('우선참여 (특수병)')
                    .setCustomId('btnFirstTrue')
                    .setStyle(ButtonStyle.Primary);
                const button1 = new ButtonBuilder()
                    .setLabel('참여')
                    .setCustomId('btnTrue')
                    .setStyle(ButtonStyle.Primary);
                const button2 = new ButtonBuilder()
                    .setLabel('불참')
                    .setCustomId('btnFalse')
                    .setStyle(ButtonStyle.Danger);
                const button3 = new ButtonBuilder()
                    .setLabel('투표 현황')
                    .setCustomId('btnResult')
                    .setStyle(ButtonStyle.Secondary);

                const buttons = new ActionRowBuilder().addComponents(button, button1, button2, button3);

                const embed = new EmbedBuilder()
                    .setColor(0x0099ff)
                    .setTitle('공성/거점 투표')
                    .addFields({ name: '일시', value: date })
                    .addFields({ name: '안내 사항', value: description });
                // .setDescription(description);

                await modalInteraction.reply({ embeds: [embed], components: [buttons] });
            })
            .catch(err => {
                console.log(`Error: ${err}`);
                interaction.followUp({
                    content: '투표창을 닫았거나 시간이 초과(10분)되었습니다.',
                    ephemeral: true,
                });
            });
    },

    data: new SlashCommandBuilder().setName('투표').setDescription('투표 관리 명령어'),
};
