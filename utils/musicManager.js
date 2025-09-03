import { 
    createAudioPlayer, 
    createAudioResource, 
    joinVoiceChannel, 
    AudioPlayerStatus, 
    VoiceConnectionStatus,
    generateDependencyReport
} from '@discordjs/voice';
import ytdl from '@distube/ytdl-core';
import yts from 'yt-search';

console.log(generateDependencyReport());

class MusicManager {
    constructor() {
        this.queues = new Map(); // Una cola por guild
        this.connections = new Map();
        this.players = new Map();
    }

    getGuildData(guildId) {
        if (!this.queues.has(guildId)) {
            this.queues.set(guildId, {
                songs: [],
                currentSong: null,
                loop: 'none', // 'none', 'song', 'queue'
                volume: 0.5,
                isPlaying: false,
                isPaused: false
            });
        }
        return this.queues.get(guildId);
    }

    async join(channel) {
        const guildId = channel.guild.id;
        
        if (this.connections.has(guildId)) {
            return this.connections.get(guildId);
        }

        if (!member.voice.channel || !member.voice.channel.joinable) {
            return interaction.reply({ content: 'No puedo unirme a tu canal de voz.', ephemeral: true });
        }

        const connection = joinVoiceChannel({
            channelId: channel.id,
            guildId: guildId,
            adapterCreator: channel.guild.voiceAdapterCreator,
        });

        const player = createAudioPlayer();
        
        connection.subscribe(player);
        
        this.connections.set(guildId, connection);
        this.players.set(guildId, player);

        // Event handlers
        connection.on(VoiceConnectionStatus.Disconnected, () => {
            this.cleanup(guildId);
        });

        connection.on(VoiceConnectionStatus.Destroyed, () => {
            this.cleanup(guildId);
        });

        player.on(AudioPlayerStatus.Idle, () => {
            this.handleSongEnd(guildId);
        });

        player.on('error', error => {
            console.error('Audio player error:', error);
            this.handleSongEnd(guildId);
        });

        return connection;
    }

    async handleSongEnd(guildId) {
        const guildData = this.getGuildData(guildId);
        
        if (guildData.loop === 'song' && guildData.currentSong) {
            // Repetir la canción actual
            this.playSong(guildId, guildData.currentSong);
        } else if (guildData.loop === 'queue' && guildData.currentSong) {
            // Añadir la canción actual al final de la cola
            guildData.songs.push(guildData.currentSong);
            this.playNext(guildId);
        } else {
            // Reproducir siguiente canción
            this.playNext(guildId);
        }
    }

    async search(query) {
        try {
            // Si es una URL de YouTube
            if (ytdl.validateURL(query)) {
                const info = await ytdl.getInfo(query);
                return {
                    title: info.videoDetails.title,
                    url: query,
                    duration: parseInt(info.videoDetails.lengthSeconds),
                    thumbnail: info.videoDetails.thumbnails[0]?.url,
                    author: info.videoDetails.author.name,
                    isLive: info.videoDetails.isLiveContent
                };
            }

            // Buscar en YouTube
            const results = await yts(query);
            if (!results.videos.length) return null;

            const video = results.videos[0];
            return {
                title: video.title,
                url: video.url,
                duration: video.duration.seconds,
                thumbnail: video.thumbnail,
                author: video.author.name,
                isLive: false
            };
        } catch (error) {
            console.error('Error en búsqueda:', error);
            return null;
        }
    }

    async add(query, guildId) {
        const song = await this.search(query);
        if (!song) return null;

        const guildData = this.getGuildData(guildId);
        guildData.songs.push(song);

        // Si no hay música reproduciéndose, empezar a reproducir
        if (!guildData.isPlaying) {
            this.playNext(guildId);
        }

        return song;
    }

    async playNext(guildId) {
        const guildData = this.getGuildData(guildId);
        
        if (guildData.songs.length === 0) {
            guildData.isPlaying = false;
            guildData.currentSong = null;
            return false;
        }

        const song = guildData.songs.shift();
        return this.playSong(guildId, song);
    }

    async playSong(guildId, song) {
        try {
            const player = this.players.get(guildId);
            if (!player) return false;

            const guildData = this.getGuildData(guildId);

            // Verificar si es contenido en vivo (no soportado por ytdl)
            if (song.isLive) {
                throw new Error('Live streams are not supported');
            }

            let stream;
            try {
                stream = ytdl(song.url, { filter: 'audioonly', highWaterMark: 1<<25, quality: 'lowestaudio' });
            } catch (err) {
                console.error('Error creando stream:', err);
                return false;
            }

            const resource = createAudioResource(stream, {
                inlineVolume: true
            });

            resource.volume?.setVolume(guildData.volume);

            player.play(resource);
            guildData.currentSong = song;
            guildData.isPlaying = true;
            guildData.isPaused = false;

            return true;
        } catch (error) {
            console.error('Error reproduciendo canción:', error);
            // Intentar siguiente canción si hay error
            this.playNext(guildId);
            return false;
        }
    }

    pause(guildId) {
        const player = this.players.get(guildId);
        const guildData = this.getGuildData(guildId);
        
        if (player && guildData.isPlaying) {
            player.pause();
            guildData.isPaused = true;
            return true;
        }
        return false;
    }

    resume(guildId) {
        const player = this.players.get(guildId);
        const guildData = this.getGuildData(guildId);
        
        if (player && guildData.isPaused) {
            player.unpause();
            guildData.isPaused = false;
            return true;
        }
        return false;
    }

    stop(guildId) {
        const player = this.players.get(guildId);
        const guildData = this.getGuildData(guildId);
        
        if (player) {
            player.stop();
            guildData.songs = [];
            guildData.currentSong = null;
            guildData.isPlaying = false;
            guildData.isPaused = false;
            return true;
        }
        return false;
    }

    skip(guildId) {
        const player = this.players.get(guildId);
        if (player) {
            player.stop(); // Esto triggerea el evento 'idle' que reproduce la siguiente
            return true;
        }
        return false;
    }

    shuffle(guildId) {
        const guildData = this.getGuildData(guildId);
        const songs = guildData.songs;
        
        for (let i = songs.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [songs[i], songs[j]] = [songs[j], songs[i]];
        }
        return true;
    }

    setLoop(guildId, mode) {
        const guildData = this.getGuildData(guildId);
        const validModes = ['none', 'song', 'queue'];
        
        if (validModes.includes(mode)) {
            guildData.loop = mode;
            return mode;
        }
        return guildData.loop;
    }

    toggleLoop(guildId) {
        const guildData = this.getGuildData(guildId);
        const modes = ['none', 'song', 'queue'];
        const currentIndex = modes.indexOf(guildData.loop);
        const nextIndex = (currentIndex + 1) % modes.length;
        
        guildData.loop = modes[nextIndex];
        return guildData.loop;
    }

    getQueue(guildId) {
        const guildData = this.getGuildData(guildId);
        return {
            current: guildData.currentSong,
            queue: guildData.songs,
            isPlaying: guildData.isPlaying,
            isPaused: guildData.isPaused,
            loop: guildData.loop,
            volume: guildData.volume
        };
    }

    clear(guildId) {
        const guildData = this.getGuildData(guildId);
        guildData.songs = [];
        return true;
    }

    leave(guildId) {
        const connection = this.connections.get(guildId);
        if (connection) {
            connection.destroy();
        }
        this.cleanup(guildId);
    }

    cleanup(guildId) {
        this.connections.delete(guildId);
        this.players.delete(guildId);
        this.queues.delete(guildId);
    }

    setVolume(guildId, volume) {
        const guildData = this.getGuildData(guildId);
        volume = Math.max(0, Math.min(1, volume));
        guildData.volume = volume;
        
        const player = this.players.get(guildId);
        if (player && player.state.resource?.volume) {
            player.state.resource.volume.setVolume(volume);
        }
        return volume;
    }
}

// Instancia única
export const musicManager = new MusicManager();