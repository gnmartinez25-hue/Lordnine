require('dotenv').config();
const fs = require('fs');
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const CHANNEL_ID = process.env.CHANNEL_ID;

if (!TOKEN || !CLIENT_ID || !GUILD_ID || !CHANNEL_ID) {
  console.error("⚠️ Faltan variables en .env. Revisa TOKEN, CLIENT_ID, GUILD_ID, CHANNEL_ID");
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

// =====================
//     BOSS LISTA
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

// =====================
//     Archivos
// =====================
const timersFile = './timers.json';
let activeTimers = {}; // en memoria

// =====================
//     Guardar timers
// =====================
function saveTimers() {
  const cleanTimers = {};
  for (const boss in activeTimers) {
    const { endTime, warn10Sent, warn5Sent } = activeTimers[boss];
    cleanTimers[boss] = { endTime, warn10Sent, warn5Sent };
  }
  fs.writeFileSync(timersFile, JSON.stringify(cleanTimers, null, 2));
}

// =====================
//     Cargar timers
// =====================
function loadTimers() {
  if (!fs.existsSync(timersFile)) return;
  const data = JSON.parse(fs.readFileSync(timersFile));
  const now = Date.now();
  for (const boss in data) {
    const timerData = data[boss];
    const remaining = timerData.endTime - now;
    if (remaining <= 0) continue; // ya respawneo
    createTimer(boss, remaining, timerData.warn10Sent, timerData.warn5Sent);
  }
}

// =====================
//     Crear timers
// =====================
async function createTimer(boss, ms, warn10Sent = false, warn5Sent = false) {
  const channel = await client.channels.fetch(CHANNEL_ID).catch(() => null);
  if (!channel) return;

  activeTimers[boss] = { endTime: Date.now() + ms, warn10Sent, warn5Sent };

  // Aviso 10 minutos antes
  if (!warn10Sent && ms > 10 * 60 * 1000) {
    activeTimers[boss].warn10 = setTimeout(() => {
      channel.send(`⚠️ @everyone **${boss.toUpperCase()}** respawnea en 10 minutos!`);
      activeTimers[boss].warn10Sent = true;
      saveTimers();
    }, ms - 10 * 60 * 1000);
  } else if (!warn10Sent) {
    channel.send(`⚠️ @everyone **${boss.toUpperCase()}** respawnea en menos de 10 minutos!`);
    activeTimers[boss].warn10Sent = true;
  }

  // Aviso 5 minutos antes
  if (!warn5Sent && ms > 5 * 60 * 1000) {
    activeTimers[boss].warn5 = setTimeout(() => {
      channel.send(`⚠️ @everyone **${boss.toUpperCase()}** respawnea en 5 minutos!`);
      activeTimers[boss].warn5Sent = true;
      saveTimers();
    }, ms - 5 * 60 * 1000);
  }

  // Respawn
  activeTimers[boss].full = setTimeout(() => {
    channel.send(`💥 @everyone **${boss.toUpperCase()} ha respawneado!**`);
    delete activeTimers[boss];
    saveTimers();
  }, ms);

  saveTimers();
}

// =====================
//     Comandos slash
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
    ),
  new SlashCommandBuilder()
    .setName('time')
    .setDescription('Ver tiempo restante para cada boss')
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
//     Lógica del bot
// =====================
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const boss = interaction.options.getString('boss');

  try {
    if (interaction.commandName === 'kill') {
      if (!bosses[boss]) return await interaction.reply({ content: 'Boss no configurado.', ephemeral: true });

      if (activeTimers[boss]) return await interaction.reply({ content: `❌ **${boss.toUpperCase()}** ya está activo.`, ephemeral: true });

      const ms = bosses[boss] * 60 * 60 * 1000;

      try { await interaction.deferReply({ ephemeral: true }); } catch { /* interacción expirada */ }
      try { await interaction.editReply({ content: `✅ **${boss.toUpperCase()} registrado como muerto.**` }); } catch { /* falló, interacción expirada */ }

      const channel = await client.channels.fetch(CHANNEL_ID).catch(() => null);
      if (channel) channel.send(`⏳ **${boss.toUpperCase()}** ha sido marcado como muerto. Respawn en **${bosses[boss]} horas**.`);

      createTimer(boss, ms);

    } else if (interaction.commandName === 'time') {
      if (Object.keys(activeTimers).length === 0) {
        return await interaction.reply({ content: 'No hay bosses activos.', ephemeral: true });
      }

      let reply = '';
      const now = Date.now();
      for (const b in activeTimers) {
        const remaining = activeTimers[b].endTime - now;
        if (remaining <= 0) continue;
        const h = Math.floor(remaining / (1000 * 60 * 60));
        const m = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
        reply += `⏳ **${b.toUpperCase()}** respawnea en ${h}h ${m}m\n`;
      }

      try { await interaction.reply({ content: reply || 'No hay bosses activos.', ephemeral: true }); } catch { /* interacción expirada */ }
    }
  } catch (err) {
    console.error('Error manejando interacción:', err);
  }
});

client.once('clientReady', () => {
  console.log(`Bot listo como ${client.user.tag}`);
  loadTimers(); // reconstruye timers al iniciar
});

client.login(TOKEN);
