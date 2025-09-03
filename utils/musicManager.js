import { Manager } from "erela.js";
import { readFile } from "fs/promises";

const config = JSON.parse(await readFile(new URL("../config.json", import.meta.url)));

class MusicManager {
    constructor(client) {
        this.client = client;
        this.manager = new Manager({
            nodes: [
                {
                    host: "127.0.0.1",     // ⚡ Cambia si Lavalink no está en el mismo servidor
                    port: 2333,
                    password: "!68b826eb#ww1",
                    retryAmount: 5,
                    retryDelay: 2000
                },
            ],
            send: (id, payload) => {
                const guild = this.client.guilds.cache.get(id);
                if (guild) guild.shard.send(payload);
            },
        });

        this.manager.on("nodeConnect", (node) =>
            console.log(`✅ Nodo ${node.options.identifier} conectado`)
        );

        this.manager.on("nodeError", (node, error) =>
            console.error(`❌ Error en nodo ${node.options.identifier}:`, error)
        );

        this.manager.on("trackStart", (player, track) => {
            const channel = this.client.channels.cache.get(player.textChannel);
            if (channel) channel.send(`🎶 Reproduciendo: **${track.title}**`);
        });

        this.manager.on("queueEnd", (player) => {
            const channel = this.client.channels.cache.get(player.textChannel);
            if (channel) channel.send("✅ Cola terminada.");
            player.destroy();
        });

        // Conectar el manager a Discord
        client.on("raw", (d) => this.manager.updateVoiceState(d));

        this.loop = "none"; // "none" | "track" | "queue"
    }

    async join(channel) {
        const player = this.manager.create({
            guild: channel.guild.id,
            voiceChannel: channel.id,
            textChannel: channel.guild.systemChannelId || channel.id,
            selfDeafen: true,
        });

        if (player.state !== "CONNECTED") player.connect();
        return player;
    }

    leave(guildId) {
        const player = this.manager.players.get(guildId);
        if (player) {
            player.destroy();
        }
    }

    async search(query, requester) {
        const res = await this.manager.search(query, requester);
        if (res.loadType === "NO_MATCHES" || res.loadType === "LOAD_FAILED")
            return null;
        return res.tracks[0];
    }

    async add(query, message) {
        const track = await this.search(query, message.author);
        if (!track) return null;

        const player = this.manager.players.get(message.guild.id);
        if (!player) return null;

        player.queue.add(track);

        if (!player.playing && !player.paused && !player.queue.size) {
            player.play();
        }

        return {
            title: track.title,
            url: track.uri,
            duration: track.duration,
            thumbnail: track.thumbnail,
            author: track.author,
        };
    }

    async play(message) {
        const player = this.manager.players.get(message.guild.id);
        if (!player || !player.queue.current) return false;

        player.play();
        return true;
    }

    async playNext(message) {
        const player = this.manager.players.get(message.guild.id);
        if (player) {
            player.stop(); // Pasa automáticamente a la siguiente
        }
    }

    pause(guildId) {
        const player = this.manager.players.get(guildId);
        if (player) player.pause(true);
    }

    resume(guildId) {
        const player = this.manager.players.get(guildId);
        if (player) player.pause(false);
    }

    stop(guildId) {
        const player = this.manager.players.get(guildId);
        if (player) {
            player.queue.clear();
            player.stop();
        }
    }

    skip(guildId) {
        const player = this.manager.players.get(guildId);
        if (player) player.stop();
    }

    shuffle(guildId) {
        const player = this.manager.players.get(guildId);
        if (player) player.queue.shuffle();
    }

    toggleLoop(guildId) {
        const player = this.manager.players.get(guildId);
        if (!player) return this.loop;

        if (this.loop === "none") {
            this.loop = "track";
            player.setTrackRepeat(true);
        } else if (this.loop === "track") {
            this.loop = "queue";
            player.setTrackRepeat(false);
            player.setQueueRepeat(true);
        } else {
            this.loop = "none";
            player.setTrackRepeat(false);
            player.setQueueRepeat(false);
        }
        return this.loop;
    }

    getQueue(guildId) {
        const player = this.manager.players.get(guildId);
        if (!player) return null;

        return {
            current: player.queue.current,
            queue: player.queue,
            isPlaying: player.playing,
            loop: this.loop,
        };
    }

    clear(guildId) {
        const player = this.manager.players.get(guildId);
        if (player) player.queue.clear();
    }
}

let musicManager;
export function initMusicManager(client) {
    musicManager = new MusicManager(client);
    musicManager.manager.init(client.user.id);
    return musicManager;
}