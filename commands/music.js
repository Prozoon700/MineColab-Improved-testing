import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { initMusicManager } from '../utils/musicManager.js';

export const data = new SlashCommandBuilder()
    .setName('music')
    .setDescription('Sistema de música del bot')
    .addSubcommand(subcommand =>
        subcommand
            .setName('play')
            .setDescription('Reproduce una canción')
            .addStringOption(option =>
                option.setName('query')
                    .setDescription('Nombre de la canción o URL de YouTube')
                    .setRequired(true)))
    .addSubcommand(subcommand =>
        subcommand
            .setName('pause')
            .setDescription('Pausa la música'))
    .addSubcommand(subcommand =>
        subcommand
            .setName('resume')
            .setDescription('Reanuda la música'))
    .addSubcommand(subcommand =>
        subcommand
            .setName('stop')
            .setDescription('Para la música y limpia la cola'))
    .addSubcommand(subcommand =>
        subcommand
            .setName('skip')
            .setDescription('Salta la canción actual'))
    .addSubcommand(subcommand =>
        subcommand
            .setName('queue')
            .setDescription('Muestra la cola de reproducción'))
    .addSubcommand(subcommand =>
        subcommand
            .setName('shuffle')
            .setDescription('Mezcla la cola de reproducción'))
    .addSubcommand(subcommand =>
        subcommand
            .setName('loop')
            .setDescription('Activa/desactiva el bucle'))
    .addSubcommand(subcommand =>
        subcommand
            .setName('leave')
            .setDescription('Desconecta el bot del canal de voz'));

export async function execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
        case 'play':
            await handlePlay(interaction);
            break;
        case 'pause':
            await handlePause(interaction);
            break;
        case 'resume':
            await handleResume(interaction);
            break;
        case 'stop':
            await handleStop(interaction);
            break;
        case 'skip':
            await handleSkip(interaction);
            break;
        case 'queue':
            await handleQueue(interaction);
            break;
        case 'shuffle':
            await handleShuffle(interaction);
            break;
        case 'loop':
            await handleLoop(interaction);
            break;
        case 'leave':
            await handleLeave(interaction);
            break;
    }
}

async function handlePlay(interaction) {
    const query = interaction.options.getString('query');
    const member = interaction.member;
    
    if (!member.voice.channel) {
        return interaction.reply({ 
            content: '❌ Debes estar en un canal de voz para usar este comando.', 
            ephemeral: true 
        });
    }

    await interaction.deferReply();

    try {
        await initMusicManager.join(member.voice.channel);
        const track = await initMusicManager.add(query);

        if (!track) {
            return interaction.editReply('❌ No se pudo encontrar la canción.');
        }

        const embed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('🎵 Canción añadida a la cola')
            .addFields(
                { name: 'Título', value: track.title, inline: true },
                { name: 'Duración', value: formatDuration(track.duration), inline: true }
            );

        if (track.thumbnail) {
            embed.setThumbnail(track.thumbnail);
        }

        await interaction.editReply({ embeds: [embed] });

        if (!initMusicManager.isPlaying) {
            initMusicManager.play();
        }
    } catch (error) {
        console.error('Error en play:', error);
        await interaction.editReply('❌ Error al reproducir la canción.');
    }
}

async function handlePause(interaction) {
    if (!initMusicManager.isPlaying) {
        return interaction.reply({ 
            content: '❌ No hay música reproduciéndose.', 
            ephemeral: true 
        });
    }

    initMusicManager.pause();
    await interaction.reply('⏸️ **Música pausada**');
}

async function handleResume(interaction) {
    initMusicManager.resume();
    await interaction.reply('▶️ **Música reanudada**');
}

async function handleStop(interaction) {
    initMusicManager.stop();
    await interaction.reply('⏹️ **Música detenida y cola limpiada**');
}

async function handleSkip(interaction) {
    if (!initMusicManager.isPlaying) {
        return interaction.reply({ 
            content: '❌ No hay música reproduciéndose.', 
            ephemeral: true 
        });
    }

    initMusicManager.skip();
    await interaction.reply('⏭️ **Canción saltada**');
}

async function handleQueue(interaction) {
    const queueInfo = initMusicManager.getQueue();

    if (!queueInfo.current && queueInfo.queue.length === 0) {
        return interaction.reply('❌ La cola está vacía.');
    }

    const embed = new EmbedBuilder()
        .setColor('#0099FF')
        .setTitle('🎵 Cola de reproducción');

    if (queueInfo.current) {
        embed.addFields({
            name: '🎵 Reproduciendo ahora',
            value: `**${queueInfo.current.title}**\nDuración: ${formatDuration(queueInfo.current.duration)}`
        });
    }

    if (queueInfo.queue.length > 0) {
        const queueList = queueInfo.queue
            .slice(0, 10)
            .map((track, index) => `**${index + 1}.** ${track.title} (${formatDuration(track.duration)})`)
            .join('\n');

        embed.addFields({
            name: `🎶 Próximas canciones (${queueInfo.queue.length})`,
            value: queueList
        });

        if (queueInfo.queue.length > 10) {
            embed.setFooter({ text: `... y ${queueInfo.queue.length - 10} más` });
        }
    }

    embed.addFields({
        name: 'ℹ️ Estado',
        value: `Bucle: ${queueInfo.loop ? '✅' : '❌'}`
    });

    await interaction.reply({ embeds: [embed] });
}

async function handleShuffle(interaction) {
    if (initMusicManager.getQueue().queue.length === 0) {
        return interaction.reply({ 
            content: '❌ No hay canciones en la cola para mezclar.', 
            ephemeral: true 
        });
    }

    initMusicManager.shuffle();
    await interaction.reply('🔀 **Cola mezclada**');
}

async function handleLoop(interaction) {
    const loopState = initMusicManager.toggleLoop();
    await interaction.reply(`🔁 **Bucle:** ${loopState ? '✅ ACTIVADO' : '❌ DESACTIVADO'}`);
}

async function handleLeave(interaction) {
    initMusicManager.leave();
    await interaction.reply('👋 **Bot desconectado del canal de voz**');
}

function formatDuration(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}