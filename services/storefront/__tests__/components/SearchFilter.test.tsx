import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import SearchFilter from '@/components/SearchFilter';
import SearchFilterWrapper from '@/components/SearchFilterWrapper';

// Mock next/navigation
const mockPush = jest.fn();
const mockSearchParams = new URLSearchParams();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useSearchParams: () => mockSearchParams,
}));

const mockCategories = [
  { id: 'cat-1', name: 'Електроніка', slug: 'electronics' },
  { id: 'cat-2', name: 'Одяг', slug: 'clothing' },
  { id: 'cat-3', name: 'Дім і сад', slug: 'home' },
];

describe('SearchFilter', () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it('renders search input', () => {
    render(<SearchFilter />);
    expect(screen.getByPlaceholderText('Назва або SKU...')).toBeInTheDocument();
  });

  it('renders price range inputs', () => {
    render(<SearchFilter />);
    expect(screen.getByPlaceholderText('0')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('99999')).toBeInTheDocument();
  });

  it('renders labels', () => {
    render(<SearchFilter />);
    expect(screen.getByText('Пошук')).toBeInTheDocument();
    expect(screen.getByText('Від, грн')).toBeInTheDocument();
    expect(screen.getByText('До, грн')).toBeInTheDocument();
  });

  it('renders submit button', () => {
    render(<SearchFilter />);
    expect(screen.getByText('Знайти')).toBeInTheDocument();
  });

  it('does not show clear button initially', () => {
    render(<SearchFilter />);
    expect(screen.queryByText('Скинути')).not.toBeInTheDocument();
  });

  it('shows clear button when filters are applied', () => {
    render(<SearchFilter />);

    const searchInput = screen.getByPlaceholderText('Назва або SKU...');
    fireEvent.change(searchInput, { target: { value: 'test' } });

    expect(screen.getByText('Скинути')).toBeInTheDocument();
  });

  it('handles search input change', () => {
    render(<SearchFilter />);
    const searchInput = screen.getByPlaceholderText('Назва або SKU...');

    fireEvent.change(searchInput, { target: { value: 'iPhone' } });

    expect(searchInput).toHaveValue('iPhone');
  });

  it('handles min price input change', () => {
    render(<SearchFilter />);
    const minPriceInput = screen.getByPlaceholderText('0');

    fireEvent.change(minPriceInput, { target: { value: '100' } });

    expect(minPriceInput).toHaveValue(100);
  });

  it('handles max price input change', () => {
    render(<SearchFilter />);
    const maxPriceInput = screen.getByPlaceholderText('99999');

    fireEvent.change(maxPriceInput, { target: { value: '5000' } });

    expect(maxPriceInput).toHaveValue(5000);
  });

  it('submits form with search params', () => {
    render(<SearchFilter />);

    const searchInput = screen.getByPlaceholderText('Назва або SKU...');
    fireEvent.change(searchInput, { target: { value: 'test' } });

    const submitButton = screen.getByText('Знайти');
    fireEvent.click(submitButton);

    expect(mockPush).toHaveBeenCalledWith('/?search=test');
  });

  it('submits form with all params', () => {
    render(<SearchFilter categories={mockCategories} />);

    const searchInput = screen.getByPlaceholderText('Назва або SKU...');
    fireEvent.change(searchInput, { target: { value: 'phone' } });

    const minPriceInput = screen.getByPlaceholderText('0');
    fireEvent.change(minPriceInput, { target: { value: '100' } });

    const maxPriceInput = screen.getByPlaceholderText('99999');
    fireEvent.change(maxPriceInput, { target: { value: '5000' } });

    const categorySelect = screen.getByRole('combobox');
    fireEvent.change(categorySelect, { target: { value: 'cat-1' } });

    const submitButton = screen.getByText('Знайти');
    fireEvent.click(submitButton);

    expect(mockPush).toHaveBeenCalledWith(
      '/?search=phone&min_price=100&max_price=5000&category_id=cat-1'
    );
  });

  it('clears all filters', () => {
    render(<SearchFilter />);

    const searchInput = screen.getByPlaceholderText('Назва або SKU...');
    fireEvent.change(searchInput, { target: { value: 'test' } });

    const clearButton = screen.getByText('Скинути');
    fireEvent.click(clearButton);

    expect(searchInput).toHaveValue('');
    expect(mockPush).toHaveBeenCalledWith('/');
  });

  it('renders categories dropdown when provided', () => {
    render(<SearchFilter categories={mockCategories} />);

    expect(screen.getByText('Категорія')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByText('Всі категорії')).toBeInTheDocument();
    expect(screen.getByText('Електроніка')).toBeInTheDocument();
    expect(screen.getByText('Одяг')).toBeInTheDocument();
    expect(screen.getByText('Дім і сад')).toBeInTheDocument();
  });

  it('does not render categories dropdown when empty', () => {
    render(<SearchFilter categories={[]} />);
    expect(screen.queryByText('Категорія')).not.toBeInTheDocument();
  });

  it('handles category selection', () => {
    render(<SearchFilter categories={mockCategories} />);

    const categorySelect = screen.getByRole('combobox');
    fireEvent.change(categorySelect, { target: { value: 'cat-2' } });

    expect(categorySelect).toHaveValue('cat-2');
  });

  it('submits to root when no filters', () => {
    render(<SearchFilter />);

    const submitButton = screen.getByText('Знайти');
    fireEvent.click(submitButton);

    expect(mockPush).toHaveBeenCalledWith('/');
  });

  it('shows clear button when min price is set', () => {
    render(<SearchFilter />);

    const minPriceInput = screen.getByPlaceholderText('0');
    fireEvent.change(minPriceInput, { target: { value: '100' } });

    expect(screen.getByText('Скинути')).toBeInTheDocument();
  });

  it('shows clear button when max price is set', () => {
    render(<SearchFilter />);

    const maxPriceInput = screen.getByPlaceholderText('99999');
    fireEvent.change(maxPriceInput, { target: { value: '5000' } });

    expect(screen.getByText('Скинути')).toBeInTheDocument();
  });

  it('shows clear button when category is set', () => {
    render(<SearchFilter categories={mockCategories} />);

    const categorySelect = screen.getByRole('combobox');
    fireEvent.change(categorySelect, { target: { value: 'cat-1' } });

    expect(screen.getByText('Скинути')).toBeInTheDocument();
  });
});

describe('SearchFilterWrapper', () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it('renders SearchFilter with categories', () => {
    render(<SearchFilterWrapper categories={mockCategories} />);

    expect(screen.getByPlaceholderText('Назва або SKU...')).toBeInTheDocument();
    expect(screen.getByText('Категорія')).toBeInTheDocument();
    expect(screen.getByText('Електроніка')).toBeInTheDocument();
  });

  it('passes categories prop correctly', () => {
    render(<SearchFilterWrapper categories={mockCategories} />);

    const categorySelect = screen.getByRole('combobox');
    expect(categorySelect.children).toHaveLength(4); // "All" + 3 categories
  });
});
