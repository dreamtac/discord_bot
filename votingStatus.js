const MemberDB = require('./models/memberDB');
const VotingState = require('./models/votingStateDB');
const moment = require('moment-timezone');

let votingStatus = {}; // 각 유저별 투표 상태를 저장할 객체
let order = []; // 투표 순서 기록용 배열
let votingClosed = true; // 투표 종료 상태를 관리하는 변수

let queue = [];
let queueRunning = false;

// 큐에 있는 작업들(task) 가 0개가 될 때까지 하나씩 꺼내서 실행.
// 작업들은 유저가 우선참여, 참여, 불참 버튼을 눌렀을때 수행하는 작업들을 의미.
const runQueue = async () => {
    while (queue.length > 0) {
        // console.log('큐 작업중...');
        const task = queue.shift();
        await task();
    }
    queueRunning = false;
};

module.exports = {
    getStatus: () => votingStatus,
    setStatus: async (userId, status) => {
        if (!votingClosed) {
            // console.log('큐에 작업 추가 중...');
            await new Promise(resolve => {
                queue.push(async () => {
                    try {
                        // console.log('Processing queue task for: ', userId);
                        votingStatus[userId] = status;
                        const existingIndex = order.indexOf(userId);

                        if (status === '우선참여' || status === '참여') {
                            if (existingIndex === -1) {
                                order.push(userId);
                            } else {
                                order[existingIndex] = null;
                                order.push(userId);
                            }

                            const krTime = moment().tz('Asia/seoul').format(`YYYY-MM-DD HH:mm:ss`);
                            let number = order.length;

                            await MemberDB.findOneAndUpdate(
                                { nickName: userId },
                                { status, number: number, date: krTime },
                                { upsert: true, new: true }
                            );
                        } else if (status === '불참' || status === '미투표') {
                            if (existingIndex !== -1) {
                                order[existingIndex] = null;
                            }
                            const krTime = moment().tz('Asia/seoul').format(`YYYY-MM-DD HH:mm:ss`);
                            await MemberDB.findOneAndUpdate(
                                { nickName: userId },
                                { status, number: null, date: krTime },
                                { upsert: true, new: true }
                            );
                        }
                    } catch (err) {
                        console.error('Error processing task:', err);
                    } finally {
                        // console.log('작업 완료');
                        resolve();
                    }
                });

                // console.log('queue:', queue);
                // console.log('큐 실행 준비 중...');
                if (!queueRunning) {
                    // console.log('큐 실행 시작');
                    queueRunning = true;
                    runQueue();
                }
            });
        }
    },
    openVoting: async () => {
        //************초기화 코드************//
        order = []; //기존 배열 초기화
        votingStatus = {}; // 유저별 투표 상태 초기화
        queue = []; //비동기 작업 큐 초기화
        queueRunning = false; // 큐 작업 상태 초기화
        votingClosed = true; // 투표 종료 상태로 초기화

        await MemberDB.collection.drop(); //컬렉션 삭제
        await VotingState.findOneAndUpdate({}, { closed: true }, { upsert: true });

        const krTime = moment().tz('Asia/seoul').format(`YYYY-MM-DD HH:mm:ss`);
        console.log(`투표 데이터 초기화 완료! - ${krTime}`);
        //************초기화 코드************//

        votingClosed = false;
        // order = []; //기존 배열 초기화
        // await MemberDB.deleteMany({}); //기존 투표 데이터 db에서 삭제
        await VotingState.findOneAndUpdate({}, { closed: false }, { upsert: true }); // db 투표 진행 상황 초기화
        console.log(`투표 시작됨! - ${krTime}`);
    },
    initData: async () => {
        order = []; //기존 배열 초기화
        votingStatus = {}; // 유저별 투표 상태 초기화
        queue = []; //비동기 작업 큐 초기화
        queueRunning = false; // 큐 작업 상태 초기화
        votingClosed = true; // 투표 종료 상태로 초기화

        await MemberDB.collection.drop(); //컬렉션 삭제
        await VotingState.findOneAndUpdate({}, { closed: true }, { upsert: true });

        const krTime = moment().tz('Asia/seoul').format(`YYYY-MM-DD HH:mm:ss`);
        console.log(`투표 데이터 초기화 완료! - ${krTime}`);
    },
    closeVoting: async () => {
        await VotingState.findOneAndUpdate({}, { closed: true }, { upsert: true });
        const krTime = moment().tz('Asia/seoul').format(`YYYY-MM-DD HH:mm:ss`);
        console.log(`투표 종료됨! - ${krTime}`);
        votingClosed = true;
        // return (votingClosed = true);
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
