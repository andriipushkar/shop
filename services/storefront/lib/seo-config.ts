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

// ============ NEW SEO HELPERS ============

/**
 * Generate hreflang alternates for a page
 */
export function generateHreflangAlternates(path: string) {
    const baseUrl = siteConfig.url;
    return {
        canonical: `${baseUrl}${path}`,
        languages: {
            'uk-UA': `${baseUrl}${path}`,
            'en-US': `${baseUrl}/en${path}`,
            'x-default': `${baseUrl}${path}`,
        },
    };
}

/**
 * Generate pagination metadata for category/search pages
 */
export function generatePaginationMeta(options: {
    currentPage: number;
    totalPages: number;
    basePath: string;
    queryParams?: Record<string, string>;
}) {
    const { currentPage, totalPages, basePath, queryParams = {} } = options;
    const baseUrl = siteConfig.url;

    const buildUrl = (page: number) => {
        const params = new URLSearchParams(queryParams);
        if (page > 1) params.set('page', String(page));
        const queryString = params.toString();
        return `${baseUrl}${basePath}${queryString ? `?${queryString}` : ''}`;
    };

    return {
        canonical: buildUrl(currentPage),
        prev: currentPage > 1 ? buildUrl(currentPage - 1) : undefined,
        next: currentPage < totalPages ? buildUrl(currentPage + 1) : undefined,
    };
}

/**
 * Generate VideoObject JSON-LD for product videos
 */
export function generateVideoObjectJsonLd(video: {
    name: string;
    description: string;
    thumbnailUrl: string;
    uploadDate: string;
    duration?: string; // ISO 8601 duration format (e.g., "PT1M30S")
    contentUrl?: string;
    embedUrl?: string;
}) {
    return {
        '@context': 'https://schema.org',
        '@type': 'VideoObject',
        name: video.name,
        description: video.description,
        thumbnailUrl: video.thumbnailUrl,
        uploadDate: video.uploadDate,
        ...(video.duration && { duration: video.duration }),
        ...(video.contentUrl && { contentUrl: video.contentUrl }),
        ...(video.embedUrl && { embedUrl: video.embedUrl }),
    };
}

/**
 * Generate HowTo JSON-LD for product guides
 */
export function generateHowToJsonLd(howTo: {
    name: string;
    description: string;
    image?: string;
    totalTime?: string; // ISO 8601 duration
    steps: {
        name: string;
        text: string;
        image?: string;
    }[];
}) {
    return {
        '@context': 'https://schema.org',
        '@type': 'HowTo',
        name: howTo.name,
        description: howTo.description,
        ...(howTo.image && { image: howTo.image }),
        ...(howTo.totalTime && { totalTime: howTo.totalTime }),
        step: howTo.steps.map((step, index) => ({
            '@type': 'HowToStep',
            position: index + 1,
            name: step.name,
            text: step.text,
            ...(step.image && { image: step.image }),
        })),
    };
}

/**
 * Generate AggregateOffer JSON-LD for category pages
 */
export function generateAggregateOfferJsonLd(offer: {
    lowPrice: number;
    highPrice: number;
    offerCount: number;
    priceCurrency?: string;
}) {
    return {
        '@type': 'AggregateOffer',
        lowPrice: offer.lowPrice,
        highPrice: offer.highPrice,
        offerCount: offer.offerCount,
        priceCurrency: offer.priceCurrency || 'UAH',
    };
}

/**
 * Generate extended Product JSON-LD with warranty and shipping
 */
export function generateExtendedProductJsonLd(product: {
    name: string;
    description: string;
    price: number;
    comparePrice?: number;
    image: string;
    images?: string[];
    sku: string;
    brand: string;
    category: string;
    inStock: boolean;
    stockCount?: number;
    rating?: number;
    reviewCount?: number;
    condition?: 'NewCondition' | 'UsedCondition' | 'RefurbishedCondition';
    warranty?: {
        durationMonths: number;
        type: 'manufacturer' | 'seller';
    };
    shipping?: {
        freeShippingThreshold?: number;
        deliveryDays: { min: number; max: number };
    };
    returnPolicy?: {
        days: number;
        type: 'full' | 'exchange';
    };
}) {
    const baseUrl = siteConfig.url;

    return {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: product.name,
        description: product.description,
        image: product.images?.length ? product.images : [product.image],
        sku: product.sku,
        mpn: product.sku,
        brand: {
            '@type': 'Brand',
            name: product.brand,
        },
        category: product.category,
        offers: {
            '@type': 'Offer',
            url: `${baseUrl}/product/${product.sku}`,
            priceCurrency: 'UAH',
            price: product.price,
            ...(product.comparePrice && {
                priceSpecification: {
                    '@type': 'PriceSpecification',
                    price: product.price,
                    priceCurrency: 'UAH',
                    valueAddedTaxIncluded: true,
                },
            }),
            priceValidUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            availability: product.inStock
                ? product.stockCount && product.stockCount < 5
                    ? 'https://schema.org/LimitedAvailability'
                    : 'https://schema.org/InStock'
                : 'https://schema.org/OutOfStock',
            itemCondition: `https://schema.org/${product.condition || 'NewCondition'}`,
            seller: {
                '@type': 'Organization',
                name: siteConfig.name,
                url: baseUrl,
            },
            ...(product.shipping && {
                shippingDetails: {
                    '@type': 'OfferShippingDetails',
                    shippingRate: {
                        '@type': 'MonetaryAmount',
                        value: product.shipping.freeShippingThreshold ? 0 : 50,
                        currency: 'UAH',
                    },
                    shippingDestination: {
                        '@type': 'DefinedRegion',
                        addressCountry: 'UA',
                    },
                    deliveryTime: {
                        '@type': 'ShippingDeliveryTime',
                        handlingTime: {
                            '@type': 'QuantitativeValue',
                            minValue: 0,
                            maxValue: 1,
                            unitCode: 'DAY',
                        },
                        transitTime: {
                            '@type': 'QuantitativeValue',
                            minValue: product.shipping.deliveryDays.min,
                            maxValue: product.shipping.deliveryDays.max,
                            unitCode: 'DAY',
                        },
                    },
                },
            }),
            ...(product.returnPolicy && {
                hasMerchantReturnPolicy: {
                    '@type': 'MerchantReturnPolicy',
                    applicableCountry: 'UA',
                    returnPolicyCategory: product.returnPolicy.type === 'full'
                        ? 'https://schema.org/MerchantReturnFiniteReturnWindow'
                        : 'https://schema.org/MerchantReturnNotPermitted',
                    merchantReturnDays: product.returnPolicy.days,
                    returnMethod: 'https://schema.org/ReturnByMail',
                    returnFees: 'https://schema.org/FreeReturn',
                },
            }),
        },
        ...(product.warranty && {
            warranty: {
                '@type': 'WarrantyPromise',
                durationOfWarranty: {
                    '@type': 'QuantitativeValue',
                    value: product.warranty.durationMonths,
                    unitCode: 'MON',
                },
                warrantyScope: product.warranty.type === 'manufacturer'
                    ? 'https://schema.org/ManufacturerWarranty'
                    : 'https://schema.org/SellerWarranty',
            },
        }),
        ...(product.rating && product.reviewCount && {
            aggregateRating: {
                '@type': 'AggregateRating',
                ratingValue: product.rating,
                reviewCount: product.reviewCount,
                bestRating: 5,
                worstRating: 1,
            },
        }),
    };
}

/**
 * Generate Pinterest Rich Pins metadata
 */
export function generatePinterestMeta(product: {
    name: string;
    price: number;
    currency?: string;
    availability: 'in stock' | 'out of stock' | 'preorder';
}) {
    return {
        'og:type': 'product',
        'product:price:amount': String(product.price),
        'product:price:currency': product.currency || 'UAH',
        'product:availability': product.availability,
    };
}

/**
 * Generate dynamic search page metadata
 */
export function generateSearchMetadata(options: {
    query?: string;
    resultsCount: number;
    page?: number;
}) {
    const { query, resultsCount, page = 1 } = options;
    const baseUrl = siteConfig.url;

    const title = query
        ? `"${query}" - результати пошуку (${resultsCount} товарів)`
        : 'Пошук товарів';

    const description = query
        ? `Знайдено ${resultsCount} товарів за запитом "${query}" в TechShop. Смартфони, ноутбуки, електроніка з доставкою по Україні.`
        : 'Пошук товарів в інтернет-магазині TechShop. Електроніка, смартфони, ноутбуки та аксесуари.';

    const canonical = query
        ? `${baseUrl}/search?q=${encodeURIComponent(query)}${page > 1 ? `&page=${page}` : ''}`
        : `${baseUrl}/search`;

    return {
        title,
        description,
        alternates: {
            canonical,
        },
        robots: {
            index: !!query && resultsCount > 0,
            follow: true,
        },
        openGraph: {
            title,
            description,
            url: canonical,
            type: 'website',
        },
    };
}
