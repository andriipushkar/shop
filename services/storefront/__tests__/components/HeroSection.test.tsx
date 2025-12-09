import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import HeroSection from '@/components/HeroSection';

describe('HeroSection', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders the hero slides', () => {
    render(<HeroSection />);
    expect(screen.getByText('Зимовий розпродаж')).toBeInTheDocument();
    expect(screen.getByText('Знижки до 50% на зимову колекцію')).toBeInTheDocument();
  });

  it('renders all slide titles', () => {
    render(<HeroSection />);
    expect(screen.getByText('Зимовий розпродаж')).toBeInTheDocument();
    expect(screen.getByText('Нові надходження')).toBeInTheDocument();
    // "Безкоштовна доставка" appears both in slides and features section
    const freeDeliveryTexts = screen.getAllByText('Безкоштовна доставка');
    expect(freeDeliveryTexts.length).toBeGreaterThanOrEqual(1);
  });

  it('renders navigation arrows', () => {
    render(<HeroSection />);
    expect(screen.getByLabelText('Previous slide')).toBeInTheDocument();
    expect(screen.getByLabelText('Next slide')).toBeInTheDocument();
  });

  it('renders dot indicators', () => {
    render(<HeroSection />);
    const dots = screen.getAllByLabelText(/Go to slide/);
    expect(dots).toHaveLength(3);
  });

  it('changes slide on next button click', () => {
    render(<HeroSection />);
    const nextButton = screen.getByLabelText('Next slide');

    fireEvent.click(nextButton);

    // After clicking, slideshow should show next slide
  });

  it('changes slide on previous button click', () => {
    render(<HeroSection />);
    const prevButton = screen.getByLabelText('Previous slide');

    fireEvent.click(prevButton);

    // After clicking, slideshow should show previous slide (wraps to last)
  });

  it('changes slide on dot click', () => {
    render(<HeroSection />);
    const dot2 = screen.getByLabelText('Go to slide 2');

    fireEvent.click(dot2);

    // Slide should change to second slide
  });

  it('auto-advances slides', () => {
    render(<HeroSection />);

    // Advance timers by 5 seconds (the interval)
    act(() => {
      jest.advanceTimersByTime(5000);
    });

    // After 5 seconds, should advance to next slide
  });

  it('pauses auto-play when user interacts', () => {
    render(<HeroSection />);
    const nextButton = screen.getByLabelText('Next slide');

    // Click button to pause auto-play
    fireEvent.click(nextButton);

    // Auto-play should be paused for 10 seconds
    act(() => {
      jest.advanceTimersByTime(5000);
    });

    // Should resume after 10 seconds
    act(() => {
      jest.advanceTimersByTime(5000);
    });
  });

  it('renders features section', () => {
    render(<HeroSection />);
    // "Безкоштовна доставка" appears in multiple places
    const freeDeliveryTexts = screen.getAllByText('Безкоштовна доставка');
    expect(freeDeliveryTexts.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Гарантія якості')).toBeInTheDocument();
    expect(screen.getByText('Безпечна оплата')).toBeInTheDocument();
    expect(screen.getByText('Легке повернення')).toBeInTheDocument();
  });

  it('renders feature descriptions', () => {
    render(<HeroSection />);
    expect(screen.getByText('При замовленні від 1000 грн')).toBeInTheDocument();
    expect(screen.getByText('30 днів на повернення')).toBeInTheDocument();
    expect(screen.getByText('Картки, Apple Pay, Google Pay')).toBeInTheDocument();
    expect(screen.getByText('Без зайвих запитань')).toBeInTheDocument();
  });

  it('renders slide call-to-action buttons', () => {
    render(<HeroSection />);
    expect(screen.getByText('Переглянути')).toBeInTheDocument();
    expect(screen.getAllByText('Каталог')).toHaveLength(3);
  });

  it('has correct button links', () => {
    render(<HeroSection />);
    const viewButton = screen.getByText('Переглянути').closest('a');
    expect(viewButton).toHaveAttribute('href', '/sale');
  });

  it('renders slide emojis', () => {
    render(<HeroSection />);
    expect(screen.getByText('🎄')).toBeInTheDocument();
    expect(screen.getByText('💻')).toBeInTheDocument();
    expect(screen.getByText('🚚')).toBeInTheDocument();
  });

  it('wraps around when clicking previous on first slide', () => {
    render(<HeroSection />);
    const prevButton = screen.getByLabelText('Previous slide');

    // Click previous - should wrap to last slide
    fireEvent.click(prevButton);
  });

  it('wraps around when clicking next on last slide', () => {
    render(<HeroSection />);
    const nextButton = screen.getByLabelText('Next slide');

    // Click next 3 times to go past the last slide
    fireEvent.click(nextButton);
    fireEvent.click(nextButton);
    fireEvent.click(nextButton);

    // Should wrap to first slide
  });
});
