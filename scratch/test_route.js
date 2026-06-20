// Test the toUuid conversion logic
function toUuid(id) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const strId = String(id).trim();
  if (uuidRegex.test(strId)) {
    return strId;
  }
  
  // Extract digits and convert to hex for standard UUID padding
  const cleanId = strId.replace(/[^0-9]/g, '');
  const numericId = parseInt(cleanId || '0', 10);
  const hexVal = numericId.toString(16).padStart(12, '0').slice(-12);
  return `00000000-0000-0000-0000-${hexVal}`;
}

const input1 = "234";
const input2 = "1462";
const input3 = "12345678-1234-1234-1234-1234567890ab";

console.log("Input:", input1, "->", toUuid(input1));
console.log("Input:", input2, "->", toUuid(input2));
console.log("Input:", input3, "->", toUuid(input3));
