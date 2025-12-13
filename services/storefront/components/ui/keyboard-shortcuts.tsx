'use client'

import { createContext, useContext, useEffect, useCallback, useState, useRef } from 'react'
import { createPortal } from 'react-dom'

// Shortcut definition
interface Shortcut {
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  meta?: boolean
  description: string
  category?: string
  action: () => void
  global?: boolean // Works even when input is focused
}

// Context for managing shortcuts
interface ShortcutsContextType {
  registerShortcut: (id: string, shortcut: Shortcut) => void
  unregisterShortcut: (id: string) => void
  isHelpOpen: boolean
  openHelp: () => void
  closeHelp: () => void
  toggleHelp: () => void
}

const ShortcutsContext = createContext<ShortcutsContextType | undefined>(undefined)

// Hook for registering shortcuts
export function useShortcut(id: string, shortcut: Shortcut) {
  const context = useContext(ShortcutsContext)

  useEffect(() => {
    if (!context) return

    context.registerShortcut(id, shortcut)
    return () => context.unregisterShortcut(id)
  }, [id, shortcut, context])
}

// Hook for using shortcuts context
export function useShortcuts() {
  const context = useContext(ShortcutsContext)
  if (!context) {
    throw new Error('useShortcuts must be used within a ShortcutsProvider')
  }
  return context
}

// Provider component
interface ShortcutsProviderProps {
  children: React.ReactNode
}

export function ShortcutsProvider({ children }: ShortcutsProviderProps) {
  const [shortcuts, setShortcuts] = useState<Map<string, Shortcut>>(new Map())
  const [isHelpOpen, setIsHelpOpen] = useState(false)
  const shortcutsRef = useRef(shortcuts)

  // Keep ref in sync
  useEffect(() => {
    shortcutsRef.current = shortcuts
  }, [shortcuts])

  const registerShortcut = useCallback((id: string, shortcut: Shortcut) => {
    setShortcuts((prev) => new Map(prev).set(id, shortcut))
  }, [])

  const unregisterShortcut = useCallback((id: string) => {
    setShortcuts((prev) => {
      const next = new Map(prev)
      next.delete(id)
      return next
    })
  }, [])

  const openHelp = useCallback(() => setIsHelpOpen(true), [])
  const closeHelp = useCallback(() => setIsHelpOpen(false), [])
  const toggleHelp = useCallback(() => setIsHelpOpen((prev) => !prev), [])

  // Global keyboard listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs (unless global)
      const target = e.target as HTMLElement
      const isInput = target.tagName === 'INPUT' ||
                      target.tagName === 'TEXTAREA' ||
                      target.isContentEditable

      // Built-in: ? for help
      if (e.key === '?' && !isInput) {
        e.preventDefault()
        toggleHelp()
        return
      }

      // Built-in: Escape to close help
      if (e.key === 'Escape' && isHelpOpen) {
        e.preventDefault()
        closeHelp()
        return
      }

      // Check registered shortcuts
      for (const [, shortcut] of shortcutsRef.current) {
        if (isInput && !shortcut.global) continue

        const keyMatches = e.key.toLowerCase() === shortcut.key.toLowerCase()
        const ctrlMatches = !!shortcut.ctrl === (e.ctrlKey || e.metaKey)
        const shiftMatches = !!shortcut.shift === e.shiftKey
        const altMatches = !!shortcut.alt === e.altKey

        if (keyMatches && ctrlMatches && shiftMatches && altMatches) {
          e.preventDefault()
          shortcut.action()
          return
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isHelpOpen, toggleHelp, closeHelp])

  return (
    <ShortcutsContext.Provider
      value={{
        registerShortcut,
        unregisterShortcut,
        isHelpOpen,
        openHelp,
        closeHelp,
        toggleHelp,
      }}
    >
      {children}
      {isHelpOpen && <ShortcutsHelp shortcuts={shortcuts} onClose={closeHelp} />}
    </ShortcutsContext.Provider>
  )
}

// Shortcuts help modal
interface ShortcutsHelpProps {
  shortcuts: Map<string, Shortcut>
  onClose: () => void
}

function ShortcutsHelp({ shortcuts, onClose }: ShortcutsHelpProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  // Group shortcuts by category
  const grouped = Array.from(shortcuts.values()).reduce((acc, shortcut) => {
    const category = shortcut.category || 'General'
    if (!acc[category]) acc[category] = []
    acc[category].push(shortcut)
    return acc
  }, {} as Record<string, Shortcut[]>)

  // Format key combination
  const formatKey = (shortcut: Shortcut) => {
    const parts: string[] = []
    if (shortcut.ctrl || shortcut.meta) parts.push('Ctrl')
    if (shortcut.shift) parts.push('Shift')
    if (shortcut.alt) parts.push('Alt')
    parts.push(shortcut.key.toUpperCase())
    return parts
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Keyboard Shortcuts
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {Object.entries(grouped).map(([category, categoryShortcuts]) => (
            <div key={category} className="mb-6 last:mb-0">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                {category}
              </h3>
              <div className="space-y-2">
                {categoryShortcuts.map((shortcut, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between py-2"
                  >
                    <span className="text-gray-700 dark:text-gray-300">
                      {shortcut.description}
                    </span>
                    <div className="flex items-center gap-1">
                      {formatKey(shortcut).map((key, i) => (
                        <span key={i}>
                          {i > 0 && <span className="text-gray-400 mx-1">+</span>}
                          <kbd className="px-2 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded">
                            {key}
                          </kbd>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Built-in shortcuts */}
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
              Built-in
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between py-2">
                <span className="text-gray-700 dark:text-gray-300">Show this help</span>
                <kbd className="px-2 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded">
                  ?
                </kbd>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-gray-700 dark:text-gray-300">Close modal / Cancel</span>
                <kbd className="px-2 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded">
                  ESC
                </kbd>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            Press <kbd className="px-1 py-0.5 text-xs bg-gray-200 dark:bg-gray-700 rounded">?</kbd> anytime to show this help
          </p>
        </div>
      </div>
    </div>,
    document.body
  )
}

// Command palette component (Ctrl+K style)
interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  commands: Command[]
  placeholder?: string
}

interface Command {
  id: string
  name: string
  description?: string
  icon?: React.ReactNode
  shortcut?: string
  category?: string
  action: () => void
}

export function CommandPalette({ isOpen, onClose, commands, placeholder = 'Search commands...' }: CommandPaletteProps) {
  const [search, setSearch] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setSearch('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  // Filter commands
  const filteredCommands = commands.filter((cmd) =>
    cmd.name.toLowerCase().includes(search.toLowerCase()) ||
    cmd.description?.toLowerCase().includes(search.toLowerCase())
  )

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.min(prev + 1, filteredCommands.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.max(prev - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].action()
          onClose()
        }
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, filteredCommands, selectedIndex, onClose])

  // Reset selection when search changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [search])

  if (!mounted || !isOpen) return null

  // Group by category
  const grouped = filteredCommands.reduce((acc, cmd) => {
    const category = cmd.category || 'Actions'
    if (!acc[category]) acc[category] = []
    acc[category].push(cmd)
    return acc
  }, {} as Record<string, Command[]>)

  let currentIndex = -1

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Palette */}
      <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-xl mx-4 overflow-hidden">
        {/* Search input */}
        <div className="flex items-center px-4 border-b border-gray-200 dark:border-gray-700">
          <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={placeholder}
            className="w-full px-4 py-4 bg-transparent border-0 outline-none text-gray-900 dark:text-white placeholder-gray-400"
          />
          <kbd className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-96 overflow-y-auto p-2">
          {filteredCommands.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
              No commands found
            </div>
          ) : (
            Object.entries(grouped).map(([category, categoryCommands]) => (
              <div key={category}>
                <div className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  {category}
                </div>
                {categoryCommands.map((cmd) => {
                  currentIndex++
                  const index = currentIndex
                  return (
                    <button
                      key={cmd.id}
                      onClick={() => {
                        cmd.action()
                        onClose()
                      }}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                        selectedIndex === index
                          ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {cmd.icon && <span className="w-5 h-5 flex-shrink-0">{cmd.icon}</span>}
                      <div className="flex-1 text-left">
                        <div className="font-medium">{cmd.name}</div>
                        {cmd.description && (
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {cmd.description}
                          </div>
                        )}
                      </div>
                      {cmd.shortcut && (
                        <kbd className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded">
                          {cmd.shortcut}
                        </kbd>
                      )}
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">Enter</kbd> to select
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">↑↓</kbd> to navigate
          </span>
        </div>
      </div>
    </div>,
    document.body
  )
}

// Pre-defined admin shortcuts
export const adminShortcuts: Shortcut[] = [
  {
    key: 'k',
    ctrl: true,
    description: 'Open command palette',
    category: 'Navigation',
    action: () => {}, // Set by component
    global: true,
  },
  {
    key: 'n',
    ctrl: false,
    description: 'New order',
    category: 'Actions',
    action: () => {}, // Set by component
  },
  {
    key: 'p',
    description: 'Go to products',
    category: 'Navigation',
    action: () => {}, // Set by component
  },
  {
    key: 'o',
    description: 'Go to orders',
    category: 'Navigation',
    action: () => {}, // Set by component
  },
  {
    key: 's',
    ctrl: true,
    description: 'Save changes',
    category: 'Actions',
    action: () => {}, // Set by component
    global: true,
  },
  {
    key: '/',
    description: 'Focus search',
    category: 'Navigation',
    action: () => {
      const searchInput = document.querySelector('[data-search]') as HTMLInputElement
      searchInput?.focus()
    },
  },
]
