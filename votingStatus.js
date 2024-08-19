let votingStatus = {}; // 각 유저별 투표 상태를 저장할 객체
let order = []; // 투표 순서 기록용 배열
let votingClosed = true; // 투표 종료 상태를 관리하는 변수

module.exports = {
    getStatus: () => votingStatus,
    setStatus: (userId, status) => {
        if (!votingClosed) {
            votingStatus[userId] = status;

            //배열에 유저가 이미 존재한다면 삭제후 다시 추가
            const existingIndex = order.indexOf(userId);
            if (existingIndex !== -1) {
                order.splice(existingIndex, 1);
            }
            order.push(userId);
            // if (!order.includes(userId)) {
            //     order.push(userId);
            // }
        }
    },
    openVoting: () => {
        votingClosed = false;
    },
    closeVoting: () => {
        return (votingClosed = true);
    },
    isVotingClosed: () => {
        return votingClosed;
    },
    getResult: () => {
        const totalUsers = Object.keys(votingStatus).length;
        const specialParticipated = Object.values(votingStatus).filter(status => status === '우선참여').length;
        const participated = Object.values(votingStatus).filter(status => status === '참여').length;
        const notParticipated = Object.values(votingStatus).filter(status => status === '불참').length;
        const notVoted = Object.values(votingStatus).filter(status => status === '미투표').length;
        const voteRate = `${specialParticipated + participated + notParticipated}/${totalUsers}`;

        let specialParticipatedUser = [];
        let participatedUser = [];

        order.forEach(userId => {
            if (votingStatus[userId] === '우선참여') {
                specialParticipatedUser.push(userId);
            } else if (votingStatus[userId] === '참여') {
                participatedUser.push(userId);
            }
        });

        // 투표 상태가 '불참'인 유저 목록을 필터링
        const notParticipatedUser = Object.entries(votingStatus)
            .filter(([userId, status]) => status === '불참')
            .map(([userId]) => userId); // 참여한 유저들의 ID 목록

        // 투표 상태가 '미투표'인 유저 목록을 필터링
        const notVotedUser = Object.entries(votingStatus)
            .filter(([userId, status]) => status === '미투표')
            .map(([userId]) => userId); // 미투표 유저들의 ID 목록

        return {
            totalUsers,
            specialParticipated,
            participated,
            notParticipated,
            notVoted,
            voteRate,
            specialParticipatedUser,
            participatedUser,
            notParticipatedUser,
            notVotedUser,
        };
    },
};
