import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';

const ticketsPath = new URL('../data/tickets.json', import.meta.url);

let tickets = {};

// Inicializar archivo de tickets si no existe
if (!existsSync(ticketsPath)) {
    await writeFile(ticketsPath, JSON.stringify({}, null, 2));
}

// Cargar tickets existentes
try {
    tickets = JSON.parse(await readFile(ticketsPath, 'utf8'));
} catch (error) {
    console.error('Error cargando tickets:', error);
    tickets = {};
}

export async function saveTickets() {
    try {
        await writeFile(ticketsPath, JSON.stringify(tickets, null, 2));
    } catch (error) {
        console.error('Error guardando tickets:', error);
    }
}

export function isTicketChannel(channelId, config) {
    return channelId in tickets || 
           (config.ticketCategoryId && tickets[channelId]?.category === config.ticketCategoryId);
}

export function addMessageToTicket(channelId, message) {
    if (!tickets[channelId]) {
        tickets[channelId] = {
            messages: [],
            created: new Date().toISOString(),
            category: null
        };
    }

    tickets[channelId].messages.push({
        id: message.id,
        author: {
            id: message.author.id,
            username: message.author.username,
            bot: message.author.bot
        },
        content: message.content,
        timestamp: message.createdTimestamp,
        attachments: message.attachments.size > 0 ? 
            Array.from(message.attachments.values()).map(att => ({
                name: att.name,
                url: att.url
            })) : []
    });

    // Mantener solo los últimos 50 mensajes para evitar archivos muy grandes
    if (tickets[channelId].messages.length > 50) {
        tickets[channelId].messages = tickets[channelId].messages.slice(-50);
    }

    saveTickets();
}

export function getTicketMessages(channelId, limit = 20) {
    if (!tickets[channelId]) return [];
    
    const messages = tickets[channelId].messages || [];
    return messages.slice(-limit);
}

export function deleteTicket(channelId) {
    if (tickets[channelId]) {
        delete tickets[channelId];
        saveTickets();
    }
}

export function hasAdminResponded(channelId, adminRoles, lastMessages = 5) {
    if (!tickets[channelId]) return false;
    
    const messages = tickets[channelId].messages.slice(-lastMessages);
    return messages.some(msg => 
        !msg.author.bot && 
        msg.author.roles?.some(role => adminRoles.includes(role))
    );
}