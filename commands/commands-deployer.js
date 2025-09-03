import { REST, Routes } from 'discord.js';
import { readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function deployCommands(clientId, token) {
    const commands = [];
    const commandFiles = readdirSync(__dirname).filter(file => 
        file.endsWith('.js') && file !== 'commands-deployer.js'
    );

    for (const file of commandFiles) {
        const command = await import(`./${file}`);
        if (command.data) {
            commands.push(command.data.toJSON());
        }
    }

    const rest = new REST({ version: '10' }).setToken(token);

    try {
        console.log(`Actualizando ${commands.length} comandos de aplicación.`);

        await rest.put(
            Routes.applicationCommands(clientId),
            { body: commands }
        );

        console.log('Comandos de aplicación actualizados correctamente.');
    } catch (error) {
        console.error('Error desplegando comandos:', error);
    }
}