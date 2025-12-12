require('dotenv').config();
const fs = require('fs');
const express = require('express');
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');

// =====================
// Variables de entorno
// =====================
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const CHANNEL_ID = process.env.CHANNEL_ID;

if (!TOKEN || !CLIENT_ID || !GUILD_ID || !CHANNEL_ID) {
  console.error("⚠️ Faltan variables en .env. Revisa TOKEN, CLIENT_ID, GUILD_ID, CHANNEL_ID");
  process.exit(1);
}

// =====================
// Servidor web mínimo para mantener vivo Render
// =====================
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Bot Lordnine está online ✅');
});

app.listen(PORT, () => {
  console.log(`Servidor web escuchando en puerto ${PORT}`);
});

// =====================
// Bot de Discord
// =====================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// =====================
// Lista de bosses
// =====================
const bosses = {
  venatus: 10,
  viorent: 10,
  undomiel: 24,
  lady_daliah: 18,
  livera: 24,
  ego: 21,
  araneo: 24,
  general_aqueleus: 29,
  amentis: 29,
  shuliar: 35,
  larba: 35,
  catena: 35,
  baron_braudmore: 32,
  wannitas: 48,
  gareth: 32,
  duplican: 48,
  metus: 48,
  titore: 37,
  supore: 62,
  asta: 62,
  ordo: 62,
  guild_boss: 1,
  secreta: 62
};

// Timers activos en memoria
let activeTimers = {};

client.once('ready', () => {
  console.log(`Bot listo como ${client.user.tag}`);
});

// =====================
// Registrar slash commands en el servidor
// =====================
const commands = [
  new SlashCommandBuilder()
    .setName('kill')
    .setDescription('Registrar kill de un boss')
    .addStringOption(opt =>
      opt.setName('boss')
         .setDescription('Nombre del boss')
         .setRequired(true)
         .addChoices(...Object.keys(bosses).map(b => ({ name: b.replace(/_/g, ' ').toUpperCase(), value: b })))
    )
].map(c => c.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    console.log('Registrando comandos en el servidor...');
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log('Comandos registrados ✔');
  } catch (err) {
    console.error('Error registrando comandos:', err);
  }
})();

// =====================
// Lógica del bot
// =====================
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== 'kill') return;

  const boss = interaction.options.getString('boss');
  const hours = bosses[boss];
  if (!hours) return interaction.reply({ content: 'Boss no configurado.', ephemeral: true });

  const ms = hours * 60 * 60 * 1000;
  const channel = await client.channels.fetch(CHANNEL_ID).catch(() => null);
  if (!channel) return interaction.reply({ content: 'No pude encontrar el canal configurado.', ephemeral: true });

  // cancelar timers antiguos
  if (activeTimers[boss]) {
    clearTimeout(activeTimers[boss].warn10);
    clearTimeout(activeTimers[boss].warn5);
    clearTimeout(activeTimers[boss].full);
  }

  await interaction.reply({ content: `⏳ ${boss.toUpperCase()} registrado como muerto. Respawn en ${hours} horas.`, ephemeral: true });
  channel.send(`⏳ **${boss.toUpperCase()}** ha sido marcado como muerto. Respawn en **${hours} horas**.`);

  // Aviso 10 minutos antes
  activeTimers[boss] = {};
  if (ms > 10 * 60 * 1000) {
    activeTimers[boss].warn10 = setTimeout(() => {
      channel.send(`⚠️ @everyone **${boss.toUpperCase()}** respawnea en **10 minutos**!`);
    }, ms - (10 * 60 * 1000));
  } else {
    channel.send(`⚠️ @everyone **${boss.toUpperCase()}** respawnea en menos de 10 minutos!`);
  }

  // Aviso 5 minutos antes
  if (ms > 5 * 60 * 1000) {
    activeTimers[boss].warn5 = setTimeout(() => {
      channel.send(`⚠️ @everyone **${boss.toUpperCase()}** respawnea en **5 minutos**!`);
    }, ms - (5 * 60 * 1000));
  }

  // Respawn
  activeTimers[boss].full = setTimeout(() => {
    channel.send(`💥 @everyone **${boss.toUpperCase()} ha respawneado!**`);
    delete activeTimers[boss];
  }, ms);
});

client.login(TOKEN);
