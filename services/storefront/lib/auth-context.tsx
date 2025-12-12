'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';

export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  avatar?: string;
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (data: RegisterData) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  updateProfile: (data: Partial<User>) => Promise<{ success: boolean; error?: string }>;
}

interface RegisterData {
  email: string;
  password: string;
  name: string;
  phone?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Mock users storage (in real app - use API/database)
const USERS_STORAGE_KEY = 'shop_users';
const CURRENT_USER_KEY = 'shop_current_user';

function getStoredUsers(): User[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(USERS_STORAGE_KEY);
  return stored ? JSON.parse(stored) : [];
}

function saveUsers(users: User[]) {
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
}

function getStoredPasswords(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const stored = localStorage.getItem('shop_passwords');
  return stored ? JSON.parse(stored) : {};
}

function savePassword(email: string, password: string) {
  const passwords = getStoredPasswords();
  passwords[email] = password;
  localStorage.setItem('shop_passwords', JSON.stringify(passwords));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    const storedUser = localStorage.getItem(CURRENT_USER_KEY);
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 500));

      const users = getStoredUsers();
      const passwords = getStoredPasswords();

      const foundUser = users.find(u => u.email.toLowerCase() === email.toLowerCase());

      if (!foundUser) {
        return { success: false, error: 'Користувача з такою електронною поштою не знайдено' };
      }

      if (passwords[foundUser.email] !== password) {
        return { success: false, error: 'Невірний пароль' };
      }

      setUser(foundUser);
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(foundUser));
      return { success: true };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(async (data: RegisterData): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 500));

      const users = getStoredUsers();

      // Check if email already exists
      if (users.some(u => u.email.toLowerCase() === data.email.toLowerCase())) {
        return { success: false, error: 'Користувач з такою електронною поштою вже існує' };
      }

      // Validate email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.email)) {
        return { success: false, error: 'Невірний формат електронної пошти' };
      }

      // Validate password
      if (data.password.length < 6) {
        return { success: false, error: 'Пароль має містити не менше 6 символів' };
      }

      const newUser: User = {
        id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        email: data.email,
        name: data.name,
        phone: data.phone,
        createdAt: new Date().toISOString(),
      };

      users.push(newUser);
      saveUsers(users);
      savePassword(data.email, data.password);

      setUser(newUser);
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(newUser));

      return { success: true };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem(CURRENT_USER_KEY);
  }, []);

  const updateProfile = useCallback(async (data: Partial<User>): Promise<{ success: boolean; error?: string }> => {
    if (!user) {
      return { success: false, error: 'Не авторизовано' };
    }

    setIsLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 300));

      const users = getStoredUsers();
      const userIndex = users.findIndex(u => u.id === user.id);

      if (userIndex === -1) {
        return { success: false, error: 'Користувача не знайдено' };
      }

      const updatedUser = { ...users[userIndex], ...data };
      users[userIndex] = updatedUser;
      saveUsers(users);

      setUser(updatedUser);
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(updatedUser));

      return { success: true };
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
