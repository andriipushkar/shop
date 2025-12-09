import React from 'react';
import { render, screen } from '@testing-library/react';
import PromoSection from '@/components/PromoSection';

describe('PromoSection', () => {
  it('renders promo cards', () => {
    render(<PromoSection />);
    expect(screen.getByText('Електроніка')).toBeInTheDocument();
    expect(screen.getByText('Одяг')).toBeInTheDocument();
    expect(screen.getByText('Дім і сад')).toBeInTheDocument();
  });

  it('renders promo card subtitles', () => {
    render(<PromoSection />);
    expect(screen.getByText('Новинки сезону')).toBeInTheDocument();
    expect(screen.getByText('Зимова колекція')).toBeInTheDocument();
    expect(screen.getByText('Затишок вдома')).toBeInTheDocument();
  });

  it('renders discount badges', () => {
    render(<PromoSection />);
    expect(screen.getByText('-30%')).toBeInTheDocument();
    expect(screen.getByText('-50%')).toBeInTheDocument();
    expect(screen.getByText('-25%')).toBeInTheDocument();
  });

  it('renders category icons', () => {
    render(<PromoSection />);
    // Icons appear multiple times (promo cards + category grid)
    const laptopIcons = screen.getAllByText('💻');
    expect(laptopIcons.length).toBeGreaterThanOrEqual(1);
    const clothingIcons = screen.getAllByText('👕');
    expect(clothingIcons.length).toBeGreaterThanOrEqual(1);
    const homeIcons = screen.getAllByText('🏠');
    expect(homeIcons.length).toBeGreaterThanOrEqual(1);
  });

  it('renders promo card links with correct hrefs', () => {
    render(<PromoSection />);
    const electronicsCard = screen.getByText('Електроніка').closest('a');
    expect(electronicsCard).toHaveAttribute('href', '/category/electronics');

    const clothingCard = screen.getByText('Одяг').closest('a');
    expect(clothingCard).toHaveAttribute('href', '/category/clothing');

    const homeCard = screen.getByText('Дім і сад').closest('a');
    expect(homeCard).toHaveAttribute('href', '/category/home');
  });

  it('renders popular categories section', () => {
    render(<PromoSection />);
    expect(screen.getByText('Популярні категорії')).toBeInTheDocument();
    expect(screen.getByText('Всі категорії')).toBeInTheDocument();
  });

  it('renders category grid items', () => {
    render(<PromoSection />);
    expect(screen.getByText('Смартфони')).toBeInTheDocument();
    expect(screen.getByText('Ноутбуки')).toBeInTheDocument();
    expect(screen.getByText('Телевізори')).toBeInTheDocument();
    expect(screen.getByText('Навушники')).toBeInTheDocument();
    expect(screen.getByText('Годинники')).toBeInTheDocument();
    expect(screen.getByText('Камери')).toBeInTheDocument();
  });

  it('renders category item counts', () => {
    render(<PromoSection />);
    expect(screen.getByText('245 товарів')).toBeInTheDocument();
    expect(screen.getByText('128 товарів')).toBeInTheDocument();
    expect(screen.getByText('89 товарів')).toBeInTheDocument();
    expect(screen.getByText('312 товарів')).toBeInTheDocument();
    expect(screen.getByText('156 товарів')).toBeInTheDocument();
    expect(screen.getByText('67 товарів')).toBeInTheDocument();
  });

  it('renders category icons in grid', () => {
    render(<PromoSection />);
    expect(screen.getByText('📱')).toBeInTheDocument();
    // 💻 appears in promo card and category grid
    const laptopIcons = screen.getAllByText('💻');
    expect(laptopIcons.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('📺')).toBeInTheDocument();
    expect(screen.getByText('🎧')).toBeInTheDocument();
    expect(screen.getByText('⌚')).toBeInTheDocument();
    expect(screen.getByText('📷')).toBeInTheDocument();
  });

  it('renders big sale banner', () => {
    render(<PromoSection />);
    expect(screen.getByText('Великий розпродаж')).toBeInTheDocument();
    expect(screen.getByText('Обмежена пропозиція')).toBeInTheDocument();
    expect(screen.getByText(/Знижки до 70%/)).toBeInTheDocument();
  });

  it('renders sale banner countdown', () => {
    render(<PromoSection />);
    expect(screen.getByText('24')).toBeInTheDocument();
    // 59 appears twice (for minutes and seconds)
    const fiftyNines = screen.getAllByText('59');
    expect(fiftyNines.length).toBe(2);
    expect(screen.getByText('год')).toBeInTheDocument();
    expect(screen.getByText('хв')).toBeInTheDocument();
    // 'сек' appears multiple times
    const sekTexts = screen.getAllByText('сек');
    expect(sekTexts.length).toBeGreaterThanOrEqual(1);
  });

  it('renders sale banner CTA button', () => {
    render(<PromoSection />);
    const saleButton = screen.getByText('Дивитись акції');
    expect(saleButton).toBeInTheDocument();
    expect(saleButton.closest('a')).toHaveAttribute('href', '/sale');
  });

  it('renders decorative emojis in sale banner', () => {
    render(<PromoSection />);
    expect(screen.getByText('🔥')).toBeInTheDocument();
    expect(screen.getByText('💰')).toBeInTheDocument();
    expect(screen.getByText('🎁')).toBeInTheDocument();
  });

  it('renders "Переглянути" links in promo cards', () => {
    render(<PromoSection />);
    const viewLinks = screen.getAllByText('Переглянути');
    expect(viewLinks).toHaveLength(3);
  });

  it('has correct category links', () => {
    render(<PromoSection />);
    const smartphonesLink = screen.getByText('Смартфони').closest('a');
    expect(smartphonesLink).toHaveAttribute('href', '/category/electronics/smartphones');

    const laptopsLink = screen.getByText('Ноутбуки').closest('a');
    expect(laptopsLink).toHaveAttribute('href', '/category/electronics/laptops');
  });

  it('renders all categories link', () => {
    render(<PromoSection />);
    const allCategoriesLink = screen.getByText('Всі категорії').closest('a');
    expect(allCategoriesLink).toHaveAttribute('href', '/categories');
  });
});
