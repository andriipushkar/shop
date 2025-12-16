// Biometrics Hook - FaceID/TouchID/Fingerprint Authentication
import { useState, useCallback, useEffect } from 'react';
import ReactNativeBiometrics, { BiometryTypes } from 'react-native-biometrics';
import * as Keychain from 'react-native-keychain';
import { Platform } from 'react-native';

import { useAppSettingsStore } from '../store';

const rnBiometrics = new ReactNativeBiometrics({ allowDeviceCredentials: true });

export interface BiometricsState {
  isAvailable: boolean;
  isEnabled: boolean;
  biometryType: BiometryTypes | null;
  isLoading: boolean;
  error: string | null;
}

export function useBiometrics() {
  const [state, setState] = useState<BiometricsState>({
    isAvailable: false,
    isEnabled: false,
    biometryType: null,
    isLoading: true,
    error: null,
  });

  const { biometricsEnabled, setBiometricsEnabled } = useAppSettingsStore();

  // Check biometrics availability
  const checkAvailability = useCallback(async () => {
    try {
      const { available, biometryType } = await rnBiometrics.isSensorAvailable();

      setState((prev) => ({
        ...prev,
        isAvailable: available,
        biometryType: biometryType || null,
        isEnabled: biometricsEnabled && available,
        isLoading: false,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isAvailable: false,
        biometryType: null,
        isLoading: false,
        error: 'Не вдалося перевірити біометрію',
      }));
    }
  }, [biometricsEnabled]);

  useEffect(() => {
    checkAvailability();
  }, [checkAvailability]);

  // Authenticate with biometrics
  const authenticate = useCallback(async (promptMessage?: string): Promise<boolean> => {
    if (!state.isAvailable) {
      throw new Error('Біометрія недоступна');
    }

    try {
      const { success } = await rnBiometrics.simplePrompt({
        promptMessage: promptMessage || 'Підтвердіть вашу особу',
        cancelButtonText: 'Скасувати',
      });

      return success;
    } catch (error) {
      console.error('Biometrics authentication error:', error);
      return false;
    }
  }, [state.isAvailable]);

  // Enable biometrics
  const enableBiometrics = useCallback(async (): Promise<boolean> => {
    if (!state.isAvailable) {
      throw new Error('Біометрія недоступна на цьому пристрої');
    }

    try {
      // Verify biometrics works
      const success = await authenticate('Підтвердіть для активації біометрії');

      if (success) {
        setBiometricsEnabled(true);
        setState((prev) => ({ ...prev, isEnabled: true }));
        return true;
      }

      return false;
    } catch (error) {
      console.error('Enable biometrics error:', error);
      return false;
    }
  }, [state.isAvailable, authenticate, setBiometricsEnabled]);

  // Disable biometrics
  const disableBiometrics = useCallback(async (): Promise<void> => {
    setBiometricsEnabled(false);
    setState((prev) => ({ ...prev, isEnabled: false }));
  }, [setBiometricsEnabled]);

  // Store credentials securely with biometrics protection
  const storeCredentials = useCallback(
    async (email: string, password: string): Promise<boolean> => {
      try {
        await Keychain.setGenericPassword(email, password, {
          accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE,
          accessible: Keychain.ACCESSIBLE.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
          service: 'login_credentials',
        });
        return true;
      } catch (error) {
        console.error('Store credentials error:', error);
        return false;
      }
    },
    []
  );

  // Get stored credentials with biometrics
  const getCredentials = useCallback(async (): Promise<{
    email: string;
    password: string;
  } | null> => {
    try {
      const credentials = await Keychain.getGenericPassword({
        service: 'login_credentials',
        accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE,
      });

      if (credentials) {
        return {
          email: credentials.username,
          password: credentials.password,
        };
      }

      return null;
    } catch (error) {
      console.error('Get credentials error:', error);
      return null;
    }
  }, []);

  // Clear stored credentials
  const clearCredentials = useCallback(async (): Promise<void> => {
    try {
      await Keychain.resetGenericPassword({ service: 'login_credentials' });
    } catch (error) {
      console.error('Clear credentials error:', error);
    }
  }, []);

  // Get biometry type name for UI
  const getBiometryTypeName = useCallback((): string => {
    if (!state.biometryType) return 'Біометрія';

    switch (state.biometryType) {
      case BiometryTypes.FaceID:
        return 'Face ID';
      case BiometryTypes.TouchID:
        return 'Touch ID';
      case BiometryTypes.Biometrics:
        return Platform.OS === 'android' ? 'Відбиток пальця' : 'Біометрія';
      default:
        return 'Біометрія';
    }
  }, [state.biometryType]);

  // Biometric login flow
  const biometricLogin = useCallback(async (): Promise<{
    email: string;
    password: string;
  } | null> => {
    if (!state.isEnabled) {
      throw new Error('Біометричний вхід не активовано');
    }

    const authenticated = await authenticate('Увійдіть за допомогою біометрії');

    if (!authenticated) {
      return null;
    }

    return getCredentials();
  }, [state.isEnabled, authenticate, getCredentials]);

  return {
    ...state,
    authenticate,
    enableBiometrics,
    disableBiometrics,
    storeCredentials,
    getCredentials,
    clearCredentials,
    getBiometryTypeName,
    biometricLogin,
    refresh: checkAvailability,
  };
}

export default useBiometrics;
