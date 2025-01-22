const { EmbedBuilder } = require('discord.js');
const votingStatus = require('../../votingStatus');
const votingStateDB = require('../../models/votingStateDB');

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
        //동일한 상태로 투표하려는지 체크 (참여 -> 참여, 우선참여 -> 우선참여)
        const currentStatus = votingStatus.getStatus()[userId]; //유저의 현재 상태 가져오기
        if (
            (interaction.customId === 'btnFirstTrue' && currentStatus === '우선참여') ||
            (interaction.customId === 'btnTrue' && currentStatus === '참여') ||
            (interaction.customId === 'btnFalse' && currentStatus === '불참')
        ) {
            console.log(`${userId} 유저가 이미 동일한 상태로 투표했습니다.`);
            await interaction.editReply({
                content: `❌ 이미 "${currentStatus}" 상태로 투표했습니다. 다른 상태로 변경하려면 다시 선택하세요.`,
                ephemeral: true,
            });
            setTimeout(() => interaction.deleteReply(), 5000);
            return; // 동일한 상태로 투표한 경우 함수 종료
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
    } else if (interaction.customId === 'btnResultParticipated') {
        // 우선참여와 참여자만 보이기
        const result = votingStatus.getResult();
        let numberedSpecialParticipants = result.specialParticipatedUser.map((user, index) => `${index + 1}. ${user}`);
        let numberedParticipants = result.participatedUser.map(
            (user, index) => `${index + 1 + numberedSpecialParticipants.length}. ${user}`
        );

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
${userId}님의 투표 상태는 *** ${myVote} *** 이며, 순번은 ***${myNumber || '없음'}*** 입니다.

**------- 🟢 우선참여: ${result.specialParticipated}명 --------**\n${numberedSpecialParticipants.join('\n')}

**------- 🔵 참여: ${result.participated}명 --------**\n${numberedParticipants.join('\n')}
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
${userId}님의 투표 상태는 *** ${myVote} *** 입니다.

**-------- 🔴 불참: ${result.notParticipated}명 --------**\n${sortedNotParticipatedUser.join('\n')}

**-------- ❔ 미투표: ${result.notVoted}명 --------**\n${sortedNotVotedUser.join('\n')}
`;

        sendPaginatedMessages(interaction, messageContent);
    }

    const result = votingStatus.getResult();
    await updateEmbedMessage(result);
};

// 실시간 임베드 업데이트 함수
const updateEmbedMessage = async result => {
    const votingMessage = votingStatus.getMessage();
    // console.log('투표 메시지:', votingMessage);

    if (!votingMessage || !votingMessage.embeds || votingMessage.embeds.length === 0) {
        //todo: db에서 메시지 가져오기
        // votingStateDB.findOne({}).then(votingState => {
        //     if (votingState) {
        //         votingMessage = votingState.message;
        //     }
        // });
        console.error('투표 메시지가 없거나 임베드가 설정되지 않았습니다.');
        return;
    }

    const embed = votingMessage.embeds[0];
    embed.fields[2].value = `
    🟢 우선참여: ${result.specialParticipated}명
    🔵 참여: ${result.participated}명
    🔴 불참: ${result.notParticipated}명
    ❔ 미투표: ${result.notVoted}명
    `;

    try {
        await votingMessage.edit({ embeds: [embed] });
        // console.log('투표 메시지 업데이트 완료:', embed.data.fields[2].value);
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

//     else if (interaction.customId === 'btnResult') {
//         const result = votingStatus.getResult();
//         let numberedSpecialParticipants = result.specialParticipatedUser.map((user, index) => `${index + 1}. ${user}`);
//         let numberedParticipants = result.participatedUser.map(
//             (user, index) => `${index + 1 + numberedSpecialParticipants.length}. ${user}`
//         );
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

//         // 메시지를 여러 조각으로 나누는 함수
//         const splitLongMessage = message => {
//             const messages = [];
//             let currentMessage = '';
//             const lines = message.split('\n');

//             lines.forEach(line => {
//                 if ((currentMessage + line).length > 2000) {
//                     //문자열이 2000자가 넘어가면 massages 배열에 넣기
//                     messages.push(currentMessage);
//                     //currentMessage 초기화, 다시 한줄한줄 넣기.
//                     currentMessage = line + '\n';
//                 } else {
//                     //기존 currentMessage 에 현재 라인 추가
//                     currentMessage += line + '\n';
//                 }
//             });

//             if (currentMessage) messages.push(currentMessage);
//             return messages;
//         };

//         const fullMessage = `
// **투표 현황:(${result.voteRate})**
// ${userId}님의 투표 상태는 *** ${myVote} *** 이며, 순번은 ***${myNumber || '없음'}*** 입니다.

// **------- 🟢 우선참여: ${result.specialParticipated}명 --------**\n${numberedSpecialParticipants.join('\n')}

// **------- 🔵 참여: ${result.participated}명 --------**\n${numberedParticipants.join('\n')}

// **-------- 🔴 불참: ${result.notParticipated}명 --------**\n${sortedNotParticipatedUser.join('\n')}

// **-------- ❔ 미투표: ${result.notVoted}명 --------**\n${sortedNotVotedUser.join('\n')}
// `;

//         // 메시지 나누기
//         const messages = splitLongMessage(fullMessage);

//         // 첫 번째 메시지는 editReply로 보냄
//         await interaction.editReply({ content: messages[0], ephemeral: true });

//         // 나머지 메시지는 followUp으로 보냄
//         for (let i = 1; i < messages.length; i++) {
//             await interaction.followUp({ content: messages[i], ephemeral: true });
//         }

//         setTimeout(() => interaction.deleteReply(), 60000);
//     }
// };
