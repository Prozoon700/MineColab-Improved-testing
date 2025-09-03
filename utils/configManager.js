import { readFile, writeFile } from 'fs/promises';

const configPath = new URL('../config.json', import.meta.url);
let config = JSON.parse(await readFile(configPath));
let autoResponder = config.autoResponder;



export const getAutoResponder = () => autoResponder;

export const toggleAutoResponder = async () => {
    autoResponder = !autoResponder;
    config.autoResponder = autoResponder;
    await writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');
    return autoResponder;
};
