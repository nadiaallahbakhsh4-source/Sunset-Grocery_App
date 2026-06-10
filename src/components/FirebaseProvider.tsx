import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User, 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  updatePassword,
  updateEmail,
  browserPopupRedirectResolver,
  sendPasswordResetEmail
} from 'firebase/auth';
import { auth, db, isFirebaseConfigured } from '../lib/firebase';
import { doc, getDoc, setDoc, onSnapshot, collection, getDocFromServer } from 'firebase/firestore';
import { Settings } from '../types';

interface FirebaseContextType {
  user: User | null;
  loading: boolean;
  login: () => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  signupWithEmail: (email: string, pass: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  updateUserName: (name: string) => Promise<void>;
  updateUserPassword: (password: string) => Promise<void>;
  updateUserEmail: (email: string) => Promise<void>;
}

const FirebaseContext = createContext<FirebaseContextType | undefined>(undefined);

export function FirebaseProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      const cached = localStorage.getItem('local_sunset_auth_user');
      if (cached) {
        try {
          setUser(JSON.parse(cached));
        } catch {
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
      
      if (user) {
        // Test connection after user is authenticated
        getDocFromServer(doc(db, 'test', 'connection'))
          .then(() => console.log("Firestore connection verified"))
          .catch((err) => console.warn("Firestore connection check failed:", err.message));
      }
    });

    return () => unsubscribe();
  }, []);

  const login = async () => {
    if (!isFirebaseConfigured) {
      const uid = 'offline_google_user';
      const fakeUser = {
        uid,
        email: 'demo@sunset.com',
        displayName: 'Google Demo User',
        emailVerified: true,
        isAnonymous: false,
        providerData: [{ providerId: 'google.com' }],
      } as any;
      localStorage.setItem('local_sunset_auth_user', JSON.stringify(fakeUser));
      setUser(fakeUser);
      return;
    }

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      // Using browserPopupRedirectResolver can help in some locked down environments or iframes
      await signInWithPopup(auth, provider, browserPopupRedirectResolver);
    } catch (error: any) {
      console.error("Auth Error:", error);
      if (error.code === 'auth/network-request-failed') {
        alert("Network error: Please check your internet connection or disable ad-blockers for this site.");
      } else {
        alert(`Authentication failed: ${error.message}`);
      }
      throw error;
    }
  };

  const loginWithEmail = async (email: string, pass: string) => {
    if (!isFirebaseConfigured) {
      const accounts = JSON.parse(localStorage.getItem('local_sunset_accounts') || '[]');
      const found = accounts.find((a: any) => a.email.toLowerCase() === email.toLowerCase());
      if (!found) {
        throw new Error("No offline account registered with this email. Please sign up first.");
      }
      if (found.password !== pass) {
        throw new Error("Incorrect secret/password.");
      }
      const fakeUser = {
        uid: found.uid || 'offline_user_uid',
        email: found.email,
        displayName: found.name || 'Shop Manager',
        emailVerified: true,
        isAnonymous: false,
        providerData: [],
      } as any;
      
      localStorage.setItem('local_sunset_auth_user', JSON.stringify(fakeUser));
      setUser(fakeUser);
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (error: any) {
      if (error.code === 'auth/network-request-failed') {
        alert("Network error: Please check your internet connection.");
      }
      throw error;
    }
  };

  const signupWithEmail = async (email: string, pass: string, name: string) => {
    if (!isFirebaseConfigured) {
      const accounts = JSON.parse(localStorage.getItem('local_sunset_accounts') || '[]');
      if (accounts.some((a: any) => a.email.toLowerCase() === email.toLowerCase())) {
        throw new Error("An account already exists offline with this email address.");
      }
      const uid = 'offline_user_' + Math.random().toString(36).substr(2, 9);
      const newAccount = { uid, email, password: pass, name };
      accounts.push(newAccount);
      localStorage.setItem('local_sunset_accounts', JSON.stringify(accounts));
      
      const fakeUser = {
        uid,
        email,
        displayName: name,
        emailVerified: true,
        isAnonymous: false,
        providerData: [],
      } as any;
      localStorage.setItem('local_sunset_auth_user', JSON.stringify(fakeUser));
      
      // Auto register a basic user profile layout in offline settings too
      const defaultRole = email.includes('supplier') ? 'supplier' : 'admin';
      const settingsKey = `local_sunset_doc_users/${uid}`;
      localStorage.setItem(settingsKey, JSON.stringify({
        role: defaultRole,
        roleConfirmed: true,
        language: 'en',
        currency: 'USD',
        theme: 'dark',
        storeName: 'Sunset Store'
      }));

      setUser(fakeUser);
      return;
    }

    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    await updateProfile(cred.user, { displayName: name });
  };

  const logout = async () => {
    if (!isFirebaseConfigured) {
      localStorage.removeItem('local_sunset_auth_user');
      setUser(null);
      return;
    }
    await signOut(auth);
  };

  const sendPasswordReset = async (emailToReset: string) => {
    if (!isFirebaseConfigured) {
      alert(`🔑 [DEMO PASSWORD RESET]: Passcode reset requested for ${emailToReset}. No email is dispatched in local demo mode.`);
      return;
    }
    if (!emailToReset) {
      throw new Error("Please enter an email address to send the reset link.");
    }
    await sendPasswordResetEmail(auth, emailToReset);
  };

  const updateUserName = async (name: string) => {
    if (!isFirebaseConfigured) {
      if (user) {
        const updated = { ...user, displayName: name };
        localStorage.setItem('local_sunset_auth_user', JSON.stringify(updated));
        setUser(updated);
      }
      return;
    }
    if (auth.currentUser) {
      await updateProfile(auth.currentUser, { displayName: name });
      setUser({ ...auth.currentUser }); // Force trigger state update
    }
  };

  const updateUserPassword = async (password: string) => {
    if (!isFirebaseConfigured) {
      if (user && user.email) {
        const accounts = JSON.parse(localStorage.getItem('local_sunset_accounts') || '[]');
        const index = accounts.findIndex((a: any) => a.email.toLowerCase() === user.email!.toLowerCase());
        if (index >= 0) {
          accounts[index].password = password;
          localStorage.setItem('local_sunset_accounts', JSON.stringify(accounts));
        }
      }
      return;
    }
    if (auth.currentUser) {
      await updatePassword(auth.currentUser, password);
    }
  };

  const updateUserEmail = async (email: string) => {
    if (auth.currentUser) {
      await updateEmail(auth.currentUser, email);
      setUser({ ...auth.currentUser });
    }
  };

  return (
    <FirebaseContext.Provider value={{ 
      user, 
      loading, 
      login, 
      logout, 
      loginWithEmail, 
      signupWithEmail,
      sendPasswordReset,
      updateUserName,
      updateUserPassword,
      updateUserEmail
    }}>
      {children}
    </FirebaseContext.Provider>
  );
}

export function useFirebase() {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useFirebase must be used within a FirebaseProvider');
  }
  return context;
}
