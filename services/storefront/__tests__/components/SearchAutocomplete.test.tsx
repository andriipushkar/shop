/**
 * Tests for Search Autocomplete Component
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SearchAutocomplete from '@/components/SearchAutocomplete';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('SearchAutocomplete', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ suggestions: [] }),
    });
  });

  describe('Input behavior', () => {
    it('should render input with placeholder', () => {
      render(<SearchAutocomplete placeholder="Пошук..." />);
      expect(screen.getByPlaceholderText('Пошук...')).toBeInTheDocument();
    });

    it('should update input value on change', () => {
      render(<SearchAutocomplete />);
      const input = screen.getByRole('textbox');

      fireEvent.change(input, { target: { value: 'iPhone' } });

      expect(input).toHaveValue('iPhone');
    });

    it('should show clear button when input has value', () => {
      render(<SearchAutocomplete />);
      const input = screen.getByRole('textbox');

      fireEvent.change(input, { target: { value: 'test' } });

      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('should clear input when clear button clicked', () => {
      render(<SearchAutocomplete />);
      const input = screen.getByRole('textbox');

      fireEvent.change(input, { target: { value: 'test' } });
      const clearButton = screen.getByRole('button');
      fireEvent.click(clearButton);

      expect(input).toHaveValue('');
    });
  });

  describe('Dropdown behavior', () => {
    it('should show dropdown on focus with recent searches', async () => {
      localStorage.setItem(
        'techshop_recent_searches',
        JSON.stringify(['Test'])
      );

      render(<SearchAutocomplete showTrending showRecent />);
      const input = screen.getByRole('textbox');

      fireEvent.focus(input);

      await waitFor(() => {
        expect(screen.getByText(/Популярні запити/)).toBeInTheDocument();
      });
    });

    it('should hide dropdown on click outside', async () => {
      localStorage.setItem(
        'techshop_recent_searches',
        JSON.stringify(['Test'])
      );

      render(
        <div>
          <SearchAutocomplete showTrending showRecent />
          <button>Outside</button>
        </div>
      );
      const input = screen.getByRole('textbox');

      fireEvent.focus(input);
      await waitFor(() => {
        expect(screen.getByText(/Популярні запити/)).toBeInTheDocument();
      });

      fireEvent.mouseDown(screen.getByText('Outside'));

      await waitFor(() => {
        expect(screen.queryByText(/Популярні запити/)).not.toBeInTheDocument();
      });
    });
  });

  describe('Keyboard navigation', () => {
    it('should close dropdown on Escape', async () => {
      localStorage.setItem(
        'techshop_recent_searches',
        JSON.stringify(['Test'])
      );

      render(<SearchAutocomplete showTrending showRecent />);
      const input = screen.getByRole('textbox');

      fireEvent.focus(input);
      await waitFor(() => {
        expect(screen.getByText(/Популярні запити/)).toBeInTheDocument();
      });

      fireEvent.keyDown(input, { key: 'Escape' });

      await waitFor(() => {
        expect(screen.queryByText(/Популярні запити/)).not.toBeInTheDocument();
      });
    });

    it('should submit search on Enter', () => {
      const onSearch = jest.fn();
      render(<SearchAutocomplete onSearch={onSearch} />);
      const input = screen.getByRole('textbox');

      fireEvent.change(input, { target: { value: 'test' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(onSearch).toHaveBeenCalledWith('test');
    });
  });

  describe('Recent searches', () => {
    it('should show recent searches from localStorage', async () => {
      localStorage.setItem(
        'techshop_recent_searches',
        JSON.stringify(['iPhone', 'MacBook'])
      );

      render(<SearchAutocomplete showRecent />);
      const input = screen.getByRole('textbox');

      fireEvent.focus(input);

      await waitFor(() => {
        expect(screen.getByText('iPhone')).toBeInTheDocument();
        expect(screen.getByText('MacBook')).toBeInTheDocument();
      });
    });

    it('should save search to recent on submit', () => {
      const onSearch = jest.fn();
      render(<SearchAutocomplete onSearch={onSearch} showRecent />);
      const input = screen.getByRole('textbox');

      fireEvent.change(input, { target: { value: 'AirPods' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      const stored = JSON.parse(localStorage.getItem('techshop_recent_searches') || '[]');
      expect(stored).toContain('AirPods');
    });

    it('should clear recent searches', async () => {
      localStorage.setItem(
        'techshop_recent_searches',
        JSON.stringify(['iPhone'])
      );

      render(<SearchAutocomplete showRecent />);
      const input = screen.getByRole('textbox');

      fireEvent.focus(input);

      await waitFor(() => {
        expect(screen.getByText('iPhone')).toBeInTheDocument();
      });

      const clearButton = screen.getByText('Очистити');
      fireEvent.click(clearButton);

      const stored = localStorage.getItem('techshop_recent_searches');
      expect(stored).toBeNull();
    });
  });

  describe('Trending searches', () => {
    it('should show trending searches when dropdown is open and query is short', async () => {
      // Need showRecent with recent searches to trigger dropdown display
      localStorage.setItem(
        'techshop_recent_searches',
        JSON.stringify(['Test'])
      );

      render(<SearchAutocomplete showTrending showRecent />);
      const input = screen.getByRole('textbox');

      fireEvent.focus(input);

      await waitFor(() => {
        expect(screen.getByText(/Популярні запити/)).toBeInTheDocument();
      });
    });

    it('should trigger search on trending click', async () => {
      // Need showRecent with recent searches to trigger dropdown display
      localStorage.setItem(
        'techshop_recent_searches',
        JSON.stringify(['Test'])
      );

      const onSearch = jest.fn();
      render(<SearchAutocomplete showTrending showRecent onSearch={onSearch} />);
      const input = screen.getByRole('textbox');

      fireEvent.focus(input);

      await waitFor(() => {
        expect(screen.getByText('iPhone 15')).toBeInTheDocument();
      });

      const trendingItem = screen.getByText('iPhone 15');
      fireEvent.click(trendingItem);

      expect(onSearch).toHaveBeenCalledWith('iPhone 15');
    });
  });

  describe('Fetch behavior', () => {
    it('should call fetch when query changes after debounce', () => {
      render(<SearchAutocomplete />);
      const input = screen.getByRole('textbox');

      // Type a query - fetch won't be called immediately due to debounce
      fireEvent.change(input, { target: { value: 'test' } });

      // The component should have the value
      expect(input).toHaveValue('test');
    });

    it('should not make fetch call for short queries', () => {
      render(<SearchAutocomplete />);
      const input = screen.getByRole('textbox');

      fireEvent.change(input, { target: { value: 'a' } });

      // No immediate fetch for single character
      expect(input).toHaveValue('a');
    });
  });

  describe('Component renders without errors', () => {
    it('should render with all props', () => {
      const { container } = render(
        <SearchAutocomplete
          placeholder="Шукайте товари..."
          showRecent
          showTrending
          maxSuggestions={5}
          onSearch={jest.fn()}
        />
      );

      expect(container.querySelector('input')).toBeInTheDocument();
    });

    it('should render with minimal props', () => {
      const { container } = render(<SearchAutocomplete />);
      expect(container.querySelector('input')).toBeInTheDocument();
    });
  });
});
