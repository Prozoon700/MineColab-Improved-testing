import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logsDir = path.join(__dirname, '../logs');

// Asegurar que el directorio logs existe
if (!existsSync(logsDir)) {
    await mkdir(logsDir, { recursive: true });
}

export async function logErrorToFile(errorData) {
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `error-${timestamp}.json`;
        const filePath = path.join(logsDir, filename);

        const logData = {
            timestamp: new Date().toISOString(),
            error: {
                date: errorData.date,
                reason: errorData.reason,
                details: errorData.details,
                stack: errorData.stack
            },
            context: {
                messageContent: errorData.messageContent,
                userId: errorData.userId,
                channelId: errorData.channelId,
                isTicket: errorData.isTicket || false
            },
            response: {
                aiResponse: errorData.aiResponse,
                finalReply: errorData.finalReply
            }
        };

        await writeFile(filePath, JSON.stringify(logData, null, 2));
        console.log(`📝 Error logged to: ${filename}`);
        
        // También loggear en consola para debugging
        console.error('Error details:', {
            reason: errorData.reason,
            userId: errorData.userId,
            messageContent: errorData.messageContent?.substring(0, 100) + '...'
        });

    } catch (logError) {
        console.error('❌ Error al guardar log:', logError);
    }
}

export async function logInfo(message, data = {}) {
    try {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] INFO: ${message} ${JSON.stringify(data)}\n`;
        
        const today = new Date().toISOString().split('T')[0];
        const logFile = path.join(logsDir, `info-${today}.log`);
        
        await writeFile(logFile, logEntry, { flag: 'a' });
    } catch (error) {
        console.error('Error logging info:', error);
    }
}