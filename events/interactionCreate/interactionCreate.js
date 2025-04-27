const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const votingStatus = require('../../votingStatus');
const votingStateDB = require('../../models/votingStateDB');
const { voiceUser } = require('../..');
const jwt = require('jsonwebtoken');

module.exports = async interaction => {
    if (!interaction.isButton()) return;
    if (interaction.customId.startsWith('confirm_') || interaction.customId === 'cancel') return;
    // if (votingStatus.isVotingClosed()) {
    //     await interaction.editReply({
    //         content: `❌ 투표가 종료되었습니다. 더 이상 참여할 수 없습니다.`,
    //         ephemeral: true,
    //     });
    //     setTimeout(() => interaction.deleteReply(), 5000);
    //     return;
    // }

    const moment = require('moment-timezone');
    const krTime = moment().tz('Asia/seoul').format(`YYYY-MM-DD HH:mm:ss`);
    console.log(`${interaction.member.displayName} : ${interaction.customId} - ${krTime}`);

    try {
        // 토큰 발급 버튼 클릭 이벤트 처리
        if (interaction.customId === 'generate_token') {
            // JWT 토큰 생성
            const token = jwt.sign(
                {
                    userId: interaction.user.id,
                    username: interaction.user.username,
                    nickname: interaction.user.displayName || interaction.user.username,
                    type: 'vote',
                    exp: Math.floor(Date.now() / 1000) + 60 * 10, // 10분 후 만료
                },
                process.env.JWT_SECRET
            );

            // 토큰이 포함된 투표 URL 생성
            const voteUrl = `${process.env.NEXT_URL}/auth/verify?token=${token}`;

            // 개인 임베드 생성 (클릭한 사용자에게만 보이는 메시지)
            const privateEmbed = new EmbedBuilder()
                .setColor(0x00ff00)
                .setTitle('🔐 개인 투표 링크 발급 완료')
                .setDescription(
                    `**${interaction.user.displayName}님**, 투표 시스템 접속을 위한 개인 링크가 발급되었습니다.\n아래 버튼을 클릭하여 투표 페이지로 이동하세요.`
                )
                .setFooter({ text: '이 링크는 발급 후 10분간 유효하며, 본인만 사용할 수 있습니다.' });

            // 투표 사이트 이동 버튼
            const linkButton = new ButtonBuilder()
                .setLabel('투표 사이트로 이동')
                .setStyle(ButtonStyle.Link)
                .setURL(voteUrl);

            // 개인 응답 전송 (버튼을 클릭한 사용자에게만 보이는 메시지)
            await interaction.reply({
                embeds: [privateEmbed],
                components: [new ActionRowBuilder().addComponents(linkButton)],
                ephemeral: true, // 개인 메시지로 전송 (다른 사용자에게는 보이지 않음)
            });
            console.log(`${interaction.user.username}에게 개인 링크 전송 완료`);
            return;
        }

        // 먼저 응답 지연을 알림
        await interaction.deferReply({ ephemeral: true }).catch(console.error);

        const userId = interaction.member.displayName;

        // 운영진인지 확인하는 함수
        const isAdmin = interaction.member.roles.cache.some(
            role => role.name === 'GANG' || role.name === '돚거단' || role.name === '포도당' || role.name === '접어'
        );

        if (
            interaction.customId === 'btnFirstTrue' ||
            interaction.customId === 'btnTrue' ||
            interaction.customId === 'btnFalse'
        ) {
            // 역할이 용병인지 체크
            if (process.env.NODE_ENV !== 'development') {
                if (
                    interaction.member.roles.cache.some(role => role.name === '용병') ||
                    !interaction.member.roles.cache.some(
                        role =>
                            role.name === '접어' ||
                            role.name === 'GANG' ||
                            role.name === '돚거단' ||
                            role.name === '포도당'
                    )
                ) {
                    console.log('투표 권한 없음');
                    await interaction
                        .editReply({
                            content: `❌ 투표 권한이 없습니다. 역할을 확인해주세요.`,
                            ephemeral: true,
                        })
                        .catch(console.error);
                    setTimeout(() => {
                        interaction.deleteReply().catch(console.error);
                    }, 5000);
                    return;
                }
            }
            //투표가 종료되었는지 체크
            if (votingStatus.isVotingClosed()) {
                console.log(`투표 종료로 요청 거절됨`);
                await interaction
                    .editReply({
                        content: `❌ 투표가 종료되었습니다. 더 이상 참여할 수 없습니다.`,
                        ephemeral: true,
                    })
                    .catch(console.error);
                setTimeout(() => {
                    interaction.deleteReply().catch(console.error);
                }, 5000);
                return;
            }
            //동일한 상태로 투표하려는지 체크 (참여 -> 참여, 우선참여 -> 우선참여)
            const currentStatus = votingStatus.getStatus()[userId]; //유저의 현재 상태 가져오기
            console.log(currentStatus);
            let newStatus = '';

            if (interaction.customId === 'btnFirstTrue') newStatus = '우선참여';
            else if (interaction.customId === 'btnTrue') newStatus = '참여';
            else if (interaction.customId === 'btnFalse') newStatus = '불참';

            if (currentStatus === newStatus) {
                await interaction
                    .editReply({
                        content: `❌ 이미 ${newStatus} 상태입니다.`,
                        ephemeral: true,
                    })
                    .catch(console.error);
                setTimeout(() => {
                    interaction.deleteReply().catch(console.error);
                }, 5000);
                return;
            }

            // 이미 투표한 상태이고, 다른 상태로 변경하려는 경우
            if (currentStatus !== '미투표' && currentStatus && currentStatus !== newStatus) {
                const confirmButton = new ButtonBuilder()
                    .setCustomId(`confirm_${newStatus}`)
                    .setLabel('확인')
                    .setStyle(ButtonStyle.Success);

                const cancelButton = new ButtonBuilder()
                    .setCustomId('cancel')
                    .setLabel('취소')
                    .setStyle(ButtonStyle.Danger);

                const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

                // 먼저 확인 메시지를 보냅니다
                await interaction
                    .editReply({
                        content: `정말 "${currentStatus}"에서 "${newStatus}"로 변경하시겠습니까?`,
                        components: [row],
                        ephemeral: true,
                    })
                    .catch(console.error);

                try {
                    // 버튼 응답을 기다립니다
                    const confirmation = await interaction.channel.awaitMessageComponent({
                        filter: i =>
                            i.user.id === interaction.user.id &&
                            (i.customId === `confirm_${newStatus}` || i.customId === 'cancel'),
                        time: 30000,
                    });

                    // 버튼 응답에 따라 처리합니다
                    if (confirmation.customId === `confirm_${newStatus}`) {
                        if (votingStatus.isVotingClosed()) {
                            await interaction
                                .editReply({
                                    content: `❌ 투표가 종료되었습니다. 더 이상 참여할 수 없습니다.`,
                                    ephemeral: true,
                                })
                                .catch(console.error);
                            return;
                        }
                        await votingStatus.setStatus(userId, newStatus);
                        await interaction
                            .editReply({
                                content: `✅ ${newStatus}로 변경되었습니다.`,
                                components: [],
                                ephemeral: true,
                            })
                            .catch(console.error);
                        const result = votingStatus.getResult();
                        await updateEmbedMessage(result);
                    } else if (confirmation.customId === 'cancel') {
                        if (votingStatus.isVotingClosed()) {
                            await interaction
                                .editReply({
                                    content: `❌ 투표가 종료되었습니다. 더 이상 참여할 수 없습니다.`,
                                    ephemeral: true,
                                })
                                .catch(console.error);
                            return;
                        }
                        await interaction
                            .editReply({
                                content: '❌ 변경이 취소되었습니다.',
                                components: [],
                                ephemeral: true,
                            })
                            .catch(console.error);
                    }

                    // 5초 후에 메시지를 삭제합니다
                    setTimeout(() => {
                        try {
                            interaction.deleteReply().catch(console.error);
                        } catch (err) {
                            console.error('메시지 삭제 중 에러:', err);
                        }
                    }, 5000);
                } catch (e) {
                    console.error('시간 초과 또는 에러:', e);
                    await interaction
                        .editReply({
                            content: '❌ 시간이 초과되었습니다.',
                            components: [],
                        })
                        .catch(console.error);
                    // 5초 후에 시간 초과 메시지 삭제
                    setTimeout(() => {
                        try {
                            interaction.deleteReply().catch(console.error);
                        } catch (err) {
                            console.error('메시지 삭제 중 에러:', err);
                        }
                    }, 5000);
                }
                return;
            }

            // 처음 투표하거나 같은 상태로 투표하는 경우는 기존 로직 실행
            if (interaction.customId === 'btnFirstTrue') {
                await votingStatus.setStatus(userId, '우선참여');
                await interaction
                    .editReply({ content: '✅ 우선참여로 기록되었습니다.', ephemeral: true })
                    .catch(console.error);
            } else if (interaction.customId === 'btnTrue') {
                await votingStatus.setStatus(userId, '참여');
                await interaction
                    .editReply({ content: '✅ 참여로 기록되었습니다.', ephemeral: true })
                    .catch(console.error);
            } else if (interaction.customId === 'btnFalse') {
                await votingStatus.setStatus(userId, '불참');
                await interaction
                    .editReply({ content: '✅ 불참으로 기록되었습니다.', ephemeral: true })
                    .catch(console.error);
            }
            setTimeout(() => {
                try {
                    interaction.deleteReply().catch(console.error);
                } catch (err) {
                    console.error('메시지 삭제 중 에러:', err);
                }
            }, 5000);
        } else if (
            interaction.customId === 'btnResultParticipated' ||
            interaction.customId === 'btnResultNotParticipated'
        ) {
            // 운영진 권한 확인
            if (process.env.NODE_ENV !== 'development') {
                if (!isAdmin) {
                    await interaction
                        .editReply({
                            content: `❌ 권한이 없습니다. 투표 현황은 관계자만 볼 수 있습니다.`,
                            ephemeral: true,
                        })
                        .catch(console.error);
                    setTimeout(() => {
                        interaction.deleteReply().catch(console.error);
                    }, 5000);
                    return;
                }
            }

            if (interaction.customId === 'btnResultParticipated') {
                // 우선참여와 참여자만 보이기
                const result = votingStatus.getResult();

                // 순번과 체크 표시를 분리하여 처리
                let numberedSpecialParticipants = result.specialParticipatedUser.map((user, index) => {
                    const isInVoice = voiceUser.includes(user);
                    return `${index + 1}. ${user}${isInVoice ? ' ✅' : ''}`;
                });

                let numberedParticipants = result.participatedUser.map((user, index) => {
                    const isInVoice = voiceUser.includes(user);
                    return `${index + 1 + numberedSpecialParticipants.length}. ${user}${isInVoice ? ' ✅' : ''}`;
                });

                const myVote = votingStatus.getStatus()[userId] || '미투표'; // 나의 투표 상황
                let myNumber = null; // 나의 투표 순번

                if (myVote === '우선참여') {
                    myNumber = numberedSpecialParticipants.findIndex(participant => participant.includes(userId)) + 1;
                } else if (myVote === '참여') {
                    myNumber =
                        numberedSpecialParticipants.length +
                        numberedParticipants.findIndex(participant => participant.includes(userId)) +
                        1;
                }

                const messageContent = `
**투표 현황:(${result.voteRate})**
${userId}님의 투표 상태는 ***${myVote}***  이며, 순번은 ***${myNumber || '없음'}***  입니다.

**------- 🟢 우선참여: ${result.specialParticipated}명 --------**\n${numberedSpecialParticipants.join('\n')}

**------- 🔵 참여: ${result.participated}명 --------**\n${numberedParticipants.join('\n')}

\`음성 채널에 입장한 유저는 이름 끝에 ✅가 붙습니다.\`
`;

                sendPaginatedMessages(interaction, messageContent);
            } else if (interaction.customId === 'btnResultNotParticipated') {
                // 불참자와 미투표자만 보이기
                const result = votingStatus.getResult();
                let sortedNotParticipatedUser = result.notParticipatedUser.sort();
                let sortedNotVotedUser = result.notVotedUser.sort();

                const myVote = votingStatus.getStatus()[userId] || '미투표'; // 나의 투표 상황

                const messageContent = `
**투표 현황:(${result.voteRate})**
${userId}님의 투표 상태는 ***${myVote}***  입니다.

**-------- 🔴 불참: ${result.notParticipated}명 --------**\n${sortedNotParticipatedUser.join('\n')}

**-------- ❔ 미투표: ${result.notVoted}명 --------**\n${sortedNotVotedUser.join('\n')}
`;

                sendPaginatedMessages(interaction, messageContent);
            }
        }

        const result = votingStatus.getResult();
        await updateEmbedMessage(result);
    } catch (error) {
        console.error('버튼 이벤트 처리 중 에러:', error);

        // 에러 발생 시 응답
        if (!interaction.replied && !interaction.deferred) {
            await interaction
                .reply({
                    content: '❌ 에러가 발생했습니다. 다시 시도해주세요.',
                    ephemeral: true,
                })
                .catch(console.error);
        } else {
            await interaction
                .followUp({
                    content: '❌ 에러가 발생했습니다. 다시 시도해주세요.',
                    ephemeral: true,
                })
                .catch(console.error);
        }
    }
};

// 실시간 임베드 업데이트 함수
const updateEmbedMessage = async result => {
    const votingMessage = votingStatus.getMessage();

    if (!votingMessage || !votingMessage.embeds || votingMessage.embeds.length === 0) {
        console.error('투표 메시지가 없거나 임베드가 설정되지 않았습니다.');
        return;
    }

    const embed = votingMessage.embeds[0];

    // 일시와 안내사항만 유지하고, 참여 현황 필드는 제거
    if (embed.fields.length > 2) {
        embed.fields.splice(2); // 세 번째 필드부터 제거
    }

    try {
        await votingMessage.edit({ embeds: [embed] });
    } catch (err) {
        console.error('투표 메시지 업데이트 중 에러 발생:', err);
    }
};

// 메시지를 여러 조각으로 나누는 함수
const sendPaginatedMessages = async (interaction, message) => {
    const messages = splitLongMessage(message);

    // 첫 번째 메시지는 editReply로 보냄
    await interaction.editReply({ content: messages[0], ephemeral: true });

    // 나머지 메시지는 followUp으로 보냄
    for (let i = 1; i < messages.length; i++) {
        await interaction.followUp({ content: messages[i], ephemeral: true });
    }

    setTimeout(() => interaction.deleteReply(), 60000);
};

// 메시지를 2000자 이하로 분할하는 함수
const splitLongMessage = message => {
    const messages = [];
    let currentMessage = '';
    const lines = message.split('\n');

    lines.forEach(line => {
        if ((currentMessage + line).length > 2000) {
            // 문자열이 2000자가 넘어가면 messages 배열에 넣기
            messages.push(currentMessage);
            // currentMessage 초기화, 다시 한 줄 한 줄 넣기
            currentMessage = line + '\n';
        } else {
            // 기존 currentMessage에 현재 라인 추가
            currentMessage += line + '\n';
        }
    });

    if (currentMessage) messages.push(currentMessage);
    return messages;
};
// const { Events } = require('discord.js');

// module.exports = {
//     name: Events.InteractionCreate,
//     async execute(interaction) {
//         // 버튼 클릭 이벤트 처리
//         if (interaction.isButton()) {
//             if (interaction.customId === 'vote_button') {
//                 try {
//                     const userId = interaction.user.id;
//                     const nickname = interaction.member.nickname || interaction.user.username;

//                     // 사용자에게만 보이는 응답 전송
//                     await interaction.reply({
//                         content: `${nickname}님, 투표 페이지로 이동하세요: http://localhost:3000/vote?user=${userId}`,
//                         ephemeral: true, // 다른 사용자에게는 보이지 않음
//                     });
//                 } catch (error) {
//                     console.error('버튼 클릭 처리 중 오류 발생:', error);
//                     await interaction.reply({
//                         content: '투표 처리 중 오류가 발생했습니다. 나중에 다시 시도해주세요.',
//                         ephemeral: true,
//                     });
//                 }
//             }
//         }
//     },
// };
