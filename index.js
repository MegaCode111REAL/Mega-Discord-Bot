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
  if (interaction.isAutocomplete() && interaction.commandName === 'give') {
    const focused = interaction.options.getFocused(true);
    if (focused.name === 'item') {
      const filtered = Object.entries(itemList)
        .filter(([id]) => id.startsWith(focused.value.toLowerCase()))
        .map(([id, label]) => ({ name: label, value: id }));
      return interaction.respond(filtered.slice(0, 25));
    }
  }

  if (interaction.isAutocomplete() && interaction.commandName === 'kill') {
    const focused = interaction.options.getFocused(true);
    if (focused.name === 'player') {
      const members = await interaction.guild.members.fetch();
      const suggestions = members.map(m => ({
        name: m.displayName,
        value: m.id
      }));
      return interaction.respond(suggestions.slice(0, 25));
    }
  }

  if (interaction.isAutocomplete() && interaction.commandName === 'approve') {
    const focused = interaction.options.getFocused(true);
    if (focused.name === 'post') {
      const posts = [];
      for (const [id, channel] of interaction.guild.channels.cache) {
        if (channel.isThread() && channel.parent?.type === 15) {
          posts.push({ name: channel.name, value: channel.id });
        }
      }
      const filtered = posts.filter(p =>
        p.name.toLowerCase().startsWith(focused.value.toLowerCase())
      );
      await interaction.respond(filtered.slice(0, 25));
    }
  }

  // /sudo
  if (interaction.isChatInputCommand() && interaction.commandName === 'sudo') {
    const hasOwnerRole = interaction.member.roles.cache.some(r => r.name === 'OWNER');
    if (!hasOwnerRole) return interaction.reply({ content: '❌ OWNER role required.', ephemeral: true });

    const msg = interaction.options.getString('message');
    const userInput = interaction.options.getString('user');
    const overrideName = interaction.options.getString('username');

    let name = overrideName || 'SudoBot';
    let avatar = null;

    if (userInput && !overrideName) {
      try {
        const fetchedUser = await client.users.fetch(userInput);
        name = fetchedUser.username;
        avatar = fetchedUser.displayAvatarURL({ format: 'png' });
      } catch {
        name = userInput;
        avatar = null;
      }
    } else if (userInput) {
      name = userInput;
    }

    try {
      const hook = await interaction.channel.createWebhook({ name });
      await hook.send({ content: msg, username: name, avatarURL: avatar });
      await hook.delete();
      await interaction.reply({ content: `✅ Sent as **${name}**`, ephemeral: true });
    } catch (err) {
      console.error(err);
      await interaction.reply({ content: '❌ Could not send message.', ephemeral: true });
    }
  }

  if (interaction.isMessageContextMenuCommand() && interaction.commandName === 'Question') {
    const message = interaction.targetMessage;
    const originalAuthor = message.author;
    const asker = interaction.user;
    const guildName = interaction.guild?.name || 'a server';

    const dmMessage = `❓ **${asker.tag}** asks:\n> Why did you send:\n> “${message.content}”\n> in “${guildName}”?`;
    try {
      await originalAuthor.send(dmMessage);
      await interaction.reply({ content: '✅ I asked them for you.', ephemeral: true });
    } catch {
      await interaction.reply({ content: '❌ Could not DM the user.', ephemeral: true });
    }
  }

  if (interaction.isChatInputCommand() && interaction.commandName === 'give') {
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

  if (interaction.isChatInputCommand() && interaction.commandName === 'kill') {
    const hasOwnerRole = interaction.member.roles.cache.some(r => r.name === 'OWNER');
    if (!hasOwnerRole) return interaction.reply({ content: '❌ OWNER role required.', ephemeral: true });

    const targetId = interaction.options.getString('player');
    const target = await interaction.guild.members.fetch(targetId).catch(() => null);
    if (!target) return interaction.reply({ content: '❌ Could not find member.', ephemeral: true });

    const punishedRole = interaction.guild.roles.cache.find(r => r.name === 'PUNISHED');
    if (!punishedRole) return interaction.reply({ content: '❌ Role `PUNISHED` not found.', ephemeral: true });

    await target.roles.add(punishedRole);
    await interaction.reply(`💀 *${target.displayName} was slain by ${interaction.user.username}.*`);
  }

  if (interaction.isChatInputCommand() && interaction.commandName === 'quiet') {
    const user = interaction.options.getUser('user');
    const hasOwnerRole = interaction.member.roles.cache.some(r => r.name === 'OWNER');
    if (!hasOwnerRole) return interaction.reply({ content: '❌ OWNER role required.', ephemeral: true });

    quietedUsers.add(user.id);
    await interaction.reply(`🔇 <@${user.id}> has been quieted.`);
  }

  if (interaction.isChatInputCommand() && interaction.commandName === 'unquiet') {
    const user = interaction.options.getUser('user');
    const hasOwnerRole = interaction.member.roles.cache.some(r => r.name === 'OWNER');
    if (!hasOwnerRole) return interaction.reply({ content: '❌ OWNER role required.', ephemeral: true });

    if (quietedUsers.delete(user.id)) {
      await interaction.reply(`🔊 <@${user.id}> has been unquieted.`);
    } else {
      await interaction.reply({ content: `⚠️ <@${user.id}> wasn’t quieted.`, ephemeral: true });
    }
  }

  if (interaction.isChatInputCommand() && interaction.commandName === 'approve') {
    const postId = interaction.options.getString('post');
    const targetChannel = interaction.options.getChannel('channel');
    const hasOwnerRole = interaction.member.roles.cache.some(r => r.name === 'OWNER');

    if (!hasOwnerRole) {
      return interaction.reply({ content: '❌ OWNER role required.', ephemeral: true });
    }

    const post = await interaction.guild.channels.fetch(postId).catch(() => null);
    if (!post || !post.isThread()) {
      return interaction.reply({ content: '❌ Invalid forum post selected.', ephemeral: true });
    }

    const starterMessage = await post.fetchStarterMessage().catch(() => null);
    if (!starterMessage) {
      return interaction.reply({ content: '❌ Could not fetch post content.', ephemeral: true });
    }

    const embed = {
      title: post.name,
      description: starterMessage.content || '*(no text content)*',
      color: 0x57f287,
      url: `https://discord.com/channels/${interaction.guildId}/${post.id}`,
      author: {
        name: starterMessage.author.tag,
        icon_url: starterMessage.author.displayAvatarURL()
      }
    };

    const files = starterMessage.attachments.map(att => ({
      attachment: att.url,
      name: att.name
    }));

    await targetChannel.send({
      content: `✅ **Suggestion approved!**`,
      embeds: [embed],
      files: files
    });

    await targetChannel.send(`🙏 Thank you, <@${starterMessage.author.id}>!`);
    await interaction.reply({ content: '✅ Approved and posted with attachments.', ephemeral: true });
  }
});

// Slash & context commands
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const commands = [
  new SlashCommandBuilder()
    .setName('sudo')
    .setDescription('Send a message via webhook as someone else')
    .addStringOption(opt =>
      opt.setName('message').setDescription('Message to send').setRequired(true))
    .addStringOption(opt =>
      opt.setName('user').setDescription('User ID or name to copy avatar/username from').setRequired(false))
    .addStringOption(opt =>
      opt.setName('username').setDescription('Custom name to display').setRequired(false)),

  new SlashCommandBuilder()
    .setName('give')
    .setDescription('Minecraft-style give command (for fun)')
    .addStringOption(opt =>
      opt.setName('player').setDescription('Player name').setRequired(true))
    .addStringOption(opt =>
      opt.setName('item').setDescription('Minecraft item ID').setRequired(true).setAutocomplete(true))
    .addIntegerOption(opt =>
      opt.setName('amount').setDescription('Amount to give').setRequired(false))
    .addStringOption(opt =>
      opt.setName('nbt').setDescription('Optional NBT data').setRequired(false)),

  new SlashCommandBuilder()
    .setName('kill')
    .setDescription('Fake kill a player and punish them')
    .addStringOption(opt =>
      opt.setName('player').setDescription('Player to target').setRequired(true).setAutocomplete(true)),

  new SlashCommandBuilder()
    .setName('quiet')
    .setDescription('Replies to a user with roast every time they talk')
    .addUserOption(opt =>
      opt.setName('user').setDescription('User to quiet').setRequired(true)),

  new SlashCommandBuilder()
    .setName('unquiet')
    .setDescription('Stops replying to a user with roast')
    .addUserOption(opt =>
      opt.setName('user').setDescription('User to unquiet').setRequired(true)),

  new SlashCommandBuilder()
    .setName('approve')
    .setDescription('Approve a forum post and send it to a channel')
    .addStringOption(opt =>
      opt.setName('post').setDescription('Post to approve').setRequired(true).setAutocomplete(true))
    .addChannelOption(opt =>
      opt.setName('channel').setDescription('Where to send the approval').setRequired(true)),

  new ContextMenuCommandBuilder()
    .setName('Question')
    .setType(ApplicationCommandType.Message)
];

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  console.log('🔄 Registering slash commands...');
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
    body: commands.map(cmd => cmd.toJSON())
  });
  console.log('✅ Commands registered.');
  client.login(TOKEN);
})();