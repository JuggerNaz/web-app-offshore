const fs = require('fs');

// Update spec-ui-config.json
const configContent = fs.readFileSync('utils/spec-ui-config.json', 'utf-8');
const config = JSON.parse(configContent);
const pwConfig = config.components.find(c => c.code === 'pw');
if (pwConfig) {
    pwConfig.fields.push(
        { "name": "diameter", "type": "string", "unitcategory": "length" },
        { "name": "wall_thk", "type": "string", "unitcategory": "length" },
        { "name": "condition", "type": "string" }
    );
}
fs.writeFileSync('utils/spec-ui-config.json', JSON.stringify(config, null, 2));

// Update spec-additional-details.json
const detailsContent = fs.readFileSync('utils/spec-additional-details.json', 'utf-8');
const details = JSON.parse(detailsContent);
const pwDetails = details.data.find(d => d.code === 'pw');
if (pwDetails) {
    pwDetails.additionalDataTemplate.diameter = "";
    pwDetails.additionalDataTemplate.wall_thk = "";
    pwDetails.additionalDataTemplate.condition = "";
}
fs.writeFileSync('utils/spec-additional-details.json', JSON.stringify(details, null, 4));

console.log('Successfully updated JSON configs for pw');
