import { 
    createAudioPlayer, 
    createAudioResource, 
    joinVoiceChannel, 
    AudioPlayerStatus, 
    VoiceConnectionStatus,
    generateDependencyReport
} from '@discordjs/voice';
import play from 'play-dl';
import fs from 'fs';

console.log(generateDependencyReport());

const cookiesFile = '/workspaces/MineColab-Improved-testing/data/youtube_cookies.txt';

if (fs.existsSync(cookiesFile)) {
    const cookiesContent = fs.readFileSync(cookiesFile, 'utf-8'); // leer el contenido del archivo
    await play.setToken({
        youtube: {
            cookie: cookiesContent
        }
    });
    console.log('✅ Cookies cargadas en play-dl');
} else {
    console.error("❌ Archivo de cookies no encontrado");
}

const stream = await play.stream('https://www.youtube.com/watch?v=A_g3lMcWVy0', { discordPlayerCompatibility: true });
console.log(stream);

class MusicManager {
    constructor() {
        this.queues = new Map();
        this.connections = new Map();
        this.players = new Map();
        this.retryAttempts = 2;
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

        const connection = joinVoiceChannel({
            channelId: channel.id,
            guildId: guildId,
            adapterCreator: channel.guild.voiceAdapterCreator,
        });

        const player = createAudioPlayer();
        connection.subscribe(player);

        this.connections.set(guildId, connection);
        this.players.set(guildId, player);

        connection.on(VoiceConnectionStatus.Disconnected, () => this.cleanup(guildId));
        connection.on(VoiceConnectionStatus.Destroyed, () => this.cleanup(guildId));

        player.on(AudioPlayerStatus.Idle, () => this.handleSongEnd(guildId));
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

    async search(query) {
        try {
            // Si es URL, obtener info directamente
            if (play.yt_validate(query) === 'video') {
                const info = await play.video_info(query);
                return {
                    title: info.video_details.title,
                    url: info.video_details.url,
                    duration: info.video_details.durationInSec,
                    thumbnail: info.video_details.thumbnails[0].url,
                    author: info.video_details.channel.name,
                    isLive: info.video_details.live,
                    source: 'play-dl-url'
                };
            }

            // Si no es URL, buscar en YouTube
            const results = await play.search(query, { limit: 1 });
            if (results.length > 0) {
                const video = results[0];
                return {
                    title: video.title,
                    url: video.url,
                    duration: video.durationInSec,
                    thumbnail: video.thumbnails[0]?.url,
                    author: video.channel?.name,
                    isLive: video.live,
                    source: 'play-dl-search'
                };
            }
        } catch (err) {
            console.error("Search failed:", err);
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

            console.log(song.url);
            const stream = await play.stream(song.url, { discordPlayerCompatibility: true });
            const resource = createAudioResource(stream.stream, {
                inputType: stream.type,
                inlineVolume: true
            });
            resource.volume?.setVolume(guildData.volume);

            player.play(resource);
            guildData.currentSong = song;
            guildData.isPlaying = true;
            guildData.isPaused = false;

            console.log(`Now playing: ${song.title}`);
            return true;

        } catch (error) {
            console.error(`Error playing song (attempt ${attempt}):`, error.message);
            if (attempt <= this.retryAttempts) {
                console.log(`Retrying song (${attempt}/${this.retryAttempts}): ${song.title}`);
                await new Promise(r => setTimeout(r, 1000 * attempt));
                return this.playSong(guildId, song, attempt + 1);
            }
            console.log(`Skipping song after ${attempt} attempts: ${song.title}`);
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

export const musicManager = new MusicManager();