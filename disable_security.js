
const firebase = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

firebase.initializeApp({
  credential: firebase.credential.cert(serviceAccount)
});

const db = firebase.firestore();

async function disableSecurity() {
  await db.collection('app_config').doc('global').set({
    security_enabled: false,
    updated_at: firebase.firestore.Timestamp.now(),
    updated_by: 'system_bypass'
  }, { merge: true });
  console.log("Seguridad DESACTIVADA globalmente en Firestore.");
  process.exit(0);
}

disableSecurity();
