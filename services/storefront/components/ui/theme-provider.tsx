'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'

type Theme = 'light' | 'dark' | 'system'
type ActualTheme = 'light' | 'dark'

interface ThemeContextType {
  theme: Theme
  actualTheme: ActualTheme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

interface ThemeProviderProps {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
  attribute?: string
  enableSystem?: boolean
  disableTransitionOnChange?: boolean
}

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'theme',
  attribute = 'class',
  enableSystem = true,
  disableTransitionOnChange = false,
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(defaultTheme)
  const [actualTheme, setActualTheme] = useState<ActualTheme>('light')
  const [mounted, setMounted] = useState(false)

  // Get system theme
  const getSystemTheme = useCallback((): ActualTheme => {
    if (typeof window === 'undefined') return 'light'
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }, [])

  // Calculate actual theme
  const getActualTheme = useCallback((t: Theme): ActualTheme => {
    if (t === 'system') {
      return getSystemTheme()
    }
    return t as ActualTheme
  }, [getSystemTheme])

  // Apply theme to document
  const applyTheme = useCallback((newTheme: ActualTheme) => {
    const root = document.documentElement
    const body = document.body

    if (disableTransitionOnChange) {
      const css = document.createElement('style')
      css.type = 'text/css'
      css.appendChild(document.createTextNode(`* { transition: none !important; }`))
      document.head.appendChild(css)

      // Force reflow
      ;(() => window.getComputedStyle(body).opacity)()

      setTimeout(() => {
        document.head.removeChild(css)
      }, 1)
    }

    if (attribute === 'class') {
      root.classList.remove('light', 'dark')
      root.classList.add(newTheme)
    } else {
      root.setAttribute(attribute, newTheme)
    }

    // Also set color-scheme for native elements
    root.style.colorScheme = newTheme

    setActualTheme(newTheme)
  }, [attribute, disableTransitionOnChange])

  // Set theme and persist
  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme)
    localStorage.setItem(storageKey, newTheme)
    applyTheme(getActualTheme(newTheme))
  }, [storageKey, applyTheme, getActualTheme])

  // Toggle between light and dark
  const toggleTheme = useCallback(() => {
    setTheme(actualTheme === 'light' ? 'dark' : 'light')
  }, [actualTheme, setTheme])

  // Initialize theme on mount
  useEffect(() => {
    const stored = localStorage.getItem(storageKey) as Theme | null
    const initial = stored || defaultTheme
    setThemeState(initial)
    applyTheme(getActualTheme(initial))
    setMounted(true)
  }, [storageKey, defaultTheme, applyTheme, getActualTheme])

  // Listen for system theme changes
  useEffect(() => {
    if (!enableSystem) return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    const handleChange = () => {
      if (theme === 'system') {
        applyTheme(getSystemTheme())
      }
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [theme, enableSystem, applyTheme, getSystemTheme])

  // Prevent flash of unstyled content
  if (!mounted) {
    return null
  }

  return (
    <ThemeContext.Provider value={{ theme, actualTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

// Theme toggle button component
interface ThemeToggleProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
}

export function ThemeToggle({ className = '', size = 'md', showLabel = false }: ThemeToggleProps) {
  const { theme, actualTheme, setTheme, toggleTheme } = useTheme()

  const sizes = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
  }

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button
        onClick={toggleTheme}
        className={`${sizes[size]} flex items-center justify-center rounded-lg
          bg-gray-100 dark:bg-gray-800
          hover:bg-gray-200 dark:hover:bg-gray-700
          transition-colors`}
        title={`Switch to ${actualTheme === 'light' ? 'dark' : 'light'} mode`}
        aria-label={`Switch to ${actualTheme === 'light' ? 'dark' : 'light'} mode`}
      >
        {actualTheme === 'light' ? (
          <svg className={iconSizes[size]} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
            />
          </svg>
        ) : (
          <svg className={iconSizes[size]} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
            />
          </svg>
        )}
      </button>
      {showLabel && (
        <span className="text-sm text-gray-600 dark:text-gray-400 capitalize">
          {actualTheme}
        </span>
      )}
    </div>
  )
}

// Theme selector dropdown
interface ThemeSelectorProps {
  className?: string
}

export function ThemeSelector({ className = '' }: ThemeSelectorProps) {
  const { theme, setTheme } = useTheme()
  const [isOpen, setIsOpen] = useState(false)

  const themes: { value: Theme; label: string; icon: React.ReactNode }[] = [
    {
      value: 'light',
      label: 'Light',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
      ),
    },
    {
      value: 'dark',
      label: 'Dark',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
          />
        </svg>
      ),
    },
    {
      value: 'system',
      label: 'System',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        </svg>
      ),
    },
  ]

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
      >
        {themes.find((t) => t.value === theme)?.icon}
        <span className="text-sm">{themes.find((t) => t.value === theme)?.label}</span>
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-40 py-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-20">
            {themes.map((t) => (
              <button
                key={t.value}
                onClick={() => {
                  setTheme(t.value)
                  setIsOpen(false)
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 ${
                  theme === t.value ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'
                }`}
              >
                {t.icon}
                <span className="text-sm">{t.label}</span>
                {theme === t.value && (
                  <svg className="w-4 h-4 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// Warehouse-specific dark theme styles
export const warehouseDarkTheme = `
  .warehouse-theme {
    --bg-primary: #0f172a;
    --bg-secondary: #1e293b;
    --bg-tertiary: #334155;
    --text-primary: #f1f5f9;
    --text-secondary: #94a3b8;
    --text-muted: #64748b;
    --border-color: #334155;
    --accent-color: #3b82f6;
    --success-color: #22c55e;
    --warning-color: #f59e0b;
    --error-color: #ef4444;
  }

  .warehouse-theme.dark {
    background-color: var(--bg-primary);
    color: var(--text-primary);
  }

  .warehouse-theme.dark .card {
    background-color: var(--bg-secondary);
    border-color: var(--border-color);
  }

  .warehouse-theme.dark .scanner-overlay {
    background-color: rgba(0, 0, 0, 0.9);
  }

  .warehouse-theme.dark .scan-indicator {
    border-color: var(--accent-color);
    box-shadow: 0 0 20px rgba(59, 130, 246, 0.5);
  }

  .warehouse-theme.dark input,
  .warehouse-theme.dark select {
    background-color: var(--bg-tertiary);
    border-color: var(--border-color);
    color: var(--text-primary);
  }

  .warehouse-theme.dark button.primary {
    background-color: var(--accent-color);
  }

  .warehouse-theme.dark .status-success {
    color: var(--success-color);
  }

  .warehouse-theme.dark .status-warning {
    color: var(--warning-color);
  }

  .warehouse-theme.dark .status-error {
    color: var(--error-color);
  }
`
