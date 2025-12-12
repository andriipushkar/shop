import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '@/lib/auth-context';

// Mock localStorage
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

// Test component to access auth context
function TestComponent({ onAuthChange }: { onAuthChange?: (auth: ReturnType<typeof useAuth>) => void }) {
  const auth = useAuth();

  React.useEffect(() => {
    if (onAuthChange) {
      onAuthChange(auth);
    }
  }, [auth, onAuthChange]);

  return (
    <div>
      <span data-testid="is-authenticated">{auth.isAuthenticated ? 'yes' : 'no'}</span>
      <span data-testid="user-name">{auth.user?.name || 'none'}</span>
      <span data-testid="user-email">{auth.user?.email || 'none'}</span>
      <span data-testid="is-loading">{auth.isLoading ? 'loading' : 'ready'}</span>
      <button onClick={() => auth.login('test@example.com', 'password123')}>Login</button>
      <button onClick={() => auth.register({ name: 'Test User', email: 'new@example.com', password: 'password123' })}>Register</button>
      <button onClick={() => auth.logout()}>Logout</button>
      <button onClick={() => auth.updateProfile({ name: 'Updated Name' })}>Update Profile</button>
    </div>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    mockLocalStorage.getItem.mockClear();
    mockLocalStorage.setItem.mockClear();
    mockLocalStorage.removeItem.mockClear();
  });

  it('should throw error when useAuth is used outside AuthProvider', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<TestComponent />);
    }).toThrow('useAuth must be used within an AuthProvider');

    consoleSpy.mockRestore();
  });

  it('should provide initial unauthenticated state', async () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('is-loading')).toHaveTextContent('ready');
    });
    expect(screen.getByTestId('is-authenticated')).toHaveTextContent('no');
    expect(screen.getByTestId('user-name')).toHaveTextContent('none');
  });

  it('should restore user from localStorage on mount', async () => {
    const storedUser = {
      id: 'user-1',
      email: 'stored@example.com',
      name: 'Stored User',
      createdAt: new Date().toISOString(),
    };
    mockLocalStorage.getItem.mockImplementation((key: string) => {
      if (key === 'shop_current_user') return JSON.stringify(storedUser);
      return null;
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('is-loading')).toHaveTextContent('ready');
    });
    expect(screen.getByTestId('is-authenticated')).toHaveTextContent('yes');
    expect(screen.getByTestId('user-name')).toHaveTextContent('Stored User');
    expect(screen.getByTestId('user-email')).toHaveTextContent('stored@example.com');
  });
});

describe('Auth Actions - Login', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    mockLocalStorage.getItem.mockReturnValue(null);
  });

  it('should login with valid credentials', async () => {
    // Create a registered user first
    const registeredUsers = [{
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      createdAt: new Date().toISOString(),
    }];
    const passwords = { 'test@example.com': 'password123' };
    mockLocalStorage.getItem.mockImplementation((key: string) => {
      if (key === 'shop_users') return JSON.stringify(registeredUsers);
      if (key === 'shop_passwords') return JSON.stringify(passwords);
      return null;
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('is-loading')).toHaveTextContent('ready');
    });

    const loginButton = screen.getByText('Login');
    await act(async () => {
      loginButton.click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('is-authenticated')).toHaveTextContent('yes');
    }, { timeout: 2000 });
    expect(screen.getByTestId('user-email')).toHaveTextContent('test@example.com');
  });

  it('should reject login with invalid email', async () => {
    let loginResult: { success: boolean; error?: string } | null = null;

    function TestLoginComponent() {
      const auth = useAuth();
      return (
        <div>
          <span data-testid="is-authenticated">{auth.isAuthenticated ? 'yes' : 'no'}</span>
          <span data-testid="login-result">{loginResult ? JSON.stringify(loginResult) : 'none'}</span>
          <button
            onClick={async () => {
              loginResult = await auth.login('wrong@example.com', 'password123');
            }}
          >
            Login
          </button>
        </div>
      );
    }

    render(
      <AuthProvider>
        <TestLoginComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('is-authenticated')).toHaveTextContent('no');
    });

    const loginButton = screen.getByText('Login');
    await act(async () => {
      loginButton.click();
    });

    // Wait for the login promise to resolve (has 500ms delay)
    await waitFor(() => {
      expect(loginResult).not.toBeNull();
    }, { timeout: 2000 });

    expect(loginResult).toEqual({ success: false, error: 'Користувача з такою електронною поштою не знайдено' });
  });
});

describe('Auth Actions - Register', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    mockLocalStorage.getItem.mockReturnValue(null);
  });

  it('should register a new user', async () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('is-loading')).toHaveTextContent('ready');
    });

    const registerButton = screen.getByText('Register');
    await act(async () => {
      registerButton.click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('is-authenticated')).toHaveTextContent('yes');
    });
    expect(screen.getByTestId('user-email')).toHaveTextContent('new@example.com');
    expect(screen.getByTestId('user-name')).toHaveTextContent('Test User');
  });

  it('should reject registration with existing email', async () => {
    let registerResult: { success: boolean; error?: string } | null = null;

    // Create an existing user
    const existingUsers = [{
      id: 'user-1',
      email: 'new@example.com',
      name: 'Existing User',
      createdAt: new Date().toISOString(),
    }];
    mockLocalStorage.getItem.mockImplementation((key: string) => {
      if (key === 'shop_users') return JSON.stringify(existingUsers);
      return null;
    });

    function TestRegisterComponent() {
      const auth = useAuth();
      return (
        <div>
          <span data-testid="is-authenticated">{auth.isAuthenticated ? 'yes' : 'no'}</span>
          <button
            onClick={async () => {
              registerResult = await auth.register({
                name: 'Test User',
                email: 'new@example.com',
                password: 'password123',
              });
            }}
          >
            Register
          </button>
        </div>
      );
    }

    render(
      <AuthProvider>
        <TestRegisterComponent />
      </AuthProvider>
    );

    const registerButton = screen.getByText('Register');
    await act(async () => {
      registerButton.click();
    });

    // Wait for the register promise to resolve (has 500ms delay)
    await waitFor(() => {
      expect(registerResult).not.toBeNull();
    }, { timeout: 2000 });

    expect(registerResult).toEqual({ success: false, error: 'Користувач з такою електронною поштою вже існує' });
  });
});

describe('Auth Actions - Logout', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    const storedUser = {
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      createdAt: new Date().toISOString(),
    };
    mockLocalStorage.getItem.mockImplementation((key: string) => {
      if (key === 'shop_current_user') return JSON.stringify(storedUser);
      return null;
    });
  });

  it('should logout user', async () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('is-authenticated')).toHaveTextContent('yes');
    });

    const logoutButton = screen.getByText('Logout');
    await act(async () => {
      logoutButton.click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('is-authenticated')).toHaveTextContent('no');
    });
    expect(screen.getByTestId('user-name')).toHaveTextContent('none');
  });
});

describe('Auth Actions - Update Profile', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    const storedUser = {
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      createdAt: new Date().toISOString(),
    };
    const storedUsers = [storedUser];
    mockLocalStorage.getItem.mockImplementation((key: string) => {
      if (key === 'shop_current_user') return JSON.stringify(storedUser);
      if (key === 'shop_users') return JSON.stringify(storedUsers);
      return null;
    });
  });

  it('should update user profile', async () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('user-name')).toHaveTextContent('Test User');
    });

    const updateButton = screen.getByText('Update Profile');
    await act(async () => {
      updateButton.click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('user-name')).toHaveTextContent('Updated Name');
    });
  });

  it('should not update profile when not authenticated', async () => {
    let updateResult: { success: boolean; error?: string } | null = null;
    mockLocalStorage.getItem.mockReturnValue(null);

    function TestUpdateComponent() {
      const auth = useAuth();
      return (
        <div>
          <span data-testid="is-authenticated">{auth.isAuthenticated ? 'yes' : 'no'}</span>
          <button
            onClick={async () => {
              updateResult = await auth.updateProfile({ name: 'New Name' });
            }}
          >
            Update Profile
          </button>
        </div>
      );
    }

    render(
      <AuthProvider>
        <TestUpdateComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('is-authenticated')).toHaveTextContent('no');
    });

    const updateButton = screen.getByText('Update Profile');
    await act(async () => {
      updateButton.click();
    });

    expect(updateResult).toEqual({ success: false, error: 'Не авторизовано' });
  });
});
