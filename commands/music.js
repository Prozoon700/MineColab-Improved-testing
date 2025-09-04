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
            .setDescription('Desconecta el bot del canal de voz'))
    .addSubcommand(subcommand =>
        subcommand
            .setName('reset')
            .setDescription('Reinicia el sistema de música (solo para admins)'));

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
        case 'reset':
            await handleReset(interaction);
            break;
    }
}

/* ---------------- FUNCIONES ---------------- */

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
        try {
            await musicManager.join(member.voice.channel);
        } catch (joinError) {
            return interaction.editReply({
                content: `❌ No pude unirme al canal de voz: ${joinError.message}`
            });
        }

        const song = await musicManager.add(query, interaction.guild.id);

        if (!song) {
            return interaction.editReply({
                content: '❌ No se pudo encontrar la canción. Intenta con otro término de búsqueda.'
            });
        }

        const embed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('🎵 Canción añadida a la cola')
            .addFields(
                { name: '📝 Título', value: song.title, inline: false },
                { name: '👤 Autor', value: song.author, inline: true },
                { name: '⏱️ Duración', value: formatDuration(song.duration), inline: true },
                { name: '🔍 Fuente', value: song.source || 'YouTube', inline: true }
            )
            .setTimestamp();

        if (song.thumbnail) embed.setThumbnail(song.thumbnail);

        const queueInfo = musicManager.getQueue(interaction.guild.id);
        if (queueInfo.usingAlternativeSearch) {
            embed.setFooter({ text: 'ℹ️ Usando métodos alternativos de búsqueda debido a restricciones de YouTube' });
        }

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('Error en comando play:', error);
        await interaction.editReply({
            content: `❌ Error al procesar la solicitud: ${error.message}`
        });
    }
}

async function handlePause(interaction) {
    const success = musicManager.pause(interaction.guild.id);
    if (!success) {
        return interaction.reply({ 
            content: '❌ No hay música reproduciéndose o ya está pausada.', 
            ephemeral: true 
        });
    }
    await interaction.reply({ embeds: [new EmbedBuilder().setColor('#FFA500').setTitle('⏸️ Música pausada')] });
}

async function handleResume(interaction) {
    const success = musicManager.resume(interaction.guild.id);
    if (!success) {
        return interaction.reply({ content: '❌ No hay música pausada.', ephemeral: true });
    }
    await interaction.reply({ embeds: [new EmbedBuilder().setColor('#00FF00').setTitle('▶️ Música reanudada')] });
}

async function handleStop(interaction) {
    musicManager.stop(interaction.guild.id);
    await interaction.reply({ embeds: [new EmbedBuilder().setColor('#FF0000').setTitle('⏹️ Música detenida')] });
}

async function handleSkip(interaction) {
    const queueInfo = musicManager.getQueue(interaction.guild.id);
    if (!queueInfo.current) {
        return interaction.reply({ content: '❌ No hay música reproduciéndose.', ephemeral: true });
    }
    const skippedSong = queueInfo.current.title;
    musicManager.skip(interaction.guild.id);
    await interaction.reply({ embeds: [new EmbedBuilder().setColor('#FFA500').setTitle(`⏭️ Saltada: ${skippedSong}`)] });
}

async function handleQueue(interaction) {
    const queueInfo = musicManager.getQueue(interaction.guild.id);
    if (!queueInfo.current && queueInfo.queue.length === 0) {
        return interaction.reply({ content: '📭 La cola está vacía.' });
    }

    const embed = new EmbedBuilder().setColor('#0099FF').setTitle('📋 Cola de reproducción');
    if (queueInfo.current) {
        embed.addFields({ name: '▶️ Ahora', value: `${queueInfo.current.title} (${formatDuration(queueInfo.current.duration)})` });
    }
    if (queueInfo.queue.length > 0) {
        embed.addFields({
            name: `📝 Próximas (${queueInfo.queue.length})`,
            value: queueInfo.queue.slice(0, 10).map((s, i) => `**${i+1}.** ${s.title} (${formatDuration(s.duration)})`).join('\n')
        });
    }
    await interaction.reply({ embeds: [embed] });
}

async function handleShuffle(interaction) {
    const queueInfo = musicManager.getQueue(interaction.guild.id);
    if (queueInfo.queue.length === 0) {
        return interaction.reply({ content: '❌ No hay canciones en la cola.', ephemeral: true });
    }
    musicManager.shuffle(interaction.guild.id);
    await interaction.reply({ embeds: [new EmbedBuilder().setColor('#9932CC').setTitle('🔀 Cola mezclada')] });
}

async function handleLoop(interaction) {
    const newMode = musicManager.toggleLoop(interaction.guild.id);
    const loopModes = { none: '➡️ Desactivado', song: '🔂 Canción actual', queue: '🔁 Cola completa' };
    await interaction.reply({ embeds: [new EmbedBuilder().setColor('#FF69B4').setTitle(`Modo bucle: ${loopModes[newMode]}`)] });
}

async function handleVolume(interaction) {
    const level = interaction.options.getInteger('level');
    const newVolume = musicManager.setVolume(interaction.guild.id, level / 100);
    const emoji = level === 0 ? '🔇' : level < 30 ? '🔉' : level < 70 ? '🔊' : '📢';
    await interaction.reply({ embeds: [new EmbedBuilder().setColor('#1E90FF').setTitle(`${emoji} Volumen: ${Math.round(newVolume * 100)}%`)] });
}

async function handleNowPlaying(interaction) {
    const queueInfo = musicManager.getQueue(interaction.guild.id);
    if (!queueInfo.current) {
        return interaction.reply({ content: '❌ No hay música reproduciéndose.' });
    }
    const song = queueInfo.current;
    const loopModes = { none: '➡️ Desactivado', song: '🔂 Canción actual', queue: '🔁 Cola completa' };

    const embed = new EmbedBuilder()
        .setColor('#FF6B6B')
        .setTitle(`🎵 ${queueInfo.isPaused ? '⏸️ Pausado' : '▶️ Reproduciendo'}`)
        .addFields(
            { name: '📝 Título', value: song.title },
            { name: '👤 Autor', value: song.author, inline: true },
            { name: '⏱️ Duración', value: formatDuration(song.duration), inline: true },
            { name: '🔍 Fuente', value: song.source || 'YouTube', inline: true }
        )
        .addFields({ name: '⚙️ Estado', value: `${loopModes[queueInfo.loop]}\n🔊 ${Math.round(queueInfo.volume*100)}%\n📝 ${queueInfo.queue.length} en cola` });

    if (song.thumbnail) embed.setThumbnail(song.thumbnail);
    await interaction.reply({ embeds: [embed] });
}

async function handleClear(interaction) {
    musicManager.clear(interaction.guild.id);
    await interaction.reply({ embeds: [new EmbedBuilder().setColor('#FFD700').setTitle('🗑️ Cola limpiada')] });
}

async function handleLeave(interaction) {
    musicManager.leave(interaction.guild.id);
    await interaction.reply({ embeds: [new EmbedBuilder().setColor('#808080').setTitle('👋 Desconectado del canal de voz')] });
}

async function handleReset(interaction) {
    if (!interaction.member.permissions.has('Administrator')) {
        return interaction.reply({ content: '❌ Solo los administradores pueden usar este comando.', ephemeral: true });
    }
    musicManager.reset(interaction.guild.id);
    await interaction.reply({ embeds: [new EmbedBuilder().setColor('#FF4500').setTitle('♻️ Sistema de música reiniciado')] });
}

/* ---------------- UTILS ---------------- */

function formatDuration(seconds) {
    if (!seconds || isNaN(seconds)) return 'Directo';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return h > 0 ? `${h}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}` : `${m}:${s.toString().padStart(2,'0')}`;
}