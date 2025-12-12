import {
    siteConfig,
    generateMetadata,
    generateProductMetadata,
    generateProductJsonLd,
    generateCategoryJsonLd,
    generateOrganizationJsonLd,
    generateBreadcrumbJsonLd,
    generateFAQJsonLd,
    generateWebsiteJsonLd
} from '../../lib/seo-config';

describe('SEO Config', () => {
    describe('siteConfig', () => {
        it('should have required properties', () => {
            expect(siteConfig.name).toBeDefined();
            expect(siteConfig.description).toBeDefined();
            expect(siteConfig.url).toBeDefined();
        });

        it('should have valid URL', () => {
            expect(siteConfig.url).toMatch(/^https?:\/\//);
        });

        it('should have keywords array', () => {
            expect(siteConfig.keywords).toBeDefined();
            expect(Array.isArray(siteConfig.keywords)).toBe(true);
            expect(siteConfig.keywords.length).toBeGreaterThan(0);
        });

        it('should have Ukrainian locale', () => {
            expect(siteConfig.locale).toBe('uk_UA');
        });
    });

    describe('generateMetadata', () => {
        it('should generate metadata with default values', () => {
            const metadata = generateMetadata({});

            expect(metadata.title).toBeDefined();
            expect(metadata.description).toBeDefined();
        });

        it('should append site name to title', () => {
            const metadata = generateMetadata({ title: 'Test Page' });

            expect(metadata.title).toContain('Test Page');
            expect(metadata.title).toContain(siteConfig.name);
        });

        it('should include OpenGraph config', () => {
            const metadata = generateMetadata({ title: 'Test' });

            expect(metadata.openGraph).toBeDefined();
            expect(metadata.openGraph?.type).toBe('website');
        });

        it('should include Twitter card config', () => {
            const metadata = generateMetadata({ title: 'Test' });

            expect(metadata.twitter).toBeDefined();
            expect(metadata.twitter?.card).toBe('summary_large_image');
        });

        it('should handle noIndex option', () => {
            const metadata = generateMetadata({ noIndex: true });

            expect(metadata.robots).toEqual({ index: false, follow: false });
        });

        it('should include custom keywords', () => {
            const metadata = generateMetadata({ keywords: ['custom', 'keyword'] });

            expect(metadata.keywords).toContain('custom');
            expect(metadata.keywords).toContain('keyword');
        });
    });

    describe('generateProductMetadata', () => {
        const mockProduct = {
            name: 'iPhone 15 Pro',
            description: 'Latest Apple smartphone',
            price: 49999,
            image: 'https://example.com/iphone.jpg',
            sku: 'IP15PRO-256',
            category: 'Смартфони',
            inStock: true
        };

        it('should generate product-specific metadata', () => {
            const metadata = generateProductMetadata(mockProduct);

            expect(metadata.title).toContain('iPhone 15 Pro');
            expect(metadata.description).toBe('Latest Apple smartphone');
        });

        it('should include product keywords', () => {
            const metadata = generateProductMetadata(mockProduct);

            expect(metadata.keywords).toContain('Смартфони');
            expect(metadata.keywords).toContain('iPhone 15 Pro');
        });
    });

    describe('generateProductJsonLd', () => {
        const mockProduct = {
            name: 'iPhone 15 Pro',
            description: 'Latest Apple smartphone',
            price: 49999,
            image: 'https://example.com/iphone.jpg',
            sku: 'IP15PRO-256',
            category: 'Смартфони',
            inStock: true,
            rating: 4.8,
            reviewCount: 150
        };

        it('should generate valid JSON-LD structure', () => {
            const jsonLd = generateProductJsonLd(mockProduct);

            expect(jsonLd['@context']).toBe('https://schema.org');
            expect(jsonLd['@type']).toBe('Product');
        });

        it('should include product name and description', () => {
            const jsonLd = generateProductJsonLd(mockProduct);

            expect(jsonLd.name).toBe('iPhone 15 Pro');
            expect(jsonLd.description).toBe('Latest Apple smartphone');
        });

        it('should include price and availability for in-stock product', () => {
            const jsonLd = generateProductJsonLd(mockProduct);

            expect(jsonLd.offers).toBeDefined();
            expect(jsonLd.offers['@type']).toBe('Offer');
            expect(jsonLd.offers.price).toBe(49999);
            expect(jsonLd.offers.priceCurrency).toBe('UAH');
            expect(jsonLd.offers.availability).toBe('https://schema.org/InStock');
        });

        it('should show out of stock for unavailable product', () => {
            const outOfStockProduct = { ...mockProduct, inStock: false };
            const jsonLd = generateProductJsonLd(outOfStockProduct);

            expect(jsonLd.offers.availability).toBe('https://schema.org/OutOfStock');
        });

        it('should include brand information', () => {
            const jsonLd = generateProductJsonLd(mockProduct);

            expect(jsonLd.brand).toBeDefined();
            expect(jsonLd.brand['@type']).toBe('Brand');
        });

        it('should include rating when provided', () => {
            const jsonLd = generateProductJsonLd(mockProduct);

            expect(jsonLd.aggregateRating).toBeDefined();
            expect(jsonLd.aggregateRating.ratingValue).toBe(4.8);
            expect(jsonLd.aggregateRating.reviewCount).toBe(150);
        });

        it('should not include rating when not provided', () => {
            const productWithoutRating = {
                name: 'Test Product',
                description: 'Test Description',
                image: 'https://example.com/image.jpg',
                price: 100,
                sku: 'TEST-001',
                category: 'Test',
                inStock: true
            };

            const jsonLd = generateProductJsonLd(productWithoutRating);

            expect(jsonLd.aggregateRating).toBeUndefined();
        });
    });

    describe('generateCategoryJsonLd', () => {
        const mockCategory = {
            name: 'Смартфони',
            description: 'Купити смартфон за найкращою ціною',
            url: 'https://techshop.ua/category/smartphones'
        };

        it('should generate valid CollectionPage schema', () => {
            const jsonLd = generateCategoryJsonLd(mockCategory);

            expect(jsonLd['@context']).toBe('https://schema.org');
            expect(jsonLd['@type']).toBe('CollectionPage');
        });

        it('should include category details', () => {
            const jsonLd = generateCategoryJsonLd(mockCategory);

            expect(jsonLd.name).toBe('Смартфони');
            expect(jsonLd.description).toBe('Купити смартфон за найкращою ціною');
            expect(jsonLd.url).toBe('https://techshop.ua/category/smartphones');
        });

        it('should include image when provided', () => {
            const categoryWithImage = {
                ...mockCategory,
                image: 'https://example.com/category.jpg'
            };
            const jsonLd = generateCategoryJsonLd(categoryWithImage);

            expect(jsonLd.image).toBe('https://example.com/category.jpg');
        });
    });

    describe('generateOrganizationJsonLd', () => {
        it('should generate valid organization schema', () => {
            const jsonLd = generateOrganizationJsonLd();

            expect(jsonLd['@context']).toBe('https://schema.org');
            expect(jsonLd['@type']).toBe('Organization');
        });

        it('should include organization name', () => {
            const jsonLd = generateOrganizationJsonLd();

            expect(jsonLd.name).toBe(siteConfig.name);
        });

        it('should include URL', () => {
            const jsonLd = generateOrganizationJsonLd();

            expect(jsonLd.url).toBe(siteConfig.url);
        });

        it('should include logo', () => {
            const jsonLd = generateOrganizationJsonLd();

            expect(jsonLd.logo).toBeDefined();
            expect(jsonLd.logo).toContain('logo.png');
        });

        it('should include contact point', () => {
            const jsonLd = generateOrganizationJsonLd();

            expect(jsonLd.contactPoint).toBeDefined();
            expect(jsonLd.contactPoint['@type']).toBe('ContactPoint');
        });

        it('should include address', () => {
            const jsonLd = generateOrganizationJsonLd();

            expect(jsonLd.address).toBeDefined();
            expect(jsonLd.address['@type']).toBe('PostalAddress');
        });

        it('should include social media links', () => {
            const jsonLd = generateOrganizationJsonLd();

            expect(jsonLd.sameAs).toBeDefined();
            expect(Array.isArray(jsonLd.sameAs)).toBe(true);
            expect(jsonLd.sameAs.length).toBeGreaterThan(0);
        });
    });

    describe('generateBreadcrumbJsonLd', () => {
        const breadcrumbs = [
            { name: 'Головна', url: 'https://techshop.ua' },
            { name: 'Смартфони', url: 'https://techshop.ua/category/smartphones' },
            { name: 'iPhone 15 Pro', url: 'https://techshop.ua/products/iphone-15-pro' }
        ];

        it('should generate valid breadcrumb schema', () => {
            const jsonLd = generateBreadcrumbJsonLd(breadcrumbs);

            expect(jsonLd['@context']).toBe('https://schema.org');
            expect(jsonLd['@type']).toBe('BreadcrumbList');
        });

        it('should include all breadcrumb items', () => {
            const jsonLd = generateBreadcrumbJsonLd(breadcrumbs);

            expect(jsonLd.itemListElement).toBeDefined();
            expect(jsonLd.itemListElement.length).toBe(3);
        });

        it('should have correct positions', () => {
            const jsonLd = generateBreadcrumbJsonLd(breadcrumbs);

            expect(jsonLd.itemListElement[0].position).toBe(1);
            expect(jsonLd.itemListElement[1].position).toBe(2);
            expect(jsonLd.itemListElement[2].position).toBe(3);
        });

        it('should include item names and URLs', () => {
            const jsonLd = generateBreadcrumbJsonLd(breadcrumbs);

            expect(jsonLd.itemListElement[0].name).toBe('Головна');
            expect(jsonLd.itemListElement[1].item).toBe('https://techshop.ua/category/smartphones');
        });
    });

    describe('generateFAQJsonLd', () => {
        const faqs = [
            { question: 'Як оформити замовлення?', answer: 'Додайте товар в кошик і оформіть замовлення.' },
            { question: 'Яка вартість доставки?', answer: 'Безкоштовна доставка при замовленні від 1000 грн.' }
        ];

        it('should generate valid FAQ schema', () => {
            const jsonLd = generateFAQJsonLd(faqs);

            expect(jsonLd['@context']).toBe('https://schema.org');
            expect(jsonLd['@type']).toBe('FAQPage');
        });

        it('should include all FAQ items', () => {
            const jsonLd = generateFAQJsonLd(faqs);

            expect(jsonLd.mainEntity).toBeDefined();
            expect(jsonLd.mainEntity.length).toBe(2);
        });

        it('should have correct question and answer structure', () => {
            const jsonLd = generateFAQJsonLd(faqs);

            expect(jsonLd.mainEntity[0]['@type']).toBe('Question');
            expect(jsonLd.mainEntity[0].name).toBe('Як оформити замовлення?');
            expect(jsonLd.mainEntity[0].acceptedAnswer['@type']).toBe('Answer');
            expect(jsonLd.mainEntity[0].acceptedAnswer.text).toBe('Додайте товар в кошик і оформіть замовлення.');
        });
    });

    describe('generateWebsiteJsonLd', () => {
        it('should generate valid website schema', () => {
            const jsonLd = generateWebsiteJsonLd();

            expect(jsonLd['@context']).toBe('https://schema.org');
            expect(jsonLd['@type']).toBe('WebSite');
        });

        it('should include search action', () => {
            const jsonLd = generateWebsiteJsonLd();

            expect(jsonLd.potentialAction).toBeDefined();
            expect(jsonLd.potentialAction['@type']).toBe('SearchAction');
        });

        it('should have proper URL template for search', () => {
            const jsonLd = generateWebsiteJsonLd();

            expect(jsonLd.potentialAction.target.urlTemplate).toContain('{search_term_string}');
        });
    });
});

describe('SEO Best Practices', () => {
    it('should have appropriate description length', () => {
        // Description should be 50-160 characters for optimal SEO
        expect(siteConfig.description.length).toBeLessThanOrEqual(200);
        expect(siteConfig.description.length).toBeGreaterThan(50);
    });

    it('should have HTTPS URL', () => {
        expect(siteConfig.url).toMatch(/^https:\/\//);
    });

    it('should include essential keywords', () => {
        const essentialKeywords = ['інтернет-магазин', 'електроніка'];
        essentialKeywords.forEach(keyword => {
            expect(siteConfig.keywords).toContain(keyword);
        });
    });
});
