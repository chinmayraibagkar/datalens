'use client';

import { useState } from 'react';
import { signUpWithEmail, signInWithEmail, signInWithGoogle } from '@/services/firebase';
import toast from 'react-hot-toast';

export default function AuthPage() {
    const [mode, setMode] = useState('login'); // 'login' | 'signup'
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (loading) return;
        setLoading(true);

        try {
            if (mode === 'signup') {
                if (!name.trim()) {
                    toast.error('Please enter your name');
                    setLoading(false);
                    return;
                }
                await signUpWithEmail(email, password, name.trim());
                toast.success('Account created successfully! 🎉');
            } else {
                await signInWithEmail(email, password);
                toast.success('Welcome back! 👋');
            }
        } catch (err) {
            const msg = err.code === 'auth/email-already-in-use'
                ? 'An account with this email already exists'
                : err.code === 'auth/invalid-credential'
                    ? 'Invalid email or password'
                    : err.code === 'auth/weak-password'
                        ? 'Password must be at least 6 characters'
                        : err.code === 'auth/invalid-email'
                            ? 'Please enter a valid email'
                            : err.message;
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSignIn = async () => {
        if (loading) return;
        setLoading(true);
        try {
            await signInWithGoogle();
            toast.success('Welcome! 👋');
        } catch (err) {
            if (err.code !== 'auth/popup-closed-by-user') {
                toast.error(err.message);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">
            {/* Animated background */}
            <div className="auth-bg">
                <div className="auth-bg-orb auth-bg-orb-1" />
                <div className="auth-bg-orb auth-bg-orb-2" />
                <div className="auth-bg-orb auth-bg-orb-3" />
            </div>

            <div className="auth-container">
                {/* Branding */}
                <div className="auth-brand">
                    <div className="auth-brand-icon">◈</div>
                    <h1>DataLens AI</h1>
                    <p>AI-powered data exploration & analysis agent</p>
                </div>

                {/* Auth Card */}
                <div className="auth-card">
                    <div className="auth-card-header">
                        <h2>{mode === 'login' ? 'Welcome Back' : 'Create Account'}</h2>
                        <p>{mode === 'login' ? 'Sign in to continue' : 'Get started with DataLens'}</p>
                    </div>

                    {/* Google Sign-In */}
                    <button
                        className="auth-google-btn"
                        onClick={handleGoogleSignIn}
                        disabled={loading}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                        Continue with Google
                    </button>

                    <div className="auth-divider">
                        <span>or</span>
                    </div>

                    {/* Email Form */}
                    <form onSubmit={handleSubmit} className="auth-form">
                        {mode === 'signup' && (
                            <div className="auth-field">
                                <label htmlFor="auth-name">Full Name</label>
                                <input
                                    id="auth-name"
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Enter your name"
                                    autoComplete="name"
                                />
                            </div>
                        )}

                        <div className="auth-field">
                            <label htmlFor="auth-email">Email</label>
                            <input
                                id="auth-email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@example.com"
                                autoComplete="email"
                                required
                            />
                        </div>

                        <div className="auth-field">
                            <label htmlFor="auth-password">Password</label>
                            <input
                                id="auth-password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                                required
                                minLength={6}
                            />
                        </div>

                        <button
                            type="submit"
                            className="auth-submit-btn"
                            disabled={loading}
                        >
                            {loading ? (
                                <span className="auth-spinner" />
                            ) : mode === 'login' ? 'Sign In' : 'Create Account'}
                        </button>
                    </form>

                    {/* Toggle mode */}
                    <div className="auth-toggle">
                        {mode === 'login' ? (
                            <p>
                                Don&apos;t have an account?{' '}
                                <button onClick={() => setMode('signup')}>Sign up</button>
                            </p>
                        ) : (
                            <p>
                                Already have an account?{' '}
                                <button onClick={() => setMode('login')}>Sign in</button>
                            </p>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="auth-footer">
                    <p>Powered by BigQuery · Google Ads · Meta Ads</p>
                </div>
            </div>
        </div>
    );
}
