const { Client, GatewayIntentBits, Partials, Routes, REST, SlashCommandBuilder, PermissionsBitField, EmbedBuilder } = require('discord.js');
const fs = require('fs');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel]
});

const clientId = process.env.CLIENT_ID;
const token = process.env.TOKEN;

const commands = [
  new SlashCommandBuilder()
    .setName('sudo')
    .setDescription('Make someone say something.')
    .addStringOption(option =>
      option.setName('username')
        .setDescription('Username to impersonate')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('message')
        .setDescription('Message to send')
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName('question')
    .setDescription('Ask someone why they sent a message.')
    .addStringOption(option =>
      option.setName('message')
        .setDescription('The message to question')
        .setRequired(true))
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user who sent the message')
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName('give')
    .setDescription('Give a Minecraft item to someone.')
    .addStringOption(option =>
      option.setName('target')
        .setDescription('Target username')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('item')
        .setDescription('Minecraft item ID (e.g., minecraft:nether_star or nether_star)')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('count')
        .setDescription('How many to give')
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName('kill')
    .setDescription('Kills a server member (adds punished role).')
    .addUserOption(option =>
      option.setName('target')
        .setDescription('User to kill')
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName('quiet')
    .setDescription('Quiet someone so their messages are intercepted.')
    .addUserOption(option =>
      option.setName('target')
        .setDescription('User to quiet')
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName('approve')
    .setDescription('Approve a forum suggestion.')
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('Channel to post approval in')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('postid')
        .setDescription('Forum post message ID')
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Clear all messages in a channel.')
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('Channel to clear')
        .setRequired(true)),
]
.map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  try {
    console.log('🔄 Registering slash commands...');
    await rest.put(Routes.applicationCommands(clientId), { body: commands });
    console.log('✅ Slash commands registered.');
  } catch (error) {
    console.error('❌ Error registering commands:', error);
  }
})();

const quietedUsers = new Map();

client.on('ready', () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const isDM = interaction.channel.type === 1; // 1 = DM
  const memberRoles = interaction.member?.roles?.cache?.map(r => r.name) || [];
  const hasOwner = interaction.guild?.roles.cache.some(r => r.name === 'OWNER');
  const isOwner = memberRoles.includes('OWNER');
  const isAdmin = memberRoles.includes('admin') || memberRoles.includes('Admin');
  const privileged = isOwner || (!hasOwner && isAdmin);

  const cmd = interaction.commandName;
  const userTag = `${interaction.user.username}#${interaction.user.discriminator}`;

  // permission checks
  const requiresOwner = ['sudo', 'give', 'kill', 'quiet', 'approve', 'clear'].includes(cmd);
  if (!isDM && requiresOwner && !privileged) {
    return await interaction.reply({ content: '❌ You need the OWNER or Admin role to use this.', ephemeral: true });
  }

  if (cmd === 'sudo') {
    const username = interaction.options.getString('username');
    const message = interaction.options.getString('message');
    await interaction.reply({ content: `🧱 ${username}: ${message}` });
  }

  else if (cmd === 'question') {
    const msg = interaction.options.getString('message');
    const targetUser = interaction.options.getUser('user');
    const dm = await targetUser.createDM();
    const prompt = isDM
      ? `Why did you send “${msg}” to ${interaction.user.username}?`
      : `Why did you send “${msg}” in ${interaction.guild.name}?`;
    await dm.send(prompt);
    await interaction.reply({ content: `❓ Asked ${targetUser.username}.`, ephemeral: true });
  }

  else if (cmd === 'give') {
    const target = interaction.options.getString('target');
    let item = interaction.options.getString('item');
    const count = interaction.options.getInteger('count');
    if (item.startsWith('minecraft:')) item = item.split(':')[1];
    await interaction.reply(`🧱 Gave ${target} ${count} ${capitalizeItem(item)}`);
  }

  else if (cmd === 'kill') {
    if (interaction.guild.name !== 'The 𝐜𝐨𝐨𝐥 𝒹𝒾𝓈𝒸ℴ𝓇𝒹') {
      return await interaction.reply({ content: '❌ This command only works in "The 𝐜𝐨𝐨𝐥 𝒹𝒾𝓈𝒸ℴ𝓇𝒹".', ephemeral: true });
    }
    const target = interaction.options.getUser('target');
    const member = await interaction.guild.members.fetch(target.id);
    const punished = interaction.guild.roles.cache.find(r => r.name === 'PUNISHED');
    if (punished) await member.roles.add(punished);
    await interaction.reply(`💀 Killed ${target.username}`);
  }

  else if (cmd === 'quiet') {
    const target = interaction.options.getUser('target');
    quietedUsers.set(target.id, interaction.user.username);
    await interaction.reply(`🔇 Quieted ${target.username}`);
  }

  else if (cmd === 'approve') {
    const channel = interaction.options.getChannel('channel');
    const postId = interaction.options.getString('postid');
    try {
      const msg = await channel.messages.fetch(postId);
      const embed = EmbedBuilder.from(msg.embeds[0]);
      await channel.send({
        content: '✅ Suggestion approved!',
        embeds: [embed]
      });
      await channel.send(`Thank you, ${msg.author || msg.user || msg.member?.user || 'user'}!`);
      await interaction.reply({ content: '✅ Approved.', ephemeral: true });
    } catch (e) {
      await interaction.reply({ content: '❌ Could not fetch post.', ephemeral: true });
    }
  }

  else if (cmd === 'clear') {
    const channel = interaction.options.getChannel('channel');
    if (channel.isTextBased()) {
      const messages = await channel.messages.fetch({ limit: 100 });
      await channel.bulkDelete(messages, true);
      await interaction.reply({ content: `🧹 Cleared ${messages.size} messages in ${channel.name}.`, ephemeral: true });
    }
  }
});

client.on('messageCreate', async msg => {
  if (msg.author.bot) return;
  const quietedBy = quietedUsers.get(msg.author.id);
  if (!quietedBy) return;

  if (msg.channel.type === 1) {
    const responses = [
      `"${quietedBy}" doesn’t care, why are you talking?`,
      `"${quietedBy}" muted you, stop typing.`,
      `"${quietedBy}" thinks you're too loud.`,
      `"${quietedBy}" wants silence.`
    ];
    const rand = responses[Math.floor(Math.random() * responses.length)];
    await msg.author.send(rand);
  } else {
    await msg.delete();
    await msg.channel.send({
      content: `🧱 ${msg.author.username}: ${msg.content}`,
      ephemeral: true
    });
    await msg.channel.send({
      content: `🔇 "${quietedBy}" says be quiet.`,
      ephemeral: true
    });
  }
});

client.login(token);

function capitalizeItem(item) {
  return item.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
}