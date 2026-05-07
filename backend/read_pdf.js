const fs = require('fs');
const pdf = require('pdf-parse');
const path = require('path');

const pdfPath = path.join(__dirname, 'Anexo de lista.pdf');
const dataBuffer = fs.readFileSync(pdfPath);

pdf(dataBuffer).then(function(data) {
    console.log(data.text);
}).catch(function(error){
    console.error(error);
});
