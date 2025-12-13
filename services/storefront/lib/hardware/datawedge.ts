/**
 * DataWedge Integration
 * Підтримка професійних ТЗД (терміналів збору даних)
 * Zebra, Honeywell, Datalogic
 */

'use client';

import { useState, useEffect, useCallback } from 'react';

export interface DataWedgeConfig {
  profileName: string;
  intentAction?: string;
  intentCategory?: string;
  intentDelivery?: 'broadcast' | 'startActivity' | 'startService';
}

export interface ScanResult {
  data: string;
  symbology: string; // EAN13, CODE128, QR, etc.
  timestamp: Date;
  source: 'camera' | 'laser' | 'imager';
}

export type ScanCallback = (result: ScanResult) => void;

declare global {
  interface Window {
    datawedge?: any;
    Android?: any;
  }
}

export class DataWedgeService {
  private listeners: Set<ScanCallback> = new Set();
  private config: DataWedgeConfig;
  private isInitialized = false;

  constructor(config?: DataWedgeConfig) {
    this.config = config || {
      profileName: 'WarehouseProfile',
      intentAction: 'com.warehouse.SCAN',
      intentCategory: 'android.intent.category.DEFAULT',
      intentDelivery: 'broadcast',
    };
  }

  /**
   * Initialize DataWedge (for Android WebView apps)
   */
  async initialize(config?: DataWedgeConfig): Promise<boolean> {
    if (config) {
      this.config = { ...this.config, ...config };
    }

    if (!this.isDataWedgeAvailable()) {
      console.warn('DataWedge not available on this device');
      return false;
    }

    try {
      // Create DataWedge profile
      await this.configureProfile(this.config);

      // Setup broadcast receiver
      this.setupBroadcastReceiver();

      this.isInitialized = true;
      console.log('DataWedge initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize DataWedge:', error);
      return false;
    }
  }

  /**
   * Check if running on DataWedge-enabled device
   */
  isDataWedgeAvailable(): boolean {
    // Check for Android WebView interface
    if (typeof window !== 'undefined' && window.Android) {
      return true;
    }

    // Check for Zebra DataWedge
    if (typeof window !== 'undefined' && window.datawedge) {
      return true;
    }

    // Check user agent for known devices
    if (typeof navigator !== 'undefined') {
      const ua = navigator.userAgent.toLowerCase();
      return (
        ua.includes('zebra') ||
        ua.includes('honeywell') ||
        ua.includes('datalogic') ||
        ua.includes('android')
      );
    }

    return false;
  }

  /**
   * Subscribe to scan events
   */
  onScan(callback: ScanCallback): () => void {
    this.listeners.add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Configure DataWedge profile
   */
  async configureProfile(config: DataWedgeConfig): Promise<void> {
    if (!this.isDataWedgeAvailable()) {
      throw new Error('DataWedge not available');
    }

    const profileConfig = {
      PROFILE_NAME: config.profileName,
      PROFILE_ENABLED: 'true',
      CONFIG_MODE: 'CREATE_IF_NOT_EXIST',
      PLUGIN_CONFIG: {
        PLUGIN_NAME: 'BARCODE',
        RESET_CONFIG: 'true',
        PARAM_LIST: {
          scanner_selection: 'auto',
          scanner_input_enabled: 'true',
        },
      },
      APP_LIST: [
        {
          PACKAGE_NAME: window.location.hostname,
          ACTIVITY_LIST: ['*'],
        },
      ],
    };

    try {
      if (window.Android?.setDataWedgeProfile) {
        window.Android.setDataWedgeProfile(JSON.stringify(profileConfig));
      } else if (window.datawedge) {
        window.datawedge.sendIntent({
          action: 'com.symbol.datawedge.api.SET_CONFIG',
          extras: profileConfig,
        });
      }
    } catch (error) {
      console.error('Failed to configure DataWedge profile:', error);
      throw error;
    }
  }

  /**
   * Enable scanner
   */
  async enableScanner(): Promise<void> {
    if (!this.isDataWedgeAvailable()) {
      throw new Error('DataWedge not available');
    }

    try {
      if (window.Android?.enableScanner) {
        window.Android.enableScanner();
      } else if (window.datawedge) {
        window.datawedge.sendIntent({
          action: 'com.symbol.datawedge.api.SCANNER_INPUT_PLUGIN',
          extras: { ENABLE: true },
        });
      }
    } catch (error) {
      console.error('Failed to enable scanner:', error);
      throw error;
    }
  }

  /**
   * Disable scanner
   */
  async disableScanner(): Promise<void> {
    if (!this.isDataWedgeAvailable()) {
      return;
    }

    try {
      if (window.Android?.disableScanner) {
        window.Android.disableScanner();
      } else if (window.datawedge) {
        window.datawedge.sendIntent({
          action: 'com.symbol.datawedge.api.SCANNER_INPUT_PLUGIN',
          extras: { ENABLE: false },
        });
      }
    } catch (error) {
      console.error('Failed to disable scanner:', error);
    }
  }

  /**
   * Trigger soft scan (for devices with hardware trigger)
   */
  async triggerScan(): Promise<void> {
    if (!this.isDataWedgeAvailable()) {
      throw new Error('DataWedge not available');
    }

    try {
      if (window.Android?.triggerScan) {
        window.Android.triggerScan();
      } else if (window.datawedge) {
        window.datawedge.sendIntent({
          action: 'com.symbol.datawedge.api.SOFT_SCAN_TRIGGER',
          extras: { PARAM: 'START_SCANNING' },
        });

        // Auto-stop after 5 seconds
        setTimeout(() => {
          window.datawedge?.sendIntent({
            action: 'com.symbol.datawedge.api.SOFT_SCAN_TRIGGER',
            extras: { PARAM: 'STOP_SCANNING' },
          });
        }, 5000);
      }
    } catch (error) {
      console.error('Failed to trigger scan:', error);
      throw error;
    }
  }

  /**
   * Setup broadcast receiver for scan events
   */
  private setupBroadcastReceiver(): void {
    // Create global callback for Android WebView
    if (typeof window !== 'undefined') {
      (window as any).onDataWedgeScan = (data: string, symbology: string, source: string) => {
        const result: ScanResult = {
          data,
          symbology: symbology || 'UNKNOWN',
          timestamp: new Date(),
          source: (source as any) || 'imager',
        };

        this.notifyListeners(result);
      };

      // Also listen for intent broadcasts
      window.addEventListener('message', (event) => {
        if (event.data?.type === 'SCAN_RESULT') {
          const result: ScanResult = {
            data: event.data.data,
            symbology: event.data.symbology || 'UNKNOWN',
            timestamp: new Date(),
            source: event.data.source || 'imager',
          };

          this.notifyListeners(result);
        }
      });
    }
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(result: ScanResult): void {
    this.listeners.forEach((callback) => {
      try {
        callback(result);
      } catch (error) {
        console.error('Error in scan callback:', error);
      }
    });
  }

  /**
   * Handle keyboard wedge input (fallback for desktop)
   */
  setupKeyboardWedge(inputSelector: string): void {
    const input = document.querySelector(inputSelector) as HTMLInputElement;
    if (!input) {
      console.warn(`Input element not found: ${inputSelector}`);
      return;
    }

    let buffer = '';
    let lastKeyTime = 0;

    const handleKeyPress = (e: KeyboardEvent) => {
      const now = Date.now();
      const timeDiff = now - lastKeyTime;

      // Reset buffer if too much time passed
      if (timeDiff > 100) {
        buffer = '';
      }

      lastKeyTime = now;

      if (e.key === 'Enter' && buffer.length > 0) {
        const result: ScanResult = {
          data: buffer,
          symbology: 'UNKNOWN',
          timestamp: new Date(),
          source: 'imager',
        };

        this.notifyListeners(result);
        buffer = '';
        e.preventDefault();
      } else if (e.key.length === 1) {
        buffer += e.key;
      }
    };

    input.addEventListener('keypress', handleKeyPress);
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.listeners.clear();
    if (typeof window !== 'undefined') {
      delete (window as any).onDataWedgeScan;
    }
  }
}

/**
 * React hook for easy integration
 */
export function useDataWedge(config?: DataWedgeConfig) {
  const [lastScan, setLastScan] = useState<ScanResult | null>(null);
  const [isAvailable, setIsAvailable] = useState(false);
  const [service] = useState(() => new DataWedgeService(config));

  useEffect(() => {
    const available = service.isDataWedgeAvailable();
    setIsAvailable(available);

    if (available) {
      service.initialize(config);
    }

    const unsubscribe = service.onScan((result) => {
      setLastScan(result);
    });

    return () => {
      unsubscribe();
      service.destroy();
    };
  }, [service, config]);

  const triggerScan = useCallback(async () => {
    try {
      await service.triggerScan();
    } catch (error) {
      console.error('Failed to trigger scan:', error);
    }
  }, [service]);

  return {
    lastScan,
    isAvailable,
    triggerScan,
    service,
  };
}
