import { SlashCommandBuilder, ChannelType } from 'discord.js';
import { readFile, writeFile } from 'fs/promises';

const configPath = new URL('../config.json', import.meta.url);

// Cargamos el config.json (importante: lo hacemos dentro de cada ejecución para mantenerlo actualizado)
async function getConfig() {
    const rawConfig = await readFile(configPath, 'utf8');
    return JSON.parse(rawConfig);
}

// Definición del comando
export const data = new SlashCommandBuilder()
    .setName('testing_mode')
    .setDescription('Activa o desactiva el modo testing.')
    .addBooleanOption(option =>
        option.setName('enabled')
            .setDescription('¿Activar el modo testing?')
            .setRequired(true))
    .addChannelOption(option =>
        option.setName('channel')
            .setDescription('Canal de testing (requerido si activas testing)')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
    );

// Ejecución del comando
export const execute = async (interaction) => {
    const enabled = interaction.options.getBoolean('enabled');
    const channel = interaction.options.getChannel('channel');

    const config = await getConfig();

    if (enabled && !channel) {
        return interaction.reply({ content: 'Debes especificar un canal de testing al activar el modo testing.', ephemeral: true });
    }

    config.testing = enabled;
    if (enabled) {
        config.testingChannel = channel.id;
    }

    await writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');

    await interaction.reply(`Modo testing ${enabled ? 'activado' : 'desactivado'}${enabled ? ` en <#${channel.id}>` : ''}.`);
};