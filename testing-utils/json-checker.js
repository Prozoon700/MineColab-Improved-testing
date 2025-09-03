import { readFile } from 'fs/promises';

const data = JSON.parse(await readFile(new URL('../data/data.json', import.meta.url)));
const productData = JSON.parse(await readFile(new URL('../data/productData.json', import.meta.url)));

console.log(data);
console.log();
console.log(productData.productData);