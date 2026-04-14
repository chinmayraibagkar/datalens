'use client';
import { SessionProvider } from 'next-auth/react';
import { useEffect } from 'react';
import { useAppStore } from '@/store/app-store';
import { Toaster } from 'react-hot-toast';
import AuthGuard from '@/components/Auth/AuthGuard';

export function Providers({ children }) {
    const theme = useAppStore((s) => s.theme);

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
    }, [theme]);

    return (
        <SessionProvider>
            <Toaster
                position="top-right"
                toastOptions={{
                    style: {
                        background: 'var(--bg-card)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '0.85rem',
                    },
                }}
            />
            <AuthGuard>{children}</AuthGuard>
        </SessionProvider>
    );
}
