'use client';

import { useEffect, useState } from 'react';
import { onAuthChange } from '@/services/firebase';
import { useAppStore } from '@/store/app-store';
import AuthPage from './AuthPage';

export default function AuthGuard({ children }) {
    const [authState, setAuthState] = useState('loading'); // 'loading' | 'authenticated' | 'unauthenticated'
    const setFirebaseUser = useAppStore((s) => s.setFirebaseUser);
    const loadFromFirestore = useAppStore((s) => s.loadFromFirestore);

    useEffect(() => {
        const unsubscribe = onAuthChange(async (user) => {
            if (user) {
                setFirebaseUser({
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName,
                    photoURL: user.photoURL,
                });
                // Load settings and conversations from Firestore
                try {
                    await loadFromFirestore(user.uid);
                } catch (err) {
                    console.error('Failed to load data from Firestore:', err);
                }
                setAuthState('authenticated');
            } else {
                setFirebaseUser(null);
                setAuthState('unauthenticated');
            }
        });

        return () => unsubscribe();
    }, [setFirebaseUser, loadFromFirestore]);

    // Loading state
    if (authState === 'loading') {
        return (
            <div className="auth-loading">
                <div className="auth-loading-content">
                    <div className="auth-brand-icon" style={{ width: 56, height: 56, fontSize: '1.5rem' }}>◈</div>
                    <div className="auth-loading-spinner" />
                    <p>Loading DataLens...</p>
                </div>
            </div>
        );
    }

    // Not authenticated — show auth page
    if (authState === 'unauthenticated') {
        return <AuthPage />;
    }

    // Authenticated — show app
    return children;
}
