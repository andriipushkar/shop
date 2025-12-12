import { Metadata } from 'next';

export const siteConfig = {
    name: 'TechShop',
    description: 'Інтернет-магазин електроніки та гаджетів. Найкращі ціни на смартфони, ноутбуки, аксесуари.',
    url: 'https://techshop.ua',
    ogImage: 'https://techshop.ua/og-image.jpg',
    keywords: [
        'інтернет-магазин',
        'електроніка',
        'смартфони',
        'ноутбуки',
        'гаджети',
        'техніка',
        'купити телефон',
        'iPhone',
        'Samsung',
        'MacBook',
    ],
    locale: 'uk_UA',
    creator: 'TechShop Ukraine',
    publisher: 'TechShop Ukraine',
    authors: [{ name: 'TechShop', url: 'https://techshop.ua' }],
};

export function generateMetadata(options: {
    title?: string;
    description?: string;
    keywords?: string[];
    image?: string;
    noIndex?: boolean;
    canonical?: string;
}): Metadata {
    const {
        title,
        description = siteConfig.description,
        keywords = [],
        image = siteConfig.ogImage,
        noIndex = false,
        canonical,
    } = options;

    const fullTitle = title ? `${title} | ${siteConfig.name}` : siteConfig.name;

    return {
        title: fullTitle,
        description,
        keywords: [...siteConfig.keywords, ...keywords],
        authors: siteConfig.authors,
        creator: siteConfig.creator,
        publisher: siteConfig.publisher,
        robots: noIndex ? { index: false, follow: false } : { index: true, follow: true },
        alternates: {
            canonical: canonical || siteConfig.url,
        },
        openGraph: {
            type: 'website',
            locale: siteConfig.locale,
            url: canonical || siteConfig.url,
            title: fullTitle,
            description,
            siteName: siteConfig.name,
            images: [
                {
                    url: image,
                    width: 1200,
                    height: 630,
                    alt: fullTitle,
                },
            ],
        },
        twitter: {
            card: 'summary_large_image',
            title: fullTitle,
            description,
            images: [image],
            creator: '@techshop_ua',
        },
    };
}

export function generateProductMetadata(product: {
    name: string;
    description: string;
    price: number;
    image: string;
    sku: string;
    category: string;
    inStock: boolean;
}): Metadata {
    return generateMetadata({
        title: product.name,
        description: product.description,
        keywords: [product.category, product.name, product.sku],
        image: product.image,
        canonical: `${siteConfig.url}/products/${product.sku}`,
    });
}

export function generateProductJsonLd(product: {
    name: string;
    description: string;
    price: number;
    image: string;
    sku: string;
    category: string;
    inStock: boolean;
    rating?: number;
    reviewCount?: number;
}) {
    return {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: product.name,
        description: product.description,
        image: product.image,
        sku: product.sku,
        brand: {
            '@type': 'Brand',
            name: 'TechShop',
        },
        offers: {
            '@type': 'Offer',
            url: `${siteConfig.url}/products/${product.sku}`,
            priceCurrency: 'UAH',
            price: product.price,
            availability: product.inStock
                ? 'https://schema.org/InStock'
                : 'https://schema.org/OutOfStock',
            seller: {
                '@type': 'Organization',
                name: siteConfig.name,
            },
        },
        ...(product.rating && product.reviewCount && {
            aggregateRating: {
                '@type': 'AggregateRating',
                ratingValue: product.rating,
                reviewCount: product.reviewCount,
            },
        }),
    };
}

export function generateCategoryJsonLd(category: {
    name: string;
    description: string;
    url: string;
    image?: string;
}) {
    return {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: category.name,
        description: category.description,
        url: category.url,
        ...(category.image && { image: category.image }),
        isPartOf: {
            '@type': 'WebSite',
            name: siteConfig.name,
            url: siteConfig.url,
        },
    };
}

export function generateOrganizationJsonLd() {
    return {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: siteConfig.name,
        url: siteConfig.url,
        logo: `${siteConfig.url}/logo.png`,
        description: siteConfig.description,
        address: {
            '@type': 'PostalAddress',
            streetAddress: 'вул. Хрещатик, 1',
            addressLocality: 'Київ',
            postalCode: '01001',
            addressCountry: 'UA',
        },
        contactPoint: {
            '@type': 'ContactPoint',
            telephone: '+380-44-123-45-67',
            contactType: 'customer service',
            availableLanguage: ['Ukrainian', 'English'],
        },
        sameAs: [
            'https://www.facebook.com/techshop.ua',
            'https://www.instagram.com/techshop_ua',
            'https://twitter.com/techshop_ua',
            'https://www.youtube.com/techshopua',
        ],
    };
}

export function generateBreadcrumbJsonLd(items: { name: string; url: string }[]) {
    return {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: items.map((item, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: item.name,
            item: item.url,
        })),
    };
}

export function generateFAQJsonLd(faqs: { question: string; answer: string }[]) {
    return {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqs.map(faq => ({
            '@type': 'Question',
            name: faq.question,
            acceptedAnswer: {
                '@type': 'Answer',
                text: faq.answer,
            },
        })),
    };
}

export function generateWebsiteJsonLd() {
    return {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: siteConfig.name,
        url: siteConfig.url,
        description: siteConfig.description,
        potentialAction: {
            '@type': 'SearchAction',
            target: {
                '@type': 'EntryPoint',
                urlTemplate: `${siteConfig.url}/search?q={search_term_string}`,
            },
            'query-input': 'required name=search_term_string',
        },
    };
}
