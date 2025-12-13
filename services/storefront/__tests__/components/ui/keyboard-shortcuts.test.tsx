import React from 'react'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import {
  ShortcutsProvider,
  useShortcut,
  useShortcuts,
  CommandPalette,
  ShortcutsHelp,
  parseShortcut,
  formatShortcut,
} from '@/components/ui/keyboard-shortcuts'

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

// Test component that uses useShortcut
function TestComponent({ callback }: { callback: () => void }) {
  useShortcut({ key: 'k', ctrl: true }, callback, 'Test shortcut')
  return <div>Test Component</div>
}

// Test component for multiple shortcuts
function MultiShortcutComponent({ callbacks }: { callbacks: Record<string, () => void> }) {
  useShortcut({ key: 'k', ctrl: true }, callbacks.search, 'Search')
  useShortcut({ key: 'n', ctrl: true }, callbacks.new, 'New item')
  useShortcut({ key: 's', ctrl: true }, callbacks.save, 'Save')
  return <div>Multi Shortcut Component</div>
}

describe('ShortcutsProvider', () => {
  it('renders children', () => {
    render(
      <ShortcutsProvider>
        <div data-testid="child">Child content</div>
      </ShortcutsProvider>
    )

    expect(screen.getByTestId('child')).toBeInTheDocument()
  })

  it('provides shortcuts context', () => {
    function ContextConsumer() {
      const shortcuts = useShortcuts()
      return <span data-testid="context">{shortcuts ? 'has context' : 'no context'}</span>
    }

    render(
      <ShortcutsProvider>
        <ContextConsumer />
      </ShortcutsProvider>
    )

    expect(screen.getByTestId('context')).toHaveTextContent('has context')
  })
})

describe('useShortcut', () => {
  it('registers and triggers shortcut', () => {
    const callback = jest.fn()

    render(
      <ShortcutsProvider>
        <TestComponent callback={callback} />
      </ShortcutsProvider>
    )

    // Trigger Ctrl+K
    act(() => {
      fireEvent.keyDown(document, { key: 'k', ctrlKey: true })
    })

    expect(callback).toHaveBeenCalled()
  })

  it('does not trigger without modifier', () => {
    const callback = jest.fn()

    render(
      <ShortcutsProvider>
        <TestComponent callback={callback} />
      </ShortcutsProvider>
    )

    // Trigger just K without Ctrl
    act(() => {
      fireEvent.keyDown(document, { key: 'k', ctrlKey: false })
    })

    expect(callback).not.toHaveBeenCalled()
  })

  it('handles multiple shortcuts', () => {
    const callbacks = {
      search: jest.fn(),
      new: jest.fn(),
      save: jest.fn(),
    }

    render(
      <ShortcutsProvider>
        <MultiShortcutComponent callbacks={callbacks} />
      </ShortcutsProvider>
    )

    // Trigger Ctrl+K
    act(() => {
      fireEvent.keyDown(document, { key: 'k', ctrlKey: true })
    })
    expect(callbacks.search).toHaveBeenCalled()

    // Trigger Ctrl+N
    act(() => {
      fireEvent.keyDown(document, { key: 'n', ctrlKey: true })
    })
    expect(callbacks.new).toHaveBeenCalled()

    // Trigger Ctrl+S
    act(() => {
      fireEvent.keyDown(document, { key: 's', ctrlKey: true })
    })
    expect(callbacks.save).toHaveBeenCalled()
  })

  it('unregisters shortcut on unmount', () => {
    const callback = jest.fn()

    const { unmount } = render(
      <ShortcutsProvider>
        <TestComponent callback={callback} />
      </ShortcutsProvider>
    )

    unmount()

    // Shortcut should no longer work after unmount
    act(() => {
      fireEvent.keyDown(document, { key: 'k', ctrlKey: true })
    })

    expect(callback).not.toHaveBeenCalled()
  })

  it('prevents default when shortcut matches', () => {
    const callback = jest.fn()

    render(
      <ShortcutsProvider>
        <TestComponent callback={callback} />
      </ShortcutsProvider>
    )

    const event = new KeyboardEvent('keydown', {
      key: 'k',
      ctrlKey: true,
      bubbles: true,
    })
    const preventDefaultSpy = jest.spyOn(event, 'preventDefault')

    act(() => {
      document.dispatchEvent(event)
    })

    expect(preventDefaultSpy).toHaveBeenCalled()
  })

  it('does not trigger when focused on input', () => {
    const callback = jest.fn()

    render(
      <ShortcutsProvider>
        <TestComponent callback={callback} />
        <input data-testid="input" />
      </ShortcutsProvider>
    )

    const input = screen.getByTestId('input')
    input.focus()

    act(() => {
      fireEvent.keyDown(input, { key: 'k', ctrlKey: true })
    })

    // Callback should not be triggered when typing in input
    expect(callback).not.toHaveBeenCalled()
  })
})

describe('parseShortcut', () => {
  it('parses simple key', () => {
    const result = parseShortcut('k')
    expect(result).toEqual({ key: 'k' })
  })

  it('parses Ctrl modifier', () => {
    const result = parseShortcut('ctrl+k')
    expect(result).toEqual({ key: 'k', ctrl: true })
  })

  it('parses Meta/Cmd modifier', () => {
    const result = parseShortcut('meta+k')
    expect(result).toEqual({ key: 'k', meta: true })
  })

  it('parses Shift modifier', () => {
    const result = parseShortcut('shift+k')
    expect(result).toEqual({ key: 'k', shift: true })
  })

  it('parses Alt modifier', () => {
    const result = parseShortcut('alt+k')
    expect(result).toEqual({ key: 'k', alt: true })
  })

  it('parses multiple modifiers', () => {
    const result = parseShortcut('ctrl+shift+k')
    expect(result).toEqual({ key: 'k', ctrl: true, shift: true })
  })

  it('handles case insensitivity', () => {
    const result = parseShortcut('CTRL+K')
    expect(result).toEqual({ key: 'k', ctrl: true })
  })

  it('parses special keys', () => {
    expect(parseShortcut('Enter')).toEqual({ key: 'enter' })
    expect(parseShortcut('Escape')).toEqual({ key: 'escape' })
    expect(parseShortcut('ArrowUp')).toEqual({ key: 'arrowup' })
  })
})

describe('formatShortcut', () => {
  // Mock navigator.platform for Mac detection
  const originalPlatform = navigator.platform

  afterEach(() => {
    Object.defineProperty(navigator, 'platform', {
      value: originalPlatform,
      writable: true,
    })
  })

  it('formats simple key', () => {
    const result = formatShortcut({ key: 'k' })
    expect(result).toBe('K')
  })

  it('formats Ctrl modifier on non-Mac', () => {
    Object.defineProperty(navigator, 'platform', { value: 'Win32', writable: true })
    const result = formatShortcut({ key: 'k', ctrl: true })
    expect(result).toBe('Ctrl+K')
  })

  it('formats Ctrl as Cmd on Mac', () => {
    Object.defineProperty(navigator, 'platform', { value: 'MacIntel', writable: true })
    const result = formatShortcut({ key: 'k', ctrl: true })
    expect(result).toContain('K')
  })

  it('formats multiple modifiers', () => {
    Object.defineProperty(navigator, 'platform', { value: 'Win32', writable: true })
    const result = formatShortcut({ key: 'k', ctrl: true, shift: true })
    expect(result).toBe('Ctrl+Shift+K')
  })
})

describe('CommandPalette', () => {
  beforeEach(() => {
    localStorageMock.clear()
  })

  it('is closed by default', () => {
    render(
      <ShortcutsProvider>
        <CommandPalette />
      </ShortcutsProvider>
    )

    expect(screen.queryByPlaceholderText(/search/i)).not.toBeInTheDocument()
  })

  it('opens with Ctrl+K', () => {
    render(
      <ShortcutsProvider>
        <CommandPalette />
      </ShortcutsProvider>
    )

    act(() => {
      fireEvent.keyDown(document, { key: 'k', ctrlKey: true })
    })

    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument()
  })

  it('closes with Escape', async () => {
    render(
      <ShortcutsProvider>
        <CommandPalette />
      </ShortcutsProvider>
    )

    // Open
    act(() => {
      fireEvent.keyDown(document, { key: 'k', ctrlKey: true })
    })

    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument()

    // Close
    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' })
    })

    await waitFor(() => {
      expect(screen.queryByPlaceholderText(/search/i)).not.toBeInTheDocument()
    })
  })

  it('filters commands based on search query', () => {
    const commands = [
      { id: '1', name: 'Search products', action: jest.fn() },
      { id: '2', name: 'Create order', action: jest.fn() },
      { id: '3', name: 'View customers', action: jest.fn() },
    ]

    render(
      <ShortcutsProvider>
        <CommandPalette commands={commands} />
      </ShortcutsProvider>
    )

    // Open
    act(() => {
      fireEvent.keyDown(document, { key: 'k', ctrlKey: true })
    })

    const input = screen.getByPlaceholderText(/search/i)

    act(() => {
      fireEvent.change(input, { target: { value: 'order' } })
    })

    expect(screen.getByText('Create order')).toBeInTheDocument()
    expect(screen.queryByText('Search products')).not.toBeInTheDocument()
    expect(screen.queryByText('View customers')).not.toBeInTheDocument()
  })

  it('executes command on selection', () => {
    const action = jest.fn()
    const commands = [
      { id: '1', name: 'Test command', action },
    ]

    render(
      <ShortcutsProvider>
        <CommandPalette commands={commands} />
      </ShortcutsProvider>
    )

    // Open
    act(() => {
      fireEvent.keyDown(document, { key: 'k', ctrlKey: true })
    })

    // Click command
    act(() => {
      fireEvent.click(screen.getByText('Test command'))
    })

    expect(action).toHaveBeenCalled()
  })

  it('navigates with arrow keys', () => {
    const commands = [
      { id: '1', name: 'Command 1', action: jest.fn() },
      { id: '2', name: 'Command 2', action: jest.fn() },
      { id: '3', name: 'Command 3', action: jest.fn() },
    ]

    render(
      <ShortcutsProvider>
        <CommandPalette commands={commands} />
      </ShortcutsProvider>
    )

    // Open
    act(() => {
      fireEvent.keyDown(document, { key: 'k', ctrlKey: true })
    })

    const input = screen.getByPlaceholderText(/search/i)

    // Navigate down
    act(() => {
      fireEvent.keyDown(input, { key: 'ArrowDown' })
    })

    // First item should be selected
    const firstItem = screen.getByText('Command 1').closest('button')
    expect(firstItem?.className).toContain('bg-')

    // Navigate down again
    act(() => {
      fireEvent.keyDown(input, { key: 'ArrowDown' })
    })

    // Second item should be selected
    const secondItem = screen.getByText('Command 2').closest('button')
    expect(secondItem?.className).toContain('bg-')
  })

  it('executes selected command with Enter', () => {
    const action = jest.fn()
    const commands = [
      { id: '1', name: 'Test command', action },
    ]

    render(
      <ShortcutsProvider>
        <CommandPalette commands={commands} />
      </ShortcutsProvider>
    )

    // Open
    act(() => {
      fireEvent.keyDown(document, { key: 'k', ctrlKey: true })
    })

    const input = screen.getByPlaceholderText(/search/i)

    // Select first item
    act(() => {
      fireEvent.keyDown(input, { key: 'ArrowDown' })
    })

    // Press Enter
    act(() => {
      fireEvent.keyDown(input, { key: 'Enter' })
    })

    expect(action).toHaveBeenCalled()
  })
})

describe('ShortcutsHelp', () => {
  it('is closed by default', () => {
    render(
      <ShortcutsProvider>
        <ShortcutsHelp />
      </ShortcutsProvider>
    )

    expect(screen.queryByText(/keyboard shortcuts/i)).not.toBeInTheDocument()
  })

  it('opens with ? key', () => {
    render(
      <ShortcutsProvider>
        <ShortcutsHelp />
      </ShortcutsProvider>
    )

    act(() => {
      fireEvent.keyDown(document, { key: '?' })
    })

    expect(screen.getByText(/keyboard shortcuts/i)).toBeInTheDocument()
  })

  it('displays registered shortcuts', () => {
    function ComponentWithShortcuts() {
      useShortcut({ key: 'k', ctrl: true }, () => {}, 'Open search')
      useShortcut({ key: 'n' }, () => {}, 'Create new')
      return null
    }

    render(
      <ShortcutsProvider>
        <ComponentWithShortcuts />
        <ShortcutsHelp />
      </ShortcutsProvider>
    )

    act(() => {
      fireEvent.keyDown(document, { key: '?' })
    })

    expect(screen.getByText('Open search')).toBeInTheDocument()
    expect(screen.getByText('Create new')).toBeInTheDocument()
  })

  it('closes with Escape', async () => {
    render(
      <ShortcutsProvider>
        <ShortcutsHelp />
      </ShortcutsProvider>
    )

    // Open
    act(() => {
      fireEvent.keyDown(document, { key: '?' })
    })

    expect(screen.getByText(/keyboard shortcuts/i)).toBeInTheDocument()

    // Close
    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' })
    })

    await waitFor(() => {
      expect(screen.queryByText(/keyboard shortcuts/i)).not.toBeInTheDocument()
    })
  })

  it('closes when clicking close button', async () => {
    render(
      <ShortcutsProvider>
        <ShortcutsHelp />
      </ShortcutsProvider>
    )

    // Open
    act(() => {
      fireEvent.keyDown(document, { key: '?' })
    })

    // Find and click close button
    const closeButton = screen.getByRole('button', { name: /close/i })
    act(() => {
      fireEvent.click(closeButton)
    })

    await waitFor(() => {
      expect(screen.queryByText(/keyboard shortcuts/i)).not.toBeInTheDocument()
    })
  })
})

describe('Shortcut with modifiers', () => {
  it('handles Shift modifier', () => {
    const callback = jest.fn()

    function ShiftComponent() {
      useShortcut({ key: 'p', ctrl: true, shift: true }, callback, 'Print')
      return null
    }

    render(
      <ShortcutsProvider>
        <ShiftComponent />
      </ShortcutsProvider>
    )

    // Without shift - should not trigger
    act(() => {
      fireEvent.keyDown(document, { key: 'p', ctrlKey: true, shiftKey: false })
    })
    expect(callback).not.toHaveBeenCalled()

    // With shift - should trigger
    act(() => {
      fireEvent.keyDown(document, { key: 'p', ctrlKey: true, shiftKey: true })
    })
    expect(callback).toHaveBeenCalled()
  })

  it('handles Alt modifier', () => {
    const callback = jest.fn()

    function AltComponent() {
      useShortcut({ key: 't', alt: true }, callback, 'Toggle')
      return null
    }

    render(
      <ShortcutsProvider>
        <AltComponent />
      </ShortcutsProvider>
    )

    act(() => {
      fireEvent.keyDown(document, { key: 't', altKey: true })
    })

    expect(callback).toHaveBeenCalled()
  })

  it('handles Meta/Cmd modifier', () => {
    const callback = jest.fn()

    function MetaComponent() {
      useShortcut({ key: 'b', meta: true }, callback, 'Bold')
      return null
    }

    render(
      <ShortcutsProvider>
        <MetaComponent />
      </ShortcutsProvider>
    )

    act(() => {
      fireEvent.keyDown(document, { key: 'b', metaKey: true })
    })

    expect(callback).toHaveBeenCalled()
  })
})
