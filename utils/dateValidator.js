/**
 * @fileoverview 날짜 형식 검증을 위한 유틸리티 함수 모음
 * @description 투표용 날짜 형식 검증 및 포맷팅을 담당하는 유틸리티
 * @module utils/dateValidator
 * @author dreamtac
 * @version 1.0.0
 */

/**
 * 날짜 형식 검증 유틸리티
 * 지원하는 날짜 형식:
 * - MM/DD 형식 (예: 08/20)
 * - MM-DD 형식 (예: 08-20)
 * - YYYY-MM-DD 형식 (예: 2024-08-20)
 * - YYYY/MM/DD 형식 (예: 2024/08/20)
 * - YYYY-MM-DD(요일) 형식 (예: 2024-08-20(화))
 */

/**
 * 날짜 문자열이 지원하는 형식인지 검증
 * @param {string} dateString - 검증할 날짜 문자열
 * @returns {boolean} 유효한 형식이면 true, 아니면 false
 */
function isValidDateFormat(dateString) {
    if (!dateString) return false;

    // MM/DD 형식 검증
    const mmddSlashRegex = /^\d{1,2}\/\d{1,2}$/;

    // MM-DD 형식 검증
    const mmddHyphenRegex = /^\d{1,2}-\d{1,2}$/;

    // YYYY-MM-DD 또는 YYYY-MM-DD(요일) 형식 검증
    const yyyymmddHyphenRegex = /^\d{4}-\d{1,2}-\d{1,2}(\(\S+\))?$/;

    // YYYY/MM/DD 형식 검증
    const yyyymmddSlashRegex = /^\d{4}\/\d{1,2}\/\d{1,2}$/;

    return (
        mmddSlashRegex.test(dateString) ||
        mmddHyphenRegex.test(dateString) ||
        yyyymmddHyphenRegex.test(dateString) ||
        yyyymmddSlashRegex.test(dateString)
    );
}

/**
 * 날짜가 실제로 존재하는 날짜인지 검증
 *
 * @param {string} dateString - 검증할 날짜 문자열
 * @returns {Object} 검증 결과 객체
 * @property {boolean} isValid - 날짜가 유효한지 여부
 * @property {string} formattedDate - 포맷팅된 날짜 문자열
 * @property {string} errorMessage - 오류 메시지 (유효하지 않은 경우에만)
 *
 * @example
 * // 유효한 날짜인 경우
 * validateDate('05/20')
 * // 결과: { isValid: true, formattedDate: '05/20', errorMessage: '' }
 *
 * @example
 * // 유효하지 않은 날짜인 경우
 * validateDate('02/31')
 * // 결과: { isValid: false, formattedDate: '02/31', errorMessage: '2월 31일은 존재하지 않는 날짜입니다.' }
 */
function validateDate(dateString) {
    if (!isValidDateFormat(dateString)) {
        return {
            isValid: false,
            formattedDate: dateString,
            errorMessage:
                '올바른 날짜 형식이 아닙니다. 다음 형식 중 하나로 입력해주세요:\n- MM/DD (예: 8/20 또는 08/20)\n- MM-DD (예: 8-20 또는 08-20)\n- YYYY-MM-DD (예: 2024-08-20)\n- YYYY/MM/DD (예: 2024/08/20)\n- YYYY-MM-DD(요일) (예: 2024-08-20(화))',
        };
    }

    let isValid = true;
    let formattedDate = dateString;
    let errorMessage = '';

    try {
        // MM/DD 형식 처리
        if (dateString.match(/^\d{1,2}\/\d{1,2}$/)) {
            const [month, day] = dateString.split('/').map(Number);

            // 월과 일 범위 확인
            if (month < 1 || month > 12 || day < 1 || day > 31) {
                isValid = false;
                errorMessage = '유효하지 않은 월 또는 일입니다.';
            } else {
                // 해당 월의 날짜 유효성 확인 (2월 30일, 31일 같은 경우 검증)
                const currentYear = new Date().getFullYear();
                const testDate = new Date(currentYear, month - 1, day);

                if (testDate.getMonth() !== month - 1 || testDate.getDate() !== day) {
                    isValid = false;
                    errorMessage = `${month}월 ${day}일은 존재하지 않는 날짜입니다.`;
                } else {
                    // 날짜를 MM/DD 형식으로 정리
                    formattedDate = `${month.toString().padStart(2, '0')}/${day.toString().padStart(2, '0')}`;
                }
            }
        }
        // MM-DD 형식 처리
        else if (dateString.match(/^\d{1,2}-\d{1,2}$/)) {
            const [month, day] = dateString.split('-').map(Number);

            // 월과 일 범위 확인
            if (month < 1 || month > 12 || day < 1 || day > 31) {
                isValid = false;
                errorMessage = '유효하지 않은 월 또는 일입니다.';
            } else {
                // 해당 월의 날짜 유효성 확인 (2월 30일, 31일 같은 경우 검증)
                const currentYear = new Date().getFullYear();
                const testDate = new Date(currentYear, month - 1, day);

                if (testDate.getMonth() !== month - 1 || testDate.getDate() !== day) {
                    isValid = false;
                    errorMessage = `${month}월 ${day}일은 존재하지 않는 날짜입니다.`;
                } else {
                    // 날짜를 MM-DD 형식으로 정리
                    formattedDate = `${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
                }
            }
        }
        // YYYY/MM/DD 형식 처리
        else if (dateString.match(/^\d{4}\/\d{1,2}\/\d{1,2}$/)) {
            const [year, month, day] = dateString.split('/').map(Number);

            // 날짜 유효성 확인
            const testDate = new Date(year, month - 1, day);
            if (testDate.getFullYear() !== year || testDate.getMonth() !== month - 1 || testDate.getDate() !== day) {
                isValid = false;
                errorMessage = `${year}년 ${month}월 ${day}일은 존재하지 않는 날짜입니다.`;
            } else {
                // 원본 형식 유지하되 0 패딩 추가
                formattedDate = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
            }
        }
        // YYYY-MM-DD 형식 처리
        else if (dateString.match(/^\d{4}-\d{1,2}-\d{1,2}/)) {
            let dateOnly = dateString;
            // 요일 정보가 있으면 제거하고 날짜만 추출
            if (dateString.includes('(')) {
                dateOnly = dateString.split('(')[0].trim();
            }

            const [year, month, day] = dateOnly.split('-').map(Number);

            // 날짜 유효성 확인
            const testDate = new Date(year, month - 1, day);
            if (testDate.getFullYear() !== year || testDate.getMonth() !== month - 1 || testDate.getDate() !== day) {
                isValid = false;
                errorMessage = `${year}년 ${month}월 ${day}일은 존재하지 않는 날짜입니다.`;
            } else {
                // 원본 형식 유지 (요일 정보 포함)
                formattedDate = dateString;
            }
        }
    } catch (e) {
        isValid = false;
        errorMessage = '날짜 유효성 검증 중 오류가 발생했습니다.';
        console.error('날짜 검증 중 오류:', e);
    }

    if (!isValid && !errorMessage) {
        errorMessage = '유효하지 않은 날짜입니다. 실제 존재하는 날짜를 입력해주세요.';
    }

    return {
        isValid,
        formattedDate,
        errorMessage,
    };
}

module.exports = {
    isValidDateFormat,
    validateDate,
};
