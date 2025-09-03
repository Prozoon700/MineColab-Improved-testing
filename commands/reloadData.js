import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { updateData } from '../utils/mistral.js';
import { readFile } from 'fs/promises';

export const data = new SlashCommandBuilder()
    .setName('reload-data')
    .setDescription('Recarga los datos del bot desde los archivos')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);

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
        await updateData();
        await interaction.reply({ 
            content: '✅ **Datos recargados correctamente**', 
            ephemeral: true 
        });
    } catch (error) {
        console.error('Error recargando datos:', error);
        await interaction.reply({ 
            content: '❌ Error al recargar los datos.', 
            ephemeral: true 
        });
    }
}