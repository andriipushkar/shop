import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import Header from '@/components/Header';

// Mock useCart
const mockUseCart = {
  totalItems: 3,
  totalPrice: 1500,
  items: [],
  addToCart: jest.fn(),
  removeFromCart: jest.fn(),
  updateQuantity: jest.fn(),
  clearCart: jest.fn(),
};

jest.mock('@/lib/cart-context', () => ({
  useCart: () => mockUseCart,
}));

// Mock useAuth
const mockUseAuth = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  login: jest.fn(),
  register: jest.fn(),
  logout: jest.fn(),
  updateProfile: jest.fn(),
};

jest.mock('@/lib/auth-context', () => ({
  useAuth: () => mockUseAuth,
}));

// Mock useWishlist
const mockUseWishlist = {
  items: [],
  totalItems: 2,
  addToWishlist: jest.fn(),
  removeFromWishlist: jest.fn(),
  isInWishlist: jest.fn().mockReturnValue(false),
  toggleWishlist: jest.fn(),
  clearWishlist: jest.fn(),
};

jest.mock('@/lib/wishlist-context', () => ({
  useWishlist: () => mockUseWishlist,
}));

// Mock useComparison
const mockUseComparison = {
  items: [],
  itemCount: 1,
  maxItems: 4,
  canAdd: true,
  addToComparison: jest.fn(),
  removeFromComparison: jest.fn(),
  isInComparison: jest.fn().mockReturnValue(false),
  toggleComparison: jest.fn(),
  clearComparison: jest.fn(),
};

jest.mock('@/lib/comparison-context', () => ({
  useComparison: () => mockUseComparison,
}));

// Mock next/navigation
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useSearchParams: () => new URLSearchParams(),
}));

// Mock next/link to properly handle onClick
jest.mock('next/link', () => {
  return ({ children, href, onClick, ...props }: { children: React.ReactNode; href: string; onClick?: () => void; [key: string]: unknown }) => {
    return (
      <a
        href={href}
        onClick={(e) => {
          e.preventDefault();
          if (onClick) onClick();
        }}
        {...props}
      >
        {children}
      </a>
    );
  };
});

describe('Header', () => {
  beforeEach(() => {
    mockPush.mockClear();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders the logo', () => {
    render(<Header />);
    expect(screen.getByText('M')).toBeInTheDocument();
    expect(screen.getByText('MyShop')).toBeInTheDocument();
  });

  it('renders the top promo bar', () => {
    render(<Header />);
    expect(screen.getByText('Безкоштовна доставка від 1000 грн')).toBeInTheDocument();
    expect(screen.getByText('Знижки до -50% на нові колекції')).toBeInTheDocument();
  });

  it('renders phone number', () => {
    render(<Header />);
    expect(screen.getByText('0 800 123 456')).toBeInTheDocument();
  });

  it('renders search input', () => {
    render(<Header />);
    const searchInputs = screen.getAllByPlaceholderText('Шукати товари...');
    expect(searchInputs.length).toBeGreaterThan(0);
  });

  it('renders cart with items count', () => {
    render(<Header />);
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('1500 грн')).toBeInTheDocument();
  });

  it('handles search input changes', () => {
    render(<Header />);
    const searchInput = screen.getAllByPlaceholderText('Шукати товари...')[0];

    fireEvent.change(searchInput, { target: { value: 'test query' } });

    expect(searchInput).toHaveValue('test query');
  });

  it('renders search form with submit button', () => {
    render(<Header />);
    const submitButton = screen.getByText('Знайти');
    expect(submitButton).toBeInTheDocument();
    expect(submitButton.getAttribute('type')).toBe('submit');
  });

  it('submits search form and navigates', () => {
    render(<Header />);
    const searchInput = screen.getAllByPlaceholderText('Шукати товари...')[0];
    const form = searchInput.closest('form');

    fireEvent.change(searchInput, { target: { value: 'test search' } });
    fireEvent.submit(form!);

    expect(mockPush).toHaveBeenCalledWith('/search?q=test%20search');
  });

  it('does not submit search with empty query', () => {
    render(<Header />);
    const searchInput = screen.getAllByPlaceholderText('Шукати товари...')[0];
    const form = searchInput.closest('form');

    fireEvent.change(searchInput, { target: { value: '   ' } });
    fireEvent.submit(form!);

    expect(mockPush).not.toHaveBeenCalled();
  });

  it('toggles mobile menu', () => {
    render(<Header />);

    const menuButton = screen.getAllByRole('button')[0];

    fireEvent.click(menuButton);

    expect(screen.getByText('Увійти / Реєстрація')).toBeInTheDocument();
    expect(screen.getByText('Мої замовлення')).toBeInTheDocument();
    expect(screen.getByText('Список бажань')).toBeInTheDocument();
  });

  it('renders navigation links', () => {
    render(<Header />);
    expect(screen.getByText('Увійти')).toBeInTheDocument();
    expect(screen.getByText('Бажання')).toBeInTheDocument();
  });

  it('renders category links in navigation', () => {
    render(<Header />);
    expect(screen.getByText('Каталог')).toBeInTheDocument();
    expect(screen.getByText('Електроніка')).toBeInTheDocument();
    expect(screen.getByText('Одяг')).toBeInTheDocument();
  });

  it('renders sale link', () => {
    render(<Header />);
    expect(screen.getByText('Розпродаж')).toBeInTheDocument();
    expect(screen.getByText('-50%')).toBeInTheDocument();
  });

  it('shows mega menu on hover', async () => {
    render(<Header />);

    const catalogButton = screen.getByText('Каталог').closest('button');

    await act(async () => {
      fireEvent.mouseEnter(catalogButton!);
    });

    expect(screen.getByText('Смартфони')).toBeInTheDocument();
    expect(screen.getByText('Ноутбуки')).toBeInTheDocument();
    expect(screen.getByText('Планшети')).toBeInTheDocument();
  });

  it('hides mega menu on mouse leave', async () => {
    render(<Header />);

    const catalogButton = screen.getByText('Каталог').closest('button');

    await act(async () => {
      fireEvent.mouseEnter(catalogButton!);
    });

    expect(screen.getByText('Смартфони')).toBeInTheDocument();

    await act(async () => {
      fireEvent.mouseLeave(catalogButton!);
      jest.advanceTimersByTime(200);
    });

    expect(screen.queryByText('Переглянути всі →')).not.toBeInTheDocument();
  });

  it('clears timeout when entering mega menu again', async () => {
    render(<Header />);

    const catalogButton = screen.getByText('Каталог').closest('button');

    await act(async () => {
      fireEvent.mouseEnter(catalogButton!);
    });

    await act(async () => {
      fireEvent.mouseLeave(catalogButton!);
    });

    await act(async () => {
      fireEvent.mouseEnter(catalogButton!);
    });

    expect(screen.getByText('Смартфони')).toBeInTheDocument();
  });

  it('handles mega menu mouse enter to keep menu open', async () => {
    render(<Header />);

    const catalogButton = screen.getByText('Каталог').closest('button');

    await act(async () => {
      fireEvent.mouseEnter(catalogButton!);
    });

    const megaMenus = document.querySelectorAll('[class*="absolute"][class*="top-full"]');
    expect(megaMenus.length).toBeGreaterThan(0);

    const megaMenu = megaMenus[0];
    await act(async () => {
      fireEvent.mouseEnter(megaMenu);
    });

    expect(screen.getByText('Смартфони')).toBeInTheDocument();
  });

  it('closes mobile menu when account link is clicked', async () => {
    render(<Header />);

    const menuButton = screen.getAllByRole('button')[0];
    fireEvent.click(menuButton);

    // Menu should be open
    expect(screen.getByText('Увійти / Реєстрація')).toBeInTheDocument();

    const accountLink = screen.getByText('Увійти / Реєстрація').closest('a');
    await act(async () => {
      fireEvent.click(accountLink!);
    });

    // Menu should be closed after clicking
    expect(screen.queryByText('Потрібна допомога?')).not.toBeInTheDocument();
  });

  it('closes mobile menu when category link is clicked', async () => {
    render(<Header />);

    const menuButton = screen.getAllByRole('button')[0];
    fireEvent.click(menuButton);

    // Find mobile category link inside mobile menu container
    const mobileMenuContainer = document.querySelector('.lg\\:hidden.fixed');
    const categoryLink = mobileMenuContainer?.querySelector('a[href="/category/electronics"]');

    expect(categoryLink).toBeTruthy();
    await act(async () => {
      fireEvent.click(categoryLink!);
    });

    // Menu should be closed
    expect(screen.queryByText('Потрібна допомога?')).not.toBeInTheDocument();
  });

  it('closes mobile menu when subcategory link is clicked', async () => {
    render(<Header />);

    const menuButton = screen.getAllByRole('button')[0];
    fireEvent.click(menuButton);

    // Find mobile subcategory link inside mobile menu container
    const mobileMenuContainer = document.querySelector('.lg\\:hidden.fixed');
    const subcategoryLink = mobileMenuContainer?.querySelector('a[href="/category/electronics/smartphones"]');

    expect(subcategoryLink).toBeTruthy();
    await act(async () => {
      fireEvent.click(subcategoryLink!);
    });

    // Menu should be closed
    expect(screen.queryByText('Потрібна допомога?')).not.toBeInTheDocument();
  });

  it('closes mobile menu when orders link is clicked', async () => {
    render(<Header />);

    const menuButton = screen.getAllByRole('button')[0];
    fireEvent.click(menuButton);

    const ordersLink = screen.getByText('Мої замовлення').closest('a');
    await act(async () => {
      fireEvent.click(ordersLink!);
    });

    // Menu should be closed
    expect(screen.queryByText('Потрібна допомога?')).not.toBeInTheDocument();
  });

  it('closes mobile menu when wishlist link is clicked', async () => {
    render(<Header />);

    const menuButton = screen.getAllByRole('button')[0];
    fireEvent.click(menuButton);

    const wishlistLink = screen.getByText('Список бажань').closest('a');
    await act(async () => {
      fireEvent.click(wishlistLink!);
    });

    // Menu should be closed
    expect(screen.queryByText('Потрібна допомога?')).not.toBeInTheDocument();
  });

  it('closes mobile menu when sale link is clicked', async () => {
    render(<Header />);

    const menuButton = screen.getAllByRole('button')[0];
    fireEvent.click(menuButton);

    const saleLink = screen.getByText('Розпродаж -50%').closest('a');
    await act(async () => {
      fireEvent.click(saleLink!);
    });

    // Menu should be closed
    expect(screen.queryByText('Потрібна допомога?')).not.toBeInTheDocument();
  });

  it('renders cart link with correct href', () => {
    render(<Header />);
    const cartLink = screen.getByText('Кошик').closest('a');
    expect(cartLink).toHaveAttribute('href', '/cart');
  });

  it('renders account link with correct href', () => {
    render(<Header />);
    const accountLink = screen.getByText('Увійти').closest('a');
    expect(accountLink).toHaveAttribute('href', '/auth/login');
  });

  it('renders wishlist link with correct href', () => {
    render(<Header />);
    const wishlistLink = screen.getByText('Бажання').closest('a');
    expect(wishlistLink).toHaveAttribute('href', '/wishlist');
  });

  it('handles search input focus state', () => {
    render(<Header />);
    const searchInput = screen.getAllByPlaceholderText('Шукати товари...')[0];

    fireEvent.focus(searchInput);
    fireEvent.blur(searchInput);
  });

  it('renders subcategories in mobile menu', () => {
    render(<Header />);

    const menuButton = screen.getAllByRole('button')[0];
    fireEvent.click(menuButton);

    expect(screen.getByText('Смартфони')).toBeInTheDocument();
    expect(screen.getByText('Ноутбуки')).toBeInTheDocument();
    expect(screen.getByText('Чоловічий')).toBeInTheDocument();
  });

  it('renders mobile menu contact section', () => {
    render(<Header />);

    const menuButton = screen.getAllByRole('button')[0];
    fireEvent.click(menuButton);

    expect(screen.getByText('Потрібна допомога?')).toBeInTheDocument();
    expect(screen.getByText('Безкоштовно по Україні')).toBeInTheDocument();
  });

  it('renders mobile sale link in menu', () => {
    render(<Header />);

    const menuButton = screen.getAllByRole('button')[0];
    fireEvent.click(menuButton);

    expect(screen.getByText('Розпродаж -50%')).toBeInTheDocument();
  });

  it('handles mobile search input', () => {
    render(<Header />);

    const searchInputs = screen.getAllByPlaceholderText('Шукати товари...');
    expect(searchInputs.length).toBe(2);

    const mobileSearchInput = searchInputs[1];
    fireEvent.change(mobileSearchInput, { target: { value: 'mobile search' } });
    expect(mobileSearchInput).toHaveValue('mobile search');
  });

  it('cleans up timeout on unmount', () => {
    const { unmount } = render(<Header />);

    const catalogButton = screen.getByText('Каталог').closest('button');

    act(() => {
      fireEvent.mouseEnter(catalogButton!);
      fireEvent.mouseLeave(catalogButton!);
    });

    unmount();
  });
});
