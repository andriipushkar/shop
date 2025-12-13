import type { NextAuthConfig, User } from 'next-auth';
import type { JWT } from 'next-auth/jwt';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';

// Extend User type with custom properties
interface ExtendedUser extends User {
    role?: string;
    firstName?: string;
    lastName?: string;
}

// Extend JWT type with custom properties
interface ExtendedJWT extends JWT {
    id?: string;
    role?: string;
    firstName?: string;
    lastName?: string;
}

// Extend Session type
interface ExtendedSession {
    firstName?: string;
    lastName?: string;
}

export const authConfig: NextAuthConfig = {
    pages: {
        signIn: '/login',
        signOut: '/logout',
        error: '/auth/error',
        verifyRequest: '/auth/verify-request',
        newUser: '/register',
    },
    callbacks: {
        authorized({ auth, request: { nextUrl } }) {
            const isLoggedIn = !!auth?.user;
            const isOnAdmin = nextUrl.pathname.startsWith('/admin');
            const isOnAccount = nextUrl.pathname.startsWith('/account');

            if (isOnAdmin) {
                if (isLoggedIn) {
                    // Type-safe access to user role
                    const extendedUser = auth.user as ExtendedUser | undefined;
                    const userRole = extendedUser?.role;
                    return userRole === 'ADMIN' || userRole === 'MANAGER';
                }
                return false;
            }

            if (isOnAccount) {
                return isLoggedIn;
            }

            return true;
        },
        async jwt({ token, user, trigger, session }) {
            // Type-safe token and user handling
            const extendedToken = token as ExtendedJWT;
            const extendedUser = user as ExtendedUser | undefined;

            if (extendedUser) {
                extendedToken.id = extendedUser.id;
                extendedToken.email = extendedUser.email;
                extendedToken.role = extendedUser.role;
                extendedToken.firstName = extendedUser.firstName;
                extendedToken.lastName = extendedUser.lastName;
            }

            // Handle session update
            if (trigger === 'update' && session) {
                const extendedSession = session as ExtendedSession;
                extendedToken.firstName = extendedSession.firstName;
                extendedToken.lastName = extendedSession.lastName;
            }

            return extendedToken;
        },
        async session({ session, token }) {
            const extendedToken = token as ExtendedJWT;

            if (extendedToken && session.user) {
                session.user.id = extendedToken.id ?? '';
                session.user.role = extendedToken.role ?? '';
                session.user.firstName = extendedToken.firstName ?? '';
                session.user.lastName = extendedToken.lastName ?? '';
            }
            return session;
        },
    },
    providers: [
        Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        }),
        Credentials({
            name: 'credentials',
            credentials: {
                email: { label: 'Email', type: 'email' },
                password: { label: 'Password', type: 'password' },
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    return null;
                }

                const email = credentials.email as string;
                const password = credentials.password as string;

                try {
                    // Dynamic import to avoid build-time db connection
                    const { userRepository } = await import('@/lib/db/repositories/user.repository');

                    const user = await userRepository.findByEmail(email);

                    if (!user || !user.isActive) {
                        return null;
                    }

                    const isValid = await userRepository.verifyPassword(user, password);

                    if (!isValid) {
                        return null;
                    }

                    // Update last login
                    await userRepository.updateLastLogin(user.id);

                    return {
                        id: user.id,
                        email: user.email,
                        role: user.role,
                        firstName: user.firstName || undefined,
                        lastName: user.lastName || undefined,
                        image: user.avatar || undefined,
                    };
                } catch {
                    return null;
                }
            },
        }),
    ],
};
