// 특정 유저 참여 처리 Line 447 ~ 452 (해당 라인만 지우면 특정 유저 참여처리 없앰)
const {
    ActionRowBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    EmbedBuilder,
    ButtonBuilder,
    ButtonStyle,
    SlashCommandBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
} = require('discord.js');
// PrismaClient 직접 임포트 및 인스턴스 생성 제거
// const { PrismaClient } = require('../generated/prisma'); // Prisma 클라이언트 가져오기
const {
    CREATE_VOTE_PERMISSIONS,
    CREATE_VOTE_PERMISSIONS_DEV,
    REGION_SELECT_MENU_OPTIONS,
    VOTE_PERMISSIONS,
} = require('../utils/constants');
const { validateDate } = require('../utils/dateValidator'); // 날짜 검증 유틸리티 추가
// Prisma 클라이언트 초기화 제거
// const prisma = new PrismaClient();
// 대신 싱글톤 인스턴스 사용
const prisma = require('../utils/prisma');
const isDevMode = process.env.NODE_ENV === 'development';
const logger = require('../utils/logger');

// votingStatus 모듈은 계속 사용 (현재 코드와의 호환성 유지를 위해)
const votingStatus = require('../votingStatus');

module.exports = {
    run: async ({ interaction }) => {
        // 역할 확인: '응애'나 '노역꾼' 역할을 가지고 있는지 체크
        if (!isDevMode) {
            const hasRequiredRole = interaction.member.roles.cache.some(role =>
                CREATE_VOTE_PERMISSIONS.includes(role.name)
            );
            if (!hasRequiredRole) {
                await interaction.reply({
                    content: `투표를 진행하기 위해서는 '운영진' 또는 '관리자' 역할이 필요합니다.`,
                    ephemeral: true,
                });
                return;
            }
        } else {
            const hasRequiredRole = interaction.member.roles.cache.some(role =>
                CREATE_VOTE_PERMISSIONS_DEV.includes(role.name)
            );
            if (!hasRequiredRole) {
                await interaction.reply({
                    content: `투표를 진행하기 위해서는 '노역꾼' 역할이 필요합니다.`,
                    ephemeral: true,
                });
                return;
            }
        }

        // 활성화된 투표가 있는지 확인
        const activeVote = await prisma.vote.findFirst({
            where: { isActive: true },
        });

        if (activeVote) {
            await interaction.reply({
                content: `투표가 이미 진행중입니다.\n'/종료' 를 입력해 진행중인 투표를 종료해주세요.`,
                ephemeral: true,
            });
            return;
        }

        // 모달 생성 - 먼저 날짜와 설명을 입력받음
        const modal = new ModalBuilder({
            customId: `voteModal`,
            title: `투표 정보 입력`,
        });

        const voteTitle = new TextInputBuilder({
            customId: `inputDate`,
            label: `공성/거점이 열리는 날짜를 입력해주세요.`,
            placeholder: `ex) 08/20 or 2024-08-20(화)`,
            style: TextInputStyle.Short,
            required: true,
        });

        const voteDescription = new TextInputBuilder({
            customId: `inputDescription`,
            label: `공성/거점에 대한 추가 정보를 입력해주세요.`,
            placeholder: `ex) 추가 정보를 입력하세요`,
            style: TextInputStyle.Paragraph,
            required: false,
        });

        const firstActionRow = new ActionRowBuilder().addComponents(voteTitle);
        const secondActionRow = new ActionRowBuilder().addComponents(voteDescription);

        modal.addComponents(firstActionRow, secondActionRow);

        await interaction.showModal(modal);

        // 제출 처리
        const filter = i => i.customId === `voteModal` && i.user.id === interaction.user.id;

        try {
            const modalInteraction = await interaction.awaitModalSubmit({ filter, time: 600000 });

            // 모달 응답 시 로딩 메시지 표시
            await modalInteraction.deferReply({ ephemeral: isDevMode });

            const date = modalInteraction.fields.getTextInputValue('inputDate');
            const additionalDescription = modalInteraction.fields.getTextInputValue('inputDescription');

            // 날짜 형식 및 유효성 검증 - 외부 유틸리티 사용
            const dateValidation = validateDate(date);

            if (!dateValidation.isValid) {
                await modalInteraction.editReply({
                    content: `⚠️ ${dateValidation.errorMessage}`,
                    ephemeral: true,
                });
                return;
            }

            const formattedDate = dateValidation.formattedDate;

            // 지역 선택 메뉴 표시
            const regionSelect = new StringSelectMenuBuilder()
                .setCustomId('region-select')
                .setPlaceholder('공성/거점 지역을 선택하세요');

            // constants.js에서 가져온 옵션 사용
            REGION_SELECT_MENU_OPTIONS.forEach(option => {
                regionSelect.addOptions(
                    new StringSelectMenuOptionBuilder()
                        .setLabel(option.label)
                        .setDescription(option.description)
                        .setValue(option.value)
                );
            });

            const selectRow = new ActionRowBuilder().addComponents(regionSelect);

            // 입력한 정보를 포함한 임베드 생성
            const infoEmbed = new EmbedBuilder()
                .setColor(0x0099ff)
                .setTitle('투표 정보')
                .addFields(
                    { name: '날짜', value: formattedDate },
                    { name: '추가 정보', value: additionalDescription || '없음' }
                )
                .setFooter({ text: '지역을 선택하여 투표를 시작하세요.' });

            // 지역 선택 메시지 전송
            await modalInteraction.editReply({
                embeds: [infoEmbed],
                components: [selectRow],
                ephemeral: isDevMode,
            });

            // 지역 선택 메뉴 응답 대기
            const regionFilter = i => i.customId === 'region-select' && i.user.id === interaction.user.id;
            const regionCollection = modalInteraction.channel.createMessageComponentCollector({
                filter: regionFilter,
                time: 60000,
                max: 1,
            });

            regionCollection.on('collect', async regionInteraction => {
                await regionInteraction.deferUpdate();

                // 선택된 지역
                const selectedRegion = regionInteraction.values[0];

                // 투표 준비 중임을 알리는 임베드
                const loadingEmbed = new EmbedBuilder()
                    .setColor(0x0099ff)
                    .setTitle('투표 준비 중')
                    .setDescription('투표를 준비하고 있습니다. 잠시만 기다려주세요...')
                    .setFooter({ text: '데이터베이스 작업 진행 중' });

                await modalInteraction.editReply({
                    embeds: [loadingEmbed],
                    components: [],
                });

                try {
                    // 1. 새 투표 생성
                    const description = `안내사항\n${additionalDescription || '없음'}`;

                    const newVote = await prisma.vote.create({
                        data: {
                            title: `공성/거점 투표: ${formattedDate} ${selectedRegion}`,
                            description: description,
                            date: formattedDate,
                            region: selectedRegion,
                            isActive: true,
                        },
                    });

                    // 2. 서버의 모든 멤버 가져오기
                    const guild = interaction.guild;
                    const members = await guild.members.fetch();

                    // 3. 필터링된 멤버 목록 생성
                    const eligibleMembers = members.filter(member => {
                        // 멤버의 역할이 유효한지 확인
                        if (!member || !member.roles || !member.roles.cache) {
                            console.log(
                                `역할 정보가 없는 멤버 발견: ${
                                    member ? member.displayName || 'Unknown' : 'Undefined member'
                                }`
                            );
                            return false;
                        }

                        // 봇과 용병 역할 체크
                        const isBot = member.user ? member.user.bot : false;
                        const hasYongbyungRole = member.roles.cache.some(role => role.name === '용병');

                        // 필요한 역할 체크
                        const hasRequiredRole = member.roles.cache.some(role => VOTE_PERMISSIONS.includes(role.name));

                        return !isBot && !hasYongbyungRole && hasRequiredRole;
                    });

                    // 4. 투표 시스템 초기화
                    const operations = [];
                    const userMap = new Map(); // 메모리 상태 추적용
                    let order = []; // 투표 순서 추적

                    // 기존 votingStatus 호환성을 위한 초기화
                    await votingStatus.openVoting();

                    try {
                        console.log('사용자 처리 시작...');
                        logger.info('사용자 처리 시작...');
                        const startTime = Date.now();

                        // 일괄 처리를 위한 준비
                        const memberArray = Array.from(eligibleMembers);
                        const processedIds = new Set(); // 이미 처리된 ID 추적

                        // 기존 사용자 ID 조회 (DB 쿼리 최소화)
                        console.log('기존 사용자 조회 중...');
                        const existingUsers = await prisma.user.findMany();
                        const existingUserMap = new Map(); // ID로 빠르게 찾기 위한 맵

                        existingUsers.forEach(user => {
                            existingUserMap.set(user.discordId, user);
                        });

                        console.log(`기존 사용자 ${existingUsers.length}명 로드 완료`);

                        // 새 사용자 처리를 위한 배열
                        const newUsers = [];
                        const allVoteStatuses = [];

                        // 5. 각 사용자를 처리하고 새 사용자와 기존 사용자 구분
                        for (const member of memberArray) {
                            // member 형태 확인 및 ID 추출
                            let discordId, memberObject;

                            if (Array.isArray(member)) {
                                discordId = member[0];
                                memberObject = member[1];
                            } else {
                                discordId = member.id;
                                memberObject = member;
                            }

                            if (!discordId) {
                                console.log(`유효하지 않은 멤버 (ID 없음)`);
                                continue; // 이 멤버는 건너뜀
                            }

                            // 중복 처리 방지
                            if (processedIds.has(discordId)) {
                                continue;
                            }
                            processedIds.add(discordId);

                            // memberObject에서 displayName 가져오기
                            const displayName =
                                memberObject && memberObject.displayName
                                    ? memberObject.displayName
                                    : memberObject && memberObject.user && memberObject.user.globalName
                                    ? memberObject.user.globalName
                                    : 'Unknown';

                            // 역할 정보 안전하게 가져오기
                            const roles =
                                memberObject && memberObject.roles && memberObject.roles.cache
                                    ? memberObject.roles.cache.map(role => role.name)
                                    : [];

                            // 기존 사용자인지 확인
                            const existingUser = existingUserMap.get(discordId);

                            if (!existingUser) {
                                // 새 사용자 생성 준비
                                newUsers.push({
                                    discordId,
                                    displayName,
                                    roles,
                                });
                            } else {
                                // 기존 사용자 정보 업데이트 (필요한 경우)
                                if (existingUser.displayName !== displayName) {
                                    await prisma.user.update({
                                        where: { id: existingUser.id },
                                        data: { displayName, roles },
                                    });
                                }

                                // 투표 상태 생성 준비
                                allVoteStatuses.push({
                                    status: '미투표',
                                    userId: existingUser.id,
                                    voteId: newVote.id,
                                });

                                // 메모리 상태 업데이트
                                votingStatus[displayName] = '미투표';
                                userMap.set(displayName, { userId: existingUser.id, status: '미투표', discordId });
                            }
                        }

                        // 6. 새 사용자 일괄 생성 (필요한 경우)
                        if (newUsers.length > 0) {
                            console.log(`새 사용자 ${newUsers.length}명 생성 중...`);

                            // 배치 단위로 사용자 생성
                            const userBatchSize = 20;
                            const createdUserIds = [];

                            for (let i = 0; i < newUsers.length; i += userBatchSize) {
                                const userBatch = newUsers.slice(i, i + userBatchSize);
                                try {
                                    // 각 배치의 사용자를 개별적으로 생성하고 ID를 수집
                                    const createdBatch = await prisma.$transaction(
                                        userBatch.map(userData =>
                                            prisma.user.create({
                                                data: userData,
                                            })
                                        )
                                    );

                                    // 생성된 사용자 정보 취합
                                    createdBatch.forEach(user => {
                                        createdUserIds.push(user.id);

                                        // 투표 상태 생성 준비
                                        allVoteStatuses.push({
                                            status: '미투표',
                                            userId: user.id,
                                            voteId: newVote.id,
                                        });

                                        // 메모리 상태 업데이트
                                        votingStatus[user.displayName] = '미투표';
                                        userMap.set(user.displayName, {
                                            userId: user.id,
                                            status: '미투표',
                                            discordId: user.discordId,
                                        });
                                    });

                                    console.log(
                                        `사용자 배치 처리 완료: ${i + 1}~${Math.min(
                                            i + userBatchSize,
                                            newUsers.length
                                        )}/${newUsers.length}`
                                    );
                                } catch (userBatchErr) {
                                    console.error(
                                        `사용자 배치 처리 중 오류 발생 (${i + 1}~${Math.min(
                                            i + userBatchSize,
                                            newUsers.length
                                        )}):`,
                                        userBatchErr
                                    );
                                    // 개별 배치 오류는 전체 프로세스를 중단시키지 않음
                                }
                            }

                            console.log(`새 사용자 ${createdUserIds.length}명 생성 완료`);
                        }

                        // 7. 투표 상태 일괄 생성
                        console.log(`투표 상태 ${allVoteStatuses.length}개 생성 중...`);

                        // skipDuplicates 옵션이 지원되지 않으므로 직접 중복 검사를 수행
                        // 먼저 기존 투표 상태를 조회하여 중복을 방지
                        const existingVoteStatuses = await prisma.voteStatus.findMany({
                            where: {
                                voteId: newVote.id,
                            },
                            select: {
                                userId: true,
                            },
                        });

                        // 이미 있는 userId 목록
                        const existingUserIds = new Set(existingVoteStatuses.map(status => status.userId));

                        // 중복되지 않는 항목만 필터링
                        const uniqueVoteStatuses = allVoteStatuses.filter(
                            status => !existingUserIds.has(status.userId)
                        );

                        console.log(`중복 제거 후 ${uniqueVoteStatuses.length}개 투표 상태 생성 중...`);

                        // 데이터를 작은 배치로 나누어 처리 (대량 데이터 처리 시 성능 향상)
                        const batchSize = 20; // 한 번에 처리할 레코드 수

                        for (let i = 0; i < uniqueVoteStatuses.length; i += batchSize) {
                            const batch = uniqueVoteStatuses.slice(i, i + batchSize);
                            try {
                                // 각 배치를 트랜잭션으로 처리하여 일관성 유지
                                await prisma.$transaction(
                                    batch.map(status =>
                                        prisma.voteStatus.create({
                                            data: status,
                                        })
                                    )
                                );
                                console.log(
                                    `배치 처리 완료: ${i + 1}~${Math.min(i + batchSize, uniqueVoteStatuses.length)}/${
                                        uniqueVoteStatuses.length
                                    }`
                                );
                            } catch (batchErr) {
                                console.error(
                                    `배치 처리 중 오류 발생 (${i + 1}~${Math.min(
                                        i + batchSize,
                                        uniqueVoteStatuses.length
                                    )}):`,
                                    batchErr
                                );
                                // 개별 배치 오류는 전체 프로세스를 중단시키지 않음
                            }
                        }

                        const endTime = Date.now();

                        logger.info(`사용자 처리 완료 (${(endTime - startTime) / 1000}초 소요)`);
                        console.log(`사용자 처리 완료 (${(endTime - startTime) / 1000}초 소요)`);

                        // 특정 유저 참여 처리 시작
                        setTimeout(() => {
                            votingStatus.setStatus('[GANG] 연', '참여');
                            logger.info('[GANG] 연 참여 처리 완료');
                            console.log('[GANG] 연 참여 처리 완료');
                        }, 2200); // 2.2초 뒤에 [GANG] 연 참여 처리 완료
                        // 특정 유저 참여 처리 끝

                        // 8. 투표 상태 설정을 호환성 있게 재정의
                        const originalSetStatus = votingStatus.setStatus;
                        votingStatus.setStatus = async (displayName, status) => {
                            // 기존 로직 유지
                            await originalSetStatus(displayName, status);

                            // Prisma를 통한 DB 업데이트
                            const userInfo = userMap.get(displayName);
                            if (userInfo) {
                                const number = status === '우선참여' || status === '참여' ? order.length + 1 : null;

                                // 순서 업데이트
                                if (status === '우선참여' || status === '참여') {
                                    const existingIndex = order.indexOf(displayName);
                                    if (existingIndex === -1) {
                                        order.push(displayName);
                                    } else {
                                        order[existingIndex] = null;
                                        order.push(displayName);
                                    }
                                }

                                // DB 업데이트
                                await prisma.voteStatus.updateMany({
                                    where: {
                                        userId: userInfo.userId,
                                        voteId: newVote.id,
                                    },
                                    data: {
                                        status,
                                        number,
                                        date: new Date(),
                                    },
                                });
                            }
                        };
                    } catch (err) {
                        console.error('사용자 처리 중 오류 발생:', err);
                        throw err; // 상위 오류 처리로 전달
                    }

                    // 8. 투표 메시지 생성 및 표시
                    const button = new ButtonBuilder()
                        .setLabel('우선참여 (특수병)')
                        .setCustomId('btnFirstTrue')
                        .setStyle(ButtonStyle.Primary);
                    const button1 = new ButtonBuilder()
                        .setLabel('참여')
                        .setCustomId('btnTrue')
                        .setStyle(ButtonStyle.Primary);
                    const button2 = new ButtonBuilder()
                        .setLabel('불참')
                        .setCustomId('btnFalse')
                        .setStyle(ButtonStyle.Danger);
                    const button3 = new ButtonBuilder()
                        .setLabel('참여 현황')
                        .setCustomId('btnResultParticipated')
                        .setStyle(ButtonStyle.Secondary);
                    const byGuildButton = new ButtonBuilder()
                        .setLabel('길드별 참여 현황')
                        .setCustomId('btnResultByGuild')
                        .setStyle(ButtonStyle.Secondary);
                    const button4 = new ButtonBuilder()
                        .setLabel('불참/미투표 현황')
                        .setCustomId('btnResultNotParticipated')
                        .setStyle(ButtonStyle.Secondary);

                    // ActionRow를 두 줄로 분리
                    const row1 = new ActionRowBuilder().addComponents(button, button1, button2);
                    const row2 = new ActionRowBuilder().addComponents(button3, byGuildButton, button4);

                    const embed = new EmbedBuilder()
                        .setColor(0x5865f2) // 디스코드 브랜드 컬러로 변경
                        .setTitle(`📢 공성/거점 투표`)
                        .addFields(
                            { name: '📅 일시', value: `\`${formattedDate}\``, inline: true },
                            { name: '🗺️ 지역', value: `\`${selectedRegion}\``, inline: true },
                            { name: '\u200B', value: '\u200B', inline: true }, // 빈 필드로 줄 맞춤
                            {
                                name: '📌 주의사항',
                                value: '투표 인원이 몰리면 속도가 느려질 수 있습니다.\n투표를 여러번 누르면 순번이 밀려날 수 있으니 주의해주세요.',
                            }
                        )
                        .setDescription(`${description}`)
                        .setFooter({
                            text: '상호작용 오류 발생 시 10초 후 다시 시도해주세요',
                        });

                    let message;

                    if (isDevMode) {
                        // 개발 모드: 명령어 실행자에게만 표시 (ephemeral)
                        message = await modalInteraction.editReply({
                            embeds: [embed],
                            components: [row1, row2],
                            fetchReply: true,
                        });

                        console.log('테스트 모드에서 투표 메시지가 생성되었습니다 (ephemeral)');
                        logger.info('테스트 모드에서 투표 메시지가 생성되었습니다 (ephemeral)');
                    } else {
                        // 프로덕션 모드: 모든 사람에게 표시
                        message = await modalInteraction.editReply({
                            embeds: [embed],
                            components: [row1, row2],
                            fetchReply: true,
                        });

                        console.log('프로덕션 모드에서 투표 메시지가 생성되었습니다 (공개)');
                        logger.info('프로덕션 모드에서 투표 메시지가 생성되었습니다 (공개)');
                    }

                    // 9. 투표가 활성화됨을 설정
                    votingStatus.setVotingActiveStatus(true);
                    // 10. 메시지 객체 저장
                    votingStatus.setMessage(message);

                    console.log(`투표가 시작되었습니다. ${eligibleMembers.size}명의 멤버가 초기화되었습니다.`);
                    logger.info(`투표가 시작되었습니다. ${eligibleMembers.size}명의 멤버가 초기화되었습니다.`);
                } catch (err) {
                    console.error('투표 초기화 중 오류 발생:', err);
                    logger.error('투표 초기화 중 오류 발생:', err);

                    // 에러 발생 시 생성된 투표가 있다면 비활성화
                    try {
                        await prisma.vote.updateMany({
                            where: { isActive: true },
                            data: { isActive: false },
                        });
                    } catch (cleanupErr) {
                        console.error('투표 정리 중 오류 발생:', cleanupErr);
                        logger.error('투표 정리 중 오류 발생:', cleanupErr);
                    }

                    await modalInteraction.editReply({
                        content: '투표 초기화 중 오류가 발생했습니다. 다시 시도해주세요.',
                        embeds: [],
                        components: [],
                    });

                    // 오류 발생 시 투표 상태 초기화
                    votingStatus.closeVoting();
                }
            });
        } catch (err) {
            console.error('투표 초기화 중 오류 발생:', err);

            // 에러 발생 시 생성된 투표가 있다면 비활성화
            try {
                await prisma.vote.updateMany({
                    where: { isActive: true },
                    data: { isActive: false },
                });
            } catch (cleanupErr) {
                console.error('투표 정리 중 오류 발생:', cleanupErr);
            }

            await interaction.editReply({
                content: '투표 초기화 중 오류가 발생했습니다. 다시 시도해주세요.',
                embeds: [],
                components: [],
            });

            // 오류 발생 시 투표 상태 초기화
            votingStatus.closeVoting();
        }
    },

    data: new SlashCommandBuilder().setName('투표').setDescription('투표를 시작합니다.'),
};
