import React from 'react';
import { render, screen } from '@testing-library/react';
import Footer from '@/components/Footer';

describe('Footer', () => {
  it('renders the newsletter section', () => {
    render(<Footer />);
    expect(screen.getByText('Підпишіться на знижки')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Ваш email')).toBeInTheDocument();
    expect(screen.getByText('Підписатися')).toBeInTheDocument();
  });

  it('renders the company logo and name', () => {
    render(<Footer />);
    expect(screen.getByText('MyShop')).toBeInTheDocument();
    expect(screen.getByText('M')).toBeInTheDocument();
  });

  it('renders category links', () => {
    render(<Footer />);
    expect(screen.getByText('Категорії')).toBeInTheDocument();
    expect(screen.getByText('Електроніка')).toBeInTheDocument();
    expect(screen.getByText('Одяг')).toBeInTheDocument();
    expect(screen.getByText('Дім і сад')).toBeInTheDocument();
    expect(screen.getByText('Спорт')).toBeInTheDocument();
    expect(screen.getByText('Краса')).toBeInTheDocument();
  });

  it('renders customer service links', () => {
    render(<Footer />);
    expect(screen.getByText('Покупцям')).toBeInTheDocument();
    expect(screen.getByText('Доставка та оплата')).toBeInTheDocument();
    expect(screen.getByText('Повернення товару')).toBeInTheDocument();
    expect(screen.getByText('Часті питання')).toBeInTheDocument();
  });

  it('renders company links', () => {
    render(<Footer />);
    expect(screen.getByText('Компанія')).toBeInTheDocument();
    expect(screen.getByText('Про нас')).toBeInTheDocument();
    expect(screen.getByText('FAQ')).toBeInTheDocument();
  });

  it('renders contact information', () => {
    render(<Footer />);
    // "Контакти" appears multiple times (in customerLinks and as section header)
    const contactTexts = screen.getAllByText('Контакти');
    expect(contactTexts.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('0 800 123 456')).toBeInTheDocument();
    expect(screen.getByText('support@myshop.ua')).toBeInTheDocument();
    expect(screen.getByText('м. Київ, вул. Хрещатик, 1')).toBeInTheDocument();
  });

  it('renders working hours', () => {
    render(<Footer />);
    expect(screen.getByText('Пн-Пт: 9:00-20:00')).toBeInTheDocument();
    expect(screen.getByText('Сб-Нд: 10:00-18:00')).toBeInTheDocument();
  });

  it('renders social media links', () => {
    render(<Footer />);
    expect(screen.getByLabelText('Facebook')).toBeInTheDocument();
    expect(screen.getByLabelText('Instagram')).toBeInTheDocument();
    expect(screen.getByLabelText('Telegram')).toBeInTheDocument();
    expect(screen.getByLabelText('YouTube')).toBeInTheDocument();
  });

  it('renders payment methods', () => {
    render(<Footer />);
    expect(screen.getByText('Способи оплати')).toBeInTheDocument();
    expect(screen.getByText('VISA')).toBeInTheDocument();
    expect(screen.getByText('Mastercard')).toBeInTheDocument();
    expect(screen.getByText('LiqPay')).toBeInTheDocument();
    expect(screen.getByText('Monobank')).toBeInTheDocument();
    expect(screen.getByText('Privat24')).toBeInTheDocument();
  });

  it('renders delivery partners', () => {
    render(<Footer />);
    expect(screen.getByText('Служби доставки')).toBeInTheDocument();
    expect(screen.getByText('Нова Пошта')).toBeInTheDocument();
    expect(screen.getByText('Укрпошта')).toBeInTheDocument();
    expect(screen.getByText('Meest')).toBeInTheDocument();
    expect(screen.getByText('Самовивіз')).toBeInTheDocument();
  });

  it('renders copyright with current year', () => {
    render(<Footer />);
    const currentYear = new Date().getFullYear();
    expect(screen.getByText(`© ${currentYear} MyShop. Всі права захищено.`)).toBeInTheDocument();
  });

  it('renders legal links', () => {
    render(<Footer />);
    expect(screen.getByText('Політика конфіденційності')).toBeInTheDocument();
    expect(screen.getByText('Умови використання')).toBeInTheDocument();
    expect(screen.getByText('Cookies')).toBeInTheDocument();
  });

  it('has correct link hrefs', () => {
    render(<Footer />);
    expect(screen.getByText('Електроніка').closest('a')).toHaveAttribute('href', '/category/electronics');
    expect(screen.getByText('Доставка та оплата').closest('a')).toHaveAttribute('href', '/delivery');
    expect(screen.getByText('Про нас').closest('a')).toHaveAttribute('href', '/about');
  });
});
