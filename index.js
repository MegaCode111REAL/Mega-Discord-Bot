const { Client, GatewayIntentBits, Partials, Routes, REST, SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, WebhookClient } = require('discord.js');
const { token, clientId } = require('./config.json');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel]
});

const quietedUsers = new Map();

const commands = [
  new SlashCommandBuilder()
    .setName('sudo')
    .setDescription('Send a message as someone else')
    .addStringOption(option => option.setName('username').setDescription('Name to use').setRequired(true))
    .addStringOption(option => option.setName('message').setDescription('Message to send').setRequired(true)),

  new SlashCommandBuilder()
    .setName('question')
    .setDescription('Ask someone why they sent a message')
    .addStringOption(option => option.setName('user').setDescription('User').setRequired(true))
    .addStringOption(option => option.setName('message').setDescription('Message content').setRequired(true)),

  new SlashCommandBuilder()
    .setName('quiet')
    .setDescription('Quiet a user so they get random shut up messages')
    .addStringOption(option => option.setName('username').setDescription('Username to quiet').setRequired(true))
];

client.once('ready', async () => {
  console.log(`🟢 Logged in as ${client.user.tag}`);
  const rest = new REST({ version: '10' }).setToken(token);
  await rest.put(Routes.applicationCommands(clientId), { body: commands.map(cmd => cmd.toJSON()) });
  console.log('✅ Slash commands registered');
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, options, channel, guild, user } = interaction;

  // OWNER/admin role check
  const isDM = !guild;
  const member = guild?.members.cache.get(user.id);
  const roles = member?.roles.cache.map(r => r.name) || [];
  const isOwner = roles.includes('OWNER') || roles.includes('admin') || roles.includes('Admin');

  if (!isDM && commandName !== 'question' && !isOwner) {
    return interaction.reply({ content: '❌ You must have the OWNER or admin role to use this command.', ephemeral: true });
  }

  if (commandName === 'sudo') {
    const username = options.getString('username');
    const msg = options.getString('message');

    const webhook = await channel.createWebhook({ name: username });
    await webhook.send({ content: msg, username });
    await interaction.reply({ content: `🧱 Sent as **${username}**: "${msg}"`, ephemeral: true });
    setTimeout(() => webhook.delete().catch(() => {}), 5000);
  }

  else if (commandName === 'question') {
    const targetUser = options.getString('user');
    const msg = options.getString('message');
    const target = client.users.cache.find(u => u.username === targetUser);

    const dmMsg = isDM
      ? `Why did you send “${msg}” to ${targetUser}?`
      : `Why did you send “${msg}” in ${guild.name}?`;

    try {
      await user.send(dmMsg);
      await interaction.reply({ content: '📨 Question sent.', ephemeral: true });
    } catch {
      await interaction.reply({ content: '❌ Could not send DM.', ephemeral: true });
    }
  }

  else if (commandName === 'quiet') {
    const targetName = options.getString('username');
    const target = client.users.cache.find(u => u.username === targetName);
    if (!target) return interaction.reply({ content: '❌ User not found.', ephemeral: true });

    quietedUsers.set(target.id, user.username);

    if (isDM) {
      const messages = [
        `'${user.username}' doesn’t care, why are you talking?`,
        `You've been silenced by ${user.username}.`,
        `${user.username} said to stop talking.`,
        `${user.username} muted you, FYI.`
      ];
      const random = messages[Math.floor(Math.random() * messages.length)];
      try {
        await target.send(random);
        await interaction.reply({ content: '✅ Quieted in DMs.', ephemeral: true });
      } catch {
        await interaction.reply({ content: '❌ Could not DM user.', ephemeral: true });
      }
    } else {
      await interaction.reply({ content: `🤫 ${targetName} will now be quieted.`, ephemeral: true });
    }
  }
});

client.on('messageCreate', async message => {
  if (message.author.bot) return;

  const quietedBy = quietedUsers.get(message.author.id);
  if (!quietedBy) return;

  if (!message.guild) return;

  const channel = message.channel;
  const webhook = await channel.createWebhook({ name: message.author.username });

  try {
    await message.delete();
    await webhook.send({
      content: message.content,
      username: message.author.username,
      avatarURL: message.author.displayAvatarURL(),
      flags: 64 // ephemeral
    });

    const responses = [
      `'${quietedBy}' doesn’t care, why are you talking?`,
      `${quietedBy} muted you.`,
      `No one wants to hear that, says ${quietedBy}.`,
      `${quietedBy} told you to zip it.`
    ];
    const random = responses[Math.floor(Math.random() * responses.length)];

    await message.channel.send({ content: random, ephemeral: true });
  } catch (err) {
    console.error(err);
  } finally {
    setTimeout(() => webhook.delete().catch(() => {}), 5000);
  }
});

client.login(token);