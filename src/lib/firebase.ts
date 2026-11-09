import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || '',
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey
  && firebaseConfig.authDomain
  && firebaseConfig.projectId
  && firebaseConfig.databaseURL
  && firebaseConfig.storageBucket
  && firebaseConfig.messagingSenderId
  && firebaseConfig.appId,
);

export const firebaseApp = isFirebaseConfigured
  ? getApps().length ? getApps()[0] : initializeApp(firebaseConfig)
  : null;
export const auth = firebaseApp ? getAuth(firebaseApp) : null;
export const database = firebaseApp ? getDatabase(firebaseApp) : null;
export const storage = firebaseApp ? getStorage(firebaseApp) : null;

export const loginWithFirebase = async (email: string, password: string): Promise<User> => {
  if (!auth) {
    throw new Error('Firebase is not configured. Add the project settings to .env.local and restart the app.');
  }

  const result = await signInWithEmailAndPassword(auth, email, password);
  return result.user;
};

export const logoutFromFirebase = async () => {
  if (!auth) throw new Error('Firebase is not configured.');
  await signOut(auth);
};
