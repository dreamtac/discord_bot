const { VOTE_PERMISSIONS } = require('../../utils/constants');
const prisma = require('../../utils/prisma');
const votingStatus = require('../../votingStatus');

// 중복 이벤트 방지를 위한 캐시
const recentUpdates = new Map();
const DEBOUNCE_TIME = 2000; // 2초 동안 같은 사용자에 대한 중복 이벤트 무시

// 닉네임 또는 역할 변경 시 DB 업데이트
module.exports = async (oldMember, newMember) => {
    // 변경 사항 확인
    const displayNameChanged = oldMember.displayName !== newMember.displayName;
    const rolesChanged = !areRolesEqual(oldMember.roles.cache, newMember.roles.cache);

    // 변경 사항이 없으면 무시
    if (!displayNameChanged && !rolesChanged) {
        return;
    }

    // 중복 이벤트 확인 및 처리
    const userId = newMember.id;
    const updateType = displayNameChanged ? 'displayName' : 'roles';
    const updateKey = `${userId}-${updateType}`;
    const now = Date.now();

    // 최근에 이미 처리한 업데이트인지 확인
    if (recentUpdates.has(updateKey)) {
        const lastUpdate = recentUpdates.get(updateKey);
        if (now - lastUpdate < DEBOUNCE_TIME) {
            // 디바운스 시간 내 중복 이벤트 무시
            console.log(`중복 이벤트 무시: ${updateKey} (${now - lastUpdate}ms 내)`);
            return;
        }
    }

    // 현재 업데이트 시간 저장
    recentUpdates.set(updateKey, now);

    // 오래된 캐시 항목 정리 (5분 이상 된 항목)
    const CACHE_LIFETIME = 5 * 60 * 1000; // 5분
    for (const [key, timestamp] of recentUpdates.entries()) {
        if (now - timestamp > CACHE_LIFETIME) {
            recentUpdates.delete(key);
        }
    }

    try {
        // 변경 내용 로깅
        if (displayNameChanged) {
            console.log(`닉네임 변경 감지: ${oldMember.displayName} → ${newMember.displayName}`);
        }

        if (rolesChanged) {
            const oldRoles = oldMember.roles.cache.map(role => role.name).join(', ');
            const newRoles = newMember.roles.cache.map(role => role.name).join(', ');
            console.log(`역할 변경 감지: [${oldRoles}] → [${newRoles}]`);
            if (VOTE_PERMISSIONS.some(permission => newRoles.includes(permission))) {
                console.log(`투표 권한 부여: ${newMember.displayName}`);
                try {
                    // 1. user 찾기
                    const user = await prisma.user.findFirst({
                        where: { discordId: newMember.id },
                    });
                    if (!user) return;

                    // 2. activeVote 찾기
                    const activeVote = await prisma.vote.findFirst({
                        where: { isActive: true },
                    });
                    if (!activeVote) return;

                    // 3. 이미 VoteStatus가 있는지 확인
                    const existingVoteStatus = await prisma.voteStatus.findFirst({
                        where: {
                            userId: user.id,
                            voteId: activeVote.id,
                        },
                    });

                    // 4. 없으면 생성
                    if (!existingVoteStatus) {
                        await prisma.voteStatus.create({
                            data: {
                                userId: user.id,
                                status: '미투표',
                                voteId: activeVote.id,
                            },
                        });
                        console.log('VoteStatus 생성 완료');
                    }
                } catch (error) {
                    console.error('투표 권한 부여 중 오류 발생:', error);
                }
            }
        }
        // 1. DB에서 사용자 찾기 (discordId로 검색)
        const user = await prisma.user.findFirst({
            where: { discordId: newMember.id },
        });

        // 2. DB에 해당 사용자가 존재하는지 확인
        if (!user) {
            console.log(`DB에서 사용자를 찾을 수 없음: discordId ${newMember.id}`);
            return;
        }

        // 3. 닉네임 변경 시, 닉네임이 이미 다른 사용자에 의해 사용 중인지 확인 (충돌 방지)
        if (displayNameChanged) {
            const existingUser = await prisma.user.findFirst({
                where: {
                    displayName: newMember.displayName,
                    discordId: { not: newMember.id },
                },
            });

            if (existingUser) {
                console.error(`닉네임 충돌 발생: ${newMember.displayName}은(는) 이미 다른 사용자가 사용 중입니다.`);
                return;
            }
        }

        // 4. 사용자 정보 업데이트
        await prisma.user.update({
            where: { id: user.id },
            data: {
                // 닉네임이 변경된 경우에만 업데이트
                ...(displayNameChanged && { displayName: newMember.displayName }),
                // 역할은 항상 최신 상태로 업데이트
                roles: newMember.roles.cache.map(role => role.name),
            },
        });

        if (displayNameChanged) {
            console.log(`사용자 정보 업데이트 완료: ${oldMember.displayName} → ${newMember.displayName}`);
        }
        if (rolesChanged) {
            console.log(`사용자 역할 업데이트 완료 (${newMember.displayName})`);
        }

        // 5. 현재 활성화된 투표가 있는지 확인
        const activeVote = await prisma.vote.findFirst({
            where: { isActive: true },
        });

        if (!activeVote) {
            console.log('활성화된 투표가 없습니다.');
            return;
        }

        // 6. 닉네임 변경 시 메모리 내 투표 상태 업데이트 (votingStatus 객체)
        if (displayNameChanged && votingStatus.getStatus()[oldMember.displayName]) {
            const status = votingStatus.getStatus()[oldMember.displayName];

            // 이전 닉네임의 상태를 새 닉네임으로 복사
            votingStatus.getStatus()[newMember.displayName] = status;

            // 이전 닉네임의 상태 삭제
            delete votingStatus.getStatus()[oldMember.displayName];

            // 순서 배열에서도 업데이트
            const order = votingStatus._getOrder();
            if (order) {
                const index = order.indexOf(oldMember.displayName);
                if (index !== -1) {
                    order[index] = newMember.displayName;
                }
            }

            console.log(`메모리 상의 투표 상태 업데이트 완료: ${oldMember.displayName} → ${newMember.displayName}`);
        }

        // DB 최신화 알림 (변경 사항이 있을 때만)
        if (displayNameChanged) {
            await votingStatus.refreshFromDB();
        }
    } catch (error) {
        console.error('사용자 정보 업데이트 중 오류 발생:', error);
    }
};

// 두 역할 컬렉션이 동일한지 비교하는 함수
function areRolesEqual(oldRoles, newRoles) {
    // 역할 ID 배열로 변환
    const oldRoleIds = Array.from(oldRoles.keys()).sort();
    const newRoleIds = Array.from(newRoles.keys()).sort();

    // 배열 길이가 다르면 다른 역할 구성
    if (oldRoleIds.length !== newRoleIds.length) {
        return false;
    }

    // ID를 하나씩 비교
    for (let i = 0; i < oldRoleIds.length; i++) {
        if (oldRoleIds[i] !== newRoleIds[i]) {
            return false;
        }
    }

    return true;
}
