module.exports = {
    run: ({ interaction }) => {
        interaction.reply({ content: 'Pong!', ephemeral: true });
    },

    data: {
        name: '핑',
        description: 'Pong!',
    },
};
