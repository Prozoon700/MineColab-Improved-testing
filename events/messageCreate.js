import { generateResponse, generateResponseWithContext } from '../utils/mistral.js';
import fetch from 'node-fetch';
import { logErrorToFile } from '../logs/logError.js';
import { addMessageToTicket, getTicketMessages, isTicketChannel } from '../utils/ticketManager.js';
import { fileURLToPath } from 'url';
import path from 'path';
import { readFile } from 'fs/promises';
import { loadProductData } from '../data/data-manager.js';
import { getAutoResponder } from '../utils/configManager.js';
import { franc } from 'franc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function handleMessageCreate(client, message) {
    if (message.author.bot) return;
    
    const config = JSON.parse(await readFile(new URL('../config.json', import.meta.url)));
    const { productData, data: manualData } = await loadProductData();

    var image_url = [];

    // Verificar si es un canal de ticket
    const isTicket = isTicketChannel(message.channel.id, config) || 
                    config.ticketChannels?.includes(message.channel.id) ||
                    (message.channel.parent && message.channel.parent.id === config.ticketCategoryId);

    // Siempre registrar mensajes en tickets
    if (isTicket) {
        addMessageToTicket(message.channel.id, message);
        
        // Verificar si un admin/moderador respondió
        const hasAdminRole = message.member.roles.cache.some(role => 
            config.adminRoles.includes(role.name)
        );
        
        // Si un admin respondió, no responder automáticamente
        if (hasAdminRole && !message.author.bot) {
            console.log('Admin respondió en ticket, bot no responderá');
            return;
        }
    }

    if (config.excludedChannels.includes(message.channel.id)) {
        return;
    }

    // Sistema de autorespuesta
    if (getAutoResponder()) {
        // Verificar canal de testing si está en modo testing
        if (config.testing && message.channel.id !== config.testingChannel) {
            return;
        }

        // Verificar canales habilitados (solo si no está en testing)
        if (!config.testing && !config.enabledChannels.includes(message.channel.id) && !isTicket) {
            return;
        }

        // Responder a preguntas o en tickets
        else if (message.content.includes('?') || message.content.includes('.mi') || message.content.includes('@1344790741469364416') || isTicket) {
            // Manejo de archivos adjuntos
            if (message.attachments.size > 0) {
                try {
                    image_url = [];
                
                    for (const file of message.attachments.values()) {
                        image_url.push(file.url);
                    
                        //await message.reply(`📎 Archivo "${file.name}" procesado correctamente.`);
                    }
                } catch (error) {
                    console.error('Error procesando archivos:', error);
                    await message.reply('❌ Hubo un error procesando los archivos.');
                }
            }
            
            const detectedLang = franc(message.content);
            console.log("Idioma detectado:", detectedLang);
            
            const thinkingMessages = {
                spa: '🧠 Déjame pensar un segundo...',
                eng: '🧠 Let me think for a second...',
                fra: '🧠 Laisse-moi réfléchir une seconde...',
                hin: '🧠 mujhe ek kshan sochane do...'
            };
            
            const thinkingMessage = await message.reply(
                thinkingMessages[detectedLang] || thinkingMessages['eng']
            );
            
            let aiResponse = null;
            
            try {
                if (isTicket) {
                    // Para tickets, usar contexto de mensajes anteriores
                    const ticketMessages = getTicketMessages(message.channel.id, 15);
                    aiResponse = await generateResponseWithTimeout(
                        message.content, 
                        [], 
                        manualData, 
                        ticketMessages,
                        image_url
                    );
                } else {
                    // Para canales normales, usar lógica estándar
                    aiResponse = await generateResponseWithTimeout(
                        message.content, 
                        [], 
                        manualData,
                        image_url
                    );
                }
                
                await editarMensajeLargo(thinkingMessage, aiResponse);
                
            } catch (error) {
                console.error('Error generando respuesta:', error);
                
                const errorMessages = {
                    spa: '❌ Hubo un problema generando la respuesta. Por favor, inténtalo de nuevo en unos segundos... Si el problema persiste, contacta con un administrador.',
                    eng: '❌ There was a problem generating the response. Please try again in a few seconds... If the problem persists, please contact an administrator.',
                    fra: '❌ Il y a eu un problème lors de la génération de la réponse. Veuillez réessayer dans quelques secondes... Si le problème persiste, veuillez contacter un administrateur.',
                    hin: '❌ javab banane mein samasya hui hai. kripaya kuch sekand mein phir se koshish karein... yadi samasya bani rahti hai, to kripaya ek vyavasthapak se sampark karein.'
                };
                
                const finalReply = errorMessages[detectedLang] || errorMessages['eng'];
                await thinkingMessage.edit(finalReply);
                
                // Log del error
                if (typeof logErrorToFile === 'function') {
                    logErrorToFile({
                        date: new Date().toISOString(),
                        reason: error.message || 'Unknown error',
                        details: error.stack || null,
                        aiResponse,
                        finalReply,
                        messageContent: message.content,
                        userId: message.author.id,
                        channelId: message.channel.id,
                        isTicket
                    });
                }
            }
        }
    }
    
    // Función con timeout para generar respuesta
    async function generateResponseWithTimeout(question, learningData, manualData, ticketContext = null, timeoutMs = 15000) {
        return Promise.race([
            ticketContext.includes(message.channel.id) ? 
                generateResponseWithContext(question, learningData, manualData, productData, ticketContext) :
                generateResponse(question, learningData, manualData, productData),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Timeout generando la respuesta...')), timeoutMs)
            )
        ]);
    }    
}

function dividirMensaje(mensaje) {
    const maxLength = 2000;
    const partes = [];

    while (mensaje.length > maxLength) {
        let corte = maxLength;
        
        // Intentar cortar en un salto de línea cercano
        const ultimoSalto = mensaje.lastIndexOf('\n', maxLength);
        if (ultimoSalto > maxLength - 200) {
            corte = ultimoSalto;
        }
        
        partes.push(mensaje.slice(0, corte));
        mensaje = mensaje.slice(corte);
    }

    if (mensaje.length > 0) {
        partes.push(mensaje);
    }

    return partes;
}

async function editarMensajeLargo(mensaje, nuevoContenido) {
    const partes = dividirMensaje(nuevoContenido);
    
    try {
        await mensaje.edit(partes[0]);
        
        for (let i = 1; i < partes.length; i++) {
            await mensaje.channel.send(partes[i]);
        }
    } catch (error) {
        console.error('Error editando mensaje:', error);
        await mensaje.channel.send('❌ Error mostrando la respuesta completa.');
    }
}