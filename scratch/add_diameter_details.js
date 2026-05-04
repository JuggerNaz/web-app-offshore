const fs = require('fs');
const content = fs.readFileSync('utils/spec-additional-details.json', 'utf-8');
const json = JSON.parse(content);

const rc = json.data.find(d => d.code === 'rc');
if (rc) {
    rc.additionalDataTemplate.diameter = "";
    fs.writeFileSync('utils/spec-additional-details.json', JSON.stringify(json, null, 4));
    console.log('Successfully added diameter to spec-additional-details.json');
} else {
    console.error('RC template not found');
}
