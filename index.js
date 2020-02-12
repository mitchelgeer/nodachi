const fs = require('fs');
const Nodachi = require('./classes/Nodachi');
const config = fs.readFileSync('config.json', 'utf8');

new Nodachi(JSON.parse(config));