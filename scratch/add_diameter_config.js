const fs = require('fs');
const content = fs.readFileSync('utils/spec-ui-config.json', 'utf-8');
const json = JSON.parse(content);

const rc = json.components.find(c => c.code === 'rc');
if (rc) {
    rc.fields.push({
        "name": "diameter",
        "type": "string",
        "unitcategory": "length"
    });
    fs.writeFileSync('utils/spec-ui-config.json', JSON.stringify(json, null, 2));
    console.log('Successfully added diameter to spec-ui-config.json');
} else {
    console.error('RC component not found');
}
