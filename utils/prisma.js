const { PrismaClient } = require('../generated/prisma');

// PrismaClient는 싱글톤으로 관리
let prisma;

// 개발 환경인 경우 DATABASE_URL_DEV 환경 변수를 사용하도록 설정
const prismaOptions = {};
if (process.env.NODE_ENV === 'development' && process.env.DATABASE_URL_DEV) {
    prismaOptions.datasources = {
        db: {
            url: process.env.DATABASE_URL_DEV,
        },
    };
    console.log('개발용 데이터베이스 연결 사용 중...');
} else {
    console.log('프로덕션 데이터베이스 연결 사용 중...');
}

// 개발 환경이 아닌 경우 일반 인스턴스 생성 (프로덕션, 스테이징 등)
if (process.env.NODE_ENV !== 'development') {
    prisma = new PrismaClient(prismaOptions);
} else {
    // 개발 환경에서는 핫 리로드시 중복 인스턴스 생성 방지
    if (!global.prisma) {
        global.prisma = new PrismaClient(prismaOptions);
    }
    prisma = global.prisma;
}

module.exports = prisma;
