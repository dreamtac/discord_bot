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
        // 역할이 용병인지 체크
        if (interaction.member.roles.cache.some(role => role.name === '용병')) {
            console.log('용병 투표 거절됨');
            await interaction.editReply({
                content: `❌ 용병은 투표에 참여할 수 없습니다.`,
                ephemeral: true,
            });
            setTimeout(() => interaction.deleteReply(), 5000);
            return;
        }
        //투표가 종료되었는지 체크
        if (votingStatus.isVotingClosed()) {
            console.log(`투표 종료로 요청 거절됨`);
            await interaction.editReply({
                content: `❌ 투표가 종료되었습니다. 더 이상 참여할 수 없습니다.`,
                ephemeral: true,
            });
            setTimeout(() => interaction.deleteReply(), 5000);
            return;
        }
        if (interaction.customId === 'btnFirstTrue') {
            votingStatus.setStatus(userId, '우선참여');
            await interaction.editReply({ content: '✅ 우선참여로 기록되었습니다.', ephemeral: true });
            setTimeout(() => interaction.deleteReply(), 5000);
        } else if (interaction.customId === 'btnTrue') {
            votingStatus.setStatus(userId, '참여');
            await interaction.editReply({ content: '✅ 참여로 기록되었습니다.', ephemeral: true });
            setTimeout(() => interaction.deleteReply(), 5000);
        } else if (interaction.customId === 'btnFalse') {
            votingStatus.setStatus(userId, '불참');
            await interaction.editReply({ content: '✅ 불참으로 기록되었습니다.', ephemeral: true });
            setTimeout(() => interaction.deleteReply(), 5000);
        }
    } else if (interaction.customId === 'btnResult') {
        const result = votingStatus.getResult();
        let numberedSpecialParticipants = result.specialParticipatedUser.map((user, index) => `${index + 1}. ${user}`);
        let numberedParticipants = result.participatedUser.map(
            (user, index) => `${index + 1 + numberedSpecialParticipants.length}. ${user}`
        );
        //불참, 미투표자는 알파벳순으로
        let sortedNotParticipatedUser = result.notParticipatedUser.sort();
        let sortedNotVotedUser = result.notVotedUser.sort();

        const myVote = votingStatus.getStatus()[userId] || '미투표'; //나의 투표 상황
        let myNumber = null; //나의 투표 순번

        if (myVote === '우선참여') {
            myNumber = numberedSpecialParticipants.findIndex(participant => participant.includes(userId)) + 1;
        } else if (myVote === '참여') {
            myNumber =
                numberedSpecialParticipants.length +
                numberedParticipants.findIndex(participant => participant.includes(userId)) +
                1;
        }

        // 메시지를 여러 조각으로 나누는 함수
        const splitLongMessage = message => {
            const messages = [];
            let currentMessage = '';
            const lines = message.split('\n');

            lines.forEach(line => {
                if ((currentMessage + line).length > 2000) {
                    messages.push(currentMessage);
                    currentMessage = line + '\n';
                } else {
                    currentMessage += line + '\n';
                }
            });

            if (currentMessage) messages.push(currentMessage);
            return messages;
        };

        const fullMessage = `
**투표 현황:(${result.voteRate})**
${userId}님의 투표 상태는 *** ${myVote} *** 이며, 순번은 ***${myNumber || '없음'}*** 입니다.

**------- 🟢 우선참여: ${result.specialParticipated}명 --------**\n${numberedSpecialParticipants.join('\n')}

**------- 🔵 참여: ${result.participated}명 --------**\n${numberedParticipants.join('\n')}

**-------- 🔴 불참: ${result.notParticipated}명 --------**\n${sortedNotParticipatedUser.join('\n')}

**-------- ❔ 미투표: ${result.notVoted}명 --------**\n${sortedNotVotedUser.join('\n')}
`;

        // 메시지 나누기
        const messages = splitLongMessage(fullMessage);

        // 첫 번째 메시지는 editReply로 보냄
        await interaction.editReply({ content: messages[0], ephemeral: true });

        // 나머지 메시지는 followUp으로 보냄
        for (let i = 1; i < messages.length; i++) {
            await interaction.followUp({ content: messages[i], ephemeral: true });
        }

        setTimeout(() => interaction.deleteReply(), 60000);
    }
};

//         //불참, 미투표자는 알파벳순으로
//         let sortedNotParticipatedUser = result.notParticipatedUser.sort();
//         let sortedNotVotedUser = result.notVotedUser.sort();

//         const myVote = votingStatus.getStatus()[userId] || '미투표'; //나의 투표 상황
//         let myNumber = null; //나의 투표 순번

//         if (myVote === '우선참여') {
//             myNumber = numberedSpecialParticipants.findIndex(participant => participant.includes(userId)) + 1;
//         } else if (myVote === '참여') {
//             myNumber =
//                 numberedSpecialParticipants.length +
//                 numberedParticipants.findIndex(participant => participant.includes(userId)) +
//                 1;
//         }

//         await interaction.editReply({
//             content: `
// **투표 현황:(${result.voteRate})**
// ${userId}님의 투표 상태는 *** ${myVote} *** 이며, 순번은 ***${myNumber || '없음'}*** 입니다.

// **------- 🟢 우선참여: ${result.specialParticipated}명 --------**\n${numberedSpecialParticipants.join('\n')}

// **------- 🔵 참여: ${result.participated}명 --------**\n${numberedParticipants.join('\n')}

// **-------- 🔴 불참: ${result.notParticipated}명 --------**\n${sortedNotParticipatedUser.join('\n')}

// **-------- ❔ 미투표: ${result.notVoted}명 --------**\n${sortedNotVotedUser.join('\n')}
// `,
//             // ephemeral: true,
//         });
//         setTimeout(() => interaction.deleteReply(), 60000);
//     }
// };
