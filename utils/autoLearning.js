import fs from 'fs';
import path from 'path';

// Cargar datos de aprendizaje
let existingData = [];

// Asegurarse de que `existingData` es un array cargado desde un archivo JSON si es necesario
const learningDataPath = path.join(__dirname, 'learningData.json');
if (fs.existsSync(learningDataPath)) {
  const rawData = fs.readFileSync(learningDataPath, 'utf8');
  try {
    existingData = JSON.parse(rawData);
  } catch (e) {
    console.error('Error al leer el archivo de datos de aprendizaje:', e);
  }
}

export const learnFromMessage = (userQuestion, response) => {
  // Leer los datos existentes
  let existingData = [];
  if (fs.existsSync(learningDataPath)) {
    existingData = JSON.parse(fs.readFileSync(learningDataPath, 'utf-8'));
  }

  // Agregar la nueva pregunta y respuesta
  const learntPair = { question: userQuestion, answer: response };
  existingData.push(learntPair);

  // Guardar los nuevos datos
  fs.writeFileSync(learningDataPath, JSON.stringify(existingData, null, 2));

  console.log('Pregunta y respuesta guardadas correctamente');
};
