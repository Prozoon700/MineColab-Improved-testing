import { readFile } from 'fs/promises';

let productData = [];
let data = [];

export async function loadProductData() {
    try {
        const fetchedProductData = await readFile(new URL('../data/productData.json', import.meta.url), 'utf8');
        productData = JSON.parse(fetchedProductData);

        const fetchedData = await readFile(new URL('../data/data.json', import.meta.url), 'utf8');
        data = JSON.parse(fetchedData);

        console.log("Datos de productData y data recargados correctamente.");
        return { productData, data };  // Retorna, pero también guarda en las variables globales.
    } catch (error) {
        console.error("Error al cargar los datos:", error);
        throw error;
    }
}