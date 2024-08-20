const { Schema, model } = require('mongoose');

const now = new Date();
const gmtNow = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
const krTimeDiff = 9 * 60 * 60 * 1000;
const krNow = new Date(gmtNow + krTimeDiff);

const memberSchema = new Schema({
    nickName: {
        //닉네임
        type: String,
        required: true,
        unique: true,
    },
    status: {
        //투표 상태
        type: String,
        required: true,
        default: '미투표',
    },
    number: {
        //투표 순번
        type: Number,
        require: false,
    },
    date: {
        //투표한 시간
        type: String,
        default: krNow,
    },
});

module.exports = model('memberDB', memberSchema);
