import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { musicManager } from '../utils/musicManager.js';

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
            .setDescription('Cambia el modo de bucle'))
    .addSubcommand(subcommand =>
        subcommand
            .setName('volume')
            .setDescription('Ajusta el volumen (0-100)')
            .addIntegerOption(option =>
                option.setName('level')
                    .setDescription('Nivel de volumen (0-100)')
                    .setRequired(true)
                    .setMinValue(0)
                    .setMaxValue(100)))
    .addSubcommand(subcommand =>
        subcommand
            .setName('nowplaying')
            .setDescription('Muestra la canción actual'))
    .addSubcommand(subcommand =>
        subcommand
            .setName('clear')
            .setDescription('Limpia la cola de reproducción'))
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
        case 'volume':
            await handleVolume(interaction);
            break;
        case 'nowplaying':
            await handleNowPlaying(interaction);
            break;
        case 'clear':
            await handleClear(interaction);
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
            content: 'Debes estar en un canal de voz para usar este comando.', 
            ephemeral: true 
        });
    }

    await interaction.deferReply();

    try {
        await musicManager.join(member.voice.channel);
        const song = await musicManager.add(query, interaction.guild.id);

        if (!song) {
            return interaction.editReply('No se pudo encontrar la canción.');
        }

        const embed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('Canción añadida a la cola')
            .addFields(
                { name: 'Título', value: song.title, inline: true },
                { name: 'Duración', value: formatDuration(song.duration), inline: true },
                { name: 'Autor', value: song.author, inline: true }
            )
            .setTimestamp();

        if (song.thumbnail) {
            embed.setThumbnail(song.thumbnail);
        }

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('Error en play:', error);
        await interaction.editReply('Error al reproducir la canción: ' + error.message);
    }
}

async function handlePause(interaction) {
    const success = musicManager.pause(interaction.guild.id);
    
    if (!success) {
        return interaction.reply({ 
            content: 'No hay música reproduciéndose o ya está pausada.', 
            ephemeral: true 
        });
    }

    await interaction.reply('Música pausada');
}

async function handleResume(interaction) {
    const success = musicManager.resume(interaction.guild.id);
    
    if (!success) {
        return interaction.reply({ 
            content: 'No hay música pausada.', 
            ephemeral: true 
        });
    }

    await interaction.reply('Música reanudada');
}

async function handleStop(interaction) {
    musicManager.stop(interaction.guild.id);
    await interaction.reply('Música detenida y cola limpiada');
}

async function handleSkip(interaction) {
    const success = musicManager.skip(interaction.guild.id);
    
    if (!success) {
        return interaction.reply({ 
            content: 'No hay música reproduciéndose.', 
            ephemeral: true 
        });
    }

    await interaction.reply('Canción saltada');
}

async function handleQueue(interaction) {
    const queueInfo = musicManager.getQueue(interaction.guild.id);

    if (!queueInfo.current && queueInfo.queue.length === 0) {
        return interaction.reply('La cola está vacía.');
    }

    const embed = new EmbedBuilder()
        .setColor('#0099FF')
        .setTitle('Cola de reproducción')
        .setTimestamp();

    if (queueInfo.current) {
        embed.addFields({
            name: 'Reproduciendo ahora',
            value: `**${queueInfo.current.title}**\nDuración: ${formatDuration(queueInfo.current.duration)}`
        });
    }

    if (queueInfo.queue.length > 0) {
        const queueList = queueInfo.queue
            .slice(0, 10)
            .map((song, index) => `**${index + 1}.** ${song.title} (${formatDuration(song.duration)})`)
            .join('\n');

        embed.addFields({
            name: `Próximas canciones (${queueInfo.queue.length})`,
            value: queueList || 'No hay canciones en cola'
        });

        if (queueInfo.queue.length > 10) {
            embed.setFooter({ text: `... y ${queueInfo.queue.length - 10} más` });
        }
    }

    const loopModes = {
        'none': 'Desactivado',
        'song': 'Canción actual',
        'queue': 'Cola completa'
    };

    embed.addFields({
        name: 'Estado',
        value: `Bucle: ${loopModes[queueInfo.loop]}\nVolumen: ${Math.round(queueInfo.volume * 100)}%`
    });

    await interaction.reply({ embeds: [embed] });
}

async function handleShuffle(interaction) {
    const queueInfo = musicManager.getQueue(interaction.guild.id);
    
    if (queueInfo.queue.length === 0) {
        return interaction.reply({ 
            content: 'No hay canciones en la cola para mezclar.', 
            ephemeral: true 
        });
    }

    musicManager.shuffle(interaction.guild.id);
    await interaction.reply('Cola mezclada');
}

async function handleLoop(interaction) {
    const newMode = musicManager.toggleLoop(interaction.guild.id);
    
    const loopModes = {
        'none': 'Desactivado',
        'song': 'Canción actual',
        'queue': 'Cola completa'
    };
    
    await interaction.reply(`Bucle: ${loopModes[newMode]}`);
}

async function handleVolume(interaction) {
    const level = interaction.options.getInteger('level');
    const newVolume = musicManager.setVolume(interaction.guild.id, level / 100);
    
    await interaction.reply(`Volumen ajustado a ${Math.round(newVolume * 100)}%`);
}

async function handleNowPlaying(interaction) {
    const queueInfo = musicManager.getQueue(interaction.guild.id);
    
    if (!queueInfo.current) {
        return interaction.reply('No hay música reproduciéndose actualmente.');
    }

    const song = queueInfo.current;
    const embed = new EmbedBuilder()
        .setColor('#FF6B6B')
        .setTitle('🎵 Reproduciendo ahora')
        .addFields(
            { name: 'Título', value: song.title, inline: true },
            { name: 'Autor', value: song.author, inline: true },
            { name: 'Duración', value: formatDuration(song.duration), inline: true }
        )
        .setTimestamp();

    if (song.thumbnail) {
        embed.setThumbnail(song.thumbnail);
    }

    const loopModes = {
        'none': 'Desactivado',
        'song': 'Canción actual', 
        'queue': 'Cola completa'
    };

    embed.addFields({
        name: 'Estado',
        value: `Bucle: ${loopModes[queueInfo.loop]}\nVolumen: ${Math.round(queueInfo.volume * 100)}%\nEn cola: ${queueInfo.queue.length} canciones`
    });

    await interaction.reply({ embeds: [embed] });
}

async function handleClear(interaction) {
    musicManager.clear(interaction.guild.id);
    await interaction.reply('Cola de reproducción limpiada ✅');
}

async function handleLeave(interaction) {
    musicManager.leave(interaction.guild.id);
    await interaction.reply('Bot desconectado del canal de voz 👋');
}

function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}