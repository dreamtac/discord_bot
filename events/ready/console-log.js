const { restoreVotingStatus } = require('../../votingStatus');
const { default: mongoose } = require('mongoose');
const moment = require('moment-timezone');
const krTime = moment().tz('Asia/seoul').format(`YYYY-MM-DD HH:mm:ss`);
const cron = require('node-cron');
module.exports = async client => {
    console.log(`${client.user.username} is online. - ${krTime}`);
    await restoreVotingStatus(client);

    if (process.env.NODE_ENV === 'development') {
        // 매 정각의 5초마다 실행되도록 설정 (초 분 시 일 월 요일)
        //5 0 * * * *
        cron.schedule('5 0 * * * *', async () => {
            const currentTime = moment().tz('Asia/seoul').format(`YYYY-MM-DD HH:mm:ss`);
            console.log(`정각 5초마다 실행 - ${currentTime}`);

            try {
                console.log('API 호출 시작...');
                const response = await fetch(`${process.env.NEXT_URL}/api/vote/check`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${process.env.CRON_API_SECRET}`,
                        'Content-Type': 'application/json',
                    },
                });

                console.log('API 응답 상태:', response.status, response.statusText);
                console.log('API URL:', `${process.env.NEXT_URL}/api/vote/check`);

                if (!response.ok) {
                    console.log(`API 오류: ${response.status} - ${response.statusText}`);
                    return;
                }

                // 응답을 텍스트로 먼저 받아서 확인
                const responseText = await response.text();
                console.log('응답 텍스트 미리보기:', responseText.substring(0, 100) + '...');

                try {
                    // 텍스트가 JSON인 경우에만 파싱
                    if (responseText.trim().startsWith('{') || responseText.trim().startsWith('[')) {
                        const data = JSON.parse(responseText);
                        console.log('성공 여부:', data.success);
                        console.log('메시지:', data.message);
                    } else {
                        console.log('응답이 JSON 형식이 아닙니다. API 경로나 인증을 확인하세요.');
                    }
                } catch (jsonError) {
                    console.error('JSON 파싱 오류:', jsonError);
                }
            } catch (error) {
                console.error('API 호출 중 오류 발생:', error);
            }
        });
    }
};

// const response = await axios.post(VERCEL_API_URL, {}, {
//     headers: {
//       'Authorization': `Bearer ${API_SECRET}`,
//       'Content-Type': 'application/json'
//     }
//   });

//   console.log('투표 상태 업데이트 결과:', response.data);
