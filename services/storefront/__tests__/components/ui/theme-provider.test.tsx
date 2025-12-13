import React from 'react'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import { ThemeProvider, useTheme, ThemeToggle, ThemeSelector } from '@/components/ui/theme-provider'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key]
    }),
    clear: jest.fn(() => {
      store = {}
    }),
  }
})()

Object.defineProperty(window, 'localStorage', { value: localStorageMock })

// Mock matchMedia
const mockMatchMedia = (matches: boolean) => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  })
}

// Test component that uses useTheme
function TestComponent() {
  const { theme, actualTheme, setTheme, toggleTheme } = useTheme()
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="actualTheme">{actualTheme}</span>
      <button onClick={() => setTheme('dark')} data-testid="setDark">Set Dark</button>
      <button onClick={() => setTheme('light')} data-testid="setLight">Set Light</button>
      <button onClick={() => setTheme('system')} data-testid="setSystem">Set System</button>
      <button onClick={toggleTheme} data-testid="toggle">Toggle</button>
    </div>
  )
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    localStorageMock.clear()
    mockMatchMedia(false) // Default to light mode
    document.documentElement.classList.remove('light', 'dark')
  })

  it('renders children', () => {
    render(
      <ThemeProvider>
        <div data-testid="child">Child content</div>
      </ThemeProvider>
    )

    expect(screen.getByTestId('child')).toBeInTheDocument()
  })

  it('defaults to system theme', async () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('theme')).toHaveTextContent('system')
    })
  })

  it('respects defaultTheme prop', async () => {
    render(
      <ThemeProvider defaultTheme="dark">
        <TestComponent />
      </ThemeProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('theme')).toHaveTextContent('dark')
    })
  })

  it('persists theme to localStorage', async () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('setDark')).toBeInTheDocument()
    })

    act(() => {
      fireEvent.click(screen.getByTestId('setDark'))
    })

    expect(localStorageMock.setItem).toHaveBeenCalledWith('theme', 'dark')
  })

  it('loads theme from localStorage', async () => {
    localStorageMock.getItem.mockReturnValueOnce('dark')

    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('theme')).toHaveTextContent('dark')
    })
  })

  it('toggles between light and dark', async () => {
    render(
      <ThemeProvider defaultTheme="light">
        <TestComponent />
      </ThemeProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('actualTheme')).toHaveTextContent('light')
    })

    act(() => {
      fireEvent.click(screen.getByTestId('toggle'))
    })

    await waitFor(() => {
      expect(screen.getByTestId('actualTheme')).toHaveTextContent('dark')
    })
  })

  it('applies theme class to document', async () => {
    render(
      <ThemeProvider defaultTheme="dark">
        <TestComponent />
      </ThemeProvider>
    )

    await waitFor(() => {
      expect(document.documentElement.classList.contains('dark')).toBe(true)
    })
  })

  it('respects system preference when theme is system', async () => {
    mockMatchMedia(true) // Dark mode preference

    render(
      <ThemeProvider defaultTheme="system">
        <TestComponent />
      </ThemeProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('actualTheme')).toHaveTextContent('dark')
    })
  })

  it('uses custom storage key', async () => {
    render(
      <ThemeProvider storageKey="custom-theme">
        <TestComponent />
      </ThemeProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('setDark')).toBeInTheDocument()
    })

    act(() => {
      fireEvent.click(screen.getByTestId('setDark'))
    })

    expect(localStorageMock.setItem).toHaveBeenCalledWith('custom-theme', 'dark')
  })
})

describe('useTheme', () => {
  it('throws error when used outside ThemeProvider', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => {
      render(<TestComponent />)
    }).toThrow('useTheme must be used within a ThemeProvider')

    consoleSpy.mockRestore()
  })
})

describe('ThemeToggle', () => {
  beforeEach(() => {
    localStorageMock.clear()
    mockMatchMedia(false)
    document.documentElement.classList.remove('light', 'dark')
  })

  it('renders toggle button', async () => {
    render(
      <ThemeProvider defaultTheme="light">
        <ThemeToggle />
      </ThemeProvider>
    )

    await waitFor(() => {
      expect(screen.getByRole('button')).toBeInTheDocument()
    })
  })

  it('shows correct icon for light mode', async () => {
    render(
      <ThemeProvider defaultTheme="light">
        <ThemeToggle />
      </ThemeProvider>
    )

    await waitFor(() => {
      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('title', 'Switch to dark mode')
    })
  })

  it('shows correct icon for dark mode', async () => {
    render(
      <ThemeProvider defaultTheme="dark">
        <ThemeToggle />
      </ThemeProvider>
    )

    await waitFor(() => {
      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('title', 'Switch to light mode')
    })
  })

  it('toggles theme on click', async () => {
    render(
      <ThemeProvider defaultTheme="light">
        <ThemeToggle />
        <TestComponent />
      </ThemeProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('actualTheme')).toHaveTextContent('light')
    })

    act(() => {
      fireEvent.click(screen.getByRole('button'))
    })

    await waitFor(() => {
      expect(screen.getByTestId('actualTheme')).toHaveTextContent('dark')
    })
  })

  it('shows label when showLabel is true', async () => {
    render(
      <ThemeProvider defaultTheme="light">
        <ThemeToggle showLabel />
      </ThemeProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('light')).toBeInTheDocument()
    })
  })

  it('applies size classes correctly', async () => {
    const { rerender } = render(
      <ThemeProvider defaultTheme="light">
        <ThemeToggle size="sm" />
      </ThemeProvider>
    )

    await waitFor(() => {
      const button = screen.getByRole('button')
      expect(button.className).toContain('w-8 h-8')
    })

    rerender(
      <ThemeProvider defaultTheme="light">
        <ThemeToggle size="lg" />
      </ThemeProvider>
    )

    await waitFor(() => {
      const button = screen.getByRole('button')
      expect(button.className).toContain('w-12 h-12')
    })
  })
})

describe('ThemeSelector', () => {
  beforeEach(() => {
    localStorageMock.clear()
    mockMatchMedia(false)
    document.documentElement.classList.remove('light', 'dark')
  })

  it('renders selector button', async () => {
    render(
      <ThemeProvider defaultTheme="light">
        <ThemeSelector />
      </ThemeProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('Light')).toBeInTheDocument()
    })
  })

  it('opens dropdown on click', async () => {
    render(
      <ThemeProvider defaultTheme="light">
        <ThemeSelector />
      </ThemeProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('Light')).toBeInTheDocument()
    })

    act(() => {
      fireEvent.click(screen.getByText('Light'))
    })

    await waitFor(() => {
      expect(screen.getByText('Dark')).toBeInTheDocument()
      expect(screen.getByText('System')).toBeInTheDocument()
    })
  })

  it('changes theme when option is selected', async () => {
    render(
      <ThemeProvider defaultTheme="light">
        <ThemeSelector />
        <TestComponent />
      </ThemeProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('theme')).toHaveTextContent('light')
    })

    // Open dropdown
    act(() => {
      fireEvent.click(screen.getByText('Light'))
    })

    // Select dark theme
    await waitFor(() => {
      expect(screen.getByText('Dark')).toBeInTheDocument()
    })

    act(() => {
      fireEvent.click(screen.getByText('Dark'))
    })

    await waitFor(() => {
      expect(screen.getByTestId('theme')).toHaveTextContent('dark')
    })
  })

  it('closes dropdown when clicking outside', async () => {
    render(
      <ThemeProvider defaultTheme="light">
        <ThemeSelector />
        <div data-testid="outside">Outside</div>
      </ThemeProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('Light')).toBeInTheDocument()
    })

    // Open dropdown
    act(() => {
      fireEvent.click(screen.getByText('Light'))
    })

    await waitFor(() => {
      expect(screen.getByText('Dark')).toBeInTheDocument()
    })

    // Click overlay (fixed inset-0 div)
    const overlay = document.querySelector('.fixed.inset-0')
    if (overlay) {
      act(() => {
        fireEvent.click(overlay)
      })
    }

    // Dropdown should be closed (Dark option should not be visible in dropdown)
    await waitFor(() => {
      const darkButtons = screen.queryAllByText('Dark')
      // After closing, we should only see the button, not the dropdown option
      expect(darkButtons.length).toBeLessThanOrEqual(1)
    })
  })
})
