import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { readFile, writeFile } from 'fs/promises';
import { updateData } from '../utils/mistral.js';

export const data = new SlashCommandBuilder()
    .setName('adddata')
    .setDescription('Añade una pregunta y respuesta a la base de datos')
    .addStringOption(option =>
        option.setName('pregunta')
            .setDescription('La pregunta a añadir')
            .setRequired(true))
    .addStringOption(option =>
        option.setName('respuesta')
            .setDescription('La respuesta asociada')
            .setRequired(true))
    .addStringOption(option =>
        option.setName('preguntas_alternativas')
            .setDescription('Preguntas alternativas separadas por ;')
            .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);

export async function execute(interaction) {
    const config = JSON.parse(await readFile(new URL('../config.json', import.meta.url)));
    
    // Verificar permisos por rol
    const hasPermission = interaction.member.roles.cache.some(role => 
        config.adminRoles.includes(role.name)
    );

    if (!hasPermission) {
        return interaction.reply({ 
            content: '❌ No tienes permisos para usar este comando.', 
            ephemeral: true 
        });
    }

    const pregunta = interaction.options.getString('pregunta');
    const respuesta = interaction.options.getString('respuesta');
    const preguntasAlt = interaction.options.getString('preguntas_alternativas');

    try {
        // Cargar datos existentes
        const dataPath = new URL('../data/data.json', import.meta.url);
        let data = [];
        
        try {
            data = JSON.parse(await readFile(dataPath, 'utf8'));
        } catch (error) {
            console.log('Creando nuevo archivo de datos');
        }

        // Preparar las preguntas
        const questions = [pregunta];
        if (preguntasAlt) {
            questions.push(...preguntasAlt.split(';').map(q => q.trim()));
        }

        // Añadir nueva entrada
        data.push({
            question: questions,
            answer: respuesta,
            addedBy: interaction.user.tag,
            addedAt: new Date().toISOString()
        });

        // Guardar
        await writeFile(dataPath, JSON.stringify(data, null, 2));
        
        // Actualizar datos en memoria
        await updateData();

        await interaction.reply({
            content: `✅ **Datos añadidos correctamente**\n` +
                    `**Pregunta principal:** ${pregunta}\n` +
                    `**Preguntas alternativas:** ${questions.length - 1}\n` +
                    `**Respuesta:** ${respuesta.substring(0, 100)}${respuesta.length > 100 ? '...' : ''}`,
            ephemeral: true
        });

    } catch (error) {
        console.error('Error añadiendo datos:', error);
        await interaction.reply({ 
            content: '❌ Error al añadir los datos.', 
            ephemeral: true 
        });
    }
}