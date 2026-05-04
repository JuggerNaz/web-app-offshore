const fs = require('fs');
const content = fs.readFileSync('utils/spec-additional-details.json', 'utf-8');
const lines = content.split('\n');
// Find the last ]
let lastArrayIndex = -1;
for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].trim() === ']') {
        lastArrayIndex = i;
        break;
    }
}

if (lastArrayIndex !== -1) {
    const newTemplate = `        },
        {
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
        }`;
    lines.splice(lastArrayIndex, 0, newTemplate);
    fs.writeFileSync('utils/spec-additional-details.json', lines.join('\n'));
    console.log('Successfully updated utils/spec-additional-details.json');
} else {
    console.error('Could not find end of data array');
}
