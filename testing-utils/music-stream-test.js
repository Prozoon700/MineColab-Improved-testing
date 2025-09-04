import play from 'play-dl';
import fs from 'fs';

const cookies = fs.readFileSync('/workspaces/MineColab-Improved-testing/data/youtube_cookies.txt', 'utf-8').replace(/\r?\n/g, '');
//await play.setToken({ youtube: { cookie: cookies } });
//await play.authorization();

try {
    const stream = await play.stream("https://www.youtube.com/watch?v=7XPGU7dmZXg");
    console.log(stream);
} catch (err) {
    console.error(err);
}
