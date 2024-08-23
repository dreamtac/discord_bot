// const votingStatus = require('../../votingStatus');

// module.exports = async interaction => {
//     const moment = require('moment-timezone');
//     const krTime = moment().tz('Asia/seoul').format(`YYYY-MM-DD HH:mm:ss`);
//     if (!interaction.isButton()) {
//         // console.log(
//         //     `투표시작 or 종료 : ${
//         //         (interaction.member.nickname ? interaction.member.nickname : interaction.user.username,
//         //         interaction.customId)
//         //     }`
//         // );
//         return;
//     }
//     //버튼 누른 유저 확인용
//     console.log(
//         `${interaction.member.nickname ? interaction.member.nickname : interaction.user.username} : ${
//             interaction.customId
//         } - ${krTime}`
//     );

//     await interaction.deferReply({ ephemeral: true }).catch(err => {
//         console.log(`버튼 이벤트 에러: ${err}`);
//         interaction.followUp({ content: '❌ 에러가 발생했습니다. 다시 시도해주세요.', ephemeral: true });
//     });
//     const userId = interaction.member.nickname ? interaction.member.nickname : interaction.user.username;

//     if (interaction.customId === 'btnFirstTrue') {
//         //투표가 종료되었는지 체크
//         if (votingStatus.isVotingClosed()) {
//             console.log(`투표 종료로 요청 거절됨`);
//             await interaction.editReply({
//                 content: `❌ 투표가 종료되었습니다. 더 이상 참여할 수 없습니다.`,
//                 ephemeral: true,
//             });
//             setTimeout(() => interaction.deleteReply(), 5000);
//             return;
//         } else {
//             votingStatus.setStatus(userId, '우선참여');
//             await interaction.editReply({ content: '✅ 우선참여로 기록되었습니다.', ephemeral: true });
//             setTimeout(() => interaction.deleteReply(), 5000);
//         }
//     } else if (interaction.customId === 'btnTrue') {
//         //투표가 종료되었는지 체크
//         if (votingStatus.isVotingClosed()) {
//             console.log(`투표 종료로 요청 거절됨`);
//             await interaction.editReply({
//                 content: `❌ 투표가 종료되었습니다. 더 이상 참여할 수 없습니다.`,
//                 ephemeral: true,
//             });
//             setTimeout(() => interaction.deleteReply(), 5000);
//             return;
//         } else {
//             votingStatus.setStatus(userId, '참여');
//             await interaction.editReply({ content: '✅ 참여로 기록되었습니다.', ephemeral: true });
//             setTimeout(() => interaction.deleteReply(), 5000);
//         }
//     } else if (interaction.customId === 'btnFalse') {
//         //투표가 종료되었는지 체크
//         if (votingStatus.isVotingClosed()) {
//             console.log(`투표 종료로 요청 거절됨`);
//             await interaction.editReply({
//                 content: `❌ 투표가 종료되었습니다. 더 이상 참여할 수 없습니다.`,
//                 ephemeral: true,
//             });
//             setTimeout(() => interaction.deleteReply(), 5000);
//             return;
//         } else {
//             votingStatus.setStatus(userId, '불참');
//             await interaction.editReply({ content: '✅ 불참으로 기록되었습니다.', ephemeral: true });
//             setTimeout(() => interaction.deleteReply(), 5000);
//         }
//     } else if (interaction.customId === 'btnResult') {
//         const result = votingStatus.getResult();
//         let numberedSpecialParticipants = result.specialParticipatedUser.map(
//             (user, index) => `*${index + 1}번*  ${user}`
//         );
//         let numberedParticipants = result.participatedUser.map(
//             (user, index) => `*${index + 1 + numberedSpecialParticipants.length}번*  ${user}`
//         );

//         //불참, 미투표자는 알파벳순으로
//         let sortedNotParticipatedUser = result.notParticipatedUser.sort();
//         let sortedNotVotedUser = result.notVotedUser.sort();
//         const myVote = votingStatus.getStatus()[userId] || '미투표';
//         let myNumber = null;

//         if (myVote === `우선참여`) {
//             myNumber = numberedSpecialParticipants.findIndex(participant => participant.includes(userId)) + 1;
//         } else if (myVote === `참여`) {
//             myNumber =
//                 numberedSpecialParticipants.length +
//                 numberedParticipants.findIndex(participant => participant.includes(userId)) +
//                 1;
//         }

//         const replyMessage = await interaction.editReply({
//             content: `
// **투표 현황:(${result.voteRate})**

// **${userId}**님의 투표 상태는 *** ${myVote} *** 이며, 순번은 ***${myNumber}*** 입니다.

// **------- 우선참여: ${result.specialParticipated}명 --------**\n${numberedSpecialParticipants.join('\n')}

// **------- 참여: ${result.participated}명 --------**\n${numberedParticipants.join('\n')}

// **-------- 불참: ${result.notParticipated}명 --------**\n${sortedNotParticipatedUser.join('\n')}

// **-------- 미투표: ${result.notVoted}명 --------**\n${sortedNotVotedUser.join('\n')}
// `,
//             ephemeral: true,
//         });
//         // console.log(`우선참여: ${numberedSpecialParticipants}`);
//         // console.log(`참여: ${numberedParticipants}`);
//         // console.log(`불참: ${sortedNotParticipatedUser}`);
//         // console.log(`미투표: ${sortedNotVotedUser}`);
//         // console.log(replyMessage.content);
//         setTimeout(() => interaction.deleteReply(), 60000);
//     }
// };

const { EmbedBuilder } = require('discord.js');
const votingStatus = require('../../votingStatus');

module.exports = async interaction => {
    const moment = require('moment-timezone');
    const krTime = moment().tz('Asia/seoul').format(`YYYY-MM-DD HH:mm:ss`);

    if (!interaction.isButton()) return;

    console.log(
        `${interaction.member.nickname ? interaction.member.nickname : interaction.user.username} : ${
            interaction.customId
        } - ${krTime}`
    );

    await interaction.deferReply({ ephemeral: true }).catch(err => {
        console.log(`버튼 이벤트 에러: ${err}`);
        interaction.followUp({ content: '❌ 에러가 발생했습니다. 다시 시도해주세요.', ephemeral: true });
    });

    const userId = interaction.member.nickname ? interaction.member.nickname : interaction.user.username;

    if (
        interaction.customId === 'btnFirstTrue' ||
        interaction.customId === 'btnTrue' ||
        interaction.customId === 'btnFalse'
    ) {
        if (interaction.customId === 'btnFirstTrue') {
            //투표가 종료되었는지 체크
            if (votingStatus.isVotingClosed()) {
                console.log(`투표 종료로 요청 거절됨`);
                await interaction.editReply({
                    content: `❌ 투표가 종료되었습니다. 더 이상 참여할 수 없습니다.`,
                    ephemeral: true,
                });
                setTimeout(() => interaction.deleteReply(), 5000);
                return;
            } else {
                votingStatus.setStatus(userId, '우선참여');
                await interaction.editReply({ content: '✅ 우선참여로 기록되었습니다.', ephemeral: true });
                setTimeout(() => interaction.deleteReply(), 5000);
            }
        } else if (interaction.customId === 'btnTrue') {
            //투표가 종료되었는지 체크
            if (votingStatus.isVotingClosed()) {
                console.log(`투표 종료로 요청 거절됨`);
                await interaction.editReply({
                    content: `❌ 투표가 종료되었습니다. 더 이상 참여할 수 없습니다.`,
                    ephemeral: true,
                });
                setTimeout(() => interaction.deleteReply(), 5000);
                return;
            } else {
                votingStatus.setStatus(userId, '참여');
                await interaction.editReply({ content: '✅ 참여로 기록되었습니다.', ephemeral: true });
                setTimeout(() => interaction.deleteReply(), 5000);
            }
        } else if (interaction.customId === 'btnFalse') {
            //투표가 종료되었는지 체크
            if (votingStatus.isVotingClosed()) {
                console.log(`투표 종료로 요청 거절됨`);
                await interaction.editReply({
                    content: `❌ 투표가 종료되었습니다. 더 이상 참여할 수 없습니다.`,
                    ephemeral: true,
                });
                setTimeout(() => interaction.deleteReply(), 5000);
                return;
            } else {
                votingStatus.setStatus(userId, '불참');
                await interaction.editReply({ content: '✅ 불참으로 기록되었습니다.', ephemeral: true });
                setTimeout(() => interaction.deleteReply(), 5000);
            }
        }
    } else if (interaction.customId === 'btnResult') {
        const result = votingStatus.getResult();
        let numberedSpecialParticipants = result.specialParticipatedUser.map((user, index) => `${index + 1}. ${user}`);
        let numberedParticipants = result.participatedUser.map(
            (user, index) => `${index + 1 + numberedSpecialParticipants.length}. ${user}`
        );
        let sortedNotParticipatedUser = result.notParticipatedUser.sort();
        let sortedNotVotedUser = result.notVotedUser.sort();

        const myVote = votingStatus.getStatus()[userId] || '미투표';
        let myNumber = null;

        if (myVote === '우선참여') {
            myNumber = numberedSpecialParticipants.findIndex(participant => participant.includes(userId)) + 1;
        } else if (myVote === '참여') {
            myNumber =
                numberedSpecialParticipants.length +
                numberedParticipants.findIndex(participant => participant.includes(userId)) +
                1;
        }

        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle(`투표 현황 (${result.voteRate})`)
            .setDescription(
                `${userId}님의 투표 상태는 *** ${myVote} *** 이며, 순번은 ***${myNumber || '없음'}*** 입니다.`
            )
            .addFields(
                {
                    name: `🟢 우선참여 (${result.specialParticipated}명)`,
                    value: numberedSpecialParticipants.join('\n') || '없음',
                    inline: false,
                },
                {
                    name: '\u200B', // 빈 줄 추가
                    value: '\u200B',
                    inline: false,
                },
                {
                    name: `🔵 참여 (${result.participated}명)`,
                    value: numberedParticipants.join('\n') || '없음',
                    inline: false,
                },
                {
                    name: '\u200B', // 빈 줄 추가
                    value: '\u200B',
                    inline: false,
                },
                {
                    name: `🔴 불참 (${result.notParticipated}명)`,
                    value: sortedNotParticipatedUser.join('\n') || '없음',
                    inline: false,
                },
                {
                    name: '\u200B', // 빈 줄 추가
                    value: '\u200B',
                    inline: false,
                },
                {
                    name: `❔ 미투표 (${result.notVoted}명)`,
                    value: sortedNotVotedUser.join('\n') || '없음',
                    inline: false,
                }
            );

        await interaction.editReply({ embeds: [embed], ephemeral: true });
        setTimeout(() => interaction.deleteReply(), 60000);
    }
};
