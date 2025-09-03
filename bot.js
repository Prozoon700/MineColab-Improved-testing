import { Client, GatewayIntentBits } from 'discord.js';
import { readFile } from 'fs/promises';
import { handleMessageCreate } from './events/messageCreate.js';
import { handleInteractionCreate } from './events/interactionCreate.js';
import { deployCommands } from './commands/commands-deployer.js';

const config = JSON.parse(await readFile(new URL('./config.json', import.meta.url)));

// Manejo de errores no capturados
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    process.exit(1);
});

// Inicializar cliente de Discord con todos los intents necesarios
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers
    ],
});

console.log('🚀 Bot inicializándose...');

async function main() {
    try {
        // Desplegar comandos slash
        console.log("📝 Desplegando comandos slash...");
        await deployCommands(config.clientId, config.token);
        console.log("✅ Comandos cargados correctamente!");

        // Event handlers
        client.once('ready', () => {
            console.log(`🤖 Bot iniciado correctamente como ${client.user.tag}!`);
            console.log(`📊 Conectado a ${client.guilds.cache.size} servidor(es)`);
            console.log(`🔧 Autoresponder: ${config.autoResponder ? 'ACTIVADO' : 'DESACTIVADO'}`);
            console.log(`🎵 Sistema de música inicializado correctamente`);
            
            // Establecer estado del bot
            client.user.setPresence({
                activities: [{
                    name: 'MineColab Improved | /music play',
                    type: 0 // PLAYING
                }],
                status: 'online'
            });
        });

        client.on('messageCreate', (message) => {
            handleMessageCreate(client, message);
        });

        client.on('interactionCreate', (interaction) => {
            handleInteractionCreate(interaction, client);
        });

        // Manejo de errores del cliente
        client.on('error', (error) => {
            console.error('Error del cliente Discord:', error);
        });

        client.on('warn', (warning) => {
            console.warn('Advertencia del cliente Discord:', warning);
        });

        // Event para cuando el bot se une a un servidor
        client.on('guildCreate', (guild) => {
            console.log(`✅ Bot añadido al servidor: ${guild.name} (${guild.id})`);
        });

        // Event para cuando el bot sale de un servidor
        client.on('guildDelete', (guild) => {
            console.log(`❌ Bot removido del servidor: ${guild.name} (${guild.id})`);
        });

        // Iniciar sesión
        console.log("🔑 Iniciando sesión...");
        await client.login(config.token);
        
    } catch (error) {
        console.error("❌ Error crítico al iniciar el bot:", error);
        process.exit(1);
    }
}

// Manejar cierre graceful
process.on('SIGINT', () => {
    console.log('🛑 Señal SIGINT recibida, cerrando bot...');
    client.destroy();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('🛑 Señal SIGTERM recibida, cerrando bot...');
    client.destroy();
    process.exit(0);
});

main();