import { readdirSync } from 'fs';
import { REST, Routes } from 'discord.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function deployCommands(clientId, token) {
    const commands = [];
    const commandFiles = readdirSync(join(__dirname)).filter(file => 
        file.endsWith('.js') && file !== 'commands-deployer.js'
    );

    for (const file of commandFiles) {
        const command = await import(join(__dirname, file));
        if (command.data) {
            commands.push(command.data.toJSON());
        }
    }

    const rest = new REST({ version: '10' }).setToken(token);

    try {
        console.log(`Actualizando ${commands.length} comandos de aplicación...`);
        await rest.put(
            Routes.applicationCommands(clientId),
            { body: commands }
        );
        console.log('✅ Comandos de aplicación actualizados correctamente.');
    } catch (error) {
        console.error('❌ Error desplegando comandos:', error);
    }
}
