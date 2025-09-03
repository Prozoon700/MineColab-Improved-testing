import { Client, GatewayIntentBits, Collection } from 'discord.js';
import { readFile } from 'fs/promises';
import { handleMessageCreate } from './events/messageCreate.js';
import { handleInteractionCreate } from './events/interactionCreate.js';
import { deployCommands } from './commands/commands-deployer.js';

const config = JSON.parse(await readFile(new URL('./config.json', import.meta.url)));

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

// Inicializar cliente de Discord
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

console.log('Bot inicializándose...');

async function main() {
    try {
        console.log("Llamando al deployer...");
        await deployCommands(config.clientId, config.token);
        console.log("Comandos cargados correctamente!");

        client.once('ready', () => {
            console.log("Bot iniciado correctamente!");
        });

        client.on('messageCreate', handleMessageCreate.bind(null, client));
        client.on('interactionCreate', (interaction) => handleInteractionCreate(interaction, client));

        console.log("Iniciando sesión...");
        await client.login(config.token);
        console.log("Sesión iniciada correctamente como", client.user.tag);
    } catch (error) {
        console.error("❌ Error crítico al iniciar el bot:", error);
    }
}

main();
