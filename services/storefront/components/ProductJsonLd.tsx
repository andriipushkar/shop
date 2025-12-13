'use client';

interface ProductJsonLdProps {
  product: {
    id: string;
    name: string;
    description?: string;
    price: number;
    compare_price?: number;
    sku?: string;
    stock: number;
    brand?: string;
    image_url?: string;
    images?: string[];
    category?: {
      name: string;
      path?: string[];
    };
    rating?: number;
    reviewCount?: number;
  };
}

export default function ProductJsonLd({ product }: ProductJsonLdProps) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://techshop.ua';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description || product.name,
    sku: product.sku || product.id,
    mpn: product.sku || product.id,
    brand: product.brand ? {
      '@type': 'Brand',
      name: product.brand,
    } : undefined,
    image: product.images?.length
      ? product.images.map(img => img.startsWith('http') ? img : `${baseUrl}${img}`)
      : product.image_url
        ? [product.image_url.startsWith('http') ? product.image_url : `${baseUrl}${product.image_url}`]
        : undefined,
    url: `${baseUrl}/product/${product.id}`,
    offers: {
      '@type': 'Offer',
      url: `${baseUrl}/product/${product.id}`,
      priceCurrency: 'UAH',
      price: product.price,
      priceValidUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      availability: product.stock > 0
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
      seller: {
        '@type': 'Organization',
        name: 'TechShop',
      },
    },
    aggregateRating: product.rating && product.reviewCount ? {
      '@type': 'AggregateRating',
      ratingValue: product.rating,
      reviewCount: product.reviewCount,
      bestRating: 5,
      worstRating: 1,
    } : undefined,
    category: product.category?.path?.join(' > ') || product.category?.name,
  };

  // Remove undefined values
  const cleanJsonLd = JSON.parse(JSON.stringify(jsonLd));

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(cleanJsonLd) }}
    />
  );
}

// Organization JSON-LD for the site
export function OrganizationJsonLd() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://techshop.ua';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'TechShop',
    url: baseUrl,
    logo: `${baseUrl}/logo.png`,
    description: 'Інтернет-магазин електроніки з доставкою по всій Україні',
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'UA',
      addressLocality: 'Київ',
    },
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: '+380-44-123-4567',
      contactType: 'customer service',
      availableLanguage: ['Ukrainian', 'English'],
    },
    sameAs: [
      'https://www.facebook.com/techshop',
      'https://www.instagram.com/techshop',
      'https://t.me/techshop',
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

// Breadcrumb JSON-LD
interface BreadcrumbJsonLdProps {
  items: { name: string; url: string }[];
}

export function BreadcrumbJsonLd({ items }: BreadcrumbJsonLdProps) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://techshop.ua';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url.startsWith('http') ? item.url : `${baseUrl}${item.url}`,
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

// WebSite JSON-LD with SearchAction
export function WebSiteJsonLd() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://techshop.ua';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'TechShop',
    url: baseUrl,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${baseUrl}/?search={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

// FAQ JSON-LD for FAQ pages
interface FAQItem {
  question: string;
  answer: string;
}

interface FAQJsonLdProps {
  items: FAQItem[];
}

export function FAQJsonLd({ items }: FAQJsonLdProps) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

// Contact Page JSON-LD
export function ContactPageJsonLd() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://techshop.ua';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ContactPage',
    name: 'Контакти TechShop',
    description: 'Зв\'яжіться з нами для отримання допомоги або консультації',
    url: `${baseUrl}/contact`,
    mainEntity: {
      '@type': 'Organization',
      name: 'TechShop',
      url: baseUrl,
      logo: `${baseUrl}/logo.png`,
      telephone: '+380-44-123-4567',
      email: 'support@techshop.ua',
      address: {
        '@type': 'PostalAddress',
        streetAddress: 'вул. Хрещатик, 1',
        addressLocality: 'Київ',
        postalCode: '01001',
        addressCountry: 'UA',
      },
      openingHoursSpecification: [
        {
          '@type': 'OpeningHoursSpecification',
          dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
          opens: '09:00',
          closes: '18:00',
        },
        {
          '@type': 'OpeningHoursSpecification',
          dayOfWeek: 'Saturday',
          opens: '10:00',
          closes: '15:00',
        },
      ],
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

// Collection/Category Page JSON-LD with AggregateRating
interface CollectionPageJsonLdProps {
  name: string;
  description?: string;
  url: string;
  itemCount?: number;
  aggregateRating?: {
    ratingValue: number;
    reviewCount: number;
  };
  priceRange?: {
    minPrice: number;
    maxPrice: number;
  };
  breadcrumbItems?: { name: string; url: string }[];
}

export function CollectionPageJsonLd({
  name,
  description,
  url,
  itemCount,
  aggregateRating,
  priceRange,
  breadcrumbItems,
}: CollectionPageJsonLdProps) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://techshop.ua';
  const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name,
    description: description || `${name} - купити в інтернет-магазині TechShop`,
    url: fullUrl,
    isPartOf: {
      '@type': 'WebSite',
      name: 'TechShop',
      url: baseUrl,
    },
    mainEntity: {
      '@type': 'ItemList',
      name: `Товари категорії ${name}`,
      numberOfItems: itemCount,
      itemListOrder: 'https://schema.org/ItemListOrderDescending',
    },
    ...(aggregateRating && aggregateRating.reviewCount > 0 && {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: aggregateRating.ratingValue,
        reviewCount: aggregateRating.reviewCount,
        bestRating: 5,
        worstRating: 1,
      },
    }),
    ...(priceRange && {
      offers: {
        '@type': 'AggregateOffer',
        priceCurrency: 'UAH',
        lowPrice: priceRange.minPrice,
        highPrice: priceRange.maxPrice,
        offerCount: itemCount,
      },
    }),
    ...(breadcrumbItems && breadcrumbItems.length > 0 && {
      breadcrumb: {
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Головна',
            item: baseUrl,
          },
          ...breadcrumbItems.map((item, index) => ({
            '@type': 'ListItem',
            position: index + 2,
            name: item.name,
            item: item.url.startsWith('http') ? item.url : `${baseUrl}${item.url}`,
          })),
        ],
      },
    }),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

// ItemList JSON-LD for product listings (SEO for category pages)
interface ItemListJsonLdProps {
  name: string;
  description?: string;
  products: {
    id: string;
    name: string;
    price: number;
    image_url?: string;
    rating?: number;
  }[];
  url: string;
}

export function ItemListJsonLd({ name, description, products, url }: ItemListJsonLdProps) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://techshop.ua';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name,
    description,
    url: url.startsWith('http') ? url : `${baseUrl}${url}`,
    numberOfItems: products.length,
    itemListElement: products.slice(0, 20).map((product, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'Product',
        name: product.name,
        url: `${baseUrl}/product/${product.id}`,
        image: product.image_url,
        offers: {
          '@type': 'Offer',
          priceCurrency: 'UAH',
          price: product.price,
          availability: 'https://schema.org/InStock',
        },
        ...(product.rating && {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: product.rating,
            bestRating: 5,
          },
        }),
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

// Review JSON-LD for product reviews
interface ReviewJsonLdProps {
  productName: string;
  productId: string;
  reviews: {
    author: string;
    datePublished: string;
    rating: number;
    reviewBody: string;
  }[];
}

export function ReviewJsonLd({ productName, productId, reviews }: ReviewJsonLdProps) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://techshop.ua';

  // Calculate aggregate rating
  const avgRating = reviews.length > 0
    ? Number((reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1))
    : 0;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: productName,
    url: `${baseUrl}/product/${productId}`,
    aggregateRating: reviews.length > 0 ? {
      '@type': 'AggregateRating',
      ratingValue: avgRating,
      reviewCount: reviews.length,
      bestRating: 5,
      worstRating: 1,
    } : undefined,
    review: reviews.map((review) => ({
      '@type': 'Review',
      author: {
        '@type': 'Person',
        name: review.author,
      },
      datePublished: review.datePublished,
      reviewRating: {
        '@type': 'Rating',
        ratingValue: review.rating,
        bestRating: 5,
        worstRating: 1,
      },
      reviewBody: review.reviewBody,
    })),
  };

  // Remove undefined values
  const cleanJsonLd = JSON.parse(JSON.stringify(jsonLd));

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(cleanJsonLd) }}
    />
  );
}

// Single Review JSON-LD
interface SingleReviewJsonLdProps {
  author: string;
  datePublished: string;
  rating: number;
  reviewBody: string;
  itemReviewed: {
    name: string;
    url: string;
  };
}

export function SingleReviewJsonLd({
  author,
  datePublished,
  rating,
  reviewBody,
  itemReviewed,
}: SingleReviewJsonLdProps) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Review',
    author: {
      '@type': 'Person',
      name: author,
    },
    datePublished,
    reviewRating: {
      '@type': 'Rating',
      ratingValue: rating,
      bestRating: 5,
      worstRating: 1,
    },
    reviewBody,
    itemReviewed: {
      '@type': 'Product',
      name: itemReviewed.name,
      url: itemReviewed.url,
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

// VideoObject JSON-LD for product videos
interface VideoObjectJsonLdProps {
  name: string;
  description: string;
  thumbnailUrl: string;
  uploadDate: string;
  duration?: string; // ISO 8601 format (e.g., "PT1M30S")
  contentUrl?: string;
  embedUrl?: string;
}

export function VideoObjectJsonLd({
  name,
  description,
  thumbnailUrl,
  uploadDate,
  duration,
  contentUrl,
  embedUrl,
}: VideoObjectJsonLdProps) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name,
    description,
    thumbnailUrl,
    uploadDate,
    ...(duration && { duration }),
    ...(contentUrl && { contentUrl }),
    ...(embedUrl && { embedUrl }),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

// HowTo JSON-LD for product setup guides
interface HowToStep {
  name: string;
  text: string;
  image?: string;
}

interface HowToJsonLdProps {
  name: string;
  description: string;
  image?: string;
  totalTime?: string; // ISO 8601 duration
  steps: HowToStep[];
}

export function HowToJsonLd({
  name,
  description,
  image,
  totalTime,
  steps,
}: HowToJsonLdProps) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name,
    description,
    ...(image && { image }),
    ...(totalTime && { totalTime }),
    step: steps.map((step, index) => ({
      '@type': 'HowToStep',
      position: index + 1,
      name: step.name,
      text: step.text,
      ...(step.image && { image: step.image }),
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

// Extended Product JSON-LD with warranty and shipping
interface ExtendedProductJsonLdProps {
  product: {
    id: string;
    name: string;
    description?: string;
    price: number;
    compare_price?: number;
    sku?: string;
    stock: number;
    brand?: string;
    image_url?: string;
    images?: string[];
    category?: {
      name: string;
      path?: string[];
    };
    rating?: number;
    reviewCount?: number;
  };
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
}

export function ExtendedProductJsonLd({
  product,
  warranty,
  shipping,
  returnPolicy,
}: ExtendedProductJsonLdProps) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://techshop.ua';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description || product.name,
    sku: product.sku || product.id,
    mpn: product.sku || product.id,
    brand: product.brand ? {
      '@type': 'Brand',
      name: product.brand,
    } : undefined,
    image: product.images?.length
      ? product.images.map(img => img.startsWith('http') ? img : `${baseUrl}${img}`)
      : product.image_url
        ? [product.image_url.startsWith('http') ? product.image_url : `${baseUrl}${product.image_url}`]
        : undefined,
    url: `${baseUrl}/product/${product.id}`,
    category: product.category?.path?.join(' > ') || product.category?.name,
    offers: {
      '@type': 'Offer',
      url: `${baseUrl}/product/${product.id}`,
      priceCurrency: 'UAH',
      price: product.price,
      priceValidUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      availability: product.stock > 0
        ? product.stock < 5
          ? 'https://schema.org/LimitedAvailability'
          : 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
      seller: {
        '@type': 'Organization',
        name: 'TechShop',
        url: baseUrl,
      },
      ...(shipping && {
        shippingDetails: {
          '@type': 'OfferShippingDetails',
          shippingRate: {
            '@type': 'MonetaryAmount',
            value: shipping.freeShippingThreshold && product.price >= shipping.freeShippingThreshold ? 0 : 50,
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
              minValue: shipping.deliveryDays.min,
              maxValue: shipping.deliveryDays.max,
              unitCode: 'DAY',
            },
          },
        },
      }),
      ...(returnPolicy && {
        hasMerchantReturnPolicy: {
          '@type': 'MerchantReturnPolicy',
          applicableCountry: 'UA',
          returnPolicyCategory: returnPolicy.type === 'full'
            ? 'https://schema.org/MerchantReturnFiniteReturnWindow'
            : 'https://schema.org/MerchantReturnNotPermitted',
          merchantReturnDays: returnPolicy.days,
          returnMethod: 'https://schema.org/ReturnByMail',
          returnFees: 'https://schema.org/FreeReturn',
        },
      }),
    },
    ...(warranty && {
      warranty: {
        '@type': 'WarrantyPromise',
        durationOfWarranty: {
          '@type': 'QuantitativeValue',
          value: warranty.durationMonths,
          unitCode: 'MON',
        },
        warrantyScope: warranty.type === 'manufacturer'
          ? 'https://schema.org/ManufacturerWarranty'
          : 'https://schema.org/SellerWarranty',
      },
    }),
    aggregateRating: product.rating && product.reviewCount ? {
      '@type': 'AggregateRating',
      ratingValue: product.rating,
      reviewCount: product.reviewCount,
      bestRating: 5,
      worstRating: 1,
    } : undefined,
  };

  // Remove undefined values
  const cleanJsonLd = JSON.parse(JSON.stringify(jsonLd));

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(cleanJsonLd) }}
    />
  );
}

// Pagination SEO component - adds rel="prev" and rel="next" links
interface PaginationSEOProps {
  currentPage: number;
  totalPages: number;
  basePath: string;
  queryParams?: Record<string, string>;
}

export function PaginationSEO({
  currentPage,
  totalPages,
  basePath,
  queryParams = {},
}: PaginationSEOProps) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://techshop.ua';

  const buildUrl = (page: number) => {
    const params = new URLSearchParams(queryParams);
    if (page > 1) params.set('page', String(page));
    const queryString = params.toString();
    return `${baseUrl}${basePath}${queryString ? `?${queryString}` : ''}`;
  };

  const prevUrl = currentPage > 1 ? buildUrl(currentPage - 1) : null;
  const nextUrl = currentPage < totalPages ? buildUrl(currentPage + 1) : null;

  return (
    <>
      {prevUrl && <link rel="prev" href={prevUrl} />}
      {nextUrl && <link rel="next" href={nextUrl} />}
    </>
  );
}

// Pinterest Rich Pins meta tags
interface PinterestMetaProps {
  product: {
    name: string;
    price: number;
    currency?: string;
    availability: 'in stock' | 'out of stock' | 'preorder';
    description?: string;
    brand?: string;
  };
}

export function PinterestMeta({ product }: PinterestMetaProps) {
  return (
    <>
      <meta property="og:type" content="product" />
      <meta property="product:price:amount" content={String(product.price)} />
      <meta property="product:price:currency" content={product.currency || 'UAH'} />
      <meta property="product:availability" content={product.availability} />
      {product.brand && <meta property="product:brand" content={product.brand} />}
    </>
  );
}

// Local Business JSON-LD (for physical stores)
interface LocalBusinessJsonLdProps {
  name?: string;
  address?: {
    street: string;
    city: string;
    postalCode: string;
  };
  geo?: {
    latitude: number;
    longitude: number;
  };
}

export function LocalBusinessJsonLd({
  name = 'TechShop',
  address = { street: 'вул. Хрещатик, 1', city: 'Київ', postalCode: '01001' },
  geo = { latitude: 50.4501, longitude: 30.5234 }
}: LocalBusinessJsonLdProps) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://techshop.ua';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ElectronicsStore',
    name,
    url: baseUrl,
    logo: `${baseUrl}/logo.png`,
    image: `${baseUrl}/store-photo.jpg`,
    telephone: '+380-44-123-4567',
    email: 'support@techshop.ua',
    priceRange: '₴₴',
    address: {
      '@type': 'PostalAddress',
      streetAddress: address.street,
      addressLocality: address.city,
      postalCode: address.postalCode,
      addressCountry: 'UA',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: geo.latitude,
      longitude: geo.longitude,
    },
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        opens: '09:00',
        closes: '18:00',
      },
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: 'Saturday',
        opens: '10:00',
        closes: '15:00',
      },
    ],
    paymentAccepted: ['Cash', 'Credit Card', 'Monobank'],
    currenciesAccepted: 'UAH',
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
