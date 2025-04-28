const prisma = require('../../utils/prisma');
const votingStatus = require('../../votingStatus');
const { VOTE_PERMISSIONS } = require('../../utils/constants');

// 새 멤버 서버 입장 시 DB에 추가
module.exports = async member => {
    try {
        console.log(`새 멤버 입장 감지: ${member.displayName} (ID: ${member.id})`);

        // 멤버가 봇인 경우 무시
        if (member.user.bot) {
            console.log(`봇 계정은 처리하지 않습니다: ${member.displayName}`);
            return;
        }

        // 이미 DB에 존재하는지 확인
        const existingUser = await prisma.user.findFirst({
            where: { discordId: member.id },
        });

        if (existingUser) {
            console.log(`사용자가 이미 DB에 존재합니다: ${member.displayName} (ID: ${member.id})`);

            // displayName이 변경되었는지 확인하고 업데이트
            if (existingUser.displayName !== member.displayName) {
                await prisma.user.update({
                    where: { id: existingUser.id },
                    data: {
                        displayName: member.displayName,
                        roles: member.roles.cache.map(role => role.name),
                    },
                });
                console.log(`기존 사용자 정보 업데이트: ${existingUser.displayName} → ${member.displayName}`);
            }
            return;
        }

        // 역할 정보 가져오기
        const roles = member.roles.cache.map(role => role.name);

        // 투표 적격 여부 확인 (투표 가능한 역할을 갖고 있는지)
        const hasRequiredRole = member.roles.cache.some(role => VOTE_PERMISSIONS.includes(role.name));

        // DB에 사용자 추가
        const newUser = await prisma.user.create({
            data: {
                discordId: member.id,
                displayName: member.displayName,
                roles: roles,
            },
        });

        console.log(`새 사용자 DB 등록 완료: ${member.displayName} (ID: ${member.id})`);

        // 현재 활성화된 투표가 있는지 확인
        const activeVote = await prisma.vote.findFirst({
            where: { isActive: true },
        });

        if (!activeVote) {
            console.log('활성화된 투표가 없습니다. 투표 상태를 설정하지 않습니다.');
            return;
        }

        // 투표 자격이 있는 경우에만 투표 상태 생성
        if (hasRequiredRole) {
            // 투표 상태 생성 (기본값: 미투표)
            await prisma.voteStatus.create({
                data: {
                    status: '미투표',
                    userId: newUser.id,
                    voteId: activeVote.id,
                },
            });

            // 메모리 상태에도 추가
            votingStatus.getStatus()[member.displayName] = '미투표';

            console.log(`${member.displayName} 사용자의 투표 상태가 '미투표'로 초기화되었습니다.`);

            // 추가된 사용자가 있으므로 투표 현황 UI 업데이트 (선택 사항)
            // 필요한 경우 임베드 메시지 업데이트 로직 추가
        } else {
            console.log(`${member.displayName} 사용자는 필요한 역할이 없어 투표 상태를 생성하지 않습니다.`);
        }
    } catch (error) {
        console.error('새 멤버 처리 중 오류 발생:', error);
    }
};
