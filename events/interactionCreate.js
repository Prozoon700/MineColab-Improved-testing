import { readdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const commands = new Map();

export async function localCommands() {
    const commandFiles = readdirSync(join(__dirname, '../commands')).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
        if (file === 'commands-deployer.js') continue;
        const command = await import(`../commands/${file}`);
        commands.set(command.data.name, command);
    }
}

export async function handleInteractionCreate(interaction) {
    if (!interaction.isCommand()) return;

    const command = commands.get(interaction.commandName);
    if (!command) return interaction.reply({ content: 'Comando no reconocido.', ephemeral: true });

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error('Error ejecutando comando:', error);
        await interaction.reply({ content: 'Hubo un error ejecutando el comando.', ephemeral: true });
    }
}