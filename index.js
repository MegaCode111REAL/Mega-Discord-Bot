require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', () => console.log(`✅ Logged in as ${client.user.tag}`));

client.on('interactionCreate', async i => {
  if (!i.isChatInputCommand()) return;
  if (i.commandName === 'sudo') {
    const name = i.options.getString('username');
    const msg = i.options.getString('message');
    try {
      const hook = await i.channel.createWebhook({ name });
      await hook.send({ content: msg, username: name });
      await hook.delete();
      await i.reply({ content: `✅ Sent as **${name}**`, ephemeral: true });
    } catch {
      await i.reply({ content: '❌ Could not send message.', ephemeral: true });
    }
  }
});

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const commands = [
  new SlashCommandBuilder()
    .setName('sudo')
    .setDescription('Send message via webhook')
    .addStringOption(opt =>
      opt.setName('username').setDescription('Fake sender name').setRequired(true))
    .addStringOption(opt =>
      opt.setName('message').setDescription('Message to send').setRequired(true))
    .toJSON()
];

const rest = new REST({ version: '10' }).setToken(TOKEN);
(async () => {
  console.log('🔄 Registering slash command...');
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
  client.login(TOKEN);
})();