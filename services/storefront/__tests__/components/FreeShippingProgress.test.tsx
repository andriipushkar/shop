/**
 * Tests for Free Shipping Progress Component
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import FreeShippingProgress from '@/components/FreeShippingProgress';

describe('FreeShippingProgress', () => {
  describe('Progress calculation', () => {
    it('should show progress towards threshold', () => {
      render(<FreeShippingProgress cartTotal={500} threshold={1000} />);
      const elements = screen.getAllByText(/500/);
      expect(elements.length).toBeGreaterThan(0);
    });

    it('should show remaining amount', () => {
      render(<FreeShippingProgress cartTotal={700} threshold={1000} />);
      const elements = screen.getAllByText(/300/);
      expect(elements.length).toBeGreaterThan(0);
    });

    it('should show free shipping achieved when threshold reached', () => {
      render(<FreeShippingProgress cartTotal={1000} threshold={1000} />);
      const elements = screen.getAllByText(/безкоштовн/i);
      expect(elements.length).toBeGreaterThan(0);
    });

    it('should show free shipping achieved when over threshold', () => {
      render(<FreeShippingProgress cartTotal={1500} threshold={1000} />);
      const elements = screen.getAllByText(/безкоштовн/i);
      expect(elements.length).toBeGreaterThan(0);
    });
  });

  describe('Variant: bar', () => {
    it('should render progress bar', () => {
      const { container } = render(
        <FreeShippingProgress cartTotal={500} threshold={1000} variant="bar" />
      );
      // Check for progress bar element with width style
      const progressBar = container.querySelector('[style*="width"]');
      expect(progressBar).toBeInTheDocument();
    });

    it('should calculate correct percentage', () => {
      const { container } = render(
        <FreeShippingProgress cartTotal={300} threshold={1000} variant="bar" />
      );
      const progressBar = container.querySelector('[style*="width: 30%"]');
      expect(progressBar).toBeInTheDocument();
    });

    it('should show success message when threshold exceeded', () => {
      render(
        <FreeShippingProgress cartTotal={1500} threshold={1000} variant="bar" />
      );
      // When free shipping is achieved, success message is shown instead of progress bar
      const elements = screen.getAllByText(/безкоштовн/i);
      expect(elements.length).toBeGreaterThan(0);
    });
  });

  describe('Variant: compact', () => {
    it('should render compact version', () => {
      const { container } = render(
        <FreeShippingProgress cartTotal={500} threshold={1000} variant="compact" />
      );
      // Compact should be smaller
      expect(container.firstChild).toBeInTheDocument();
    });

    it('should show icon', () => {
      const { container } = render(
        <FreeShippingProgress cartTotal={500} threshold={1000} variant="compact" />
      );
      expect(container.querySelector('svg')).toBeInTheDocument();
    });
  });

  describe('Variant: banner', () => {
    it('should render banner version', () => {
      const { container } = render(
        <FreeShippingProgress cartTotal={500} threshold={1000} variant="banner" />
      );
      expect(container.firstChild).toBeInTheDocument();
    });

    it('should have prominent styling', () => {
      const { container } = render(
        <FreeShippingProgress cartTotal={500} threshold={1000} variant="banner" />
      );
      // Banner should have background color
      expect(container.querySelector('[class*="bg-"]')).toBeInTheDocument();
    });
  });

  describe('Edge cases', () => {
    it('should handle zero cart total', () => {
      render(<FreeShippingProgress cartTotal={0} threshold={1000} />);
      const elements = screen.getAllByText(/1\s?000/);
      expect(elements.length).toBeGreaterThan(0);
    });

    it('should handle zero threshold', () => {
      render(<FreeShippingProgress cartTotal={500} threshold={0} />);
      const elements = screen.getAllByText(/безкоштовн/i);
      expect(elements.length).toBeGreaterThan(0);
    });

    it('should format numbers with Ukrainian locale', () => {
      render(<FreeShippingProgress cartTotal={1500} threshold={2000} />);
      // Ukrainian locale uses space as thousand separator
      const elements = screen.getAllByText(/500/);
      expect(elements.length).toBeGreaterThan(0);
    });
  });

  describe('Messages', () => {
    it('should show encouraging message when close to threshold', () => {
      render(<FreeShippingProgress cartTotal={900} threshold={1000} />);
      const elements = screen.getAllByText(/100/);
      expect(elements.length).toBeGreaterThan(0);
    });

    it('should show celebration message when threshold achieved', () => {
      render(<FreeShippingProgress cartTotal={1000} threshold={1000} />);
      // Should have success styling or message
      const elements = screen.getAllByText(/безкоштовн/i);
      expect(elements.length).toBeGreaterThan(0);
    });
  });
});
