import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Para que __dirname funcione en ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function logErrorToFile({ date, reason, details, aiResponse, finalReply, messageContent, userId }) {
    const logDir = path.join(__dirname, 'logs');
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir);
    }

    const today = new Date().toISOString().split('T')[0];  // YYYY-MM-DD
    const logFile = path.join(logDir, `error-log-${today}.json`);

    const logEntry = {
        timestamp: new Date().toISOString(),
        userId,
        messageContent,
        reason,
        details,
        aiResponse,
        finalReply
    };

    let logs = [];
    if (fs.existsSync(logFile)) {
        try {
            logs = JSON.parse(fs.readFileSync(logFile, 'utf8'));
        } catch (error) {
            console.error('Error al leer el archivo de logs:', error);
        }
    }

    logs.push(logEntry);

    fs.writeFileSync(logFile, JSON.stringify(logs, null, 2), 'utf8');
}
