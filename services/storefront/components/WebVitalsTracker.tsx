'use client';

import { useEffect } from 'react';
import { initWebVitals } from '@/lib/web-vitals';

/**
 * Web Vitals Tracker Component
 * Add this to your root layout to enable Core Web Vitals monitoring
 */
export default function WebVitalsTracker(): null {
  useEffect(() => {
    initWebVitals();
  }, []);

  return null;
}
