const { Client, GatewayIntentBits, Partials, REST, Routes, SlashCommandBuilder, ChannelType, EmbedBuilder, PermissionsBitField } = require('discord.js');
const TOKEN = 'YOUR_BOT_TOKEN';
const CLIENT_ID = 'YOUR_CLIENT_ID';
const GUILD_ID = 'YOUR_GUILD_ID'; // Optional if registering globally

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Channel]
});

const quietedUsers = new Map(); // { userId: { quietedBy: string } }

const commands = [
  new SlashCommandBuilder()
    .setName('sudo')
    .setDescription('Send a message pretending to be someone else')
    .addStringOption(opt => opt.setName('username').setDescription('Target username').setRequired(true))
    .addStringOption(opt => opt.setName('message').setDescription('Message to send').setRequired(true))
    .addStringOption(opt => opt.setName('avatar_name').setDescription('Optional: username to copy avatar/effects from')),

  new SlashCommandBuilder()
    .setName('question')
    .setDescription('DM someone asking why they sent a message')
    .addStringOption(opt => opt.setName('user').setDescription('Their username').setRequired(true))
    .addStringOption(opt => opt.setName('message').setDescription('The message').setRequired(true)),

  new SlashCommandBuilder()
    .setName('quiet')
    .setDescription('Tell someone to be quiet')
    .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true)),

  new SlashCommandBuilder()
    .setName('unquiet')
    .setDescription('Stop quieting a user')
    .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true)),

  // Add other commands here...
];

const rest = new REST({ version: '10' }).setToken(TOKEN);
(async () => {
  try {
    console.log('🔄 Registering slash commands...');
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands.map(cmd => cmd.toJSON()) });
    console.log('✅ Slash commands registered.');
  } catch (err) {
    console.error('❌ Error registering commands:', err);
  }
})();

client.on('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = interaction.commandName;

  if (command === 'sudo') {
    const username = interaction.options.getString('username');
    const message = interaction.options.getString('message');
    const avatarName = interaction.options.getString('avatar_name');

    const webhook = await interaction.channel.createWebhook({ name: username });
    const avatarUser = avatarName
      ? interaction.guild?.members.cache.find(m => m.user.username === avatarName)
      : null;

    await webhook.send({
      content: message,
      username,
      avatarURL: avatarUser?.user.displayAvatarURL({ dynamic: true }) ?? undefined
    });

    await webhook.delete();
    await interaction.reply({ content: `🧱 Sent message as ${username}`, ephemeral: true });
  }

  if (command === 'question') {
    const targetUser = interaction.options.getString('user');
    const message = interaction.options.getString('message');
    const questioner = interaction.user.username;

    try {
      const user = await client.users.cache.find(u => u.username === targetUser);
      const context = interaction.guild
        ? `in **${interaction.guild.name}**`
        : `to **${interaction.user.username}**`;
      await user.send(`❓ Why did you send “${message}” ${context}?`);
      await interaction.reply({ content: '✅ Question sent.', ephemeral: true });
    } catch {
      await interaction.reply({ content: '❌ Could not DM user.', ephemeral: true });
    }
  }

  if (command === 'quiet') {
    const target = interaction.options.getUser('user');
    const quieter = interaction.user.username;

    quietedUsers.set(target.id, { quietedBy: quieter });

    if (interaction.channel.type === ChannelType.DM) {
      await target.send(randomQuietResponse(quieter));
      await interaction.reply({ content: `✅ DM’d ${target.username} to be quiet.`, ephemeral: true });
    } else {
      await interaction.reply({ content: `🔇 ${target.username} has been told to be quiet.`, ephemeral: true });
    }
  }

  if (command === 'unquiet') {
    const target = interaction.options.getUser('user');
    quietedUsers.delete(target.id);
    await interaction.reply({ content: `✅ ${target.username} is no longer quieted.`, ephemeral: true });
  }

  // Other command logic goes here
});

client.on('messageCreate', async message => {
  if (message.author.bot) return;

  const quieted = quietedUsers.get(message.author.id);
  if (quieted && message.guild) {
    const replies = [
      `🔇 Shut up, ${message.author.username}.`,
      `${quieted.quietedBy} told you to zip it, ${message.author.username}.`,
      `${message.author.username}, no one asked.`,
      `${quieted.quietedBy} muted you for a reason.`
    ];
    const reply = replies[Math.floor(Math.random() * replies.length)];
    message.channel.send(reply);
  }
});

function randomQuietResponse(quieter) {
  const responses = [
    `“${quieter}” doesn’t care, why are you talking?`,
    `You’ve been silenced by ${quieter}.`,
    `${quieter} told me to shut you up.`,
    `Nobody asked, ${quieter} says be quiet.`
  ];
  return responses[Math.floor(Math.random() * responses.length)];
}

client.login(TOKEN);