require('dotenv').config();
const {
    Client,
    GatewayIntentBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    Events,
    EmbedBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
} = require('discord.js');
const { Guilds, GuildMessages, MessageContent } = GatewayIntentBits;
const client = new Client({ intents: [Guilds, GuildMessages, MessageContent, GatewayIntentBits.GuildMembers] });
client.login(process.env.DICO_TOKEN);

let votingStatus = {}; // 각 유저별 투표 상태를 저장할 객체
let date = ''; //거점전 날짜

client.once('ready', async () => {
    console.log(client.user.tag + ' 준비 완료!');
    const guild = client.guilds.cache.get('368772417088126978');

    console.log('fetching users');
    let res = await guild.members.fetch();
    res.forEach(member => {
        console.log(member.user.username);
        if (member.user.username === '투표봇') return; //투표봇은 리스트에 추가x
        votingStatus[member.user.username] = '미투표'; // 초기 상태는 미투표
        // console.log(member.nickname);
        // votingStatus[member.nickname] = '미투표'; // 초기 상태는 미투표
    });
});

client.on('messageCreate', async msg => {
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

        const embed = new EmbedBuilder()
            .setColor(0x0099ff)
            .setTitle('검은사막 거점전 투표')
            .addFields({ name: 일시, value: date, inline: false })
            .setDescription('아래 버튼을 눌러 투표에 참여해주세요.')
            .setTimestamp()
            .setFooter({ text: '투표 시스템' });

        const Buttons = new ActionRowBuilder().addComponents(button, button2, button3);

        msg.reply({ embeds: [embed], components: [Buttons] });
        // const modal = new ModalBuilder().setCustomId('modalDate').setTitle('거점전 날짜');

        // const dateInput = new TextInputBuilder()
        //     .setCustomId('inputDate')
        //     .setLabel('거점전 날짜를 입력해주세요 (예: 12.25)')
        //     .setStyle(TextInputStyle.Short)
        //     .setPlaceholder('MM.DD 형식으로 입력')
        //     .setRequired(true);

        // const firstActionRow = new ActionRowBuilder().addComponents(dateInput);
        // modal.addComponents(firstActionRow);

        // await msg.reply({ content: '거점전 날짜를 설정해주세요:', components: [], ephemeral: true });
        // await msg.showModal(modal);
    }
});

client.on(Events.InteractionCreate, async interaction => {
    // if (interaction.isModalSubmit()) {
    //     if (interaction.customId === 'modalDate') {
    //         //사용자가 입력한 일시 가져오기
    //         date = interaction.fields.getTextInputValue('inputDate');
    //         console.log(`거점 날짜: ${date}`);

    //         //투표 시작 임베드 생성
    //         const button = new ButtonBuilder().setLabel('참여').setCustomId('true').setStyle(ButtonStyle.Primary);
    //         const button2 = new ButtonBuilder().setLabel('불참').setCustomId('false').setStyle(ButtonStyle.Danger);
    //         const button3 = new ButtonBuilder()
    //             .setLabel('투표 현황')
    //             .setCustomId('result')
    //             .setStyle(ButtonStyle.Secondary);

    //         const embed = new EmbedBuilder()
    //             .setColor(0x0099ff)
    //             .setTitle('검은사막 거점전 투표')
    //             .addFields({ name: 일시, value: date, inline: false })
    //             .setDescription('아래 버튼을 눌러 투표에 참여해주세요.')
    //             .setTimestamp()
    //             .setFooter({ text: '투표 시스템' });

    //         const Buttons = new ActionRowBuilder().addComponents(button, button2, button3);

    //         msg.reply({ embeds: [embed], components: [Buttons] });
    //     }
    // }
    if (!interaction.isButton()) return;
    // const memberNickname = interaction.member.nickname;
    // console.log(memberNickname);
    const memberName = interaction.user.username;
    console.log('버튼 누른 사람: ', interaction.user.username);
    if (interaction.customId === 'true') {
        // votingStatus[memberNickname] = '참여';
        votingStatus[memberName] = '참여';
        console.log(votingStatus);
        const replyMessage = await interaction.reply({ content: '참여로 기록되었습니다.', ephemeral: true });
    } else if (interaction.customId === 'false') {
        // votingStatus[memberNickname] = '불참';
        votingStatus[memberName] = '불참';
        console.log(votingStatus);
        const replyMessage = await interaction.reply({ content: '불참으로 기록되었습니다.', ephemeral: true });
    } else if (interaction.customId === 'result') {
        const totalUsers = Object.keys(votingStatus).length;
        const participated = Object.keys(votingStatus).filter(nickname => votingStatus[nickname] === '참여');
        const notParticipated = Object.keys(votingStatus).filter(nickname => votingStatus[nickname] === '불참');
        const notVoted = Object.keys(votingStatus).filter(nickname => votingStatus[nickname] === '미투표');

        const replyMessage = await interaction.reply({
            content: `
***투표 현황 - ${participated.length + notParticipated.length}/${totalUsers}***

**-------- 참여자 ${participated.length}명 --------** \n${participated.join('\n')}\n
**-------- 불참자 ${notParticipated.length}명 --------** \n${notParticipated.join('\n')}\n
**-------- 미투표자 ${notVoted.length}명 --------** \n${notVoted.join('\n')}\n
`,
            ephemeral: true,
        });
    }
});
