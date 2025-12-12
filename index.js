require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const CHANNEL_ID = process.env.CHANNEL_ID;

if (!TOKEN || !CLIENT_ID || !GUILD_ID || !CHANNEL_ID) {
  console.error("⚠️ Faltan variables en .env. Revisa TOKEN, CLIENT_ID, GUILD_ID, CHANNEL_ID");
  process.exit(1);
}

// Archivo para persistir timers
const TIMERS_FILE = path.join(__dirname, 'timers.json');

// Cargar timers guardados
let activeTimers = {};
try {
  if (fs.existsSync(TIMERS_FILE)) {
    const data = fs.readFileSync(TIMERS_FILE, 'utf8');
    activeTimers = JSON.parse(data);
  }
} catch (err) {
  console.error("Error leyendo timers.json:", err);
}

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
//  Funciones de ayuda
// =====================
function saveTimers() {
  fs.writeFileSync(TIMERS_FILE, JSON.stringify(activeTimers, null, 2));
}

function getRemainingTime(endTimestamp) {
  const now = Date.now();
  const diff = endTimestamp - now;
  if (diff <= 0) return "0h 0m";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return `${h}h ${m}m`;
}

// Reconstruir timers al iniciar
async function rebuildTimers(client) {
  const channel = await client.channels.fetch(CHANNEL_ID).catch(() => null);
  if (!channel) return;

  for (const boss in activeTimers) {
    const timerData = activeTimers[boss];
    const now = Date.now();
    const remaining = timerData.end - now;

    if (remaining <= 0) {
      channel.send(`💥 @everyone **${boss.toUpperCase()} ha respawneado!**`);
      delete activeTimers[boss];
      saveTimers();
      continue;
    }

    // Warn 10 min
    if (remaining > 10 * 60 * 1000) {
      timerData.warn10Timeout = setTimeout(() => {
        channel.send(`⚠️ @everyone **${boss.toUpperCase()}** respawnea en 10 minutos!`);
      }, remaining - 10 * 60 * 1000);
    } else {
      channel.send(`⚠️ @everyone **${boss.toUpperCase()}** respawnea en menos de 10 minutos!`);
    }

    // Warn 5 min
    if (remaining > 5 * 60 * 1000) {
      timerData.warn5Timeout = setTimeout(() => {
        channel.send(`⚠️ @everyone **${boss.toUpperCase()}** respawnea en 5 minutos!`);
      }, remaining - 5 * 60 * 1000);
    }

    // Respawn
    timerData.fullTimeout = setTimeout(() => {
      channel.send(`💥 @everyone **${boss.toUpperCase()} ha respawneado!**`);
      delete activeTimers[boss];
      saveTimers();
    }, remaining);
  }
}

// =====================
//     Cliente Discord
// =====================
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

client.once('ready', async () => {
  console.log(`Bot listo como ${client.user.tag}`);
  await rebuildTimers(client);
});

// =====================
//   Registrar comandos
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
    .toJSON(),
  new SlashCommandBuilder()
    .setName('time')
    .setDescription('Ver cuánto falta para que aparezca un boss')
    .addStringOption(opt =>
      opt.setName('boss')
         .setDescription('Nombre del boss')
         .setRequired(true)
         .addChoices(...Object.keys(bosses).map(b => ({ name: b.replace(/_/g, ' ').toUpperCase(), value: b })))
    )
    .toJSON()
];

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

  // --- /time ---
  if (interaction.commandName === 'time') {
    const timerData = activeTimers[boss];
    const remaining = timerData ? getRemainingTime(timerData.end) : null;
    return interaction.reply({
      content: remaining ? `⏳ **${boss.toUpperCase()}** respawnea en ${remaining}` : `❌ ${boss.toUpperCase()} no está activo.`,
      ephemeral: true
    });
  }

  // --- /kill ---
  if (interaction.commandName === 'kill') {
    if (activeTimers[boss]) {
      return interaction.reply({ content: `❌ ${boss.toUpperCase()} ya está activo.`, ephemeral: true });
    }

    const hours = bosses[boss];
    if (!hours) return interaction.reply({ content: 'Boss no configurado.', ephemeral: true });

    const ms = hours * 60 * 60 * 1000;
    const endTimestamp = Date.now() + ms;

    // Respuesta inmediata
    await interaction.reply({ content: `✅ **${boss.toUpperCase()} registrado como muerto.**`, ephemeral: true });

    const channel = await client.channels.fetch(CHANNEL_ID).catch(() => null);
    if (channel) channel.send(`⏳ **${boss.toUpperCase()}** ha sido marcado como muerto. Respawn en **${hours} horas**.`);

    // Guardar en memoria y archivo
    activeTimers[boss] = { end: endTimestamp };
    saveTimers();

    // Timers públicos
    if (ms > 10 * 60 * 1000) {
      activeTimers[boss].warn10Timeout = setTimeout(() => {
        if (channel) channel.send(`⚠️ @everyone **${boss.toUpperCase()}** respawnea en 10 minutos!`);
      }, ms - 10 * 60 * 1000);
    } else {
      if (channel) channel.send(`⚠️ @everyone **${boss.toUpperCase()}** respawnea en menos de 10 minutos!`);
    }

    if (ms > 5 * 60 * 1000) {
      activeTimers[boss].warn5Timeout = setTimeout(() => {
        if (channel) channel.send(`⚠️ @everyone **${boss.toUpperCase()}** respawnea en 5 minutos!`);
      }, ms - 5 * 60 * 1000);
    }

    activeTimers[boss].fullTimeout = setTimeout(() => {
      if (channel) channel.send(`💥 @everyone **${boss.toUpperCase()} ha respawneado!**`);
      delete activeTimers[boss];
      saveTimers();
    }, ms);
  }
});

client.login(TOKEN);
