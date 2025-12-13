import React from 'react'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import { Tour, useTour, OnboardingProvider, TourConfig } from '@/components/ui/onboarding-tour'

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

// Mock createPortal
jest.mock('react-dom', () => ({
  ...jest.requireActual('react-dom'),
  createPortal: (node: React.ReactNode) => node,
}))

// Mock scrollIntoView
Element.prototype.scrollIntoView = jest.fn()

// Mock getBoundingClientRect
const mockRect = {
  top: 100,
  left: 100,
  bottom: 200,
  right: 300,
  width: 200,
  height: 100,
  x: 100,
  y: 100,
  toJSON: () => {},
}

const testTourConfig: TourConfig = {
  id: 'test-tour',
  showProgress: true,
  showStepNumbers: true,
  steps: [
    {
      target: '[data-tour="step1"]',
      title: 'Step 1',
      content: 'This is the first step',
      position: 'bottom',
    },
    {
      target: '[data-tour="step2"]',
      title: 'Step 2',
      content: 'This is the second step',
      position: 'right',
    },
    {
      target: '[data-tour="step3"]',
      title: 'Step 3',
      content: 'This is the third step',
      position: 'left',
    },
  ],
}

// Test component for useTour hook
function TestHookComponent({ tourId }: { tourId: string }) {
  const { isActive, hasCompleted, startTour, endTour, resetTour } = useTour(tourId)

  return (
    <div>
      <span data-testid="isActive">{isActive.toString()}</span>
      <span data-testid="hasCompleted">{hasCompleted.toString()}</span>
      <button onClick={startTour} data-testid="start">Start</button>
      <button onClick={() => endTour(true)} data-testid="complete">Complete</button>
      <button onClick={() => endTour(false)} data-testid="skip">Skip</button>
      <button onClick={resetTour} data-testid="reset">Reset</button>
    </div>
  )
}

describe('useTour', () => {
  beforeEach(() => {
    localStorageMock.clear()
  })

  it('initializes with inactive state', () => {
    render(<TestHookComponent tourId="test" />)

    expect(screen.getByTestId('isActive')).toHaveTextContent('false')
    expect(screen.getByTestId('hasCompleted')).toHaveTextContent('false')
  })

  it('starts tour when startTour is called', () => {
    render(<TestHookComponent tourId="test" />)

    act(() => {
      fireEvent.click(screen.getByTestId('start'))
    })

    expect(screen.getByTestId('isActive')).toHaveTextContent('true')
  })

  it('ends tour and marks as completed', () => {
    render(<TestHookComponent tourId="test" />)

    act(() => {
      fireEvent.click(screen.getByTestId('start'))
    })

    act(() => {
      fireEvent.click(screen.getByTestId('complete'))
    })

    expect(screen.getByTestId('isActive')).toHaveTextContent('false')
    expect(screen.getByTestId('hasCompleted')).toHaveTextContent('true')
    expect(localStorageMock.setItem).toHaveBeenCalledWith('tour_test_completed', 'true')
  })

  it('ends tour without marking as completed when skipped', () => {
    render(<TestHookComponent tourId="test" />)

    act(() => {
      fireEvent.click(screen.getByTestId('start'))
    })

    act(() => {
      fireEvent.click(screen.getByTestId('skip'))
    })

    expect(screen.getByTestId('isActive')).toHaveTextContent('false')
    expect(screen.getByTestId('hasCompleted')).toHaveTextContent('false')
  })

  it('loads completed state from localStorage', () => {
    localStorageMock.getItem.mockReturnValueOnce('true')

    render(<TestHookComponent tourId="test" />)

    expect(screen.getByTestId('hasCompleted')).toHaveTextContent('true')
  })

  it('resets tour completion status', () => {
    localStorageMock.getItem.mockReturnValueOnce('true')

    render(<TestHookComponent tourId="test" />)

    act(() => {
      fireEvent.click(screen.getByTestId('reset'))
    })

    expect(localStorageMock.removeItem).toHaveBeenCalledWith('tour_test_completed')
    expect(screen.getByTestId('hasCompleted')).toHaveTextContent('false')
  })
})

describe('Tour', () => {
  beforeEach(() => {
    localStorageMock.clear()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('renders nothing when inactive', () => {
    const onEnd = jest.fn()

    const { container } = render(
      <Tour config={testTourConfig} isActive={false} onEnd={onEnd} />
    )

    expect(container.querySelector('.tour-overlay')).not.toBeInTheDocument()
  })

  it('renders tour overlay when active and target is found', async () => {
    const onEnd = jest.fn()

    // Add target element to DOM
    const targetDiv = document.createElement('div')
    targetDiv.setAttribute('data-tour', 'step1')
    targetDiv.getBoundingClientRect = jest.fn(() => mockRect as DOMRect)
    document.body.appendChild(targetDiv)

    render(
      <Tour config={testTourConfig} isActive={true} onEnd={onEnd} />
    )

    act(() => {
      jest.advanceTimersByTime(200)
    })

    await waitFor(() => {
      expect(screen.getByText('Step 1')).toBeInTheDocument()
      expect(screen.getByText('This is the first step')).toBeInTheDocument()
    })

    document.body.removeChild(targetDiv)
  })

  it('shows step numbers when configured', async () => {
    const onEnd = jest.fn()

    const targetDiv = document.createElement('div')
    targetDiv.setAttribute('data-tour', 'step1')
    targetDiv.getBoundingClientRect = jest.fn(() => mockRect as DOMRect)
    document.body.appendChild(targetDiv)

    render(
      <Tour config={testTourConfig} isActive={true} onEnd={onEnd} />
    )

    act(() => {
      jest.advanceTimersByTime(200)
    })

    await waitFor(() => {
      expect(screen.getByText('1 / 3')).toBeInTheDocument()
    })

    document.body.removeChild(targetDiv)
  })

  it('navigates to next step', async () => {
    const onEnd = jest.fn()

    // Create both target elements
    const target1 = document.createElement('div')
    target1.setAttribute('data-tour', 'step1')
    target1.getBoundingClientRect = jest.fn(() => mockRect as DOMRect)
    document.body.appendChild(target1)

    const target2 = document.createElement('div')
    target2.setAttribute('data-tour', 'step2')
    target2.getBoundingClientRect = jest.fn(() => mockRect as DOMRect)
    document.body.appendChild(target2)

    render(
      <Tour config={testTourConfig} isActive={true} onEnd={onEnd} />
    )

    act(() => {
      jest.advanceTimersByTime(200)
    })

    await waitFor(() => {
      expect(screen.getByText('Step 1')).toBeInTheDocument()
    })

    // Click Next
    act(() => {
      fireEvent.click(screen.getByText('Next'))
      jest.advanceTimersByTime(200)
    })

    await waitFor(() => {
      expect(screen.getByText('Step 2')).toBeInTheDocument()
    })

    document.body.removeChild(target1)
    document.body.removeChild(target2)
  })

  it('navigates back to previous step', async () => {
    const onEnd = jest.fn()

    const target1 = document.createElement('div')
    target1.setAttribute('data-tour', 'step1')
    target1.getBoundingClientRect = jest.fn(() => mockRect as DOMRect)
    document.body.appendChild(target1)

    const target2 = document.createElement('div')
    target2.setAttribute('data-tour', 'step2')
    target2.getBoundingClientRect = jest.fn(() => mockRect as DOMRect)
    document.body.appendChild(target2)

    render(
      <Tour config={testTourConfig} isActive={true} onEnd={onEnd} />
    )

    act(() => {
      jest.advanceTimersByTime(200)
    })

    // Go to step 2
    act(() => {
      fireEvent.click(screen.getByText('Next'))
      jest.advanceTimersByTime(200)
    })

    await waitFor(() => {
      expect(screen.getByText('Step 2')).toBeInTheDocument()
    })

    // Go back
    act(() => {
      fireEvent.click(screen.getByText('Back'))
      jest.advanceTimersByTime(200)
    })

    await waitFor(() => {
      expect(screen.getByText('Step 1')).toBeInTheDocument()
    })

    document.body.removeChild(target1)
    document.body.removeChild(target2)
  })

  it('calls onEnd with true when completing last step', async () => {
    const onEnd = jest.fn()
    const onComplete = jest.fn()

    const configWithCallback: TourConfig = {
      ...testTourConfig,
      steps: [testTourConfig.steps[0]],
      onComplete,
    }

    const target = document.createElement('div')
    target.setAttribute('data-tour', 'step1')
    target.getBoundingClientRect = jest.fn(() => mockRect as DOMRect)
    document.body.appendChild(target)

    render(
      <Tour config={configWithCallback} isActive={true} onEnd={onEnd} />
    )

    act(() => {
      jest.advanceTimersByTime(200)
    })

    await waitFor(() => {
      expect(screen.getByText('Done')).toBeInTheDocument()
    })

    act(() => {
      fireEvent.click(screen.getByText('Done'))
    })

    expect(onComplete).toHaveBeenCalled()
    expect(onEnd).toHaveBeenCalledWith(true)

    document.body.removeChild(target)
  })

  it('calls onEnd with false when skipping', async () => {
    const onEnd = jest.fn()
    const onSkip = jest.fn()

    const configWithCallback: TourConfig = {
      ...testTourConfig,
      onSkip,
    }

    const target = document.createElement('div')
    target.setAttribute('data-tour', 'step1')
    target.getBoundingClientRect = jest.fn(() => mockRect as DOMRect)
    document.body.appendChild(target)

    render(
      <Tour config={configWithCallback} isActive={true} onEnd={onEnd} />
    )

    act(() => {
      jest.advanceTimersByTime(200)
    })

    await waitFor(() => {
      expect(screen.getByText('Skip')).toBeInTheDocument()
    })

    act(() => {
      fireEvent.click(screen.getByText('Skip'))
    })

    expect(onSkip).toHaveBeenCalled()
    expect(onEnd).toHaveBeenCalledWith(false)

    document.body.removeChild(target)
  })

  it('handles keyboard navigation', async () => {
    const onEnd = jest.fn()

    const target = document.createElement('div')
    target.setAttribute('data-tour', 'step1')
    target.getBoundingClientRect = jest.fn(() => mockRect as DOMRect)
    document.body.appendChild(target)

    const target2 = document.createElement('div')
    target2.setAttribute('data-tour', 'step2')
    target2.getBoundingClientRect = jest.fn(() => mockRect as DOMRect)
    document.body.appendChild(target2)

    render(
      <Tour config={testTourConfig} isActive={true} onEnd={onEnd} />
    )

    act(() => {
      jest.advanceTimersByTime(200)
    })

    // Press ArrowRight to go next
    act(() => {
      fireEvent.keyDown(document, { key: 'ArrowRight' })
      jest.advanceTimersByTime(200)
    })

    await waitFor(() => {
      expect(screen.getByText('Step 2')).toBeInTheDocument()
    })

    // Press ArrowLeft to go back
    act(() => {
      fireEvent.keyDown(document, { key: 'ArrowLeft' })
      jest.advanceTimersByTime(200)
    })

    await waitFor(() => {
      expect(screen.getByText('Step 1')).toBeInTheDocument()
    })

    // Press Escape to skip
    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' })
    })

    expect(onEnd).toHaveBeenCalledWith(false)

    document.body.removeChild(target)
    document.body.removeChild(target2)
  })
})

describe('OnboardingProvider', () => {
  beforeEach(() => {
    localStorageMock.clear()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('renders children', () => {
    render(
      <OnboardingProvider tourConfig={testTourConfig}>
        <div data-testid="child">Child content</div>
      </OnboardingProvider>
    )

    expect(screen.getByTestId('child')).toBeInTheDocument()
  })

  it('auto-starts tour when autoStart is true and not completed', () => {
    const target = document.createElement('div')
    target.setAttribute('data-tour', 'step1')
    target.getBoundingClientRect = jest.fn(() => mockRect as DOMRect)
    document.body.appendChild(target)

    render(
      <OnboardingProvider tourConfig={testTourConfig} autoStart={true}>
        <div>Content</div>
      </OnboardingProvider>
    )

    // Wait for auto-start delay
    act(() => {
      jest.advanceTimersByTime(1500)
    })

    // Tour should have started
    expect(screen.queryByText('Step 1')).toBeInTheDocument()

    document.body.removeChild(target)
  })

  it('does not auto-start when already completed', () => {
    localStorageMock.getItem.mockReturnValueOnce('true')

    render(
      <OnboardingProvider tourConfig={testTourConfig} autoStart={true}>
        <div>Content</div>
      </OnboardingProvider>
    )

    act(() => {
      jest.advanceTimersByTime(1500)
    })

    // Tour should not have started
    expect(screen.queryByText('Step 1')).not.toBeInTheDocument()
  })
})

describe('Tour step actions', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('calls step action when proceeding to next step', async () => {
    const stepAction = jest.fn()

    const configWithAction: TourConfig = {
      id: 'action-test',
      steps: [
        {
          target: '[data-tour="step1"]',
          title: 'Step 1',
          content: 'Content',
          action: stepAction,
        },
        {
          target: '[data-tour="step2"]',
          title: 'Step 2',
          content: 'Content',
        },
      ],
    }

    const target1 = document.createElement('div')
    target1.setAttribute('data-tour', 'step1')
    target1.getBoundingClientRect = jest.fn(() => mockRect as DOMRect)
    document.body.appendChild(target1)

    const target2 = document.createElement('div')
    target2.setAttribute('data-tour', 'step2')
    target2.getBoundingClientRect = jest.fn(() => mockRect as DOMRect)
    document.body.appendChild(target2)

    render(
      <Tour config={configWithAction} isActive={true} onEnd={jest.fn()} />
    )

    act(() => {
      jest.advanceTimersByTime(200)
    })

    act(() => {
      fireEvent.click(screen.getByText('Next'))
    })

    expect(stepAction).toHaveBeenCalled()

    document.body.removeChild(target1)
    document.body.removeChild(target2)
  })
})
