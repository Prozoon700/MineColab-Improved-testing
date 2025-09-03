export const getSimilarity = (text1, text2) => {
  // Verificar que ambos textos estén definidos y sean cadenas
  if (typeof text1 !== 'string' || typeof text2 !== 'string') {
    console.error('getSimilarity requiere dos cadenas de texto');
    return 0; // Devolver 0 si no son cadenas válidas
  }

  // Asegurarse de que no haya valores undefined antes de hacer split
  const cleanText1 = text1.trim();
  const cleanText2 = text2.trim();

  // Realizar la comparación de alguna forma que tenga sentido (esto es solo un ejemplo)
  const text1Words = cleanText1.split(' ');
  const text2Words = cleanText2.split(' ');

  let commonWords = 0;

  text1Words.forEach(word1 => {
    text2Words.forEach(word2 => {
      if (word1 === word2) {
        commonWords++;
      }
    });
  });

  // Retornar la similitud como el número de palabras comunes sobre el total de palabras
  return commonWords / Math.max(text1Words.length, text2Words.length);
};
