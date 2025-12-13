'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'

// Tour step definition
interface TourStep {
  target: string // CSS selector
  title: string
  content: string
  position?: 'top' | 'bottom' | 'left' | 'right'
  highlightPadding?: number
  action?: () => void
  showSkip?: boolean
  showBack?: boolean
}

// Tour configuration
interface TourConfig {
  id: string
  steps: TourStep[]
  onComplete?: () => void
  onSkip?: () => void
  showProgress?: boolean
  showStepNumbers?: boolean
  overlayOpacity?: number
}

// Hook for managing tour state
export function useTour(tourId: string) {
  const [isActive, setIsActive] = useState(false)
  const [hasCompleted, setHasCompleted] = useState(false)

  useEffect(() => {
    const completed = localStorage.getItem(`tour_${tourId}_completed`)
    setHasCompleted(completed === 'true')
  }, [tourId])

  const startTour = useCallback(() => {
    setIsActive(true)
  }, [])

  const endTour = useCallback((completed: boolean = false) => {
    setIsActive(false)
    if (completed) {
      localStorage.setItem(`tour_${tourId}_completed`, 'true')
      setHasCompleted(true)
    }
  }, [tourId])

  const resetTour = useCallback(() => {
    localStorage.removeItem(`tour_${tourId}_completed`)
    setHasCompleted(false)
  }, [tourId])

  return {
    isActive,
    hasCompleted,
    startTour,
    endTour,
    resetTour,
  }
}

// Main Tour component
interface TourProps {
  config: TourConfig
  isActive: boolean
  onEnd: (completed: boolean) => void
}

export function Tour({ config, isActive, onEnd }: TourProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  const [mounted, setMounted] = useState(false)
  const tooltipRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Find and highlight target element
  useEffect(() => {
    if (!isActive) return

    const step = config.steps[currentStep]
    if (!step) return

    const findTarget = () => {
      const target = document.querySelector(step.target)
      if (target) {
        const rect = target.getBoundingClientRect()
        setTargetRect(rect)

        // Scroll target into view if needed
        target.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }

    // Small delay to ensure DOM is ready
    const timer = setTimeout(findTarget, 100)
    return () => clearTimeout(timer)
  }, [isActive, currentStep, config.steps])

  // Handle keyboard navigation
  useEffect(() => {
    if (!isActive) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleSkip()
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        handleNext()
      } else if (e.key === 'ArrowLeft') {
        handleBack()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isActive, currentStep])

  const handleNext = () => {
    const step = config.steps[currentStep]
    if (step.action) {
      step.action()
    }

    if (currentStep < config.steps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      config.onComplete?.()
      onEnd(true)
    }
  }

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleSkip = () => {
    config.onSkip?.()
    onEnd(false)
  }

  if (!isActive || !mounted || !targetRect) return null

  const step = config.steps[currentStep]
  const padding = step.highlightPadding ?? 8

  // Calculate tooltip position
  const getTooltipPosition = () => {
    const position = step.position || 'bottom'
    const tooltipWidth = 320
    const tooltipHeight = 200
    const margin = 16

    let top = 0
    let left = 0

    switch (position) {
      case 'top':
        top = targetRect.top - tooltipHeight - margin
        left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2
        break
      case 'bottom':
        top = targetRect.bottom + margin
        left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2
        break
      case 'left':
        top = targetRect.top + targetRect.height / 2 - tooltipHeight / 2
        left = targetRect.left - tooltipWidth - margin
        break
      case 'right':
        top = targetRect.top + targetRect.height / 2 - tooltipHeight / 2
        left = targetRect.right + margin
        break
    }

    // Keep tooltip within viewport
    if (left < margin) left = margin
    if (left + tooltipWidth > window.innerWidth - margin) {
      left = window.innerWidth - tooltipWidth - margin
    }
    if (top < margin) top = margin
    if (top + tooltipHeight > window.innerHeight - margin) {
      top = window.innerHeight - tooltipHeight - margin
    }

    return { top, left }
  }

  const tooltipPosition = getTooltipPosition()

  return createPortal(
    <div className="tour-overlay fixed inset-0 z-[9999]">
      {/* Overlay with cutout for target */}
      <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }}>
        <defs>
          <mask id="tour-mask">
            <rect width="100%" height="100%" fill="white" />
            <rect
              x={targetRect.left - padding}
              y={targetRect.top - padding}
              width={targetRect.width + padding * 2}
              height={targetRect.height + padding * 2}
              rx="8"
              fill="black"
            />
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill={`rgba(0, 0, 0, ${config.overlayOpacity ?? 0.5})`}
          mask="url(#tour-mask)"
          style={{ pointerEvents: 'auto' }}
          onClick={(e) => e.stopPropagation()}
        />
      </svg>

      {/* Highlight border */}
      <div
        className="absolute border-2 border-blue-500 rounded-lg transition-all duration-300 pointer-events-none"
        style={{
          top: targetRect.top - padding,
          left: targetRect.left - padding,
          width: targetRect.width + padding * 2,
          height: targetRect.height + padding * 2,
          boxShadow: '0 0 0 4px rgba(59, 130, 246, 0.3)',
        }}
      />

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="absolute bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 w-80 transition-all duration-300"
        style={{
          top: tooltipPosition.top,
          left: tooltipPosition.left,
        }}
      >
        {/* Progress indicator */}
        {config.showProgress && (
          <div className="flex gap-1 mb-4">
            {config.steps.map((_, index) => (
              <div
                key={index}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  index <= currentStep ? 'bg-blue-500' : 'bg-gray-200 dark:bg-gray-700'
                }`}
              />
            ))}
          </div>
        )}

        {/* Step number */}
        {config.showStepNumbers && (
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">
            {currentStep + 1} / {config.steps.length}
          </div>
        )}

        {/* Title */}
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          {step.title}
        </h3>

        {/* Content */}
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          {step.content}
        </p>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            {step.showSkip !== false && (
              <button
                onClick={handleSkip}
                className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                Skip
              </button>
            )}
            {step.showBack !== false && currentStep > 0 && (
              <button
                onClick={handleBack}
                className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                Back
              </button>
            )}
          </div>
          <button
            onClick={handleNext}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium"
          >
            {currentStep === config.steps.length - 1 ? 'Done' : 'Next'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// Pre-defined tour for admin panel
export const adminOnboardingTour: TourConfig = {
  id: 'admin-onboarding',
  showProgress: true,
  showStepNumbers: true,
  steps: [
    {
      target: '[data-tour="dashboard"]',
      title: 'Dashboard',
      content: 'Here you can see all your key metrics at a glance - orders, revenue, and more.',
      position: 'bottom',
    },
    {
      target: '[data-tour="products"]',
      title: 'Products',
      content: 'Manage your product catalog here. Add, edit, or remove products.',
      position: 'right',
    },
    {
      target: '[data-tour="orders"]',
      title: 'Orders',
      content: 'View and manage all customer orders. Process shipments and handle returns.',
      position: 'right',
    },
    {
      target: '[data-tour="customers"]',
      title: 'Customers',
      content: 'See your customer list and their purchase history.',
      position: 'right',
    },
    {
      target: '[data-tour="analytics"]',
      title: 'Analytics',
      content: 'Detailed reports and insights about your store performance.',
      position: 'right',
    },
    {
      target: '[data-tour="settings"]',
      title: 'Settings',
      content: 'Configure your store settings, payment methods, and integrations.',
      position: 'top',
    },
    {
      target: '[data-tour="telegram"]',
      title: 'Connect Telegram',
      content: 'Click here to connect your Telegram bot for instant order notifications.',
      position: 'left',
    },
  ],
}

// Pre-defined tour for warehouse
export const warehouseOnboardingTour: TourConfig = {
  id: 'warehouse-onboarding',
  showProgress: true,
  steps: [
    {
      target: '[data-tour="scan"]',
      title: 'Scan Items',
      content: 'Use your scanner or camera to quickly scan product barcodes.',
      position: 'bottom',
    },
    {
      target: '[data-tour="inventory"]',
      title: 'Inventory',
      content: 'View and update stock levels for all products.',
      position: 'right',
    },
    {
      target: '[data-tour="picking"]',
      title: 'Order Picking',
      content: 'See orders ready for picking and pack them efficiently.',
      position: 'right',
    },
    {
      target: '[data-tour="shipping"]',
      title: 'Shipping',
      content: 'Print shipping labels and mark orders as shipped.',
      position: 'right',
    },
  ],
}

// Onboarding wrapper component
interface OnboardingProviderProps {
  children: React.ReactNode
  tourConfig: TourConfig
  autoStart?: boolean
}

export function OnboardingProvider({ children, tourConfig, autoStart = false }: OnboardingProviderProps) {
  const { isActive, hasCompleted, startTour, endTour } = useTour(tourConfig.id)

  useEffect(() => {
    if (autoStart && !hasCompleted) {
      // Small delay to ensure page is ready
      const timer = setTimeout(startTour, 1000)
      return () => clearTimeout(timer)
    }
  }, [autoStart, hasCompleted, startTour])

  return (
    <>
      {children}
      <Tour config={tourConfig} isActive={isActive} onEnd={endTour} />
    </>
  )
}
