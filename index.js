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
//     TIMERS Y JSON
// =====================
const SAVE_FILE = path.join(__dirname, 'timers.json');
let activeTimers = {};

// Cargar respawns guardados
if (fs.existsSync(SAVE_FILE)) {
  try {
    const data = JSON.parse(fs.readFileSync(SAVE_FILE, 'utf8'));
    for (let boss in data) {
      const remaining = data[boss] - Date.now();
      if (remaining > 0) startTimer(boss, remaining);
    }
  } catch (err) {
    console.error("Error leyendo timers.json:", err.message);
  }
}

// =====================
//    FUNCIONES
// =====================
async function notify(channel, content) {
  try {
    await channel.send(content);
  } catch (err) {
    console.error("No pude enviar el mensaje:", err.message);
  }
}

function saveTimers() {
  const toSave = {};
  for (let boss in activeTimers) {
    toSave[boss] = activeTimers[boss].endTime;
  }
  fs.writeFileSync(SAVE_FILE, JSON.stringify(toSave, null, 2));
}

async function startTimer(boss, ms) {
  const channel = await client.channels.fetch(CHANNEL_ID).catch(() => null);
  if (!channel) return;

  // Cancelar timers antiguos
  if (activeTimers[boss]) {
    clearTimeout(activeTimers[boss].warn10);
    clearTimeout(activeTimers[boss].warn5);
    clearTimeout(activeTimers[boss].full);
  }

  const endTime = Date.now() + ms;
  activeTimers[boss] = { endTime };

  // Aviso 10 minutos antes
  if (ms > 10 * 60 * 1000) {
    activeTimers[boss].warn10 = setTimeout(() => {
      notify(channel, `⚠️ @everyone **${boss.toUpperCase()}** respawnea en 10 minutos!`);
    }, ms - (10 * 60 * 1000));
  } else {
    notify(channel, `⚠️ @everyone **${boss.toUpperCase()}** respawnea en menos de 10 minutos!`);
  }

  // Aviso 5 minutos antes
  if (ms > 5 * 60 * 1000) {
    activeTimers[boss].warn5 = setTimeout(() => {
      notify(channel, `⚠️ @everyone **${boss.toUpperCase()}** respawnea en 5 minutos!`);
    }, ms - (5 * 60 * 1000));
  }

  // Respawn
  activeTimers[boss].full = setTimeout(() => {
    notify(channel, `💥 @everyone **${boss.toUpperCase()} ha respawneado!**`);
    delete activeTimers[boss];
    saveTimers();
  }, ms);

  saveTimers();
}

// =====================
//   SLASH COMMANDS
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
    .setDescription('Ver cuanto tiempo le queda a un boss')
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
//     LOGICA BOT
// =====================
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const boss = interaction.options.getString('boss');
  if (!bosses[boss]) return interaction.reply({ content: 'Boss no configurado.', ephemeral: true });

  const channel = await client.channels.fetch(CHANNEL_ID).catch(() => null);
  if (!channel) return interaction.reply({ content: 'No pude encontrar el canal configurado.', ephemeral: true });

  if (interaction.commandName === 'kill') {
    const ms = bosses[boss] * 60 * 60 * 1000;
    startTimer(boss, ms);

    // Responder rápido
    return interaction.reply({ content: `✅ **${boss.toUpperCase()} registrado como muerto.**`, ephemeral: true });
  }

  if (interaction.commandName === 'time') {
    if (!activeTimers[boss]) {
      return interaction.reply({ content: `❌ **${boss.toUpperCase()}** no está activo.`, ephemeral: true });
    }
    const remaining = activeTimers[boss].endTime - Date.now();
    const h = Math.floor(remaining / (1000 * 60 * 60));
    const m = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    return interaction.reply({ content: `⏳ **${boss.toUpperCase()}** respawnea en ${h}h ${m}m.`, ephemeral: true });
  }
});

// =====================
//     INICIAR BOT
// =====================
client.once('ready', () => {
  console.log(`Bot listo como ${client.user.tag}`);
});

client.login(TOKEN);
