import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { toggleAutoResponder } from '../utils/configManager.js';
import { readFile } from 'fs/promises';

export const data = new SlashCommandBuilder()
    .setName('toggle-autoresponder')
    .setDescription('Activa/desactiva el sistema de autorespuesta')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction) {
    const config = JSON.parse(await readFile(new URL('../config.json', import.meta.url)));
    
    const hasPermission = interaction.member.roles.cache.some(role => 
        config.adminRoles.includes(role.name)
    );

    if (!hasPermission) {
        return interaction.reply({ 
            content: '❌ No tienes permisos para usar este comando.', 
            ephemeral: true 
        });
    }

    try {
        const newState = await toggleAutoResponder();
        
        await interaction.reply({
            content: `🤖 **Sistema de autorespuesta:** ${newState ? '✅ ACTIVADO' : '❌ DESACTIVADO'}`,
            ephemeral: true
        });
    } catch (error) {
        console.error('Error cambiando autoresponder:', error);
        await interaction.reply({ 
            content: '❌ Error al cambiar el estado del autoresponder.', 
            ephemeral: true 
        });
    }
}