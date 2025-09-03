import { Mistral } from '@mistralai/mistralai';
import { readFile } from 'fs/promises';
import { createReadStream } from 'fs'; // Import createReadStream for file upload
import { loadProductData } from '../data/data-manager.js';

const config = JSON.parse(await readFile(new URL('../config.json', import.meta.url)));

if (!config['apiKey']) {
    throw new Error("Falta 'API-key' en config.json");
}

let productData = [];
let data = [];

export async function updateData() {
    const result = await loadProductData();
	productData = result.productData.productData;
	data = result.data;
}

updateData();

// Inicializar cliente de Mistral
const mistral = new Mistral({
    apiKey: config.apiKey ?? "",
});

// 1️⃣ Clasificación: ¿La pregunta es sobre MineColab?
export async function isRelatedToMineColab(question) {
    const prompt = `
    ¿Es esta pregunta sobre el servidor MineColab Improved? Responde solamente "Sí" o "No".
    
    Pregunta: ${question}
    Respuesta:`;

    const result = await mistral.chat({
        model: "mistral-small-2506",
        messages: [{ role: 'user', content: prompt }],
        temperature: 0,
        max_tokens: 5000,
    });

    const aiResponse = result.choices[0].message.content.trim().toLowerCase();
    return aiResponse.includes('sí');
}

// 2️⃣ Generar respuesta final con contexto y aportes del administrador
export async function generateResponse(userQuestion, learningData, manualData) {
    const context = buildContext(learningData, manualData);

    const formattedFAQ = data.map(pair => {
    	const questions = Array.isArray(pair.question) ? pair.question : [pair.question];
    	return questions.map(q => `Pregunta: ${q}\nRespuesta: ${pair.answer}`).join('\n\n');
	}).join('\n\n');
	
    const formattedData = `
        Nombre del producto: ${productData.productName}
        Descripción: ${productData.description}
        Otros nombres del producto: ${productData['otros nombres'].join(', ')}

        Características:
        ${Object.entries(productData.features).map(([key, value]) => `- ${key}: ${value}`).join('\n')}

        No soporta:
        ${Object.entries(productData.no_permite).map(([key, value]) => `- ${key}: ${value}`).join('\n')}

        Comunidad y soporte:
        Oficial: ${productData.comunidad.oficial}
        Otras plataformas:
        ${Object.entries(productData.comunidad.secundarias).map(([key, value]) => `- ${key}: ${value}`).join('\n')}

        Problemas comunes:
        ${Object.entries(productData.commonIssues).map(([key, value]) => `- ${key}: ${value}`).join('\n')}
    `.trim();

    
const prompt = `Eres un asistente experto en MineColab Improved, un servicio que permite ejecutar Minecraft en un entorno de Jupyter Notebook. Está diseñado especialmente para Google Colab, una plataforma gratuita que permite ejecutar Jupyter Notebooks. Responde usando ÚNICAMENTE el siguiente historial de conocimiento y las preguntas-respuestas ya preparadas. SI LA PREGUNTA COINCIDE CON UNO DE LOS DATOS PROPORCIONADOS, UTILÍZALO SIEMPRE, PERO SELECCIONA SOLO LOS DATOS RELEVANTES PARA RESPONDER A LA PREGUNTA DE FORMA DIRECTA. NO INVENTES DATOS.

UTILIZA SIEMPRE MARKDOWN para dar formato a las respuestas, incluso si los datos originales no lo incluyen.

INFORMACIÓN:

${formattedData}

Preguntas frecuentes: ${formattedFAQ}

Pregunta del usuario: ${userQuestion}

Por favor, genera una respuesta utilizando SOLO la información provista y EN EL IDIOMA DE LA PREGUNTA. Si no encuentras una respuesta directa en los datos, di que no sabes o redirige al usuario a la documentación oficial en "minecolabimproved.wiki.gg".

Si el mensaje puede contener más información, SUGIERE QUE TE PREGUNTE EL USUARIO sobre el tema del que le has hablado y que REVISE LA WIKI OFICIAL en minecolabimproved.wiki.gg.

> Este mensaje ha sido generado por IA y puede contener información incorrecta o incompleta.
`;


    const result = await mistral.chat.complete({
        model: "mistral-small-latest",
        stream: false,
        messages: [{ role: 'user', content: prompt }]
    });

    return result.choices[0].message.content; // result.choices[0].message.content.trim()
}

// 3️⃣ Construir contexto con historial de aprendizaje y data manual
function buildContext(learningData, manualData) {
    var combinedData;
    if (learningData == []) {
        combinedData = [...manualData];
    } else {
        combinedData = [...manualData, ...learningData];
    }
    return combinedData.map(pair => `Pregunta: ${pair.question}\nRespuesta: ${pair.answer}`).join('\n\n');
}

// 4️⃣ Manejar archivos subidos (logs, capturas, etc)
export async function uploadFile(filePath) {
    const fileStream = createReadStream(filePath); // Create a readable stream from the file
    const result = await mistral.files.upload({
        file: fileStream, // Pass the stream to the upload function
    });

    return result; // Devuelve el resultado para ver el ID o metadatos del archivo.
}

// Run function to initialize or perform any startup tasks if needed
async function run() {
    // Any initialization code can go here
}

run();