const { PrismaClient } = require('../generated/prisma');

// PrismaClient는 싱글톤으로 관리
let prisma;

// 개발 환경이 아닌 경우 일반 인스턴스 생성 (프로덕션, 스테이징 등)
if (process.env.NODE_ENV !== 'development') {
    prisma = new PrismaClient();
} else {
    // 개발 환경에서는 핫 리로드시 중복 인스턴스 생성 방지
    if (!global.prisma) {
        global.prisma = new PrismaClient();
    }
    prisma = global.prisma;
}

module.exports = prisma;
