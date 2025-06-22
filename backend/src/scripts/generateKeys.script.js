const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

// Generate key pair
const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", {
  namedCurve: "secp256k1",
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" }
});

// Define file paths
const keysDir = path.join(__dirname, "../keys");
const privatePath = path.join(keysDir, "private.pem");
const publicPath = path.join(keysDir, "public.pem");

// Ensure the keys directory exists
fs.mkdirSync(keysDir, { recursive: true });

// Write keys to files
fs.writeFileSync(privatePath, privateKey, "utf8");
fs.writeFileSync(publicPath, publicKey, "utf8");

console.log("✅ Keys saved to ../keys/private.pem and ../keys/public.pem");
