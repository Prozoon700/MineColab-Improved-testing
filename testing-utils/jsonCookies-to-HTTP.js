import fs from 'fs';

const raw = JSON.parse(fs.readFileSync('../data/youtube-cookies.json', 'utf-8'));
const cookieString = raw.map(c => `${c.name}=${c.value}`).join('; ');

console.log(cookieString);