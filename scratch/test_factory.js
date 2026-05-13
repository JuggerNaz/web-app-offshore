const { getStorageHandler } = require('./utils/storage-factory');

async function testFactory() {
    const provider = "Google Drive";
    const config = {
        "basePath": "",
        "googleDriveFolderId": "https://drive.google.com/drive/folders/168-AM4KOCDsJk_dqbF7ZIHtOHo4cwEgh?usp=drive_link"
    };
    
    try {
        const handler = await getStorageHandler(provider, config);
        console.log('Resolved Handler:', handler.constructor.name);
        
        try {
            await handler.upload(Buffer.from('test'), 'test.txt', 'text/plain');
        } catch (e) {
            console.log('Upload error (expected):', e.message);
        }
    } catch (e) {
        console.error('Factory error:', e);
    }
}

testFactory();
