
const { S3Client, HeadObjectCommand } = require('@aws-sdk/client-s3');
require('dotenv').config({ path: '.env.local' });

async function checkFile() {
  const config = {
    bucket: "web-app-offshore",
    region: "us-east-005",
    endpoint: "https://s3.us-east-005.backblazeb2.com",
    accessKeyId: "005c48eb61245cc0000000001",
    secretAccessKey: "K005KdCLsolj0KOyMjUsDiJrQcQYSLE"
  };

  const client = new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  const key = "uploads/1778659435216-2qpek9.png";

  console.log(`Checking file: ${key} in bucket ${config.bucket}...`);
  try {
    const data = await client.send(new HeadObjectCommand({
      Bucket: config.bucket,
      Key: key
    }));
    console.log('File found!');
    console.log('Content-Type:', data.ContentType);
    console.log('Content-Length:', data.ContentLength);
  } catch (err) {
    console.error('File NOT found or error:', err.message);
  }
}

checkFile();
