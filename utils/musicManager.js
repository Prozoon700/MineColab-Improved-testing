import { createAudioPlayer, createAudioResource, joinVoiceChannel, AudioPlayerStatus, VoiceConnectionStatus } from '@discordjs/voice';
import play from 'play-dl';
import { readFile } from 'fs/promises';

const config = JSON.parse(await readFile(new URL('../config.json', import.meta.url)));

class MusicManager {
    constructor() {
        this.queue = [];
        this.player = createAudioPlayer();
        this.connection = null;
        this.currentTrack = null;
        this.isPlaying = false;
        this.loop = false;
        this.volume = 0.5;

        this.player.on(AudioPlayerStatus.Idle, () => {
            if (this.loop && this.currentTrack) {
                this.playTrack(this.currentTrack);
            } else {
                this.playNext();
            }
        });

        this.player.on('error', error => {
            console.error('Player error:', error);
            this.playNext();
        });
    }

    async join(channel) {
        if (this.connection) {
            return this.connection;
        }

        this.connection = joinVoiceChannel({
            channelId: channel.id,
            guildId: channel.guild.id,
            adapterCreator: channel.guild.voiceAdapterCreator,
        });

        this.connection.on(VoiceConnectionStatus.Disconnected, () => {
            this.connection = null;
            this.queue = [];
            this.currentTrack = null;
            this.isPlaying = false;
        });

        this.connection.subscribe(this.player);
        return this.connection;
    }

    leave() {
        if (this.connection) {
            this.connection.destroy();
            this.connection = null;
            this.queue = [];
            this.currentTrack = null;
            this.isPlaying = false;
            this.player.stop();
        }
    }

    async search(query) {
        try {
            const results = await play.search(query, {
                limit: 1,
                source: {
                    youtube: 'video'
                }
            });

            return results[0] || null;
        } catch (error) {
            console.error('Search error:', error);
            return null;
        }
    }

    async add(query) {
        const track = await this.search(query);
        if (!track) return null;

        const trackInfo = {
            title: track.title,
            url: track.url,
            duration: track.durationInSec,
            thumbnail: track.thumbnails[0]?.url,
            author: track.channel?.name
        };

        this.queue.push(trackInfo);
        return trackInfo;
    }

    async playTrack(track) {
        try {
            const stream = await play.stream(track.url, {
                quality: 2
            });

            const resource = createAudioResource(stream.stream, {
                inputType: stream.type
            });

            this.currentTrack = track;
            this.isPlaying = true;
            this.player.play(resource);
        } catch (error) {
            console.error('Play error:', error);
            this.playNext();
        }
    }

    async play() {
        if (this.queue.length === 0) {
            this.isPlaying = false;
            return false;
        }

        const track = this.queue.shift();
        await this.playTrack(track);
        return true;
    }

    async playNext() {
        if (this.queue.length > 0) {
            await this.play();
        } else {
            this.isPlaying = false;
            this.currentTrack = null;
        }
    }

    pause() {
        this.player.pause();
    }

    resume() {
        this.player.unpause();
    }

    stop() {
        this.player.stop();
        this.queue = [];
        this.currentTrack = null;
        this.isPlaying = false;
    }

    skip() {
        this.player.stop();
    }

    shuffle() {
        for (let i = this.queue.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.queue[i], this.queue[j]] = [this.queue[j], this.queue[i]];
        }
    }

    toggleLoop() {
        this.loop = !this.loop;
        return this.loop;
    }

    getQueue() {
        return {
            current: this.currentTrack,
            queue: this.queue,
            isPlaying: this.isPlaying,
            loop: this.loop
        };
    }

    clear() {
        this.queue = [];
    }
}

// Instancia única para toda la aplicación
export const musicManager = new MusicManager();