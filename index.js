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
//   Archivo de timers
// =====================
const TIMERS_FILE = path.join(__dirname, 'timers.json');
let activeTimers = {};

// Función para guardar timers en archivo
function saveTimers() {
  fs.writeFileSync(TIMERS_FILE, JSON.stringify(activeTimers, null, 2));
}

// Función para cargar timers del archivo al iniciar
function loadTimers() {
  if (!fs.existsSync(TIMERS_FILE)) return;
  try {
    const data = fs.readFileSync(TIMERS_FILE);
    activeTimers = JSON.parse(data);
    const now = Date.now();

    // Reconstruir timers pendientes
    for (const boss in activeTimers) {
      const remaining = activeTimers[boss].respawnTime - now;
      if (remaining <= 0) {
        delete activeTimers[boss];
      } else {
        scheduleTimers(boss, remaining);
      }
    }
  } catch (err) {
    console.error('Error cargando timers:', err);
  }
}

// Función para programar avisos y respawn
async function scheduleTimers(boss, ms) {
  const channel = await client.channels.fetch(CHANNEL_ID).catch(() => null);
  if (!channel) return;

  activeTimers[boss].warn10 && clearTimeout(activeTimers[boss].warn10);
  activeTimers[boss].warn5 && clearTimeout(activeTimers[boss].warn5);
  activeTimers[boss].full && clearTimeout(activeTimers[boss].full);

  // Aviso 10 min antes
  if (ms > 10 * 60 * 1000) {
    activeTimers[boss].warn10 = setTimeout(() => {
      channel.send(`⚠️ @everyone **${boss.toUpperCase()}** respawnea en 10 minutos!`);
    }, ms - 10 * 60 * 1000);
  } else {
    channel.send(`⚠️ @everyone **${boss.toUpperCase()}** respawnea en menos de 10 minutos!`);
  }

  // Aviso 5 min antes
  if (ms > 5 * 60 * 1000) {
    activeTimers[boss].warn5 = setTimeout(() => {
      channel.send(`⚠️ @everyone **${boss.toUpperCase()}** respawnea en 5 minutos!`);
    }, ms - 5 * 60 * 1000);
  }

  // Respawn
  activeTimers[boss].full = setTimeout(() => {
    channel.send(`💥 @everyone **${boss.toUpperCase()} ha respawneado!**`);
    delete activeTimers[boss];
    saveTimers();
  }, ms);
}

// =====================
//   Inicialización
// =====================
client.once('ready', () => {
  console.log(`Bot listo como ${client.user.tag}`);
  loadTimers();
});

// =====================
//   Comandos Slash
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
    .setDescription('Ver cuánto falta para que los bosses aparezcan')
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
//   Interacciones
// =====================
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const now = Date.now();

  if (interaction.commandName === 'kill') {
    const boss = interaction.options.getString('boss');

    if (activeTimers[boss]) {
      await interaction.deferReply({ ephemeral: true });
      return interaction.editReply(`❌ **${boss.toUpperCase()}** ya está registrado como muerto.`);
    }

    const hours = bosses[boss];
    const ms = hours * 60 * 60 * 1000;
    const channel = await client.channels.fetch(CHANNEL_ID).catch(() => null);
    if (!channel) {
      await interaction.deferReply({ ephemeral: true });
      return interaction.editReply('No pude encontrar el canal configurado.');
    }

    // Guardar timer
    activeTimers[boss] = { respawnTime: now + ms };
    saveTimers();

    await interaction.deferReply({ ephemeral: true });
    await interaction.editReply(`✅ **${boss.toUpperCase()} registrado como muerto.**`);
    channel.send(`⏳ **${boss.toUpperCase()}** ha sido marcado como muerto. Respawn en **${hours} horas**.`);

    scheduleTimers(boss, ms);

  } else if (interaction.commandName === 'time') {
    let message = '⏱️ **Bosses activos:**\n';
    let anyActive = false;

    for (const boss in activeTimers) {
      const remaining = activeTimers[boss].respawnTime - now;
      if (remaining > 0) {
        anyActive = true;
        const h = Math.floor(remaining / 3600000);
        const m = Math.floor((remaining % 3600000) / 60000);
        message += `- **${boss.toUpperCase()}**: ${h}h ${m}m restantes\n`;
      }
    }

    if (!anyActive) message = '✅ No hay bosses activos.';
    await interaction.deferReply({ ephemeral: true });
    await interaction.editReply(message);
  }
});

client.login(TOKEN);
