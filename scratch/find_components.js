const fs = require('fs');
const config = JSON.parse(fs.readFileSync('utils/spec-ui-config.json', 'utf-8'));
config.components.forEach(c => {
    const hasWallThk = c.fields.some(f => f.name === 'wall_thk');
    const hasDepth = c.fields.some(f => f.name === 'depth');
    if (hasWallThk && hasDepth) {
        console.log(`Code: ${c.code}, ComponentType: ${c.componentType}`);
    }
});
