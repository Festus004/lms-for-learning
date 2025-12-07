// setAdmin.js (run locally)
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json'); // download from Firebase Console
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const uid = process.argv[2]; // pass uid in CLI
if (!uid) { console.error('Usage: node setAdmin.js <uid>'); process.exit(1); }

admin.auth().setCustomUserClaims(uid, { admin: true }).then(() => {
  console.log('Custom claim set for', uid);
  process.exit(0);
}).catch(err => { console.error(err); process.exit(1); });
