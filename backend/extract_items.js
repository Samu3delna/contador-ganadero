const fs = require('fs');

const text = fs.readFileSync('parsed.txt', 'utf16le');
const lines = text.split('\n');

const items = [];
const regex = /^\s*(\d+)\.\s+(.*)/;

let currentItem = '';

for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Ignore page numbers like "-- 41 of 48 --" or "42"
    if (line.match(/^--\s+\d+\s+of\s+\d+\s+--$/) || line.match(/^\d+$/)) {
        continue;
    }
    
    const match = line.match(regex);
    if (match) {
        if (currentItem) {
            items.push(currentItem.trim().replace(/\s+/g, ' '));
        }
        currentItem = match[2];
    } else {
        // Might be a continuation of the previous line
        if (currentItem && !line.match(/^[A-ZÁÉÍÓÚÑ]{4,}/) && !line.match(/^ANEXO/)) {
            currentItem += ' ' + line;
        }
    }
}

if (currentItem) {
    items.push(currentItem.trim().replace(/\s+/g, ' '));
}

// Write to a JSON file
fs.writeFileSync('insumos_oficiales.json', JSON.stringify(items, null, 2), 'utf8');
console.log(`Extracted ${items.length} items`);
