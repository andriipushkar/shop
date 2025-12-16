// Login Screen
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';

import { useAuthStore } from '../store';
import { useBiometrics } from '../hooks/useBiometrics';

export const LoginScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { login, isLoading, error, clearError } = useAuthStore();
  const {
    isAvailable: biometricsAvailable,
    isEnabled: biometricsEnabled,
    biometricLogin,
    getBiometryTypeName,
  } = useBiometrics();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    if (error) {
      Alert.alert('Помилка', error);
      clearError();
    }
  }, [error]);

  // Try biometric login on mount if available
  useEffect(() => {
    if (biometricsEnabled) {
      handleBiometricLogin();
    }
  }, [biometricsEnabled]);

  const validateEmail = (value: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!value.trim()) {
      setEmailError('Введіть email');
      return false;
    }
    if (!emailRegex.test(value)) {
      setEmailError('Некоректний email');
      return false;
    }
    setEmailError('');
    return true;
  };

  const validatePassword = (value: string): boolean => {
    if (!value) {
      setPasswordError('Введіть пароль');
      return false;
    }
    if (value.length < 6) {
      setPasswordError('Пароль має бути мінімум 6 символів');
      return false;
    }
    setPasswordError('');
    return true;
  };

  const handleLogin = async () => {
    const isEmailValid = validateEmail(email);
    const isPasswordValid = validatePassword(password);

    if (!isEmailValid || !isPasswordValid) {
      return;
    }

    try {
      await login(email, password);
    } catch {
      // Error handled in useEffect
    }
  };

  const handleBiometricLogin = async () => {
    try {
      const credentials = await biometricLogin();
      if (credentials) {
        await login(credentials.email, credentials.password);
      }
    } catch (error) {
      console.log('Biometric login failed:', error);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>Shop</Text>
          <Text style={styles.title}>Вхід</Text>
          <Text style={styles.subtitle}>
            Увійдіть, щоб отримати персоналізовані рекомендації
          </Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {/* Email Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Email</Text>
            <View
              style={[
                styles.inputWrapper,
                emailError && styles.inputWrapperError,
              ]}
            >
              <Icon
                name="mail-outline"
                size={20}
                color={emailError ? '#FF6B6B' : '#999'}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="your@email.com"
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (emailError) validateEmail(text);
                }}
                onBlur={() => validateEmail(email)}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            {emailError && <Text style={styles.errorText}>{emailError}</Text>}
          </View>

          {/* Password Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Пароль</Text>
            <View
              style={[
                styles.inputWrapper,
                passwordError && styles.inputWrapperError,
              ]}
            >
              <Icon
                name="lock-closed-outline"
                size={20}
                color={passwordError ? '#FF6B6B' : '#999'}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Введіть пароль"
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (passwordError) validatePassword(text);
                }}
                onBlur={() => validatePassword(password)}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeButton}
              >
                <Icon
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color="#999"
                />
              </TouchableOpacity>
            </View>
            {passwordError && (
              <Text style={styles.errorText}>{passwordError}</Text>
            )}
          </View>

          {/* Forgot Password */}
          <TouchableOpacity style={styles.forgotPassword}>
            <Text style={styles.forgotPasswordText}>Забули пароль?</Text>
          </TouchableOpacity>

          {/* Login Button */}
          <TouchableOpacity
            style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.loginButtonText}>Увійти</Text>
            )}
          </TouchableOpacity>

          {/* Biometric Login */}
          {biometricsAvailable && biometricsEnabled && (
            <TouchableOpacity
              style={styles.biometricButton}
              onPress={handleBiometricLogin}
            >
              <Icon name="finger-print" size={24} color="#007AFF" />
              <Text style={styles.biometricText}>
                Увійти за допомогою {getBiometryTypeName()}
              </Text>
            </TouchableOpacity>
          )}

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>або</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Social Login */}
          <View style={styles.socialButtons}>
            <TouchableOpacity style={styles.socialButton}>
              <Icon name="logo-google" size={20} color="#DB4437" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.socialButton}>
              <Icon name="logo-apple" size={20} color="#000" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.socialButton}>
              <Icon name="logo-facebook" size={20} color="#4267B2" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Register Link */}
        <View style={styles.registerContainer}>
          <Text style={styles.registerText}>Немає акаунту?</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Register')}>
            <Text style={styles.registerLink}>Зареєструватися</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
  },
  header: {
    marginTop: 48,
    marginBottom: 32,
  },
  logo: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#666',
    lineHeight: 22,
  },
  form: {
    flex: 1,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: '#fafafa',
  },
  inputWrapperError: {
    borderColor: '#FF6B6B',
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: '#333',
  },
  eyeButton: {
    padding: 4,
  },
  errorText: {
    fontSize: 12,
    color: '#FF6B6B',
    marginTop: 4,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 24,
  },
  forgotPasswordText: {
    fontSize: 14,
    color: '#007AFF',
  },
  loginButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  biometricButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    marginTop: 16,
    gap: 8,
  },
  biometricText: {
    fontSize: 14,
    color: '#007AFF',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e0e0e0',
  },
  dividerText: {
    paddingHorizontal: 16,
    fontSize: 14,
    color: '#999',
  },
  socialButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  socialButton: {
    width: 56,
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    gap: 4,
  },
  registerText: {
    fontSize: 14,
    color: '#666',
  },
  registerLink: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
});

export default LoginScreen;
