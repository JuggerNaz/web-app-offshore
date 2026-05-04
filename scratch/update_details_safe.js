const fs = require('fs');
const content = fs.readFileSync('utils/spec-additional-details.json', 'utf-8');
const data = JSON.parse(content);

const newTemplate = {
    "code": "rc",
    "componentType": "rc_comp",
    "additionalDataTemplate": {
        "manufacture": "",
        "model_type": "",
        "material": "",
        "pipe_cls": "",
        "serial_no": "",
        "repair_comp_t": "",
        "po_no": "",
        "installed_date": "",
        "desg_press": "",
        "op_press": "",
        "no_bolts": "",
        "del": false
    }
};

data.push(newTemplate);
fs.writeFileSync('utils/spec-additional-details.json', JSON.stringify(data, null, 4));
console.log('Successfully updated utils/spec-additional-details.json');
