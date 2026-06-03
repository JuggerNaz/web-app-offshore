const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', '.next');

function deleteFolderRecursive(directoryPath) {
  if (fs.existsSync(directoryPath)) {
    fs.readdirSync(directoryPath).forEach((file) => {
      const curPath = path.join(directoryPath, file);
      if (fs.lstatSync(curPath).isDirectory()) {
        // recurse
        deleteFolderRecursive(curPath);
      } else {
        // delete file
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(directoryPath);
  }
}

console.log("Checking if .next directory exists...");
if (fs.existsSync(dir)) {
  console.log("Deleting .next directory...");
  try {
    deleteFolderRecursive(dir);
    console.log("Successfully deleted .next directory.");
  } catch (error) {
    console.error("Error deleting .next directory:", error.message);
  }
} else {
  console.log(".next directory does not exist.");
}
