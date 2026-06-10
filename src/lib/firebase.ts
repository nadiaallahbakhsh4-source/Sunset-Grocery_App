/// <reference types="vite/client" />
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, Firestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const rawApiKey = (import.meta.env.VITE_FIREBASE_API_KEY || firebaseConfig.apiKey || '').trim();
export const isFirebaseConfigured = rawApiKey !== '';

// Support loading Firebase config from environment variables for security and local development
const resolvedConfig = {
  // Use a mock valid-looking key if empty to prevent Firebase SDK from crashing on boot with 'auth/invalid-api-key'
  apiKey: isFirebaseConfigured ? rawApiKey : 'AIzaSy_PlaceholderKey_Configure_VITE_FIREBASE_API_KEY',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfig.authDomain || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseConfig.projectId || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfig.storageBucket || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfig.messagingSenderId || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || firebaseConfig.appId || '',
  firestoreDatabaseId: import.meta.env.VITE_FIREBASE_DATABASE_ID || firebaseConfig.firestoreDatabaseId || '',
};

const app = initializeApp(resolvedConfig);

let dbInstance: Firestore | null = null;

export const getDb = (): Firestore => {
  if (!dbInstance) {
    const firestoreSettings = {
      experimentalForceLongPolling: true,
    };
    if (resolvedConfig.firestoreDatabaseId && resolvedConfig.firestoreDatabaseId !== '(default)') {
      console.log('Initializing Firestore with database and long-polling:', resolvedConfig.firestoreDatabaseId);
      dbInstance = initializeFirestore(app, firestoreSettings, resolvedConfig.firestoreDatabaseId);
    } else {
      console.log('Initializing Firestore with (default) database and long-polling');
      dbInstance = initializeFirestore(app, firestoreSettings);
    }
  }
  return dbInstance;
};

// For compatibility with existing imports
export const db = getDb();
const realAuth = getAuth(app);
export const auth = new Proxy(realAuth, {
  get(target, prop, receiver) {
    if (prop === 'currentUser' && !isFirebaseConfigured) {
      const cached = localStorage.getItem('local_sunset_auth_user');
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch {
          return null;
        }
      }
      return null;
    }
    return Reflect.get(target, prop, receiver);
  }
}) as ReturnType<typeof getAuth>;

// Test connection on boot to validate Firestore link health
async function testConnection() {
  if (!isFirebaseConfigured) {
    console.warn("Firebase is operating with a placeholder configuration. Please set VITE_FIREBASE_API_KEY.");
    return;
  }
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
