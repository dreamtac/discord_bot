const { default: mongoose } = require('mongoose');
const moment = require('moment-timezone');
const krTime = moment().tz('Asia/seoul').format(`YYYY-MM-DD HH:mm:ss`);

module.exports = async client => {
    console.log(`${client.user.username} is online. - ${krTime}`);
};
