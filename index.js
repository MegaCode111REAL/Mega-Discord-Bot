require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  ContextMenuCommandBuilder,
  ApplicationCommandType
} = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const quietedUsers = new Set();

const roastReplies = [
  "shut up <@{id}>",
  "nobody asked <@{id}>",
  "why are you even talking <@{id}>",
  "<@{id}> you're on timeout"
];

const itemList = {
  "diamond_sword": "Diamond Sword",
  "stick": "Stick",
  "stone": "Stone",
  "elytra": "Elytra",
  "bedrock": "Bedrock",
  "barrier": "Barrier",
  "command_block": "Command Block",
  "cooked_beef": "Steak",
  "nether_star": "Nether Star",
  "beacon": "Beacon",
  "golden_apple": "Golden Apple"
};

function hasRequiredRole(member) {
  const roles = member.roles.cache.map(r => r.name.toLowerCase());
  const hasOwner = roles.includes('owner');
  if (hasOwner) return true;

  const guildHasOwnerRole = member.guild.roles.cache.some(r => r.name === 'OWNER');
  if (!guildHasOwnerRole && (roles.includes('admin'))) return true;

  return false;
}

client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async message => {
  if (message.author.bot || !message.guild) return;
  if (quietedUsers.has(message.author.id)) {
    const roast = roastReplies[Math.floor(Math.random() * roastReplies.length)];
    const reply = roast.replace('{id}', message.author.id);
    await message.channel.send(reply).catch(console.error);
  }
});

client.on('interactionCreate', async interaction => {
  if (interaction.isChatInputCommand()) {
    const commandName = interaction.commandName;

    // SUDO
    if (commandName === 'sudo') {
      if (!hasRequiredRole(interaction.member)) {
        return interaction.reply({ content: '❌ OWNER role required.', ephemeral: true });
      }
      const msg = interaction.options.getString('message');
      const userInput = interaction.options.getString('user');
      const overrideName = interaction.options.getString('username');
      let name = overrideName || 'SudoBot';
      let avatar = null;

      if (userInput && !overrideName) {
        try {
          const fetchedUser = await client.users.fetch(userInput);
          name = fetchedUser.username;
          avatar = fetchedUser.displayAvatarURL({ format: 'png', dynamic: true });
        } catch {
          name = userInput;
          avatar = null;
        }
      } else if (userInput) {
        name = userInput;
      }

      const hook = await interaction.channel.createWebhook({ name });
      await hook.send({ content: msg, username: name, avatarURL: avatar });
      setTimeout(() => hook.delete().catch(() => {}), 1000);
      await interaction.reply({ content: `✅ Sent as **${name}**`, ephemeral: true });
    }

    // CLEAR
    else if (commandName === 'clear') {
      if (!hasRequiredRole(interaction.member)) {
        return interaction.reply({ content: '❌ OWNER role required.', ephemeral: true });
      }

      const channel = interaction.options.getChannel('channel');
      if (!channel || channel.type !== 0) {
        return interaction.reply({ content: '❌ Please select a valid text channel.', ephemeral: true });
      }

      const channelName = channel.name;
      const category = channel.parent;
      const position = channel.position;
      const permissionOverwrites = channel.permissionOverwrites.cache.map(po => ({
        id: po.id,
        allow: po.allow.bitfield,
        deny: po.deny.bitfield,
        type: po.type
      }));

      await interaction.reply({ content: `🧹 Clearing <#${channel.id}>...`, ephemeral: true });
      await channel.delete();
      const newChannel = await interaction.guild.channels.create({
        name: channelName,
        type: 0,
        parent: category,
        position,
        permissionOverwrites
      });
      await interaction.followUp({ content: `✅ Cleared and recreated <#${newChannel.id}>.`, ephemeral: true });
    }

    // GIVE
    else if (commandName === 'give') {
      const player = interaction.options.getString('player');
      let rawItem = interaction.options.getString('item');
      const amount = interaction.options.getInteger('amount') || 1;
      const nbt = interaction.options.getString('nbt') || '';

      if (rawItem.startsWith('minecraft:')) rawItem = rawItem.split(':')[1];
      const friendlyName = itemList[rawItem];
      if (!friendlyName) {
        return interaction.reply({ content: `❌ Unknown item: \`${rawItem}\``, ephemeral: true });
      }

      const response = `🧱 Gave ${player} ${amount} ${friendlyName}${nbt ? ` ${nbt}` : ''}`;
      return interaction.reply({ content: response });
    }

    // KILL
    else if (commandName === 'kill') {
      if (interaction.guild.name !== 'The 𝐜𝐨𝐨𝐥 𝒹𝒾𝓈𝒸ℴ𝓇𝒹') {
        return interaction.reply({ content: '❌ This command can only be used in the designated server.', ephemeral: true });
      }

      if (!hasRequiredRole(interaction.member)) {
        return interaction.reply({ content: '❌ OWNER role required.', ephemeral: true });
      }

      const targetId = interaction.options.getString('player');
      const target = await interaction.guild.members.fetch(targetId).catch(() => null);
      const punishedRole = interaction.guild.roles.cache.find(r => r.name === 'PUNISHED');
      if (!target || !punishedRole) {
        return interaction.reply({ content: '❌ Could not find member or PUNISHED role.', ephemeral: true });
      }

      await target.roles.add(punishedRole);
      await interaction.reply(`💀 *${target.displayName} was slain by ${interaction.user.username}.*`);
    }

    // QUIET
    else if (commandName === 'quiet') {
      if (!hasRequiredRole(interaction.member)) {
        return interaction.reply({ content: '❌ OWNER role required.', ephemeral: true });
      }

      const user = interaction.options.getUser('user');
      quietedUsers.add(user.id);
      await interaction.reply(`🔇 <@${user.id}> has been quieted.`);
    }

    // UNQUIET
    else if (commandName === 'unquiet') {
      if (!hasRequiredRole(interaction.member)) {
        return interaction.reply({ content: '❌ OWNER role required.', ephemeral: true });
      }

      const user = interaction.options.getUser('user');
      quietedUsers.delete(user.id);
      await interaction.reply(`🔊 <@${user.id}> is no longer quieted.`);
    }

    // APPROVE
    else if (commandName === 'approve') {
      if (!hasRequiredRole(interaction.member)) {
        return interaction.reply({ content: '❌ OWNER role required.', ephemeral: true });
      }

      const postId = interaction.options.getString('post');
      const targetChannel = interaction.options.getChannel('channel');
      const post = await interaction.guild.channels.fetch(postId).catch(() => null);
      if (!post || !post.isThread()) {
        return interaction.reply({ content: '❌ Invalid forum post.', ephemeral: true });
      }

      const starterMessage = await post.fetchStarterMessage().catch(() => null);
      if (!starterMessage) {
        return interaction.reply({ content: '❌ Could not fetch original message.', ephemeral: true });
      }

      const embed = {
        title: post.name,
        description: starterMessage.content || '*No content*',
        color: 0x57f287,
        url: `https://discord.com/channels/${interaction.guildId}/${post.id}`,
        author: {
          name: starterMessage.author.tag,
          icon_url: starterMessage.author.displayAvatarURL()
        }
      };

      await targetChannel.send({ content: '✅ Suggestion approved!', embeds: [embed] });
      await targetChannel.send(`🙏 Thank you, <@${starterMessage.author.id}>!`);
      await interaction.reply({ content: '✅ Done!', ephemeral: true });
    }
  }

  // CONTEXT MENU: Question
  else if (interaction.isMessageContextMenuCommand() && interaction.commandName === 'Question') {
    const message = interaction.targetMessage;
    const asker = interaction.user;
    const guildName = interaction.guild?.name || 'a server';

    try {
      await message.author.send(
        `❓ ${asker.tag} asks:\n> Why did you send:\n> “${message.content}”\n> in “${guildName}”?`
      );
      await interaction.reply({ content: '✅ I asked them for you.', ephemeral: true });
    } catch {
      await interaction.reply({ content: '❌ Could not DM the user.', ephemeral: true });
    }
  }
});

// Slash Command Registration
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const commands = [
  new SlashCommandBuilder()
    .setName('sudo')
    .setDescription('Send a message as someone else via webhook')
    .addStringOption(opt =>
      opt.setName('message').setDescription('Message content').setRequired(true))
    .addStringOption(opt =>
      opt.setName('user').setDescription('User ID or name').setRequired(false))
    .addStringOption(opt =>
      opt.setName('username').setDescription('Override name').setRequired(false)),

  new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Clear all messages in a text channel')
    .addChannelOption(opt =>
      opt.setName('channel').setDescription('Target channel').setRequired(true)),

  new SlashCommandBuilder()
    .setName('give')
    .setDescription('Minecraft-style give command')
    .addStringOption(opt =>
      opt.setName('player').setDescription('Player name').setRequired(true))
    .addStringOption(opt =>
      opt.setName('item').setDescription('Item ID').setRequired(true))
    .addIntegerOption(opt =>
      opt.setName('amount').setDescription('How many'))
    .addStringOption(opt =>
      opt.setName('nbt').setDescription('NBT data')),

  new SlashCommandBuilder()
    .setName('kill')
    .setDescription('Punish a member (The 𝐜𝐨𝐨𝐥 𝒹𝒾𝓈𝒸ℴ𝓇𝒹 only)')
    .addStringOption(opt =>
      opt.setName('player').setDescription('Target user ID').setRequired(true)),

  new SlashCommandBuilder()
    .setName('quiet')
    .setDescription('Auto-roast a user on message')
    .addUserOption(opt =>
      opt.setName('user').setDescription('User to quiet').setRequired(true)),

  new SlashCommandBuilder()
    .setName('unquiet')
    .setDescription('Remove quiet mode')
    .addUserOption(opt =>
      opt.setName('user').setDescription('User to unquiet').setRequired(true)),

  new SlashCommandBuilder()
    .setName('approve')
    .setDescription('Approve a forum post')
    .addStringOption(opt =>
      opt.setName('post').setDescription('Thread ID').setRequired(true))
    .addChannelOption(opt =>
      opt.setName('channel').setDescription('Target channel').setRequired(true)),

  new ContextMenuCommandBuilder()
    .setName('Question')
    .setType(ApplicationCommandType.Message)
];

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  console.log('🔄 Registering commands...');
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
    body: commands.map(cmd => cmd.toJSON())
  });
  console.log('✅ Commands registered.');
  client.login(TOKEN);
})();