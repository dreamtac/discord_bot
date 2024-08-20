const MemberDB = require('./models/memberDB');
const VotingState = require('./models/votingStateDB');
const moment = require('moment-timezone');

let votingStatus = {}; // 각 유저별 투표 상태를 저장할 객체
let order = []; // 투표 순서 기록용 배열
let votingClosed = true; // 투표 종료 상태를 관리하는 변수

module.exports = {
    getStatus: () => votingStatus,
    setStatus: async (userId, status) => {
        if (!votingClosed) {
            votingStatus[userId] = status;
            const existingIndex = order.indexOf(userId);

            if (status === '우선참여' || status === '참여') {
                // 참여 상태라면 order에 추가
                if (existingIndex === -1) {
                    //유저가 아직 order배열에 없을 때만 order에 추가
                    order.push(userId);
                    // order.splice(existingIndex, 1);
                } else {
                    order[existingIndex] = null;
                    order.push(userId);
                }

                const krTime = moment().tz('Asia/seoul').format(`YYYY-MM-DD HH:mm:ss`);

                let memberDoc = await MemberDB.findOne({ nickName: userId });
                let number;

                // if (memberDoc && memberDoc.number) {
                //     number = memberDoc.number;
                // } else {
                //     number = order.length;
                // }

                number = order.length;

                await MemberDB.findOneAndUpdate(
                    { nickName: userId },
                    { status, number: number, date: krTime },
                    { upsert: true, new: true }
                );
            } else if (status === '불참' || status === '미투표') {
                //불참 또는 미투표 상태라면 order를 null로 변경, number = null로 설정
                if (existingIndex !== -1) {
                    order[existingIndex] = null; //기존 위치를 null로 표시
                    // order.splice(existingIndex,1);
                }
                const krTime = moment().tz('Asia/seoul').format(`YYYY-MM-DD HH:mm:ss`);
                await MemberDB.findOneAndUpdate(
                    { nickName: userId },
                    { status, number: null, date: krTime },
                    { upsert: true, new: true }
                );
            }
        }
    },

    openVoting: async () => {
        votingClosed = false;
        order = [];
        await MemberDB.deleteMany({}); //기존 투표 데이터 db에서 삭제
        await VotingState.findOneAndUpdate({}, { closed: false }, { upsert: true });
        const krTime = moment().tz('Asia/seoul').format(`YYYY-MM-DD HH:mm:ss`);
        console.log(`투표 시작됨! - ${krTime}`);
    },
    closeVoting: async () => {
        await VotingState.findOneAndUpdate({}, { closed: true }, { upsert: true });
        console.log('투표 종료됨!');
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

    //서버 재시작 시 투표 상태 복원
    restoreVotingStatus: async () => {
        const votingState = await VotingState.findOne({});
        if (votingState && !votingState.closed) {
            votingClosed = false; //투표가 종료되지 않았다면 투표를 자동으로 활성화 상태로 변경
        }
        const statuses = await MemberDB.find({}).sort({ number: 1 });
        order = [];
        statuses.forEach(doc => {
            console.log(`재부팅..:`, `${doc.nickName} ${doc.status} ${doc.number}`);
            votingStatus[doc.nickName] = doc.status;
            if (doc.status === '우선참여' || doc.status === '참여') {
                console.log(`order 배열에 추가...`);
                order[doc.number - 1] = doc.nickName;
            }
            console.log('재부팅 order: ', order);
            // order[doc.number - 1] = doc.nickName;
        });
    },
};
