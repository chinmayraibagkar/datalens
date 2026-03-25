import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';

const handler = NextAuth({
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            authorization: {
                params: {
                    scope:
                        'openid email profile https://www.googleapis.com/auth/bigquery https://www.googleapis.com/auth/bigquery.readonly https://www.googleapis.com/auth/cloud-platform',
                    access_type: 'offline',
                    prompt: 'consent',
                },
            },
        }),
    ],
    callbacks: {
        async jwt({ token, account }) {
            // On initial sign-in, store all token info
            if (account) {
                token.accessToken = account.access_token;
                token.refreshToken = account.refresh_token;
                token.expiresAt = account.expires_at;
                return token;
            }

            // If the token hasn't expired yet, return it as-is
            if (token.expiresAt && Date.now() < token.expiresAt * 1000 - 60000) {
                return token;
            }

            // Token has expired — refresh it
            try {
                const response = await fetch('https://oauth2.googleapis.com/token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({
                        client_id: process.env.GOOGLE_CLIENT_ID,
                        client_secret: process.env.GOOGLE_CLIENT_SECRET,
                        grant_type: 'refresh_token',
                        refresh_token: token.refreshToken,
                    }),
                });

                const refreshed = await response.json();

                if (!response.ok) {
                    console.error('Token refresh failed:', refreshed);
                    throw new Error(refreshed.error || 'Token refresh failed');
                }

                token.accessToken = refreshed.access_token;
                token.expiresAt = Math.floor(Date.now() / 1000) + refreshed.expires_in;
                // Google may issue a new refresh token
                if (refreshed.refresh_token) {
                    token.refreshToken = refreshed.refresh_token;
                }
                console.log('Access token refreshed successfully');
            } catch (error) {
                console.error('Error refreshing access token:', error);
                token.error = 'RefreshAccessTokenError';
            }

            return token;
        },
        async session({ session, token }) {
            session.accessToken = token.accessToken;
            session.refreshToken = token.refreshToken;
            session.error = token.error;
            return session;
        },
    },
    pages: {
        signIn: '/settings',
    },
    secret: process.env.NEXTAUTH_SECRET,
});

export { handler as GET, handler as POST };
