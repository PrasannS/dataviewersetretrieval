import fs from 'fs';
import path from 'path';

const dataFolder = './public/data';
const outputFile = './public/data/manifest.json';

// Get all files ending in .jsonl
const files = fs.readdirSync(dataFolder)
  .filter(file => file.endsWith('_preds2.jsonl'));

// Write the list to manifest.json
fs.writeFileSync(outputFile, JSON.stringify(files, null, 2));

console.log(`✅ Automatically indexed ${files.length} files to manifest.json`);