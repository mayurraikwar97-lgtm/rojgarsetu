import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import {
  auth,
  BOOTSTRAPPED_ADMIN_EMAIL,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
  testFirestoreConnection,
} from '../lib/firebase';
import type {
  CustomerPreference,
  EmployerPrivateInfo,
  PublicEmployerProfile,
  PublicWorkerProfile,
  UserAccount,
  WorkerPrivateInfo,
} from '../types/domain';
import { subscribeCustomerPreference } from '../lib/firestoreService';
import { clearPhotoCache } from '../lib/photoStorageService';
import { useLanguage } from '../i18n/LanguageContext';

interface AuthContextValue {
  user: User | null;
  authReady: boolean;
  firestoreOnline: boolean;
  userAccount: UserAccount | null;
  workerProfile: PublicWorkerProfile | null;
  workerPrivate: WorkerPrivateInfo | null;
  employerProfile: PublicEmployerProfile | null;
  employerPrivate: EmployerPrivateInfo | null;
  customerPreference: CustomerPreference | null;
  isAdmin: boolean;
  authError: string;
  clearAuthError: () => void;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  refreshUserProfiles: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { lang } = useLanguage();
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [firestoreOnline, setFirestoreOnline] = useState(true);
  const [userAccount, setUserAccount] = useState<UserAccount | null>(null);
  const [workerProfile, setWorkerProfile] = useState<PublicWorkerProfile | null>(null);
  const [workerPrivate, setWorkerPrivate] = useState<WorkerPrivateInfo | null>(null);
  const [employerProfile, setEmployerProfile] = useState<PublicEmployerProfile | null>(null);
  const [employerPrivate, setEmployerPrivate] = useState<EmployerPrivateInfo | null>(null);
  const [customerPreference, setCustomerPreference] = useState<CustomerPreference | null>(null);
  const [isAdminDoc, setIsAdminDoc] = useState(false);
  const [authError, setAuthError] = useState('');

  const loadProfiles = async (firebaseUser: User) => {
    const uid = firebaseUser.uid;
    try {
      const userRef = doc(db, 'users', uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        setUserAccount(userSnap.data() as UserAccount);
      } else if (firebaseUser.email && firebaseUser.emailVerified) {
        const isBootAdmin = firebaseUser.email === BOOTSTRAPPED_ADMIN_EMAIL;
        const newAccount: UserAccount = {
          uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName || 'ROJGAR SETU User',
          role: isBootAdmin ? 'admin' : 'worker',
          preferredLanguage: lang,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        await setDoc(userRef, newAccount);
        setUserAccount(newAccount);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `users/${uid}`);
    }

    try {
      const adminSnap = await getDoc(doc(db, 'admins', uid));
      setIsAdminDoc(adminSnap.exists());
    } catch {
      setIsAdminDoc(false);
    }

    try {
      const [pubW, privW, pubE, privE] = await Promise.all([
        getDoc(doc(db, 'publicWorkers', uid)),
        getDoc(doc(db, 'workerPrivate', uid)),
        getDoc(doc(db, 'publicEmployers', uid)),
        getDoc(doc(db, 'employerPrivate', uid)),
      ]);
      setWorkerProfile(pubW.exists() ? ({ id: pubW.id, ...pubW.data() } as PublicWorkerProfile) : null);
      setWorkerPrivate(privW.exists() ? (privW.data() as WorkerPrivateInfo) : null);
      setEmployerProfile(pubE.exists() ? ({ id: pubE.id, ...pubE.data() } as PublicEmployerProfile) : null);
      setEmployerPrivate(privE.exists() ? (privE.data() as EmployerPrivateInfo) : null);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `profiles/${uid}`);
    }
  };

  useEffect(() => {
    testFirestoreConnection().then((res) => setFirestoreOnline(res.online));

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          await loadProfiles(firebaseUser);
        } catch (err) {
          console.error('Profile sync error:', err);
        }
      } else {
        clearPhotoCache();
        setUserAccount(null);
        setWorkerProfile(null);
        setWorkerPrivate(null);
        setEmployerProfile(null);
        setEmployerPrivate(null);
        setCustomerPreference(null);
        setIsAdminDoc(false);
      }
      setAuthReady(true);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user?.uid || !user.emailVerified) {
      setCustomerPreference(null);
      return;
    }
    const unsubPref = subscribeCustomerPreference(user.uid, setCustomerPreference);
    return () => unsubPref();
  }, [user?.uid, user?.emailVerified]);

  const signInWithGoogle = async () => {
    setAuthError('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/popup-closed-by-user') {
        setAuthError('Google sign-in popup was closed before finishing. Click Sign In again.');
      } else if (code === 'auth/popup-blocked') {
        setAuthError('Your browser blocked the Google sign-in popup. Please enable popups and retry.');
      } else if (code === 'auth/unauthorized-domain') {
        setAuthError('Sign-in failed: this domain is not listed in Firebase Authorized Domains.');
      } else if (code === 'auth/network-request-failed') {
        setAuthError('Network error during Google sign-in. Check your internet connection and retry.');
      } else {
        setAuthError(
          err instanceof Error && err.message
            ? err.message
            : 'Unable to complete Google sign-in. Please retry.'
        );
      }
    }
  };

  const clearAuthError = () => setAuthError('');

  const logout = async () => {
    clearPhotoCache();
    setAuthError('');
    await signOut(auth);
  };

  const refreshUserProfiles = async () => {
    if (user) {
      await loadProfiles(user);
    }
  };

  const isAdmin =
    Boolean(user?.emailVerified) &&
    (isAdminDoc || user?.email === BOOTSTRAPPED_ADMIN_EMAIL || userAccount?.role === 'admin');

  return (
    <AuthContext.Provider
      value={{
        user,
        authReady,
        firestoreOnline,
        userAccount,
        workerProfile,
        workerPrivate,
        employerProfile,
        employerPrivate,
        customerPreference,
        isAdmin,
        authError,
        clearAuthError,
        signInWithGoogle,
        logout,
        refreshUserProfiles,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
