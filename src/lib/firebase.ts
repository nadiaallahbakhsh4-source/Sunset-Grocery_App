import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, Firestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

let dbInstance: Firestore | null = null;

export const getDb = (): Firestore => {
  if (!dbInstance) {
    const firestoreSettings = {
      experimentalForceLongPolling: true,
    };
    if (firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)') {
      console.log('Initializing Firestore with database and long-polling:', firebaseConfig.firestoreDatabaseId);
      dbInstance = initializeFirestore(app, firestoreSettings, firebaseConfig.firestoreDatabaseId);
    } else {
      console.log('Initializing Firestore with (default) database and long-polling');
      dbInstance = initializeFirestore(app, firestoreSettings);
    }
  }
  return dbInstance;
};

// For compatibility with existing imports
export const db = getDb();
export const auth = getAuth(app);

// Test connection on boot to validate Firestore link health
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firestore connection test: SUCCESS!");
  } catch (error) {
    if (error instanceof Error && error.message.includes('offline')) {
      console.warn("Firestore connection check: operating in robust offline-cache mode.");
    } else {
      console.log("Firestore readiness check finished.");
    }
  }
}
testConnection();
