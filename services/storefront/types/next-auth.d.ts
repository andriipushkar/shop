import 'next-auth';

declare module 'next-auth' {
    interface User {
        id: string;
        email: string;
        role?: string;
        firstName?: string;
        lastName?: string;
    }

    interface Session {
        user: User & {
            id: string;
            role: string;
            firstName: string;
            lastName: string;
        };
    }
}

declare module 'next-auth/jwt' {
    interface JWT {
        id: string;
        role?: string;
        firstName?: string;
        lastName?: string;
    }
}
