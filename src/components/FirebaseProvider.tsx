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
import { auth, db } from '../lib/firebase';
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
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    await updateProfile(cred.user, { displayName: name });
  };

  const logout = async () => {
    await signOut(auth);
  };

  const sendPasswordReset = async (emailToReset: string) => {
    if (!emailToReset) {
      throw new Error("Please enter an email address to send the reset link.");
    }
    await sendPasswordResetEmail(auth, emailToReset);
  };

  const updateUserName = async (name: string) => {
    if (auth.currentUser) {
      await updateProfile(auth.currentUser, { displayName: name });
      setUser({ ...auth.currentUser }); // Force trigger state update
    }
  };

  const updateUserPassword = async (password: string) => {
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
