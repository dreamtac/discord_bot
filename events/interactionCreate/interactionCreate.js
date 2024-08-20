const votingStatus = require('../../votingStatus');

module.exports = async interaction => {
    const moment = require('moment-timezone');
    const krTime = moment().tz('Asia/seoul').format(`YYYY-MM-DD HH:mm:ss`);
    if (!interaction.isButton()) {
        // console.log(
        //     `투표시작 or 종료 : ${
        //         (interaction.member.nickname ? interaction.member.nickname : interaction.user.username,
        //         interaction.customId)
        //     }`
        // );
        return;
    }
    //버튼 누른 유저 확인용
    console.log(
        `${interaction.member.nickname ? interaction.member.nickname : interaction.user.username} : ${
            interaction.customId
        } - ${krTime}`
    );

    await interaction.deferReply({ ephemeral: true }).catch(err => {
        console.log(`버튼 이벤트 에러: ${err}`);
        interaction.followUp({ content: '에러가 발생했습니다. 다시 시도해주세요.', ephemeral: true });
    });
    const userId = interaction.member.nickname ? interaction.member.nickname : interaction.user.username;

    if (interaction.customId === 'btnFirstTrue') {
        //투표가 종료되었는지 체크
        if (votingStatus.isVotingClosed()) {
            console.log(`투표 종료로 요청 거절됨`);
            await interaction.editReply({
                content: `투표가 종료되었습니다. 더 이상 참여할 수 없습니다.`,
                ephemeral: true,
            });
            setTimeout(() => interaction.deleteReply(), 5000);
            return;
        } else {
            votingStatus.setStatus(userId, '우선참여');
            await interaction.editReply({ content: '우선참여로 기록되었습니다.', ephemeral: true });
            setTimeout(() => interaction.deleteReply(), 5000);
        }
    } else if (interaction.customId === 'btnTrue') {
        //투표가 종료되었는지 체크
        if (votingStatus.isVotingClosed()) {
            console.log(`투표 종료로 요청 거절됨`);
            await interaction.editReply({
                content: `투표가 종료되었습니다. 더 이상 참여할 수 없습니다.`,
                ephemeral: true,
            });
            setTimeout(() => interaction.deleteReply(), 5000);
            return;
        } else {
            votingStatus.setStatus(userId, '참여');
            await interaction.editReply({ content: '참여로 기록되었습니다.', ephemeral: true });
            setTimeout(() => interaction.deleteReply(), 5000);
        }
    } else if (interaction.customId === 'btnFalse') {
        //투표가 종료되었는지 체크
        if (votingStatus.isVotingClosed()) {
            console.log(`투표 종료로 요청 거절됨`);
            await interaction.editReply({
                content: `투표가 종료되었습니다. 더 이상 참여할 수 없습니다.`,
                ephemeral: true,
            });
            setTimeout(() => interaction.deleteReply(), 5000);
            return;
        } else {
            votingStatus.setStatus(userId, '불참');
            await interaction.editReply({ content: '불참으로 기록되었습니다.', ephemeral: true });
            setTimeout(() => interaction.deleteReply(), 5000);
        }
    } else if (interaction.customId === 'btnResult') {
        const result = votingStatus.getResult();
        let numberedSpecialParticipants = result.specialParticipatedUser.map(
            (user, index) => `*${index + 1}번*  ${user}`
        );
        let numberedParticipants = result.participatedUser.map(
            (user, index) => `*${index + 1 + numberedSpecialParticipants.length}번*  ${user}`
        );

        //불참, 미투표자는 알파벳순으로
        let sortedNotParticipatedUser = result.notParticipatedUser.sort();
        let sortedNotVotedUser = result.notVotedUser.sort();

        const replyMessage = await interaction.editReply({
            content: `
**투표 현황:(${result.voteRate})**

**------- 우선참여: ${result.specialParticipated}명 --------**\n${numberedSpecialParticipants.join('\n')}

**------- 참여: ${result.participated}명 --------**\n${numberedParticipants.join('\n')}

**-------- 불참: ${result.notParticipated}명 --------**\n${sortedNotParticipatedUser.join('\n')}

**-------- 미투표: ${result.notVoted}명 --------**\n${sortedNotVotedUser.join('\n')}
`,
            ephemeral: true,
        });
        // console.log(`우선참여: ${numberedSpecialParticipants}`);
        // console.log(`참여: ${numberedParticipants}`);
        // console.log(`불참: ${sortedNotParticipatedUser}`);
        // console.log(`미투표: ${sortedNotVotedUser}`);
        // console.log(replyMessage.content);
        setTimeout(() => interaction.deleteReply(), 60000);
    }
};
