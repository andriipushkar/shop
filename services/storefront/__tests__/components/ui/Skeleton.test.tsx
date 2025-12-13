/**
 * Tests for Skeleton Loader Components
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import {
  Skeleton,
  SkeletonText,
  SkeletonAvatar,
  SkeletonButton,
  SkeletonImage,
  SkeletonProductCard,
  SkeletonProductGrid,
  SkeletonCartItem,
  SkeletonOrderItem,
  SkeletonReview,
  SkeletonTableRow,
  SkeletonTable,
  SkeletonStatsCard,
  SkeletonDashboard,
  SkeletonCategoryFilter,
  SkeletonForm,
} from '@/components/ui/Skeleton';

describe('Skeleton Components', () => {
  describe('Skeleton (Base)', () => {
    it('renders with default props', () => {
      const { container } = render(<Skeleton />);
      const skeleton = container.firstChild as HTMLElement;

      expect(skeleton).toHaveClass('bg-gray-200');
      expect(skeleton).toHaveClass('rounded-md');
      expect(skeleton).toHaveClass('animate-pulse');
    });

    it('applies custom className', () => {
      const { container } = render(<Skeleton className="custom-class" />);
      const skeleton = container.firstChild as HTMLElement;

      expect(skeleton).toHaveClass('custom-class');
    });

    it('applies width and height as pixels when numbers', () => {
      const { container } = render(<Skeleton width={100} height={50} />);
      const skeleton = container.firstChild as HTMLElement;

      expect(skeleton).toHaveStyle({ width: '100px', height: '50px' });
    });

    it('applies width and height as-is when strings', () => {
      const { container } = render(<Skeleton width="50%" height="auto" />);
      const skeleton = container.firstChild as HTMLElement;

      expect(skeleton).toHaveStyle({ width: '50%', height: 'auto' });
    });

    it('applies different rounded values', () => {
      const roundedValues = ['none', 'sm', 'md', 'lg', 'full'] as const;
      const expectedClasses = ['', 'rounded-sm', 'rounded-md', 'rounded-lg', 'rounded-full'];

      roundedValues.forEach((rounded, index) => {
        const { container, unmount } = render(<Skeleton rounded={rounded} />);
        const skeleton = container.firstChild as HTMLElement;

        if (expectedClasses[index]) {
          expect(skeleton).toHaveClass(expectedClasses[index]);
        }

        unmount();
      });
    });

    it('can disable animation', () => {
      const { container } = render(<Skeleton animate={false} />);
      const skeleton = container.firstChild as HTMLElement;

      expect(skeleton).not.toHaveClass('animate-pulse');
    });
  });

  describe('SkeletonText', () => {
    it('renders single line by default', () => {
      const { container } = render(<SkeletonText />);
      const skeletons = container.querySelectorAll('.bg-gray-200');

      expect(skeletons).toHaveLength(1);
    });

    it('renders multiple lines', () => {
      const { container } = render(<SkeletonText lines={3} />);
      const skeletons = container.querySelectorAll('.bg-gray-200');

      expect(skeletons).toHaveLength(3);
    });

    it('last line has reduced width when multiple lines', () => {
      const { container } = render(<SkeletonText lines={3} lastLineWidth="50%" />);
      const skeletons = container.querySelectorAll('.bg-gray-200');
      const lastSkeleton = skeletons[2] as HTMLElement;

      expect(lastSkeleton).toHaveStyle({ width: '50%' });
    });
  });

  describe('SkeletonAvatar', () => {
    it('renders circular skeleton', () => {
      const { container } = render(<SkeletonAvatar />);
      const skeleton = container.querySelector('.bg-gray-200') as HTMLElement;

      expect(skeleton).toHaveClass('rounded-full');
    });

    it('applies size', () => {
      const { container } = render(<SkeletonAvatar size={60} />);
      const skeleton = container.querySelector('.bg-gray-200') as HTMLElement;

      expect(skeleton).toHaveStyle({ width: '60px', height: '60px' });
    });
  });

  describe('SkeletonButton', () => {
    it('renders with default size', () => {
      const { container } = render(<SkeletonButton />);
      const skeleton = container.querySelector('.bg-gray-200') as HTMLElement;

      expect(skeleton).toHaveStyle({ width: '100px', height: '40px' });
    });

    it('accepts custom dimensions', () => {
      const { container } = render(<SkeletonButton width={200} height={48} />);
      const skeleton = container.querySelector('.bg-gray-200') as HTMLElement;

      expect(skeleton).toHaveStyle({ width: '200px', height: '48px' });
    });
  });

  describe('SkeletonImage', () => {
    it('renders skeleton for image', () => {
      const { container } = render(<SkeletonImage />);
      const skeleton = container.querySelector('.bg-gray-200');

      expect(skeleton).toBeInTheDocument();
    });

    it('applies dimensions', () => {
      const { container } = render(<SkeletonImage width={300} height={200} />);
      const skeleton = container.querySelector('.bg-gray-200') as HTMLElement;

      expect(skeleton).toHaveStyle({ width: '300px', height: '200px' });
    });
  });

  describe('SkeletonProductCard', () => {
    it('renders product card skeleton structure', () => {
      const { container } = render(<SkeletonProductCard />);

      // Should have multiple skeleton elements
      const skeletons = container.querySelectorAll('.bg-gray-200');
      expect(skeletons.length).toBeGreaterThan(5);

      // Should have container with styling
      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass('bg-white');
      expect(card).toHaveClass('rounded-lg');
    });
  });

  describe('SkeletonProductGrid', () => {
    it('renders default 8 product cards', () => {
      render(<SkeletonProductGrid />);

      // Each product card has multiple skeletons
      // Just verify the grid is rendered
      const cards = document.querySelectorAll('.bg-white.rounded-lg');
      expect(cards).toHaveLength(8);
    });

    it('renders custom count', () => {
      render(<SkeletonProductGrid count={4} />);

      const cards = document.querySelectorAll('.bg-white.rounded-lg');
      expect(cards).toHaveLength(4);
    });

    it('applies column classes', () => {
      const { container } = render(<SkeletonProductGrid columns={3} />);
      const grid = container.firstChild as HTMLElement;

      expect(grid).toHaveClass('grid-cols-2');
      expect(grid).toHaveClass('md:grid-cols-3');
    });
  });

  describe('SkeletonCartItem', () => {
    it('renders cart item skeleton structure', () => {
      const { container } = render(<SkeletonCartItem />);

      const skeletons = container.querySelectorAll('.bg-gray-200');
      expect(skeletons.length).toBeGreaterThan(3);

      const cartItem = container.firstChild as HTMLElement;
      expect(cartItem).toHaveClass('flex');
    });
  });

  describe('SkeletonOrderItem', () => {
    it('renders order item skeleton structure', () => {
      const { container } = render(<SkeletonOrderItem />);

      const skeletons = container.querySelectorAll('.bg-gray-200');
      expect(skeletons.length).toBeGreaterThan(5);
    });
  });

  describe('SkeletonReview', () => {
    it('renders review skeleton with avatar', () => {
      const { container } = render(<SkeletonReview />);

      // Should have avatar (circular)
      const avatar = container.querySelector('.rounded-full');
      expect(avatar).toBeInTheDocument();

      // Should have rating stars
      const skeletons = container.querySelectorAll('.bg-gray-200');
      expect(skeletons.length).toBeGreaterThan(5);
    });
  });

  describe('SkeletonTableRow', () => {
    it('renders table row with default columns', () => {
      render(
        <table>
          <tbody>
            <SkeletonTableRow />
          </tbody>
        </table>
      );

      const cells = document.querySelectorAll('td');
      expect(cells).toHaveLength(5);
    });

    it('renders custom number of columns', () => {
      render(
        <table>
          <tbody>
            <SkeletonTableRow columns={3} />
          </tbody>
        </table>
      );

      const cells = document.querySelectorAll('td');
      expect(cells).toHaveLength(3);
    });
  });

  describe('SkeletonTable', () => {
    it('renders table skeleton', () => {
      render(<SkeletonTable />);

      expect(document.querySelector('table')).toBeInTheDocument();
      expect(document.querySelector('thead')).toBeInTheDocument();
      expect(document.querySelector('tbody')).toBeInTheDocument();
    });

    it('renders correct number of rows and columns', () => {
      render(<SkeletonTable rows={3} columns={4} />);

      // Header has same columns
      const headerCells = document.querySelectorAll('th');
      expect(headerCells).toHaveLength(4);

      // Body has specified rows
      const bodyRows = document.querySelectorAll('tbody tr');
      expect(bodyRows).toHaveLength(3);
    });
  });

  describe('SkeletonStatsCard', () => {
    it('renders stats card skeleton', () => {
      const { container } = render(<SkeletonStatsCard />);

      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass('bg-white');
      expect(card).toHaveClass('rounded-lg');

      const skeletons = container.querySelectorAll('.bg-gray-200');
      expect(skeletons.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('SkeletonDashboard', () => {
    it('renders full dashboard skeleton', () => {
      render(<SkeletonDashboard />);

      // Should have stats cards
      const statsCards = document.querySelectorAll('.grid > .bg-white');
      expect(statsCards.length).toBeGreaterThan(0);

      // Should have table
      expect(document.querySelector('table')).toBeInTheDocument();
    });
  });

  describe('SkeletonCategoryFilter', () => {
    it('renders filter skeleton', () => {
      const { container } = render(<SkeletonCategoryFilter />);

      const skeletons = container.querySelectorAll('.bg-gray-200');
      expect(skeletons.length).toBeGreaterThan(5);
    });
  });

  describe('SkeletonForm', () => {
    it('renders form skeleton with default fields', () => {
      const { container } = render(<SkeletonForm />);

      // Default is 4 fields, each has label and input skeleton
      const skeletons = container.querySelectorAll('.bg-gray-200');
      expect(skeletons.length).toBeGreaterThanOrEqual(8);
    });

    it('renders custom number of fields', () => {
      const { container } = render(<SkeletonForm fields={2} />);

      // 2 fields + 1 button = at least 5 skeletons
      const skeletons = container.querySelectorAll('.bg-gray-200');
      expect(skeletons.length).toBeGreaterThanOrEqual(5);
    });
  });
});
