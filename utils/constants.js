const VOTE_PERMISSIONS = ['응애', '노예왕', '노역꾼', 'GANG', '돚거단', '포도당', '접어'];

const CREATE_VOTE_PERMISSIONS = ['운영진', '관리자'];
const CREATE_VOTE_PERMISSIONS_DEV = ['노역꾼'];

const REGION_SELECT_MENU_OPTIONS = [
    {
        label: '발레노스/세렌디아',
        value: '발레노스/세렌디아',
        description: '발레노스/세렌디아 지역 거점전',
    },
    {
        label: '칼페온/카마실비아',
        value: '칼페온/카마실비아',
        description: '칼페온/카마실비아 지역 거점전',
    },
    {
        label: '메디아/발렌시아',
        value: '메디아/발렌시아',
        description: '메디아/발렌시아 거점전',
    },
    {
        label: '칼페온',
        value: '칼페온',
        description: '칼페온 지역 공성전',
    },
    {
        label: '메디아',
        value: '메디아',
        description: '메디아 지역 공성전',
    },
    {
        label: '발렌시아',
        value: '발렌시아',
        description: '발렌시아 지역 공성전',
    },
    {
        label: '미정',
        value: '미정',
        description: '지역 미정',
    },
];

module.exports = { CREATE_VOTE_PERMISSIONS, CREATE_VOTE_PERMISSIONS_DEV, REGION_SELECT_MENU_OPTIONS, VOTE_PERMISSIONS };
