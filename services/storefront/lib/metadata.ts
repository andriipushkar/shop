import { Metadata } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://techshop.ua';

// Helper to generate canonical URL
export function getCanonicalUrl(path: string): string {
  return `${BASE_URL}${path}`;
}

// Common metadata defaults
const defaultMetadata = {
  siteName: 'TechShop',
  locale: 'uk_UA',
};

// Page-specific metadata configurations
export const pageMetadata: Record<string, Metadata> = {
  // Public pages - indexable
  about: {
    title: 'Про нас',
    description: 'TechShop - надійний інтернет-магазин електроніки в Україні. Дізнайтесь більше про нашу компанію, цінності та команду.',
    keywords: ['про нас', 'TechShop', 'інтернет-магазин', 'електроніка', 'Україна'],
    alternates: {
      canonical: getCanonicalUrl('/about'),
    },
    openGraph: {
      title: 'Про нас | TechShop',
      description: 'TechShop - надійний інтернет-магазин електроніки в Україні.',
      url: getCanonicalUrl('/about'),
      siteName: defaultMetadata.siteName,
      locale: defaultMetadata.locale,
      type: 'website',
    },
  },

  contact: {
    title: 'Контакти',
    description: 'Зв\'яжіться з TechShop: телефон, email, адреса магазину. Графік роботи та форма зворотного зв\'язку.',
    keywords: ['контакти', 'телефон', 'адреса', 'TechShop', 'підтримка'],
    alternates: {
      canonical: getCanonicalUrl('/contact'),
    },
    openGraph: {
      title: 'Контакти | TechShop',
      description: 'Зв\'яжіться з TechShop: телефон, email, адреса магазину.',
      url: getCanonicalUrl('/contact'),
      siteName: defaultMetadata.siteName,
      locale: defaultMetadata.locale,
      type: 'website',
    },
  },

  faq: {
    title: 'Часті питання (FAQ)',
    description: 'Відповіді на найпопулярніші питання про замовлення, доставку, оплату та повернення товарів у TechShop.',
    keywords: ['FAQ', 'питання', 'відповіді', 'допомога', 'TechShop'],
    alternates: {
      canonical: getCanonicalUrl('/faq'),
    },
    openGraph: {
      title: 'FAQ | TechShop',
      description: 'Відповіді на найпопулярніші питання про замовлення та доставку.',
      url: getCanonicalUrl('/faq'),
      siteName: defaultMetadata.siteName,
      locale: defaultMetadata.locale,
      type: 'website',
    },
  },

  returns: {
    title: 'Повернення та обмін',
    description: 'Умови повернення та обміну товарів у TechShop. 14 днів на повернення, безкоштовна доставка при обміні.',
    keywords: ['повернення', 'обмін', 'гарантія', 'TechShop'],
    alternates: {
      canonical: getCanonicalUrl('/returns'),
    },
    openGraph: {
      title: 'Повернення та обмін | TechShop',
      description: 'Умови повернення та обміну товарів у TechShop.',
      url: getCanonicalUrl('/returns'),
      siteName: defaultMetadata.siteName,
      locale: defaultMetadata.locale,
      type: 'website',
    },
  },

  'gift-cards': {
    title: 'Подарункові сертифікати',
    description: 'Подарункові сертифікати TechShop - ідеальний подарунок для любителів техніки. Номінали від 500 до 10000 грн.',
    keywords: ['подарунковий сертифікат', 'подарунок', 'TechShop', 'електроніка'],
    alternates: {
      canonical: getCanonicalUrl('/gift-cards'),
    },
    openGraph: {
      title: 'Подарункові сертифікати | TechShop',
      description: 'Подарункові сертифікати TechShop - ідеальний подарунок.',
      url: getCanonicalUrl('/gift-cards'),
      siteName: defaultMetadata.siteName,
      locale: defaultMetadata.locale,
      type: 'website',
    },
  },

  tracking: {
    title: 'Відстеження посилки',
    description: 'Відстежуйте статус доставки вашого замовлення за номером ТТН Нової Пошти.',
    keywords: ['відстеження', 'ТТН', 'Нова Пошта', 'доставка', 'посилка'],
    alternates: {
      canonical: getCanonicalUrl('/tracking'),
    },
    openGraph: {
      title: 'Відстеження посилки | TechShop',
      description: 'Відстежуйте статус доставки вашого замовлення.',
      url: getCanonicalUrl('/tracking'),
      siteName: defaultMetadata.siteName,
      locale: defaultMetadata.locale,
      type: 'website',
    },
  },

  loyalty: {
    title: 'Програма лояльності',
    description: 'Програма лояльності TechShop: накопичуйте бали, отримуйте знижки та ексклюзивні пропозиції.',
    keywords: ['лояльність', 'бонуси', 'бали', 'знижки', 'TechShop'],
    alternates: {
      canonical: getCanonicalUrl('/loyalty'),
    },
    openGraph: {
      title: 'Програма лояльності | TechShop',
      description: 'Накопичуйте бали та отримуйте знижки в TechShop.',
      url: getCanonicalUrl('/loyalty'),
      siteName: defaultMetadata.siteName,
      locale: defaultMetadata.locale,
      type: 'website',
    },
  },

  search: {
    title: 'Пошук товарів',
    description: 'Пошук товарів у каталозі TechShop. Знайдіть потрібну електроніку за найкращими цінами.',
    robots: {
      index: false, // Search result pages should not be indexed
      follow: true,
    },
    alternates: {
      canonical: getCanonicalUrl('/search'),
      languages: {
        'uk-UA': getCanonicalUrl('/search'),
        'en-US': getCanonicalUrl('/en/search'),
      },
    },
    openGraph: {
      title: 'Пошук | TechShop',
      description: 'Пошук товарів у каталозі TechShop.',
      url: getCanonicalUrl('/search'),
      siteName: defaultMetadata.siteName,
      locale: defaultMetadata.locale,
      type: 'website',
    },
  },

  // Private pages - noindex
  cart: {
    title: 'Кошик',
    description: 'Ваш кошик покупок у TechShop.',
    robots: {
      index: false,
      follow: true,
    },
    alternates: {
      canonical: getCanonicalUrl('/cart'),
    },
  },

  checkout: {
    title: 'Оформлення замовлення',
    description: 'Оформлення замовлення у TechShop.',
    robots: {
      index: false,
      follow: false,
    },
    alternates: {
      canonical: getCanonicalUrl('/checkout'),
    },
  },

  wishlist: {
    title: 'Список бажань',
    description: 'Ваш список бажань у TechShop.',
    robots: {
      index: false,
      follow: true,
    },
    alternates: {
      canonical: getCanonicalUrl('/wishlist'),
    },
  },

  comparison: {
    title: 'Порівняння товарів',
    description: 'Порівняння товарів у TechShop.',
    robots: {
      index: false,
      follow: true,
    },
    alternates: {
      canonical: getCanonicalUrl('/comparison'),
    },
  },

  orders: {
    title: 'Мої замовлення',
    description: 'Історія ваших замовлень у TechShop.',
    robots: {
      index: false,
      follow: false,
    },
    alternates: {
      canonical: getCanonicalUrl('/orders'),
    },
  },

  account: {
    title: 'Особистий кабінет',
    description: 'Ваш особистий кабінет у TechShop.',
    robots: {
      index: false,
      follow: false,
    },
    alternates: {
      canonical: getCanonicalUrl('/account'),
    },
  },

  offline: {
    title: 'Офлайн',
    description: 'Ви зараз офлайн. Перевірте підключення до інтернету.',
    robots: {
      index: false,
      follow: false,
    },
  },

  'not-found': {
    title: 'Сторінку не знайдено (404)',
    description: 'На жаль, сторінку не знайдено. Поверніться на головну або скористайтесь пошуком.',
    robots: {
      index: false,
      follow: true,
    },
  },

  login: {
    title: 'Вхід в акаунт',
    description: 'Увійдіть у свій акаунт TechShop.',
    robots: {
      index: false,
      follow: true,
    },
    alternates: {
      canonical: getCanonicalUrl('/auth/login'),
    },
  },

  register: {
    title: 'Реєстрація',
    description: 'Створіть акаунт у TechShop.',
    robots: {
      index: false,
      follow: true,
    },
    alternates: {
      canonical: getCanonicalUrl('/auth/register'),
    },
  },
};

// Helper to get metadata for a page
export function getPageMetadata(pageName: string): Metadata {
  return pageMetadata[pageName] || {};
}
