require('dotenv').config();
const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, Events } = require('discord.js');
const { Guilds, GuildMessages, MessageContent } = GatewayIntentBits;
const client = new Client({ intents: [Guilds, GuildMessages, MessageContent, GatewayIntentBits.GuildMembers] });
client.login(process.env.DICO_TOKEN);

let votingStatus = {}; // 각 유저별 투표 상태를 저장할 객체

client.once('ready', async () => {
    console.log(client.user.tag + ' 준비 완료!');
    const guild = client.guilds.cache.get('368772417088126978');

    console.log('fetching users');
    let res = await guild.members.fetch();
    res.forEach(member => {
        console.log(member.user.username);
        votingStatus[member.user.username] = '미투표'; // 초기 상태는 미투표
        // console.log(member.nickname);
        // votingStatus[member.nickname] = '미투표'; // 초기 상태는 미투표
    });
});

client.on('messageCreate', msg => {
    const content = msg.content;

    if (content === '하이') {
        msg.reply('안녕하세요!');
    }
    if (content === '핑') {
        msg.channel.send('퐁!');
    }
    if (content === '삭제') {
        msg.delete();
        msg.reply('삭제 했어요!');
    }

    if (content === '!투표') {
        const button = new ButtonBuilder().setLabel('참여').setCustomId('true').setStyle(ButtonStyle.Primary);
        const button2 = new ButtonBuilder().setLabel('불참').setCustomId('false').setStyle(ButtonStyle.Danger);
        const button3 = new ButtonBuilder().setLabel('투표 현황').setCustomId('result').setStyle(ButtonStyle.Secondary);

        const Buttons = new ActionRowBuilder().addComponents(button, button2, button3);

        msg.reply({ components: [Buttons] });
    }
});

client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isButton()) return;

    // const memberNickname = interaction.member.nickname;
    // console.log(memberNickname);
    const memberName = interaction.user.username;
    console.log(interaction.user.username);
    if (interaction.customId === 'true') {
        // votingStatus[memberNickname] = '참여';
        votingStatus[memberName] = '참여';
        console.log(votingStatus);
        await interaction.reply({ content: '참여로 기록되었습니다.', ephemeral: true });
    } else if (interaction.customId === 'false') {
        // votingStatus[memberNickname] = '불참';
        votingStatus[memberName] = '불참';
        console.log(votingStatus);
        await interaction.reply({ content: '불참으로 기록되었습니다.', ephemeral: true });
    } else if (interaction.customId === 'result') {
        const participated = Object.keys(votingStatus).filter(nickname => votingStatus[nickname] === '참여');
        const notParticipated = Object.keys(votingStatus).filter(nickname => votingStatus[nickname] === '불참');
        const notVoted = Object.keys(votingStatus).filter(nickname => votingStatus[nickname] === '미투표');

        await interaction.reply({
            content: `
            **투표 현황**
            참여자: ${participated.length}명
            불참자: ${notParticipated.length}명
            미투표자: ${notVoted.length}명
            `,
            ephemeral: true,
        });
    }
});
