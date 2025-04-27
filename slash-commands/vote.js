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
const MemberDB = require('../models/memberDB'); // MemberDB 모듈 추가
const moment = require('moment-timezone'); // moment-timezone 모듈 추가

module.exports = {
    run: async ({ interaction }) => {
        // const subcommand = interaction.options.getSubcommand();

        // 역할 확인: '응애'나 '노역꾼' 역할을 가지고 있는지 체크

        if (process.env.NODE_ENV !== 'development') {
            const hasRequiredRole = interaction.member.roles.cache.some(role => role.name === '운영진');
            if (!hasRequiredRole) {
                await interaction.reply({
                    content: `투표를 진행하기 위해서는 '운영진' 역할이 필요합니다.`,
                    ephemeral: true,
                });
                return;
            }
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
                // 개발 모드인지 여부 확인
                const isDevMode = process.env.NODE_ENV === 'development';

                // 모달 응답 시 로딩 메시지 표시 (개발 모드에서는 ephemeral: true)
                await modalInteraction.deferReply({ ephemeral: isDevMode });

                // 투표 준비 중임을 알리는 임베드
                const loadingEmbed = new EmbedBuilder()
                    .setColor(0x0099ff)
                    .setTitle('투표 준비 중')
                    .setDescription('투표를 준비하고 있습니다. 잠시만 기다려주세요...')
                    .setFooter({ text: '데이터베이스 작업 진행 중' });

                await modalInteraction.editReply({ embeds: [loadingEmbed] });

                // 투표 시작 (이후에 votingClosed = false 설정)
                await votingStatus.openVoting();

                const guild = interaction.guild;
                const members = await guild.members.fetch(); // 모든 멤버 정보를 가져옴

                // 필터링된 멤버 목록 생성
                const eligibleMembers = members.filter(
                    member =>
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
                );

                // 메모리에 상태 저장 및 DB 데이터 준비
                const memberStatus = [];
                const krTime = moment().tz('Asia/seoul').format(`YYYY-MM-DD HH:mm:ss`);

                eligibleMembers.forEach(member => {
                    votingStatus[member.displayName] = '미투표';
                    memberStatus.push({
                        nickName: member.displayName,
                        status: '미투표',
                        number: null,
                        date: krTime,
                    });
                });

                try {
                    // 일괄 DB 작업 수행
                    await MemberDB.insertMany(memberStatus, { ordered: false });

                    // 투표 메시지 생성 및 표시
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

                    let message;

                    if (isDevMode) {
                        // 개발 모드: 명령어 실행자에게만 표시 (ephemeral)
                        message = await modalInteraction.editReply({
                            embeds: [embed],
                            components: [buttons],
                            fetchReply: true,
                        });

                        console.log('테스트 모드에서 투표 메시지가 생성되었습니다 (ephemeral)');
                    } else {
                        // 프로덕션 모드: 모든 사람에게 표시
                        message = await modalInteraction.editReply({
                            embeds: [embed],
                            components: [buttons],
                            fetchReply: true,
                        });

                        console.log('프로덕션 모드에서 투표 메시지가 생성되었습니다 (공개)');
                    }

                    // 투표가 활성화됨을 설정
                    votingStatus.setVotingActiveStatus(true);

                    // 메시지 객체 저장
                    votingStatus.setMessage(message);
                    console.log(`투표가 시작되었습니다. ${memberStatus.length}명의 멤버가 초기화되었습니다.`);
                } catch (err) {
                    console.error('투표 초기화 중 오류 발생:', err);
                    await modalInteraction.editReply({
                        content: '투표 초기화 중 오류가 발생했습니다. 다시 시도해주세요.',
                        embeds: [],
                        components: [],
                    });

                    // 오류 발생 시 투표 상태 초기화
                    votingStatus.closeVoting();
                }
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
