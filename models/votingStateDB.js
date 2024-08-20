const { Schema, model } = require('mongoose');

const votingStateSchema = new Schema({
    closed: {
        type: Boolean,
        default: true,
    },
});

module.exports = model('VotingState', votingStateSchema);
