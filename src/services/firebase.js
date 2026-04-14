// Firebase client SDK initialization and helpers
import { initializeApp, getApps } from 'firebase/app';
import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider,
    signOut as firebaseSignOut,
    onAuthStateChanged,
    updateProfile,
} from 'firebase/auth';
import {
    getFirestore,
    doc,
    setDoc,
    getDoc,
    getDocs,
    deleteDoc,
    collection,
    query,
    orderBy,
    limit,
    serverTimestamp,
    writeBatch,
} from 'firebase/firestore';

// Firebase config from environment variables
const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase (singleton)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);
export const db = getFirestore(app);

// ─── Auth Helpers ────────────────────────────────────────────────

export async function signUpWithEmail(email, password, displayName) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName) {
        await updateProfile(cred.user, { displayName });
    }
    return cred.user;
}

export async function signInWithEmail(email, password) {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return cred.user;
}

export async function signInWithGoogle() {
    const provider = new GoogleAuthProvider();
    const cred = await signInWithPopup(auth, provider);
    return cred.user;
}

export async function signOutUser() {
    await firebaseSignOut(auth);
}

export function onAuthChange(callback) {
    return onAuthStateChanged(auth, callback);
}

// ─── Firestore: User Settings ────────────────────────────────────

export async function saveUserSettings(uid, settings) {
    const ref = doc(db, 'users', uid, 'data', 'settings');
    await setDoc(ref, { ...settings, updatedAt: serverTimestamp() }, { merge: true });
}

export async function loadUserSettings(uid) {
    const ref = doc(db, 'users', uid, 'data', 'settings');
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data() : null;
}

// ─── Firestore: Conversations ────────────────────────────────────

export async function saveConversation(uid, conversation) {
    const ref = doc(db, 'users', uid, 'conversations', conversation.id);
    await setDoc(ref, {
        ...conversation,
        updatedAt: serverTimestamp(),
    });
}

export async function loadConversations(uid, maxCount = 100) {
    const col = collection(db, 'users', uid, 'conversations');
    const q = query(col, orderBy('updatedAt', 'desc'), limit(maxCount));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function deleteConversationFromFirestore(uid, convId) {
    const ref = doc(db, 'users', uid, 'conversations', convId);
    await deleteDoc(ref);
}

// ─── Firestore: Usage Data ───────────────────────────────────────

export async function saveUsageEntry(uid, entry) {
    const id = `usage_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const ref = doc(db, 'users', uid, 'usage', id);
    await setDoc(ref, { ...entry, createdAt: serverTimestamp() });
}

export async function loadUsageData(uid, maxCount = 500) {
    const col = collection(db, 'users', uid, 'usage');
    const q = query(col, orderBy('createdAt', 'desc'), limit(maxCount));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ─── Firestore: Batch save settings + conversations ──────────────

export async function batchSaveAll(uid, settings, conversations) {
    const batch = writeBatch(db);

    // Settings
    const settingsRef = doc(db, 'users', uid, 'data', 'settings');
    batch.set(settingsRef, { ...settings, updatedAt: serverTimestamp() }, { merge: true });

    // Conversations (batch supports max 500 operations)
    const convSlice = conversations.slice(0, 490);
    for (const conv of convSlice) {
        const convRef = doc(db, 'users', uid, 'conversations', conv.id);
        batch.set(convRef, { ...conv, updatedAt: serverTimestamp() });
    }

    await batch.commit();
}
