'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { initMonitoring, trackPageView, setUser } from '@/lib/monitoring';
import { initPerformanceMonitoring } from '@/lib/performance';
import { useAuth } from '@/lib/auth-context';

export function AppInitializer() {
    const pathname = usePathname();
    const { user } = useAuth();

    // Initialize monitoring and performance on mount
    useEffect(() => {
        initMonitoring();
        initPerformanceMonitoring();
    }, []);

    // Track page views
    useEffect(() => {
        trackPageView(pathname);
    }, [pathname]);

    // Set user for analytics when logged in
    useEffect(() => {
        if (user) {
            setUser({
                id: user.id,
                email: user.email,
                name: user.name,
            });
        } else {
            setUser(null);
        }
    }, [user]);

    return null;
}
