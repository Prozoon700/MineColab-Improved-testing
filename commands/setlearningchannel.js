import { SlashCommandBuilder } from 'discord.js';
import { readFile } from 'fs/promises';

const config = JSON.parse(await readFile(new URL('../config.json', import.meta.url)));

export const data = new SlashCommandBuilder()
  .setName('setlearningchannel')
  .setDescription('Establecer el canal de aprendizaje automático')
  .addChannelOption(option =>
    option.setName('channel')
      .setDescription('Canal donde el bot aprenderá')
      .setRequired(true));

export const execute = async (interaction) => {
  const channel = interaction.options.getChannel('channel');

  if (!channel) {
    return interaction.reply('Debes especificar un canal válido.');
  }

  config.learningChannel = channel.id;
  await interaction.reply(`Canal de aprendizaje establecido: ${channel.name}`);
};
