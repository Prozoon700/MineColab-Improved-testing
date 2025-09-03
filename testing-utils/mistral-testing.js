import { Mistral } from "@mistralai/mistralai";
import { readFile } from 'fs/promises';

const config = JSON.parse(await readFile(new URL('../config.json', import.meta.url)));

const mistral = new Mistral({
  apiKey: config.apiKey ?? "",
});

async function run() {
  const result = await mistral.chat.complete({
    model: "mistral-small-latest",
    stream: false,
    messages: [
      {
        content:
          "Este es un mensaje de prueba. Me gustaría ver de que eres capaz. Responde con algo bonito pero inteligente.",
        role: "user",
      },
    ],
  });

  // Handle the result
  console.log(`Resultado:  ${result}`);
  console.log(`Contenido del mensaje: ${result.choices[0].message.content}`)
}

run();
