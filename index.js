const { Client, GatewayIntentBits, Partials, Routes, REST, SlashCommandBuilder, EmbedBuilder, WebhookClient, PermissionsBitField } = require('discord.js');
const dotenv = require('dotenv');
dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

const quietedUsers = new Map();

const commands = [
  new SlashCommandBuilder()
    .setName('sudo')
    .setDescription('Send a message as another user')
    .addStringOption(option =>
      option.setName('username')
        .setDescription('The username of the target user')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('message')
        .setDescription('Message to send')
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName('quiet')
    .setDescription('Quiet a user (only they will see their messages)')
    .addStringOption(option =>
      option.setName('username')
        .setDescription('Username of the user to quiet')
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName('unquiet')
    .setDescription('Unquiet a user')
    .addStringOption(option =>
      option.setName('username')
        .setDescription('Username of the user to unquiet')
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName('approve')
    .setDescription('Approve a suggestion')
    .addStringOption(option =>
      option.setName('message')
        .setDescription('Suggestion text')
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName('kill')
    .setDescription('Kill a user (fun)')
    .addStringOption(option =>
      option.setName('username')
        .setDescription('Username of the user to kill')
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Delete all messages in the current channel'),

  new SlashCommandBuilder()
    .setName('question')
    .setDescription('Ask why someone sent a message')
    .addStringOption(option =>
      option.setName('username')
        .setDescription('Who you want to question')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('message')
        .setDescription('The message you are questioning')
        .setRequired(true)),
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log('Commands registered globally');
  } catch (error) {
    console.error('Error registering commands:', error);
  }
})();

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  const username = interaction.options.getString('username');
  const message = interaction.options.getString('message');

  // Permission check for OWNER/admin
  const guild = interaction.guild;
  let hasOwnerPerms = false;
  if (guild) {
    const member = await guild.members.fetch(interaction.user.id);
    const ownerRole = guild.roles.cache.find(role =>
      role.name === 'OWNER' || role.name.toLowerCase() === 'admin'
    );
    if (ownerRole && member.roles.cache.has(ownerRole.id)) {
      hasOwnerPerms = true;
    }
  }

  if (commandName === 'sudo') {
    const targetUsername = interaction.options.getString('username');
    const text = interaction.options.getString('message');

    await interaction.deferReply({ ephemeral: true });

    const webhook = await interaction.channel.createWebhook({
      name: targetUsername,
      avatar: 'https://cdn.discordapp.com/embed/avatars/0.png',
    });

    await webhook.send(text);
    await webhook.delete();

    await interaction.editReply(`Message sent as **${targetUsername}**`);
  }

  if (commandName === 'quiet') {
    const targetUsername = interaction.options.getString('username');
    quietedUsers.set(targetUsername.toLowerCase(), interaction.user.username);
    await interaction.reply({ content: `User ${targetUsername} has been quieted.`, ephemeral: true });
  }

  if (commandName === 'unquiet') {
    const targetUsername = interaction.options.getString('username');
    quietedUsers.delete(targetUsername.toLowerCase());
    await interaction.reply({ content: `User ${targetUsername} is no longer quieted.`, ephemeral: true });
  }

  if (commandName === 'kill') {
    if (!guild || guild.name !== 'The 𝐜𝐨𝐨𝐥 𝒹𝒾𝓈𝒸ℴ𝓇𝒹') {
      return interaction.reply({ content: 'This command only works in the "The 𝐜𝐨𝐨𝐥 𝒹𝒾𝓈𝒸ℴ𝓇𝒹" server.', ephemeral: true });
    }
    if (!hasOwnerPerms) {
      return interaction.reply({ content: 'Only OWNER/admins can use this.', ephemeral: true });
    }

    const victim = interaction.options.getString('username');
    await interaction.reply({ content: `💥 ${victim} was obliterated by ${interaction.user.username}.`, ephemeral: false });
  }

  if (commandName === 'approve') {
    const suggestion = interaction.options.getString('message');
    await interaction.reply({ content: 'Suggestion approved!', ephemeral: false });
    const embed = new EmbedBuilder()
      .setTitle('✅ Approved Suggestion')
      .setDescription(suggestion)
      .setColor(0x00FF00);
    await interaction.followUp({ embeds: [embed] });
    await interaction.followUp({ content: 'Thank you for your suggestion!', ephemeral: false });
  }

  if (commandName === 'clear') {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
      return interaction.reply({ content: 'You do not have permission to clear messages.', ephemeral: true });
    }
    const fetched = await interaction.channel.messages.fetch({ limit: 100 });
    await interaction.channel.bulkDelete(fetched, true);
    await interaction.reply({ content: 'Messages cleared.', ephemeral: true });
  }

  if (commandName === 'question') {
    const target = interaction.options.getString('username');
    const msg = interaction.options.getString('message');

    const reply = interaction.channel.type === 1
      ? `Why did you send “${msg}” to ${target}?`
      : `Why did you send “${msg}” in this server?`;

    await interaction.reply({ content: reply, ephemeral: true });
  }
});

client.on('messageCreate', async message => {
  if (message.author.bot) return;

  const authorName = message.author.username.toLowerCase();
  if (quietedUsers.has(authorName)) {
    const quietedBy = quietedUsers.get(authorName);

    const roast = `${quietedBy} doesn’t care, why are you talking?`;

    await message.delete();

    const reply = await message.channel.send({
      content: `**${message.author.username}**: ${message.content}`,
    });

    setTimeout(() => {
      reply.delete().catch(() => {});
    }, 5000);

    await message.channel.send({
      content: roast,
      ephemeral: true,
    }).catch(() => {});
  }
});

client.login(TOKEN);