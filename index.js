require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  ContextMenuCommandBuilder,
  ApplicationCommandType,
  PermissionsBitField
} = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', () =>
  console.log(`✅ Logged in as ${client.user.tag}`)
);

client.on('interactionCreate', async interaction => {
  // /sudo command
  if (interaction.isChatInputCommand() && interaction.commandName === 'sudo') {
    const member = interaction.member;
    const hasOwnerRole = member.roles.cache.some(role => role.name === 'OWNER');

    if (!hasOwnerRole) {
      return interaction.reply({
        content: '❌ You must have the **OWNER** role to use this command.',
        ephemeral: true
      });
    }

    const msg = interaction.options.getString('message');
    const selectedUser = interaction.options.getUser('user');
    const overrideName = interaction.options.getString('username');

    const name = overrideName || selectedUser?.username || 'SudoBot';
    const avatar = selectedUser?.displayAvatarURL({ format: 'png' });

    try {
      const hook = await interaction.channel.createWebhook({ name });
      await hook.send({
        content: msg,
        username: name,
        avatarURL: avatar
      });
      await hook.delete();
      await interaction.reply({ content: `✅ Sent as **${name}**`, ephemeral: true });
    } catch (err) {
      console.error(err);
      await interaction.reply({ content: '❌ Could not send message.', ephemeral: true });
    }
  }

  // Message context menu: Question
  if (interaction.isMessageContextMenuCommand() && interaction.commandName === 'Question') {
    const message = interaction.targetMessage;
    const originalAuthor = message.author;
    const asker = interaction.user;
    const guildName = interaction.guild?.name || 'a server';

    const dmMessage = `❓ **${asker.tag}** asks:\n> Why did you send:\n> “${message.content}”\n> in “${guildName}”?`;

    try {
      await originalAuthor.send(dmMessage);
      await interaction.reply({ content: '✅ I asked them for you.', ephemeral: true });
    } catch (err) {
      console.error(err);
      await interaction.reply({
        content: '❌ Could not DM the user (they may have DMs disabled).',
        ephemeral: true
      });
    }
  }
});

// Slash + Context Menu Command Definitions
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const commands = [
  new SlashCommandBuilder()
    .setName('sudo')
    .setDescription('Send a message via webhook as someone else')
    .addStringOption(opt =>
      opt.setName('message').setDescription('Message to send').setRequired(true)
    )
    .addUserOption(opt =>
      opt.setName('user').setDescription('User to copy avatar/username from').setRequired(false)
    )
    .addStringOption(opt =>
      opt.setName('username').setDescription('Custom name to display').setRequired(false)
    ),

  new ContextMenuCommandBuilder()
    .setName('Question')
    .setType(ApplicationCommandType.Message)
];

const rest = new REST({ version: '10' }).setToken(TOKEN);
(async () => {
  console.log('🔄 Registering commands...');
  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands.map(c => c.toJSON()) }
  ).then(() => {
    console.log('✅ Commands registered.');
    client.login(TOKEN);
  }).catch(console.error);
})();