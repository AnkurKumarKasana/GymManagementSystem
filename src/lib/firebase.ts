import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

export const firebaseApp = isFirebaseConfigured ? getApps().length ? getApps()[0] : initializeApp(firebaseConfig) : null;
export const auth = firebaseApp ? getAuth(firebaseApp) : null;
export const db = firebaseApp ? getFirestore(firebaseApp) : null;
export const storage = firebaseApp ? getStorage(firebaseApp) : null;

export const adminCredentials = {
  email: import.meta.env.VITE_ADMIN_EMAIL || 'admin@gym.com',
  password: import.meta.env.VITE_ADMIN_PASSWORD || 'admin123',
};

export const loginWithFirebase = async (email: string, password: string) => {
  if (!auth) {
    throw new Error('Firebase is not configured. Using local demo mode.');
  }

  const result = await signInWithEmailAndPassword(auth, email, password);
  return result.user;
};

export const logoutFromFirebase = async () => {
  if (!auth) return;
  await signOut(auth);
};

export const getCurrentUser = (): User | null => auth?.currentUser ?? null;
