import play from 'play-dl';
import fs from 'fs';

const cookies = fs.readFileSync('/workspaces/MineColab-Improved-testing/data/youtube_cookies.txt', 'utf-8').replace(/\r?\n/g, '');
await play.setToken({ youtube: { cookie: "cookies" } });

try {
    const stream = await play.stream('https://www.youtube.com/watch?v=A_g3lMcWVy0', { discordPlayerCompatibility: true });
    console.log(stream);
} catch (err) {
    console.error(err);
}
