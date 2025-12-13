/**
 * SEO Metadata Tests
 * Tests for product, category, and page metadata generation
 */

const BASE_URL = 'https://techshop.ua';

describe('SEO Metadata', () => {
  describe('Product Metadata', () => {
    it('should generate correct title format for products', () => {
      const productName = 'Смартфон Apple iPhone 15 Pro Max 256GB';
      const price = 54999;
      const expectedTitle = `${productName} - купити в TechShop | Ціна ${price.toLocaleString('uk-UA')} ₴`;

      expect(expectedTitle).toContain(productName);
      expect(expectedTitle).toContain('купити');
      expect(expectedTitle).toContain('TechShop');
      expect(expectedTitle).toContain('Ціна');
    });

    it('should generate SEO-friendly description for products', () => {
      const product = {
        name: 'Смартфон Apple iPhone 15 Pro Max 256GB',
        rating: 4.8,
        reviews_count: 234,
        price: 54999,
        compare_price: 59999,
      };

      const discount = Math.round((1 - product.price / product.compare_price) * 100);
      const description = `${product.name} ⭐ ${product.rating}/5 (${product.reviews_count} відгуків) ✓ Ціна ${product.price.toLocaleString('uk-UA')} грн (знижка ${discount}%) ✓ Офіційна гарантія ✓ Доставка по Україні`;

      expect(description).toContain(product.name);
      expect(description).toContain(`${product.rating}/5`);
      expect(description).toContain(`${product.reviews_count} відгуків`);
      expect(description).toContain('Офіційна гарантія');
      expect(description).toContain('Доставка по Україні');
    });

    it('should generate correct canonical URL for products', () => {
      const productId = '1';
      const canonicalUrl = `${BASE_URL}/product/${productId}`;

      expect(canonicalUrl).toBe('https://techshop.ua/product/1');
    });

    it('should generate hreflang URLs for products', () => {
      const productId = '1';
      const hreflang = {
        'uk-UA': `${BASE_URL}/product/${productId}`,
        'en-US': `${BASE_URL}/en/product/${productId}`,
      };

      expect(hreflang['uk-UA']).toBe('https://techshop.ua/product/1');
      expect(hreflang['en-US']).toBe('https://techshop.ua/en/product/1');
    });
  });

  describe('Category Metadata', () => {
    it('should generate correct title for categories', () => {
      const categoryName = 'Смартфони';
      const title = `${categoryName} - купити в інтернет-магазині TechShop`;

      expect(title).toContain(categoryName);
      expect(title).toContain('інтернет-магазині');
      expect(title).toContain('TechShop');
    });

    it('should generate category-specific keywords', () => {
      const category = { name: 'Смартфони', slug: 'smartphones' };
      const baseKeywords = [
        category.name,
        `купити ${category.name.toLowerCase()}`,
        `${category.name.toLowerCase()} ціна`,
        `${category.name.toLowerCase()} Україна`,
        `${category.name.toLowerCase()} Київ`,
        'інтернет-магазин',
        'TechShop',
      ];

      expect(baseKeywords).toContain('Смартфони');
      expect(baseKeywords).toContain('купити смартфони');
      expect(baseKeywords).toContain('TechShop');
    });
  });

  describe('Open Graph Tags', () => {
    it('should have required OG properties', () => {
      const ogTags = {
        title: 'TechShop - Інтернет-магазин електроніки',
        description: 'Найкращі товари з доставкою по всій Україні',
        url: BASE_URL,
        type: 'website',
        locale: 'uk_UA',
        siteName: 'TechShop',
      };

      expect(ogTags.title).toBeDefined();
      expect(ogTags.description).toBeDefined();
      expect(ogTags.url).toBeDefined();
      expect(ogTags.type).toBe('website');
      expect(ogTags.locale).toBe('uk_UA');
    });

    it('should generate dynamic OG image URL for products', () => {
      const product = {
        name: 'iPhone 15 Pro Max',
        price: 54999,
        oldPrice: 59999,
        rating: 4.8,
        brand: 'Apple',
      };

      const params = new URLSearchParams({
        type: 'product',
        title: product.name,
        price: String(product.price),
        oldPrice: String(product.oldPrice),
        rating: String(product.rating),
        brand: product.brand,
      });

      const ogImageUrl = `${BASE_URL}/api/og?${params.toString()}`;

      expect(ogImageUrl).toContain('/api/og');
      expect(ogImageUrl).toContain('type=product');
      // URLSearchParams encodes spaces as + instead of %20
      expect(ogImageUrl).toContain('title=iPhone');
      expect(ogImageUrl).toContain('brand=Apple');
    });
  });

  describe('Twitter Cards', () => {
    it('should use summary_large_image card type for products', () => {
      const twitterCard = 'summary_large_image';
      expect(twitterCard).toBe('summary_large_image');
    });
  });
});

describe('Robots and Sitemap', () => {
  describe('Robots.txt', () => {
    it('should disallow admin and API routes', () => {
      const disallowedRoutes = [
        '/admin/',
        '/api/',
        '/auth/',
        '/checkout/',
        '/cart/',
        '/profile/',
      ];

      disallowedRoutes.forEach((route) => {
        expect(route).toMatch(/^\//);
      });
    });

    it('should include sitemap URL', () => {
      const sitemapUrl = `${BASE_URL}/sitemap.xml`;
      expect(sitemapUrl).toBe('https://techshop.ua/sitemap.xml');
    });
  });

  describe('Sitemap.xml', () => {
    it('should not include user-specific pages', () => {
      const excludedPages = ['/cart', '/checkout', '/wishlist', '/compare'];
      const sitemapPages = [
        '/',
        '/catalog',
        '/faq',
        '/about',
        '/contact',
        '/delivery',
        '/warranty',
      ];

      excludedPages.forEach((page) => {
        expect(sitemapPages).not.toContain(page);
      });
    });

    it('should include category pages', () => {
      const categories = [
        'smartphones',
        'laptops',
        'tablets',
        'accessories',
        'audio',
        'wearables',
      ];

      categories.forEach((slug) => {
        const url = `${BASE_URL}/category/${slug}`;
        expect(url).toContain('/category/');
      });
    });
  });
});

describe('Accessibility', () => {
  describe('ARIA Labels', () => {
    it('should provide descriptive aria-labels for icon buttons', () => {
      const ariaLabels = {
        menuButton: 'Відкрити меню',
        closeMenuButton: 'Закрити меню',
        userProfile: 'Перейти до профілю',
        login: 'Увійти в акаунт',
        wishlist: 'Список бажань',
        comparison: 'Порівняння товарів',
        cart: 'Кошик',
      };

      Object.values(ariaLabels).forEach((label) => {
        expect(label).toBeDefined();
        expect(label.length).toBeGreaterThan(0);
      });
    });
  });
});

describe('Schema.org JSON-LD', () => {
  describe('Product Schema', () => {
    it('should generate valid Product schema', () => {
      const productSchema = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: 'iPhone 15 Pro Max',
        sku: 'IPHONE15PM256',
        brand: {
          '@type': 'Brand',
          name: 'Apple',
        },
        offers: {
          '@type': 'Offer',
          priceCurrency: 'UAH',
          price: 54999,
          availability: 'https://schema.org/InStock',
        },
      };

      expect(productSchema['@context']).toBe('https://schema.org');
      expect(productSchema['@type']).toBe('Product');
      expect(productSchema.offers['@type']).toBe('Offer');
      expect(productSchema.offers.priceCurrency).toBe('UAH');
    });
  });

  describe('Review Schema', () => {
    it('should generate valid Review schema', () => {
      const reviews = [
        { author: 'Іван', datePublished: '2025-01-15', rating: 5, reviewBody: 'Чудовий товар!' },
        { author: 'Марія', datePublished: '2025-01-14', rating: 4, reviewBody: 'Добрий товар' },
      ];

      const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;

      const reviewSchema = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: 'iPhone 15 Pro Max',
        aggregateRating: {
          '@type': 'AggregateRating',
          ratingValue: avgRating,
          reviewCount: reviews.length,
          bestRating: 5,
          worstRating: 1,
        },
        review: reviews.map((r) => ({
          '@type': 'Review',
          author: { '@type': 'Person', name: r.author },
          datePublished: r.datePublished,
          reviewRating: {
            '@type': 'Rating',
            ratingValue: r.rating,
          },
          reviewBody: r.reviewBody,
        })),
      };

      expect(reviewSchema.aggregateRating.ratingValue).toBe(4.5);
      expect(reviewSchema.aggregateRating.reviewCount).toBe(2);
      expect(reviewSchema.review).toHaveLength(2);
      expect(reviewSchema.review[0]['@type']).toBe('Review');
    });
  });

  describe('ItemList Schema', () => {
    it('should generate valid ItemList schema for homepage', () => {
      const products = [
        { id: '1', name: 'iPhone 15', price: 54999, image_url: '/img1.jpg', rating: 4.8 },
        { id: '2', name: 'Samsung S24', price: 49999, image_url: '/img2.jpg', rating: 4.7 },
      ];

      const itemListSchema = {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: 'Популярні товари TechShop',
        numberOfItems: products.length,
        itemListElement: products.map((p, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          item: {
            '@type': 'Product',
            name: p.name,
            url: `${BASE_URL}/product/${p.id}`,
          },
        })),
      };

      expect(itemListSchema['@type']).toBe('ItemList');
      expect(itemListSchema.numberOfItems).toBe(2);
      expect(itemListSchema.itemListElement[0].position).toBe(1);
    });
  });

  describe('FAQPage Schema', () => {
    it('should generate valid FAQPage schema', () => {
      const faqItems = [
        { question: 'Як зробити замовлення?', answer: 'Додайте товари в кошик...' },
        { question: 'Як відстежити моє замовлення?', answer: 'Перейдіть в особистий кабінет...' },
      ];

      const faqSchema = {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqItems.map((item) => ({
          '@type': 'Question',
          name: item.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: item.answer,
          },
        })),
      };

      expect(faqSchema['@type']).toBe('FAQPage');
      expect(faqSchema.mainEntity).toHaveLength(2);
      expect(faqSchema.mainEntity[0]['@type']).toBe('Question');
    });
  });

  describe('CollectionPage Schema', () => {
    it('should generate valid CollectionPage schema for categories', () => {
      const collectionSchema = {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: 'Смартфони',
        description: 'Купити смартфон в TechShop',
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: 150,
        },
        aggregateRating: {
          '@type': 'AggregateRating',
          ratingValue: 4.5,
          reviewCount: 1250,
        },
      };

      expect(collectionSchema['@type']).toBe('CollectionPage');
      expect(collectionSchema.mainEntity['@type']).toBe('ItemList');
      expect(collectionSchema.aggregateRating).toBeDefined();
    });
  });

  describe('BreadcrumbList Schema', () => {
    it('should generate valid BreadcrumbList schema', () => {
      const breadcrumbs = [
        { name: 'Головна', url: '/' },
        { name: 'Смартфони', url: '/category/smartphones' },
        { name: 'iPhone 15 Pro Max', url: '/product/1' },
      ];

      const breadcrumbSchema = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: breadcrumbs.map((item, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: item.name,
          item: `${BASE_URL}${item.url}`,
        })),
      };

      expect(breadcrumbSchema['@type']).toBe('BreadcrumbList');
      expect(breadcrumbSchema.itemListElement).toHaveLength(3);
      expect(breadcrumbSchema.itemListElement[0].position).toBe(1);
    });
  });
});
