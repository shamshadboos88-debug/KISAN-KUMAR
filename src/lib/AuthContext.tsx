import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { UserProfile } from '../types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateSettings: (settings: UserProfile['settings']) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = async () => {
    if (!auth.currentUser) return;
    const path = `users/${auth.currentUser.uid}`;
    try {
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (userDoc.exists()) {
        setProfile(userDoc.data() as UserProfile);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    }
  };

  const updateSettings = async (settings: UserProfile['settings']) => {
    if (!user) return;
    const path = `users/${user.uid}`;
    const userRef = doc(db, 'users', user.uid);
    
    // Safety check: Remove undefined values which Firestore doesn't like
    const cleanSettings = Object.fromEntries(
      Object.entries(settings).filter(([_, v]) => v !== undefined)
    );

    try {
      await setDoc(userRef, { settings: cleanSettings }, { merge: true });
      setProfile(prev => prev ? { ...prev, settings: { ...prev.settings, ...cleanSettings } } : null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        const path = `users/${user.uid}`;
        const userRef = doc(db, 'users', user.uid);
        try {
          const userDoc = await getDoc(userRef);
          
          if (!userDoc.exists()) {
            const newProfile: UserProfile = {
              uid: user.uid,
              email: user.email || '',
              displayName: user.displayName || '',
              photoURL: user.photoURL || '',
              isPro: true,
              settings: {
                preferredModel: 'gemini-3-flash-preview',
                preferredImageModel: 'gemini-2.5-flash-image',
                persona: 'professional'
              },
              usage: {
                chatCount: 0,
                imageCount: 0,
                pdfCount: 0
              },
              createdAt: new Date().toISOString()
            };
            await setDoc(userRef, newProfile);
            setProfile(newProfile);
          } else {
            const data = userDoc.data() as UserProfile;
            // Ensure settings exist for legacy users
            let updated = false;
            if (!data.settings) {
              data.settings = {
                preferredModel: 'gemini-3-flash-preview',
                preferredImageModel: 'gemini-2.5-flash-image',
                persona: 'professional'
              };
              updated = true;
            } else {
              if (!data.settings.preferredModel || data.settings.preferredModel.includes('1.5')) {
                data.settings.preferredModel = 'gemini-3-flash-preview';
                updated = true;
              }
              if (!data.settings.preferredImageModel) {
                data.settings.preferredImageModel = 'gemini-2.5-flash-image';
                updated = true;
              }
            }
            if (updated) {
               await setDoc(userRef, { settings: data.settings }, { merge: true });
            }
            setProfile(data);
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, path);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, logout, refreshProfile, updateSettings }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
