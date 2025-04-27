// const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');

// module.exports = {
//     data: new SlashCommandBuilder().setName('vote').setDescription('투표를 위한 버튼을 생성합니다.'),

//     run: async (client, interaction) => {
//         try {
//             // 임베드 생성
//             const voteEmbed = new EmbedBuilder()
//                 .setColor('#0099ff')
//                 .setTitle('📊 투표 참여하기')
//                 .setDescription('아래 버튼을 클릭하여 투표에 참여하세요.')
//                 .setTimestamp();

//             // 투표 버튼 생성
//             const voteButton = new ButtonBuilder()
//                 .setCustomId('vote_button')
//                 .setLabel('투표 참여하기')
//                 .setStyle(ButtonStyle.Primary)
//                 .setEmoji('🗳️');

//             // 버튼을 포함한 액션 로우 생성
//             const row = new ActionRowBuilder().addComponents(voteButton);

//             // 응답 전송
//             await interaction.reply({
//                 embeds: [voteEmbed],
//                 components: [row],
//             });
//         } catch (error) {
//             console.error('투표 명령어 실행 중 오류 발생:', error);
//             await interaction.reply({
//                 content: '투표 버튼 생성 중 오류가 발생했습니다.',
//                 ephemeral: true,
//             });
//         }
//     },
// };

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

        // 역할 확인: '응애'나 '노역꾼' 역할을 가지고 있는지 체크
        const hasRequiredRole = interaction.member.roles.cache.some(
            role => role.name === '운영진'
            // role.name === '응애' ||
            // role.name === '노역꾼' ||
            // role.name === 'GANG' ||
            // role.name === '돚거단' ||
            // role.name === '포도당'
        );

        if (!hasRequiredRole) {
            await interaction.reply({
                content: `투표를 진행하기 위해서는 '운영진' 역할이 필요합니다.`,
                ephemeral: true,
            });
            return;
        }

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
                await votingStatus.openVoting(); //투표 상태를 진행으로 변경
                const guild = interaction.guild;
                const members = await guild.members.fetch(); // 모든 멤버 정보를 가져옴
                // 모든 멤버의 상태를 '미투표'로 초기화
                members.forEach(member => {
                    // 봇과 용병 역할을 가진 사용자는 제외하고, '응애' 또는 '노역꾼' 역할을 가진 사용자만 포함
                    if (
                        !member.roles.cache.some(role => role.name === '용병') &&
                        !member.user.bot &&
                        member.roles.cache.some(
                            role =>
                                role.name === '응애' ||
                                role.name === '노역꾼' ||
                                role.name === 'GANG' ||
                                role.name === '돚거단' ||
                                role.name === '포도당' ||
                                role.name === '접어'
                        )
                    ) {
                        votingStatus.setStatus(member.displayName, '미투표');
                    }
                });

                const result = votingStatus.getResult(); // 투표 결과를 가져옴
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
                    .setLabel('참여 현황')
                    .setCustomId('btnResultParticipated')
                    .setStyle(ButtonStyle.Secondary);
                const button4 = new ButtonBuilder()
                    .setLabel('불참/미투표 현황')
                    .setCustomId('btnResultNotParticipated')
                    .setStyle(ButtonStyle.Secondary);

                const buttons = new ActionRowBuilder().addComponents(button, button1, button2, button3, button4);

                const embed = new EmbedBuilder()
                    .setColor(0x0099ff)
                    .setTitle('공성/거점 투표')
                    .addFields({ name: '일시', value: date }, { name: '안내 사항', value: description })
                    .setFooter({ text: '• 상호작용 실패 문구가 뜨면 잠시후(10초) 다시 시도해 주세요 •' });

                // 메시지 객체 저장
                const message = await modalInteraction.reply({
                    embeds: [embed],
                    components: [buttons],
                    fetchReply: true, // 메시지 객체 반환
                });
                votingStatus.setMessage(message); // 메시지 저장
            })
            .catch(err => {
                console.log(`Error: ${err}`);
                interaction.followUp({
                    content: "error - '프리덤'에게 문의 주세요!!",
                    ephemeral: true,
                });
            });
    },

    data: new SlashCommandBuilder().setName('투표').setDescription('투표를 시작합니다.'),
};
