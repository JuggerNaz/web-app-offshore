const fs = require('fs');
const content = fs.readFileSync('app/api/migration/execute/route.ts', 'utf8');
console.log('Has getStorageHandler:', content.includes('getStorageHandler'));
console.log('Has path import:', content.includes("from 'path'") || content.includes('from "path"'));
console.log('Has fs import:', content.includes("from 'fs'") || content.includes('from "fs"'));
