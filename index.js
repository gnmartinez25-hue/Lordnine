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

const timersFile = path.join(__dirname, 'timers.json');
let activeTimers = {};

// =====================
// Guardar timers en archivo
// =====================
function saveTimers() {
  fs.writeFileSync(timersFile, JSON.stringify(activeTimers, null, 2));
}

// =====================
// Crear timers en memoria
// =====================
async function createTimer(boss, endTime, warn10Sent = false, warn5Sent = false) {
  const channel = await client.channels.fetch(CHANNEL_ID).catch(() => null);
  if (!channel) return;

  const now = Date.now();
  const msRemaining = endTime - now;
  if (msRemaining <= 0) {
    channel.send(`💥 @everyone **${boss.toUpperCase()} ha respawneado!**`);
    delete activeTimers[boss];
    saveTimers();
    return;
  }

  activeTimers[boss] = { endTime, warn10Sent, warn5Sent };

  // Aviso 10 min
  if (!warn10Sent && msRemaining > 10 * 60 * 1000) {
    activeTimers[boss].warn10 = setTimeout(() => {
      channel.send(`⚠️ @everyone **${boss.toUpperCase()}** respawnea en **10 minutos**!`);
      activeTimers[boss].warn10Sent = true;
      saveTimers();
    }, msRemaining - 10 * 60 * 1000);
  }

  // Aviso 5 min
  if (!warn5Sent && msRemaining > 5 * 60 * 1000) {
    activeTimers[boss].warn5 = setTimeout(() => {
      channel.send(`⚠️ @everyone **${boss.toUpperCase()}** respawnea en **5 minutos**!`);
      activeTimers[boss].warn5Sent = true;
      saveTimers();
    }, msRemaining - 5 * 60 * 1000);
  }

  // Respawn
  activeTimers[boss].full = setTimeout(() => {
    channel.send(`💥 @everyone **${boss.toUpperCase()} ha respawneado!**`);
    delete activeTimers[boss];
    saveTimers();
  }, msRemaining);
}

// =====================
// Al iniciar, cargar timers del archivo
// =====================
if (fs.existsSync(timersFile)) {
  const saved = JSON.parse(fs.readFileSync(timersFile));
  for (const boss in saved) {
    const { endTime, warn10Sent, warn5Sent } = saved[boss];
    createTimer(boss, endTime, warn10Sent, warn5Sent);
  }
}

// =====================
// Comandos slash
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
    .setDescription('Ver tiempo restante para todos los bosses activos')
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

  const channel = await client.channels.fetch(CHANNEL_ID).catch(() => null);
  if (!channel) return;

  if (interaction.commandName === 'kill') {
    const boss = interaction.options.getString('boss');
    const hours = bosses[boss];
    if (!hours) return interaction.reply({ content: 'Boss no configurado.', ephemeral: true });

    const now = Date.now();
    const endTime = now + hours * 60 * 60 * 1000;

    // Evitar duplicados
    if (activeTimers[boss]) {
      return interaction.reply({ content: `❌ **${boss.toUpperCase()}** ya está activo.`, ephemeral: true });
    }

    await createTimer(boss, endTime);
    saveTimers();

    await interaction.reply({ content: `✅ **${boss.toUpperCase()} registrado como muerto.**`, ephemeral: true });
    channel.send(`⏳ **${boss.toUpperCase()}** ha sido marcado como muerto. Respawn en **${hours} horas**.`);
  }

  if (interaction.commandName === 'time') {
    if (Object.keys(activeTimers).length === 0) {
      return interaction.reply({ content: 'No hay bosses activos actualmente.', ephemeral: true });
    }

    let message = '';
    const now = Date.now();
    for (const boss in activeTimers) {
      const remaining = activeTimers[boss].endTime - now;
      const h = Math.floor(remaining / 3600000);
      const m = Math.floor((remaining % 3600000) / 60000);
      message += `⏳ **${boss.toUpperCase()}**: ${h}h ${m}m restantes\n`;
    }

    await interaction.reply({ content: message, ephemeral: true });
  }
});

client.once('ready', () => {
  console.log(`Bot listo como ${client.user.tag}`);
});

client.login(TOKEN);
