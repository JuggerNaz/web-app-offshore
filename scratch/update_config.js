const fs = require('fs');
const content = fs.readFileSync('utils/spec-ui-config.json', 'utf-8');
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
    const newComp = `    },
    {
      "code": "rc",
      "componentType": "rc_comp",
      "fields": [
        { "name": "manufacture", "type": "string" },
        { "name": "model_type", "type": "string" },
        { "name": "material", "type": "string" },
        { "name": "pipe_cls", "type": "string" },
        { "name": "serial_no", "type": "string" },
        { "name": "repair_comp_t", "type": "string" },
        { "name": "po_no", "type": "string" },
        { "name": "installed_date", "type": "string" },
        { "name": "desg_press", "type": "string", "unitcategory": "pressure" },
        { "name": "op_press", "type": "string", "unitcategory": "pressure" },
        { "name": "no_bolts", "type": "string" }
      ]
    }`;
    // Replace the line that was just '    }' with '    },'
    // Actually the line before the ] was '    }'
    lines.splice(lastArrayIndex, 0, newComp);
    fs.writeFileSync('utils/spec-ui-config.json', lines.join('\n'));
    console.log('Successfully updated utils/spec-ui-config.json');
} else {
    console.error('Could not find end of components array');
}
