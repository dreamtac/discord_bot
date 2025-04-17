const cron = require('node-cron');

// 테스트용 5초 스케줄러 함수
function startTestScheduler() {
    const task = cron.schedule('*/5 * * * * *', () => {
        const now = new Date();
        console.log(`[테스트 스케줄러] 현재 시간: ${now.toISOString()} - 5초마다 실행`);
    });

    console.log('테스트 스케줄러가 시작되었습니다. 5초마다 실행됩니다.');

    return task; // 나중에 중지할 수 있도록 task 반환
}

module.exports = { startTestScheduler };
