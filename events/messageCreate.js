import { uploadFile, generateResponse } from '../utils/mistral.js';
import { logErrorToFile } from '../logs/logError.js';
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { readFile } from 'fs/promises';
import { getAutoResponder } from '../utils/configManager.js';
import { franc } from 'franc'

// Definir __filename y __dirname en módulos ES
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function handleMessageCreate(client, message) {
    if (message.author.bot) return;
    const manualData = JSON.parse(await readFile(new URL('../data/data.json', import.meta.url)));

    if (getAutoResponder()) {
        const config = JSON.parse(await readFile(new URL('../config.json', import.meta.url)));
        if (config.testing && message.channel.id !== config.testingChannel) {
            return;
        } else {
            if (message.attachments.size > 0) {
                const file = message.attachments.first();
                const filePath = path.join(__dirname, '../temp', file.name);
                try {
                    // Descargar el archivo
                    const response = await fetch(file.url);
                    const buffer = await response.arrayBuffer();
                    await fs.promises.writeFile(filePath, Buffer.from(buffer));
                    const result = await uploadFile(filePath);
                    await message.reply(`Archivo subido correctamente. ID: ${result.id}`);
                    // Eliminar el archivo local después de subirlo
                    fs.unlinkSync(filePath);
                } catch (error) {
                    console.error('This file generated the following error: ', error);
                    await message.reply('There was an error dealing with this file.');
                }
            }

            else if (message.content.trim().endsWith('?')) { // Solo responde si el mensaje termina con un ?
                const detectedLang = franc(message.content);
                console.log("Idioma detectado: ", detectedLang)
	            const thinkingMessages = {
   	        		spa: '🧠 Déjame pensar un segundo...',
   	        		eng: '🧠 Let me think for a second...',
            		fra: '🧠 Laisse-moi réfléchir une seconde...',
                    hin: '🧠 mujhe ek kshan sochane do...'
	        	};
                const thinkingMessage = await message.reply(thinkingMessages[detectedLang] || thinkingMessages['en']);
            	let aiResponse = null;
            // FALTA QUE RESPONDA EN OTROS IDIOMAS SI NO ESTÁ REGISTRADO EL DETECTADO EN EL DICCIONARIO
	            try {
            	    aiResponse = await generateResponseWithTimeout(message.content, [], manualData);     
	                await editarMensajeLargo(thinkingMessage, aiResponse); // Usar la nueva función
            	} catch (error) {
                	console.error('The response generated the following error: ', error);

	            	    const finalReply = '❌ There was a problem generating the response. Please try again in a few seconds... If the problem persists, please contact an administrator.';
            		    await thinkingMessage.edit(finalReply);
                
	                	logErrorToFile({
            	        date: new Date().toISOString(),
	                    reason: error.message || 'Unknown error',
                	    details: error.stack || null,
            	        aiResponse,
	                    finalReply,
	                    messageContent: message.content,
                    	userId: message.author.id
                	});
            	}
	        }
        }
    }
    
    async function generateResponseWithTimeout(question, learningData, manualData, timeoutMs = 10000) {
        return Promise.race([
            generateResponse(question, learningData, manualData),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Timeout generating the response...')), timeoutMs)
            )
        ]);
    }    
}


function dividirMensaje(mensaje) {
    const maxLength = 2000; // Limite de caracteres por mensaje en Discord
    const partes = [];

    // Mientras el mensaje tenga más de 2000 caracteres
    while (mensaje.length > maxLength) {
        // Partir el mensaje en el índice de 2000 caracteres
        partes.push(mensaje.slice(0, maxLength));
        mensaje = mensaje.slice(maxLength); // Cortar lo que ya se envió
    }

    // Agregar la última parte (si existe algo restante)
    if (mensaje.length > 0) {
        partes.push(mensaje);
    }

    return partes;
}

async function editarMensajeLargo(mensaje, nuevoContenido) {
    const partes = dividirMensaje(nuevoContenido);
    
    // Editar el mensaje original con la primera parte
    await mensaje.edit(partes[0]);
    
    // Enviar el resto de las partes como mensajes nuevos
    for (let i = 1; i < partes.length; i++) {
        await mensaje.channel.send(partes[i]);
    }
}