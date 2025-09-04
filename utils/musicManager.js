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
import youtubeSr from 'youtube-sr';

console.log(generateDependencyReport());

class MusicManager {
    constructor() {
        this.queues = new Map();
        this.connections = new Map();
        this.players = new Map();
        this.retryAttempts = 2; // Reducido para evitar spam
        this.useAlternativeSearch = false; // Flag para usar búsqueda alternativa
    }

    getGuildData(guildId) {
        if (!this.queues.has(guildId)) {
            this.queues.set(guildId, {
                songs: [],
                currentSong: null,
                loop: 'none',
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

        if (!channel || !channel.joinable) {
            throw new Error('No puedo unirme a tu canal de voz.');
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
            this.playSong(guildId, guildData.currentSong);
        } else if (guildData.loop === 'queue' && guildData.currentSong) {
            guildData.songs.push(guildData.currentSong);
            this.playNext(guildId);
        } else {
            this.playNext(guildId);
        }
    }

    // Método de búsqueda principal con fallbacks integrados
    async search(query) {
        // Método 1: Intentar con ytdl si es URL válida
        if (ytdl.validateURL(query)) {
            try {
                const info = await ytdl.getInfo(query);
                return {
                    title: info.videoDetails.title,
                    url: query,
                    duration: parseInt(info.videoDetails.lengthSeconds),
                    thumbnail: info.videoDetails.thumbnails[0]?.url,
                    author: info.videoDetails.author.name,
                    isLive: info.videoDetails.isLiveContent,
                    source: 'ytdl-url'
                };
            } catch (ytdlError) {
                console.warn('ytdl failed for URL, trying alternative methods');
                this.useAlternativeSearch = true;
            }
        }

        // Método 2: youtube-sr (más confiable actualmente)
        try {
            const results = await youtubeSr.search(query, { type: 'video', limit: 1 });
            
            if (results && results.length > 0) {
                const video = results[0];
                return {
                    title: video.title,
                    url: video.url,
                    duration: Math.floor(video.duration / 1000),
                    thumbnail: video.thumbnail?.displayThumbnailURL() || video.thumbnail?.url,
                    author: video.channel?.name || 'Unknown',
                    isLive: video.live || false,
                    source: 'youtube-sr'
                };
            }
        } catch (srError) {
            console.warn('youtube-sr failed, trying yt-search:', srError.message);
        }

        // Método 3: yt-search como último recurso
        try {
            const results = await yts(query);
            if (results.videos && results.videos.length > 0) {
                const video = results.videos[0];
                return {
                    title: video.title,
                    url: video.url,
                    duration: video.duration.seconds,
                    thumbnail: video.thumbnail,
                    author: video.author.name,
                    isLive: false,
                    source: 'yt-search'
                };
            }
        } catch (ytsError) {
            console.error('All search methods failed:', ytsError);
        }

        return null;
    }

    async add(query, guildId) {
        const song = await this.search(query);
        if (!song) return null;

        const guildData = this.getGuildData(guildId);
        guildData.songs.push(song);

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

    async playSong(guildId, song, attempt = 1) {
        try {
            const player = this.players.get(guildId);
            if (!player) return false;

            const guildData = this.getGuildData(guildId);

            if (song.isLive) {
                console.warn('Skipping live stream:', song.title);
                this.playNext(guildId);
                return false;
            }

            // Intentar crear el stream con manejo robusto de errores
            let stream;
            let streamCreated = false;

            // Si ytdl ha fallado antes, usar método alternativo directamente
            if (this.useAlternativeSearch && song.source !== 'ytdl-url') {
                console.log('Using alternative stream method due to previous ytdl failures');
                throw new Error('Skipping ytdl due to previous failures');
            }

            // Intentar diferentes configuraciones de ytdl
            const ytdlOptions = [
                { 
                    filter: 'audioonly', 
                    quality: 'lowestaudio',
                    requestOptions: {
                        headers: {
                            cookie: process.env.YT_COOKIE,
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                        }
                    }
                },
                { 
                    filter: 'audioonly',
                    requestOptions: {
                        headers: {
                            cookie: process.env.YT_COOKIE,
                            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
                        }
                    }
                }
            ];

            for (const options of ytdlOptions) {
                try {
                    stream = ytdl(song.url, options);
                    streamCreated = true;
                    console.log(`Stream created successfully for: ${song.title}`);
                    break;
                } catch (error) {
                    console.warn(`ytdl option failed:`, error.message);
                    continue;
                }
            }

            if (!streamCreated) {
                throw new Error('Could not create ytdl stream with any configuration');
            }

            const resource = createAudioResource(stream, {
                inlineVolume: true
            });

            resource.volume?.setVolume(guildData.volume);

            // Manejar errores del stream ANTES de reproducir
            stream.on('error', (error) => {
                console.error('Stream error occurred:', error.message);
                
                // Si es el error de "Sign in to confirm you're not a bot", marcar para usar alternativas
                if (error.message.includes('Sign in to confirm')) {
                    this.useAlternativeSearch = true;
                    console.log('YouTube bot detection triggered, switching to alternative methods');
                }
                
                // Saltar a la siguiente canción inmediatamente
                setTimeout(() => {
                    console.log('Skipping to next song due to stream error');
                    this.playNext(guildId);
                }, 1000);
            });

            player.play(resource);
            guildData.currentSong = song;
            guildData.isPlaying = true;
            guildData.isPaused = false;

            return true;

        } catch (error) {
            console.error(`Error playing song (attempt ${attempt}):`, error.message);
            
            // Si es error de bot detection, marcar flag
            if (error.message.includes('Sign in to confirm') || error.message.includes('bot')) {
                this.useAlternativeSearch = true;
            }
            
            if (attempt <= this.retryAttempts && !error.message.includes('Sign in to confirm')) {
                console.log(`Retrying song (${attempt}/${this.retryAttempts}): ${song.title}`);
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                return this.playSong(guildId, song, attempt + 1);
            }
            
            console.log(`Skipping song after ${attempt} attempts: ${song.title}`);
            
            // Intentar siguiente canción
            setTimeout(() => this.playNext(guildId), 500);
            return false;
        }
    }

    pause(guildId) {
        const player = this.players.get(guildId);
        const guildData = this.getGuildData(guildId);
        
        if (player && guildData.isPlaying && !guildData.isPaused) {
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
            player.stop();
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
            volume: guildData.volume,
            usingAlternativeSearch: this.useAlternativeSearch
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

    // Método para resetear el flag de búsqueda alternativa
    resetAlternativeSearch() {
        this.useAlternativeSearch = false;
        console.log('Reset alternative search flag - will try ytdl again');
    }
}

export const musicManager = new MusicManager();