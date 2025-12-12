'use client';

import { useState } from 'react';
import {
    ArrowPathIcon,
    CheckCircleIcon,
    XCircleIcon,
    ClockIcon,
    Cog6ToothIcon,
    CloudArrowUpIcon,
    CloudArrowDownIcon,
    ExclamationTriangleIcon,
    PlusIcon,
    PlayIcon,
    PauseIcon,
    DocumentArrowDownIcon,
    BellIcon,
    ChartBarIcon,
    ShoppingCartIcon,
    LinkIcon,
    TrashIcon,
    PencilIcon,
    SignalIcon,
    FunnelIcon,
    CurrencyDollarIcon,
    TagIcon,
    ExclamationCircleIcon,
    InformationCircleIcon,
    ArrowTrendingUpIcon,
    ArrowTrendingDownIcon,
} from '@heroicons/react/24/outline';

type IntegrationStatus = 'connected' | 'disconnected' | 'syncing' | 'error';
type ActiveTab = 'marketplaces' | 'export' | 'history' | 'statistics' | 'orders' | 'webhooks';
type ModalType = 'connect' | 'settings' | 'mapping' | 'pricing' | 'notifications' | null;

interface ConnectionField {
    id: string;
    label: string;
    type: 'text' | 'password' | 'select' | 'checkbox' | 'url';
    placeholder?: string;
    required?: boolean;
    options?: { value: string; label: string }[];
    helpText?: string;
}

interface Integration {
    id: string;
    name: string;
    logo: string;
    status: IntegrationStatus;
    lastSync: string | null;
    products: number;
    orders: number;
    autoSync: boolean;
    syncInterval: string;
    description: string;
}

// Типи авторизації
type AuthMethod = 'api_key' | 'oauth' | 'login' | 'feed' | 'oauth_button';

interface MarketplaceConfig {
    authMethod: AuthMethod;
    authDescription: string;
    fields: ConnectionField[];
}

// Правила ціноутворення
interface PriceRule {
    markupPercent: number;
    markupFixed: number;
    roundTo: 'none' | '1' | '10' | '100' | '99';
    minPrice: number | null;
    maxPrice: number | null;
    compareAtMarkup: number; // для відображення знижки
}

// Налаштування синхронізації
interface SyncSettings {
    products: { enabled: boolean; interval: number };
    prices: { enabled: boolean; interval: number };
    stock: { enabled: boolean; interval: number };
    orders: { enabled: boolean; interval: number };
    priority: 'low' | 'normal' | 'high';
}

// Мапінг категорій
interface CategoryMapping {
    internalId: string;
    internalName: string;
    externalId: string;
    externalName: string;
}

// Фільтр товарів
interface ProductFilter {
    categories: string[];
    brands: string[];
    minPrice: number | null;
    maxPrice: number | null;
    inStockOnly: boolean;
    excludeSkus: string[];
}

// Налаштування сповіщень
interface NotificationSettings {
    email: { enabled: boolean; address: string };
    telegram: { enabled: boolean; chatId: string; botToken: string };
    onError: boolean;
    onSyncComplete: boolean;
    onLowStock: boolean;
    onNewOrder: boolean;
}

// Webhook
interface Webhook {
    id: string;
    marketplaceId: string;
    event: string;
    url: string;
    secret: string;
    active: boolean;
    lastTriggered: string | null;
}

// Замовлення з маркетплейсу
interface MarketplaceOrder {
    id: string;
    marketplaceId: string;
    marketplaceName: string;
    externalId: string;
    date: string;
    customer: string;
    total: number;
    status: 'new' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
    syncStatus: 'synced' | 'pending' | 'error';
    items: number;
}

// Статистика маркетплейсу
interface MarketplaceStats {
    marketplaceId: string;
    revenue: number;
    orders: number;
    avgOrderValue: number;
    conversionRate: number;
    topProducts: { name: string; sold: number; revenue: number }[];
    revenueByDay: { date: string; revenue: number }[];
}

// Лог помилок
interface ErrorLog {
    id: string;
    marketplaceId: string;
    marketplaceName: string;
    type: 'sync' | 'connection' | 'api' | 'validation';
    message: string;
    details: string;
    timestamp: string;
    resolved: boolean;
}

// Розширений інтерфейс інтеграції
interface IntegrationSettings {
    priceRule: PriceRule;
    syncSettings: SyncSettings;
    categoryMappings: CategoryMapping[];
    productFilter: ProductFilter;
    notifications: NotificationSettings;
}

// Налаштування підключення для кожного маркетплейсу
const marketplaceSettings: Record<string, MarketplaceConfig> = {
    // ============ УКРАЇНСЬКІ МАРКЕТПЛЕЙСИ ============
    rozetka: {
        authMethod: 'api_key',
        authDescription: 'Отримайте API ключ в особистому кабінеті продавця Rozetka',
        fields: [
            { id: 'api_key', label: 'API ключ', type: 'password', placeholder: 'Ваш API ключ Rozetka', required: true },
            { id: 'seller_id', label: 'ID продавця', type: 'text', placeholder: 'Ваш Seller ID', required: true },
            { id: 'warehouse_id', label: 'ID складу', type: 'text', placeholder: 'ID вашого складу в Rozetka' },
            { id: 'price_markup', label: 'Націнка на ціну (%)', type: 'text', placeholder: '0' },
            { id: 'sync_stock', label: 'Синхронізувати залишки', type: 'checkbox' },
            { id: 'sync_orders', label: 'Отримувати замовлення', type: 'checkbox' },
        ],
    },
    prom: {
        authMethod: 'api_key',
        authDescription: 'Згенеруйте API токен в налаштуваннях кабінету Prom.ua',
        fields: [
            { id: 'auth_method', label: 'Спосіб підключення', type: 'select', required: true, options: [
                { value: 'api', label: 'API (рекомендовано)' },
                { value: 'ftp', label: 'FTP (завантаження фіду)' },
            ]},
            { id: 'api_key', label: 'API токен', type: 'password', placeholder: 'API токен з кабінету Prom.ua', required: true },
            { id: 'shop_id', label: 'ID магазину', type: 'text', placeholder: 'ID вашого магазину' },
            { id: 'ftp_login', label: 'FTP логін', type: 'text', placeholder: 'Логін для FTP', helpText: 'Тільки для FTP підключення' },
            { id: 'ftp_password', label: 'FTP пароль', type: 'password', placeholder: 'Пароль для FTP' },
            { id: 'sync_prices', label: 'Синхронізувати ціни', type: 'checkbox' },
            { id: 'sync_stock', label: 'Синхронізувати залишки', type: 'checkbox' },
            { id: 'sync_orders', label: 'Отримувати замовлення', type: 'checkbox' },
        ],
    },
    hotline: {
        authMethod: 'login',
        authDescription: 'Використовуйте дані входу в кабінет мерчанта Hotline',
        fields: [
            { id: 'merchant_id', label: 'Merchant ID', type: 'text', placeholder: 'Ваш ID мерчанта', required: true },
            { id: 'login', label: 'Логін', type: 'text', placeholder: 'Email або логін', required: true },
            { id: 'password', label: 'Пароль', type: 'password', placeholder: 'Пароль від кабінету', required: true },
            { id: 'feed_url', label: 'URL фіду', type: 'url', placeholder: 'URL вашого YML фіду', helpText: 'Або завантажте фід вручну' },
            { id: 'category_mapping', label: 'Мапінг категорій', type: 'select', options: [
                { value: 'auto', label: 'Автоматичний' },
                { value: 'manual', label: 'Ручний' },
            ]},
        ],
    },
    price: {
        authMethod: 'feed',
        authDescription: 'Зареєструйте фід через кабінет Price.ua',
        fields: [
            { id: 'shop_id', label: 'ID магазину', type: 'text', placeholder: 'Ваш Shop ID', required: true },
            { id: 'login', label: 'Email', type: 'text', placeholder: 'Email реєстрації', required: true },
            { id: 'password', label: 'Пароль', type: 'password', placeholder: 'Пароль від кабінету', required: true },
            { id: 'feed_url', label: 'URL фіду', type: 'url', placeholder: 'URL вашого XML фіду', required: true },
        ],
    },
    allo: {
        authMethod: 'api_key',
        authDescription: 'Запросіть API доступ через менеджера партнерської програми Allo',
        fields: [
            { id: 'partner_id', label: 'Partner ID', type: 'text', placeholder: 'ID партнера Allo', required: true },
            { id: 'api_key', label: 'API ключ', type: 'password', placeholder: 'Секретний API ключ', required: true },
            { id: 'api_secret', label: 'API Secret', type: 'password', placeholder: 'Секретний ключ' },
            { id: 'sync_stock', label: 'Синхронізувати залишки', type: 'checkbox' },
            { id: 'auto_confirm', label: 'Автопідтвердження замовлень', type: 'checkbox' },
        ],
    },
    epicentr: {
        authMethod: 'login',
        authDescription: 'Увійдіть з даними від кабінету продавця Епіцентр',
        fields: [
            { id: 'email', label: 'Email', type: 'text', placeholder: 'Email від кабінету', required: true },
            { id: 'password', label: 'Пароль', type: 'password', placeholder: 'Пароль від кабінету', required: true },
            { id: 'seller_id', label: 'ID продавця', type: 'text', placeholder: 'Ваш Seller ID (автоматично)' },
            { id: 'warehouse', label: 'Склад відвантаження', type: 'select', options: [
                { value: 'main', label: 'Основний склад' },
                { value: 'kyiv', label: 'Київ' },
                { value: 'odesa', label: 'Одеса' },
                { value: 'kharkiv', label: 'Харків' },
            ]},
            { id: 'delivery_type', label: 'Тип доставки', type: 'select', options: [
                { value: 'epicentr', label: 'Доставка Епіцентр' },
                { value: 'seller', label: 'Доставка продавця' },
                { value: 'pickup', label: 'Самовивіз' },
            ]},
        ],
    },
    olx: {
        authMethod: 'oauth_button',
        authDescription: 'Авторизуйтесь через OAuth 2.0 для доступу до OLX API',
        fields: [
            { id: 'client_id', label: 'Client ID', type: 'text', placeholder: 'OAuth Client ID', required: true, helpText: 'Отримайте в OLX Developer Portal' },
            { id: 'client_secret', label: 'Client Secret', type: 'password', placeholder: 'OAuth Client Secret', required: true },
            { id: 'auto_republish', label: 'Автоперепублікація оголошень', type: 'checkbox' },
            { id: 'business_account', label: 'Бізнес акаунт', type: 'checkbox' },
        ],
    },
    ekatalog: {
        authMethod: 'feed',
        authDescription: 'Зареєструйте XML фід через кабінет eKatalog',
        fields: [
            { id: 'shop_id', label: 'ID магазину', type: 'text', placeholder: 'Ваш Shop ID', required: true },
            { id: 'email', label: 'Email', type: 'text', placeholder: 'Email реєстрації', required: true },
            { id: 'password', label: 'Пароль', type: 'password', placeholder: 'Пароль', required: true },
            { id: 'feed_format', label: 'Формат фіду', type: 'select', options: [
                { value: 'yml', label: 'YML (Yandex Market)' },
                { value: 'xml', label: 'XML' },
            ]},
            { id: 'feed_url', label: 'URL фіду', type: 'url', placeholder: 'URL вашого фіду', required: true },
        ],
    },
    nadavi: {
        authMethod: 'feed',
        authDescription: 'Додайте фід через кабінет Nadavi',
        fields: [
            { id: 'partner_id', label: 'Partner ID', type: 'text', placeholder: 'ID партнера', required: true },
            { id: 'email', label: 'Email', type: 'text', placeholder: 'Email реєстрації', required: true },
            { id: 'password', label: 'Пароль', type: 'password', placeholder: 'Пароль', required: true },
            { id: 'feed_url', label: 'URL фіду', type: 'url', placeholder: 'URL вашого фіду', required: true },
        ],
    },
    bigl: {
        authMethod: 'api_key',
        authDescription: 'Отримайте API ключ в кабінеті Bigl.ua (Prom Group)',
        fields: [
            { id: 'api_key', label: 'API ключ', type: 'password', placeholder: 'API ключ Bigl.ua', required: true },
            { id: 'shop_id', label: 'ID магазину', type: 'text', placeholder: 'ID магазину', required: true },
            { id: 'sync_mode', label: 'Режим синхронізації', type: 'select', options: [
                { value: 'full', label: 'Повна синхронізація' },
                { value: 'delta', label: 'Тільки зміни' },
            ]},
        ],
    },
    zakupka: {
        authMethod: 'login',
        authDescription: 'Увійдіть з даними від B2B кабінету Zakupka',
        fields: [
            { id: 'company_id', label: 'ID компанії', type: 'text', placeholder: 'Ваш Company ID', required: true },
            { id: 'email', label: 'Email', type: 'text', placeholder: 'Email компанії', required: true },
            { id: 'password', label: 'Пароль', type: 'password', placeholder: 'Пароль', required: true },
            { id: 'price_type', label: 'Тип ціни', type: 'select', options: [
                { value: 'retail', label: 'Роздрібна' },
                { value: 'wholesale', label: 'Оптова' },
                { value: 'dealer', label: 'Дилерська' },
            ]},
            { id: 'min_order', label: 'Мінімальне замовлення (грн)', type: 'text', placeholder: '1000' },
        ],
    },
    fua: {
        authMethod: 'api_key',
        authDescription: 'Запросіть API доступ через партнерський відділ F.ua',
        fields: [
            { id: 'partner_code', label: 'Код партнера', type: 'text', placeholder: 'Партнерський код F.ua', required: true },
            { id: 'api_key', label: 'API ключ', type: 'password', placeholder: 'Секретний ключ', required: true },
            { id: 'commission', label: 'Комісія (%)', type: 'text', placeholder: '5', helpText: 'Комісія маркетплейсу' },
        ],
    },
    citrus: {
        authMethod: 'login',
        authDescription: 'Увійдіть з даними від кабінету вендора Citrus',
        fields: [
            { id: 'vendor_id', label: 'Vendor ID', type: 'text', placeholder: 'ID вендора', required: true },
            { id: 'email', label: 'Email', type: 'text', placeholder: 'Email вендора', required: true },
            { id: 'password', label: 'Пароль', type: 'password', placeholder: 'Пароль', required: true },
            { id: 'fulfillment', label: 'Fulfillment', type: 'select', options: [
                { value: 'fbc', label: 'Fulfillment by Citrus' },
                { value: 'fbm', label: 'Fulfillment by Merchant' },
            ]},
        ],
    },
    kasta: {
        authMethod: 'login',
        authDescription: 'Увійдіть з даними від кабінету продавця Kasta',
        fields: [
            { id: 'email', label: 'Email', type: 'text', placeholder: 'Email продавця', required: true },
            { id: 'password', label: 'Пароль', type: 'password', placeholder: 'Пароль', required: true },
            { id: 'seller_id', label: 'Seller ID', type: 'text', placeholder: 'ID продавця (автоматично)' },
            { id: 'brand_name', label: 'Назва бренду', type: 'text', placeholder: 'Ваш бренд' },
            { id: 'category', label: 'Категорія', type: 'select', options: [
                { value: 'women', label: 'Жіночий одяг' },
                { value: 'men', label: 'Чоловічий одяг' },
                { value: 'kids', label: 'Дитячий одяг' },
                { value: 'shoes', label: 'Взуття' },
                { value: 'accessories', label: 'Аксесуари' },
            ]},
        ],
    },
    // ============ МІЖНАРОДНІ МАРКЕТПЛЕЙСИ ============
    amazon: {
        authMethod: 'oauth',
        authDescription: 'Підключіться через Amazon Seller Central API',
        fields: [
            { id: 'seller_id', label: 'Seller ID', type: 'text', placeholder: 'Amazon Seller ID', required: true },
            { id: 'mws_auth_token', label: 'MWS Auth Token', type: 'password', placeholder: 'MWS авторизаційний токен', required: true, helpText: 'Згенеруйте в Seller Central > User Permissions' },
            { id: 'aws_access_key', label: 'AWS Access Key', type: 'password', placeholder: 'AWS Access Key ID', required: true },
            { id: 'aws_secret_key', label: 'AWS Secret Key', type: 'password', placeholder: 'AWS Secret Access Key', required: true },
            { id: 'marketplace', label: 'Маркетплейс', type: 'select', required: true, options: [
                { value: 'us', label: 'Amazon.com (США)' },
                { value: 'uk', label: 'Amazon.co.uk (Британія)' },
                { value: 'de', label: 'Amazon.de (Німеччина)' },
                { value: 'pl', label: 'Amazon.pl (Польща)' },
            ]},
            { id: 'fulfillment', label: 'Fulfillment', type: 'select', options: [
                { value: 'fba', label: 'FBA (Fulfillment by Amazon)' },
                { value: 'fbm', label: 'FBM (Fulfillment by Merchant)' },
            ]},
        ],
    },
    ebay: {
        authMethod: 'oauth_button',
        authDescription: 'Авторизуйтесь через eBay OAuth для безпечного доступу',
        fields: [
            { id: 'app_id', label: 'App ID (Client ID)', type: 'text', placeholder: 'eBay App ID', required: true, helpText: 'Зареєструйте додаток на developer.ebay.com' },
            { id: 'cert_id', label: 'Cert ID (Client Secret)', type: 'password', placeholder: 'eBay Cert ID', required: true },
            { id: 'dev_id', label: 'Dev ID', type: 'text', placeholder: 'eBay Developer ID', required: true },
            { id: 'site', label: 'Сайт eBay', type: 'select', required: true, options: [
                { value: 'us', label: 'eBay.com (США)' },
                { value: 'uk', label: 'eBay.co.uk (Британія)' },
                { value: 'de', label: 'eBay.de (Німеччина)' },
                { value: 'pl', label: 'eBay.pl (Польща)' },
            ]},
            { id: 'listing_type', label: 'Тип лістингу', type: 'select', options: [
                { value: 'fixed', label: 'Фіксована ціна' },
                { value: 'auction', label: 'Аукціон' },
            ]},
        ],
    },
    etsy: {
        authMethod: 'oauth_button',
        authDescription: 'Авторизуйтесь через Etsy OAuth 2.0',
        fields: [
            { id: 'api_key', label: 'API Key (Keystring)', type: 'password', placeholder: 'Etsy API Key', required: true, helpText: 'Створіть додаток на etsy.com/developers' },
            { id: 'shared_secret', label: 'Shared Secret', type: 'password', placeholder: 'Etsy Shared Secret', required: true },
            { id: 'shop_id', label: 'Shop ID', type: 'text', placeholder: 'Назва або ID магазину', required: true },
            { id: 'language', label: 'Мова лістингів', type: 'select', options: [
                { value: 'en', label: 'Англійська' },
                { value: 'de', label: 'Німецька' },
                { value: 'fr', label: 'Французька' },
            ]},
        ],
    },
    allegro: {
        authMethod: 'oauth_button',
        authDescription: 'Авторизуйтесь через Allegro REST API (OAuth 2.0)',
        fields: [
            { id: 'client_id', label: 'Client ID', type: 'text', placeholder: 'Allegro Client ID', required: true, helpText: 'Зареєструйте на apps.developer.allegro.pl' },
            { id: 'client_secret', label: 'Client Secret', type: 'password', placeholder: 'Allegro Client Secret', required: true },
            { id: 'sandbox', label: 'Тестовий режим (Sandbox)', type: 'checkbox' },
            { id: 'delivery_method', label: 'Метод доставки', type: 'select', options: [
                { value: 'allegro', label: 'Allegro One' },
                { value: 'courier', label: "Кур'єр" },
                { value: 'pickup', label: 'Пункт видачі' },
            ]},
        ],
    },
    aliexpress: {
        authMethod: 'oauth_button',
        authDescription: 'Авторизуйтесь через AliExpress Open Platform',
        fields: [
            { id: 'app_key', label: 'App Key', type: 'text', placeholder: 'AliExpress App Key', required: true, helpText: 'Створіть додаток на open.aliexpress.com' },
            { id: 'app_secret', label: 'App Secret', type: 'password', placeholder: 'AliExpress App Secret', required: true },
            { id: 'seller_id', label: 'Seller ID', type: 'text', placeholder: 'ID продавця (автоматично)' },
            { id: 'shipping_template', label: 'Шаблон доставки', type: 'text', placeholder: 'ID шаблону доставки' },
        ],
    },
    // ============ E-COMMERCE ПЛАТФОРМИ ============
    shopify: {
        authMethod: 'api_key',
        authDescription: 'Створіть приватний додаток в адмін-панелі Shopify',
        fields: [
            { id: 'shop_domain', label: 'Домен магазину', type: 'text', placeholder: 'myshop.myshopify.com', required: true },
            { id: 'api_key', label: 'API Key', type: 'password', placeholder: 'Admin API Access Token', required: true, helpText: 'Settings > Apps > Develop apps' },
            { id: 'api_secret', label: 'API Secret Key', type: 'password', placeholder: 'API Secret Key' },
            { id: 'sync_inventory', label: 'Синхронізувати інвентар', type: 'checkbox' },
            { id: 'sync_orders', label: 'Синхронізувати замовлення', type: 'checkbox' },
        ],
    },
    woocommerce: {
        authMethod: 'api_key',
        authDescription: 'Згенеруйте REST API ключі в WooCommerce > Settings > Advanced > REST API',
        fields: [
            { id: 'store_url', label: 'URL магазину', type: 'url', placeholder: 'https://myshop.com', required: true },
            { id: 'consumer_key', label: 'Consumer Key', type: 'password', placeholder: 'ck_xxxxxxxxxxxx', required: true },
            { id: 'consumer_secret', label: 'Consumer Secret', type: 'password', placeholder: 'cs_xxxxxxxxxxxx', required: true },
            { id: 'api_version', label: 'Версія API', type: 'select', options: [
                { value: 'wc/v3', label: 'WC API v3 (рекомендовано)' },
                { value: 'wc/v2', label: 'WC API v2' },
            ]},
            { id: 'sync_products', label: 'Синхронізувати товари', type: 'checkbox' },
            { id: 'sync_orders', label: 'Синхронізувати замовлення', type: 'checkbox' },
        ],
    },
    opencart: {
        authMethod: 'api_key',
        authDescription: 'Налаштуйте API доступ в System > Users > API',
        fields: [
            { id: 'store_url', label: 'URL магазину', type: 'url', placeholder: 'https://myshop.com', required: true },
            { id: 'api_username', label: "Ім'я API користувача", type: 'text', placeholder: 'API username', required: true },
            { id: 'api_key', label: 'API ключ', type: 'password', placeholder: 'OpenCart API Key', required: true },
            { id: 'store_id', label: 'Store ID', type: 'text', placeholder: '0', helpText: 'ID магазину (0 для основного)' },
        ],
    },
    // ============ СОЦІАЛЬНІ МЕРЕЖІ ============
    google_merchant: {
        authMethod: 'oauth',
        authDescription: 'Підключіться через Google Cloud Console Service Account',
        fields: [
            { id: 'merchant_id', label: 'Merchant ID', type: 'text', placeholder: 'Google Merchant Center ID', required: true, helpText: 'Знайдіть в Merchant Center > Settings' },
            { id: 'auth_type', label: 'Тип авторизації', type: 'select', required: true, options: [
                { value: 'service_account', label: 'Service Account (рекомендовано)' },
                { value: 'oauth', label: 'OAuth 2.0' },
            ]},
            { id: 'service_account_json', label: 'Service Account JSON', type: 'password', placeholder: 'Вставте вміст JSON файлу', helpText: 'Завантажте з Google Cloud Console > IAM > Service Accounts' },
            { id: 'target_country', label: 'Цільова країна', type: 'select', options: [
                { value: 'UA', label: 'Україна' },
                { value: 'PL', label: 'Польща' },
                { value: 'DE', label: 'Німеччина' },
                { value: 'US', label: 'США' },
            ]},
            { id: 'content_language', label: 'Мова контенту', type: 'select', options: [
                { value: 'uk', label: 'Українська' },
                { value: 'en', label: 'Англійська' },
                { value: 'pl', label: 'Польська' },
            ]},
        ],
    },
    facebook: {
        authMethod: 'oauth_button',
        authDescription: 'Авторизуйтесь через Facebook Business для доступу до Catalog API',
        fields: [
            { id: 'business_id', label: 'Business ID', type: 'text', placeholder: 'Facebook Business ID', required: true, helpText: 'Знайдіть в Business Settings > Business Info' },
            { id: 'catalog_id', label: 'Catalog ID', type: 'text', placeholder: 'ID каталогу товарів', helpText: 'Автоматично після авторизації' },
            { id: 'pixel_id', label: 'Pixel ID', type: 'text', placeholder: 'Facebook Pixel ID', helpText: 'Для відстеження конверсій' },
            { id: 'instagram_enabled', label: 'Instagram Shopping', type: 'checkbox' },
            { id: 'checkout_enabled', label: 'Facebook Checkout', type: 'checkbox' },
        ],
    },
    tiktok: {
        authMethod: 'oauth_button',
        authDescription: 'Авторизуйтесь через TikTok Shop Seller Center',
        fields: [
            { id: 'app_key', label: 'App Key', type: 'text', placeholder: 'TikTok App Key', required: true, helpText: 'Створіть на partner.tiktokshop.com' },
            { id: 'app_secret', label: 'App Secret', type: 'password', placeholder: 'TikTok App Secret', required: true },
            { id: 'shop_id', label: 'Shop ID', type: 'text', placeholder: 'ID магазину (автоматично)' },
            { id: 'region', label: 'Регіон', type: 'select', required: true, options: [
                { value: 'eu', label: 'Європа' },
                { value: 'us', label: 'США' },
                { value: 'uk', label: 'Британія' },
            ]},
        ],
    },
    // ============ НІШЕВІ МАРКЕТПЛЕЙСИ ============
    makeup: {
        authMethod: 'api_key',
        authDescription: 'Запросіть API доступ через партнерський відділ Makeup.ua',
        fields: [
            { id: 'partner_id', label: 'Partner ID', type: 'text', placeholder: 'ID партнера Makeup', required: true },
            { id: 'api_key', label: 'API ключ', type: 'password', placeholder: 'Секретний ключ', required: true },
            { id: 'brand_id', label: 'Brand ID', type: 'text', placeholder: 'ID вашого бренду' },
            { id: 'category', label: 'Категорія', type: 'select', options: [
                { value: 'makeup', label: 'Макіяж' },
                { value: 'skincare', label: 'Догляд за шкірою' },
                { value: 'haircare', label: 'Догляд за волоссям' },
                { value: 'perfume', label: 'Парфумерія' },
            ]},
        ],
    },
    yakaboo: {
        authMethod: 'login',
        authDescription: 'Увійдіть з даними від кабінету видавця Yakaboo',
        fields: [
            { id: 'email', label: 'Email', type: 'text', placeholder: 'Email видавця', required: true },
            { id: 'password', label: 'Пароль', type: 'password', placeholder: 'Пароль', required: true },
            { id: 'publisher_id', label: 'Publisher ID', type: 'text', placeholder: 'ID видавця (автоматично)' },
            { id: 'publisher_name', label: 'Назва видавництва', type: 'text', placeholder: 'Назва видавництва' },
            { id: 'isbn_prefix', label: 'ISBN префікс', type: 'text', placeholder: '978-617' },
        ],
    },
    shafa: {
        authMethod: 'login',
        authDescription: 'Увійдіть з даними від вашого акаунту Shafa',
        fields: [
            { id: 'email', label: 'Email або телефон', type: 'text', placeholder: 'Email або номер телефону', required: true },
            { id: 'password', label: 'Пароль', type: 'password', placeholder: 'Пароль від Shafa', required: true },
            { id: 'shop_name', label: 'Назва магазину', type: 'text', placeholder: 'Назва вашого магазину' },
            { id: 'auto_republish', label: 'Автоперепублікація', type: 'checkbox' },
            { id: 'category', label: 'Основна категорія', type: 'select', options: [
                { value: 'women', label: 'Жіночий одяг' },
                { value: 'men', label: 'Чоловічий одяг' },
                { value: 'kids', label: 'Дитячий одяг' },
                { value: 'accessories', label: 'Аксесуари' },
            ]},
        ],
    },
};

const integrations: Integration[] = [
    // ============ УКРАЇНСЬКІ МАРКЕТПЛЕЙСИ ============
    {
        id: 'rozetka',
        name: 'Rozetka',
        logo: '🛒',
        status: 'connected',
        lastSync: '10.12.2024 14:30',
        products: 1245,
        orders: 89,
        autoSync: true,
        syncInterval: 'Кожні 30 хв',
        description: 'Найбільший маркетплейс України',
    },
    {
        id: 'prom',
        name: 'Prom.ua',
        logo: '🏪',
        status: 'connected',
        lastSync: '10.12.2024 14:25',
        products: 1180,
        orders: 45,
        autoSync: true,
        syncInterval: 'Кожну годину',
        description: 'Торговельний майданчик B2B та B2C',
    },
    {
        id: 'hotline',
        name: 'Hotline',
        logo: '🔥',
        status: 'connected',
        lastSync: '10.12.2024 12:00',
        products: 890,
        orders: 0,
        autoSync: true,
        syncInterval: 'Кожні 2 години',
        description: 'Порівняння цін та товарів',
    },
    {
        id: 'price',
        name: 'Price.ua',
        logo: '💰',
        status: 'disconnected',
        lastSync: null,
        products: 0,
        orders: 0,
        autoSync: false,
        syncInterval: '-',
        description: 'Порівняння цін',
    },
    {
        id: 'allo',
        name: 'Allo.ua',
        logo: '📱',
        status: 'error',
        lastSync: '09.12.2024 18:00',
        products: 456,
        orders: 12,
        autoSync: true,
        syncInterval: 'Кожні 30 хв',
        description: 'Партнерська програма Allo',
    },
    {
        id: 'epicentr',
        name: 'Епіцентр',
        logo: '🏠',
        status: 'disconnected',
        lastSync: null,
        products: 0,
        orders: 0,
        autoSync: false,
        syncInterval: '-',
        description: 'Маркетплейс товарів для дому',
    },
    {
        id: 'olx',
        name: 'OLX',
        logo: '📦',
        status: 'disconnected',
        lastSync: null,
        products: 0,
        orders: 0,
        autoSync: false,
        syncInterval: '-',
        description: 'Дошка оголошень та маркетплейс',
    },
    {
        id: 'ekatalog',
        name: 'E-Katalog',
        logo: '📋',
        status: 'disconnected',
        lastSync: null,
        products: 0,
        orders: 0,
        autoSync: false,
        syncInterval: '-',
        description: 'Каталог товарів з порівнянням цін',
    },
    {
        id: 'nadavi',
        name: 'Nadavi',
        logo: '🔎',
        status: 'disconnected',
        lastSync: null,
        products: 0,
        orders: 0,
        autoSync: false,
        syncInterval: '-',
        description: 'Порівняння цін та товарів',
    },
    {
        id: 'bigl',
        name: 'Bigl.ua',
        logo: '🛍️',
        status: 'disconnected',
        lastSync: null,
        products: 0,
        orders: 0,
        autoSync: false,
        syncInterval: '-',
        description: 'Маркетплейс від Prom.ua',
    },
    {
        id: 'zakupka',
        name: 'Zakupka.com',
        logo: '🏷️',
        status: 'disconnected',
        lastSync: null,
        products: 0,
        orders: 0,
        autoSync: false,
        syncInterval: '-',
        description: 'B2B торговий майданчик',
    },
    {
        id: 'fua',
        name: 'F.ua',
        logo: '⚡',
        status: 'disconnected',
        lastSync: null,
        products: 0,
        orders: 0,
        autoSync: false,
        syncInterval: '-',
        description: 'Магазин електроніки та техніки',
    },
    {
        id: 'citrus',
        name: 'Citrus',
        logo: '🍊',
        status: 'disconnected',
        lastSync: null,
        products: 0,
        orders: 0,
        autoSync: false,
        syncInterval: '-',
        description: 'Мережа магазинів електроніки',
    },
    {
        id: 'kasta',
        name: 'Kasta',
        logo: '👗',
        status: 'disconnected',
        lastSync: null,
        products: 0,
        orders: 0,
        autoSync: false,
        syncInterval: '-',
        description: 'Fashion-маркетплейс (колишній Modna Kasta)',
    },
    // ============ МІЖНАРОДНІ МАРКЕТПЛЕЙСИ ============
    {
        id: 'amazon',
        name: 'Amazon',
        logo: '📦',
        status: 'disconnected',
        lastSync: null,
        products: 0,
        orders: 0,
        autoSync: false,
        syncInterval: '-',
        description: 'Найбільший світовий маркетплейс',
    },
    {
        id: 'ebay',
        name: 'eBay',
        logo: '🏷️',
        status: 'disconnected',
        lastSync: null,
        products: 0,
        orders: 0,
        autoSync: false,
        syncInterval: '-',
        description: 'Міжнародний аукціон та маркетплейс',
    },
    {
        id: 'etsy',
        name: 'Etsy',
        logo: '🎨',
        status: 'disconnected',
        lastSync: null,
        products: 0,
        orders: 0,
        autoSync: false,
        syncInterval: '-',
        description: 'Маркетплейс handmade та вінтажу',
    },
    {
        id: 'allegro',
        name: 'Allegro',
        logo: '🇵🇱',
        status: 'disconnected',
        lastSync: null,
        products: 0,
        orders: 0,
        autoSync: false,
        syncInterval: '-',
        description: 'Найбільший маркетплейс Польщі/ЄС',
    },
    {
        id: 'aliexpress',
        name: 'AliExpress',
        logo: '🇨🇳',
        status: 'disconnected',
        lastSync: null,
        products: 0,
        orders: 0,
        autoSync: false,
        syncInterval: '-',
        description: 'Китайський маркетплейс Alibaba Group',
    },
    // ============ E-COMMERCE ПЛАТФОРМИ ============
    {
        id: 'shopify',
        name: 'Shopify',
        logo: '🛒',
        status: 'disconnected',
        lastSync: null,
        products: 0,
        orders: 0,
        autoSync: false,
        syncInterval: '-',
        description: 'Інтеграція з Shopify магазинами',
    },
    {
        id: 'woocommerce',
        name: 'WooCommerce',
        logo: '🔌',
        status: 'disconnected',
        lastSync: null,
        products: 0,
        orders: 0,
        autoSync: false,
        syncInterval: '-',
        description: 'WordPress e-commerce плагін',
    },
    {
        id: 'opencart',
        name: 'OpenCart',
        logo: '🛒',
        status: 'disconnected',
        lastSync: null,
        products: 0,
        orders: 0,
        autoSync: false,
        syncInterval: '-',
        description: 'Open-source e-commerce платформа',
    },
    // ============ СОЦІАЛЬНІ МЕРЕЖІ ============
    {
        id: 'google_merchant',
        name: 'Google Merchant',
        logo: '🔍',
        status: 'connected',
        lastSync: '10.12.2024 13:45',
        products: 1300,
        orders: 0,
        autoSync: true,
        syncInterval: 'Кожні 4 години',
        description: 'Google Shopping реклама',
    },
    {
        id: 'facebook',
        name: 'Facebook Shop',
        logo: '📘',
        status: 'syncing',
        lastSync: '10.12.2024 14:35',
        products: 1150,
        orders: 23,
        autoSync: true,
        syncInterval: 'Кожні 2 години',
        description: 'Каталог товарів Facebook/Instagram',
    },
    {
        id: 'tiktok',
        name: 'TikTok Shop',
        logo: '🎵',
        status: 'disconnected',
        lastSync: null,
        products: 0,
        orders: 0,
        autoSync: false,
        syncInterval: '-',
        description: 'TikTok Shopping для продажів через відео',
    },
    // ============ НІШЕВІ МАРКЕТПЛЕЙСИ ============
    {
        id: 'makeup',
        name: 'Makeup.ua',
        logo: '💄',
        status: 'disconnected',
        lastSync: null,
        products: 0,
        orders: 0,
        autoSync: false,
        syncInterval: '-',
        description: 'Маркетплейс косметики та парфумерії',
    },
    {
        id: 'yakaboo',
        name: 'Yakaboo',
        logo: '📚',
        status: 'disconnected',
        lastSync: null,
        products: 0,
        orders: 0,
        autoSync: false,
        syncInterval: '-',
        description: 'Книжковий маркетплейс України',
    },
    {
        id: 'shafa',
        name: 'Shafa',
        logo: '👚',
        status: 'disconnected',
        lastSync: null,
        products: 0,
        orders: 0,
        autoSync: false,
        syncInterval: '-',
        description: 'C2C маркетплейс одягу та аксесуарів',
    },
];

const exportFormats = [
    { id: 'yml', name: 'YML (Yandex Market)', description: 'Для Rozetka, Prom, Hotline' },
    { id: 'xml', name: 'XML (Google Merchant)', description: 'Для Google Shopping' },
    { id: 'csv', name: 'CSV', description: 'Універсальний формат' },
    { id: 'json', name: 'JSON Feed', description: 'Для Facebook/Instagram' },
];

const syncHistory = [
    { id: 1, platform: 'Rozetka', type: 'auto', date: '10.12.2024 14:30', products: 1245, status: 'success', duration: '2 хв 15 сек' },
    { id: 2, platform: 'Facebook Shop', type: 'auto', date: '10.12.2024 14:35', products: 1150, status: 'in_progress', duration: '-' },
    { id: 3, platform: 'Prom.ua', type: 'auto', date: '10.12.2024 14:25', products: 1180, status: 'success', duration: '1 хв 45 сек' },
    { id: 4, platform: 'Allo.ua', type: 'manual', date: '09.12.2024 18:00', products: 456, status: 'error', duration: '5 хв 30 сек' },
    { id: 5, platform: 'Google Merchant', type: 'auto', date: '10.12.2024 13:45', products: 1300, status: 'success', duration: '3 хв 10 сек' },
];

// Замовлення з маркетплейсів
const marketplaceOrders: MarketplaceOrder[] = [
    { id: '1', marketplaceId: 'rozetka', marketplaceName: 'Rozetka', externalId: 'RZ-12345678', date: '10.12.2024 15:30', customer: 'Іван Петренко', total: 12500, status: 'new', syncStatus: 'synced', items: 3 },
    { id: '2', marketplaceId: 'rozetka', marketplaceName: 'Rozetka', externalId: 'RZ-12345679', date: '10.12.2024 14:15', customer: 'Марія Коваленко', total: 8900, status: 'processing', syncStatus: 'synced', items: 2 },
    { id: '3', marketplaceId: 'prom', marketplaceName: 'Prom.ua', externalId: 'PROM-987654', date: '10.12.2024 13:45', customer: 'Олександр Шевченко', total: 3200, status: 'shipped', syncStatus: 'synced', items: 1 },
    { id: '4', marketplaceId: 'facebook', marketplaceName: 'Facebook Shop', externalId: 'FB-456789', date: '10.12.2024 12:00', customer: 'Наталія Бондар', total: 15600, status: 'new', syncStatus: 'pending', items: 4 },
    { id: '5', marketplaceId: 'prom', marketplaceName: 'Prom.ua', externalId: 'PROM-987655', date: '10.12.2024 11:30', customer: 'Дмитро Мельник', total: 2100, status: 'delivered', syncStatus: 'synced', items: 1 },
    { id: '6', marketplaceId: 'allo', marketplaceName: 'Allo.ua', externalId: 'ALLO-111222', date: '09.12.2024 18:45', customer: 'Олена Кравченко', total: 45000, status: 'processing', syncStatus: 'error', items: 2 },
    { id: '7', marketplaceId: 'rozetka', marketplaceName: 'Rozetka', externalId: 'RZ-12345680', date: '09.12.2024 16:20', customer: 'Андрій Лисенко', total: 6700, status: 'cancelled', syncStatus: 'synced', items: 2 },
];

// Статистика по маркетплейсах
const marketplaceStats: MarketplaceStats[] = [
    {
        marketplaceId: 'rozetka',
        revenue: 1250000,
        orders: 89,
        avgOrderValue: 14045,
        conversionRate: 3.2,
        topProducts: [
            { name: 'iPhone 15 Pro 256GB', sold: 23, revenue: 1150000 },
            { name: 'AirPods Pro 2', sold: 45, revenue: 450000 },
            { name: 'MacBook Air M2', sold: 8, revenue: 400000 },
        ],
        revenueByDay: [
            { date: '04.12', revenue: 150000 },
            { date: '05.12', revenue: 180000 },
            { date: '06.12', revenue: 210000 },
            { date: '07.12', revenue: 165000 },
            { date: '08.12', revenue: 195000 },
            { date: '09.12', revenue: 220000 },
            { date: '10.12', revenue: 130000 },
        ],
    },
    {
        marketplaceId: 'prom',
        revenue: 580000,
        orders: 45,
        avgOrderValue: 12889,
        conversionRate: 2.8,
        topProducts: [
            { name: 'Samsung Galaxy S24', sold: 15, revenue: 375000 },
            { name: 'Xiaomi 14', sold: 12, revenue: 180000 },
            { name: 'Google Pixel 8', sold: 5, revenue: 125000 },
        ],
        revenueByDay: [
            { date: '04.12', revenue: 65000 },
            { date: '05.12', revenue: 78000 },
            { date: '06.12', revenue: 92000 },
            { date: '07.12', revenue: 85000 },
            { date: '08.12', revenue: 95000 },
            { date: '09.12', revenue: 88000 },
            { date: '10.12', revenue: 77000 },
        ],
    },
    {
        marketplaceId: 'facebook',
        revenue: 320000,
        orders: 23,
        avgOrderValue: 13913,
        conversionRate: 1.9,
        topProducts: [
            { name: 'Apple Watch Series 9', sold: 18, revenue: 180000 },
            { name: 'iPad Air', sold: 6, revenue: 120000 },
            { name: 'AirPods 3', sold: 8, revenue: 40000 },
        ],
        revenueByDay: [
            { date: '04.12', revenue: 35000 },
            { date: '05.12', revenue: 42000 },
            { date: '06.12', revenue: 55000 },
            { date: '07.12', revenue: 48000 },
            { date: '08.12', revenue: 52000 },
            { date: '09.12', revenue: 45000 },
            { date: '10.12', revenue: 43000 },
        ],
    },
];

// Логи помилок
const errorLogs: ErrorLog[] = [
    { id: '1', marketplaceId: 'allo', marketplaceName: 'Allo.ua', type: 'api', message: 'API rate limit exceeded', details: 'Перевищено ліміт запитів до API (100/хв). Спробуйте пізніше.', timestamp: '10.12.2024 14:35', resolved: false },
    { id: '2', marketplaceId: 'rozetka', marketplaceName: 'Rozetka', type: 'validation', message: 'Invalid product data', details: 'SKU "PHONE-123" має невалідну категорію. Перевірте мапінг категорій.', timestamp: '10.12.2024 13:20', resolved: false },
    { id: '3', marketplaceId: 'prom', marketplaceName: 'Prom.ua', type: 'sync', message: 'Sync timeout', details: 'Синхронізація перервана через timeout (30с). Товарів оброблено: 850/1180.', timestamp: '10.12.2024 12:00', resolved: true },
    { id: '4', marketplaceId: 'allo', marketplaceName: 'Allo.ua', type: 'connection', message: 'Authentication failed', details: 'API ключ недійсний або прострочений. Оновіть credentials.', timestamp: '09.12.2024 18:00', resolved: false },
    { id: '5', marketplaceId: 'facebook', marketplaceName: 'Facebook Shop', type: 'validation', message: 'Missing required field', details: '15 товарів не мають обов\'язкового поля "brand". Оновіть дані товарів.', timestamp: '09.12.2024 15:30', resolved: true },
];

// Webhooks
const webhooks: Webhook[] = [
    { id: '1', marketplaceId: 'rozetka', event: 'order.created', url: 'https://myshop.ua/webhooks/rozetka/order', secret: 'wh_secret_rozetka_123', active: true, lastTriggered: '10.12.2024 15:30' },
    { id: '2', marketplaceId: 'rozetka', event: 'order.status_changed', url: 'https://myshop.ua/webhooks/rozetka/status', secret: 'wh_secret_rozetka_456', active: true, lastTriggered: '10.12.2024 14:15' },
    { id: '3', marketplaceId: 'prom', event: 'order.created', url: 'https://myshop.ua/webhooks/prom/order', secret: 'wh_secret_prom_789', active: true, lastTriggered: '10.12.2024 13:45' },
    { id: '4', marketplaceId: 'facebook', event: 'order.created', url: 'https://myshop.ua/webhooks/fb/order', secret: 'wh_secret_fb_abc', active: false, lastTriggered: null },
];

// Категорії для мапінгу (приклад)
const internalCategories = [
    { id: 'phones', name: 'Смартфони' },
    { id: 'tablets', name: 'Планшети' },
    { id: 'laptops', name: 'Ноутбуки' },
    { id: 'accessories', name: 'Аксесуари' },
    { id: 'audio', name: 'Аудіо' },
    { id: 'wearables', name: 'Носимі пристрої' },
];

// Налаштування за замовчуванням для нових інтеграцій
const defaultIntegrationSettings: IntegrationSettings = {
    priceRule: {
        markupPercent: 0,
        markupFixed: 0,
        roundTo: 'none',
        minPrice: null,
        maxPrice: null,
        compareAtMarkup: 0,
    },
    syncSettings: {
        products: { enabled: true, interval: 60 },
        prices: { enabled: true, interval: 30 },
        stock: { enabled: true, interval: 15 },
        orders: { enabled: true, interval: 5 },
        priority: 'normal',
    },
    categoryMappings: [],
    productFilter: {
        categories: [],
        brands: [],
        minPrice: null,
        maxPrice: null,
        inStockOnly: true,
        excludeSkus: [],
    },
    notifications: {
        email: { enabled: false, address: '' },
        telegram: { enabled: false, chatId: '', botToken: '' },
        onError: true,
        onSyncComplete: false,
        onLowStock: true,
        onNewOrder: true,
    },
};

export default function AdminIntegrationsPage() {
    const [activeTab, setActiveTab] = useState<ActiveTab>('marketplaces');
    const [modalType, setModalType] = useState<ModalType>(null);
    const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
    const [syncingPlatform, setSyncingPlatform] = useState<string | null>(null);
    const [testingConnection, setTestingConnection] = useState<string | null>(null);
    const [connectionTestResult, setConnectionTestResult] = useState<{ success: boolean; message: string } | null>(null);
    const [selectedStatsMarketplace, setSelectedStatsMarketplace] = useState<string>('all');
    const [ordersFilter, setOrdersFilter] = useState<string>('all');
    const [showErrorLogs, setShowErrorLogs] = useState(false);

    // Симуляція тесту з'єднання
    const handleTestConnection = async (platformId: string) => {
        setTestingConnection(platformId);
        setConnectionTestResult(null);
        await new Promise(resolve => setTimeout(resolve, 2000));
        // Симулюємо результат (80% успіх)
        const success = Math.random() > 0.2;
        setConnectionTestResult({
            success,
            message: success ? 'З\'єднання успішне! API відповідає коректно.' : 'Помилка з\'єднання. Перевірте credentials.',
        });
        setTestingConnection(null);
    };

    const handleSync = async (platformId: string) => {
        setSyncingPlatform(platformId);
        await new Promise(resolve => setTimeout(resolve, 3000));
        setSyncingPlatform(null);
    };

    const handleDisconnect = (integration: Integration) => {
        if (confirm(`Ви впевнені, що хочете відключити ${integration.name}? Це припинить синхронізацію товарів та замовлень.`)) {
            // В реальному додатку тут буде API виклик
            alert(`${integration.name} відключено`);
        }
    };

    const openSettingsModal = (integration: Integration) => {
        setSelectedIntegration(integration);
        setModalType('settings');
    };

    const openMappingModal = (integration: Integration) => {
        setSelectedIntegration(integration);
        setModalType('mapping');
    };

    const openPricingModal = (integration: Integration) => {
        setSelectedIntegration(integration);
        setModalType('pricing');
    };

    const openNotificationsModal = (integration: Integration) => {
        setSelectedIntegration(integration);
        setModalType('notifications');
    };

    const closeModal = () => {
        setModalType(null);
        setSelectedIntegration(null);
        setConnectionTestResult(null);
    };

    // Підрахунок статистики
    const totalStats = {
        revenue: marketplaceStats.reduce((sum, s) => sum + s.revenue, 0),
        orders: marketplaceStats.reduce((sum, s) => sum + s.orders, 0),
        avgOrderValue: Math.round(marketplaceStats.reduce((sum, s) => sum + s.revenue, 0) / marketplaceStats.reduce((sum, s) => sum + s.orders, 0)),
    };

    const filteredOrders = ordersFilter === 'all'
        ? marketplaceOrders
        : marketplaceOrders.filter(o => o.marketplaceId === ordersFilter);

    const unresolvedErrors = errorLogs.filter(e => !e.resolved).length;

    const getStatusBadge = (status: IntegrationStatus) => {
        switch (status) {
            case 'connected':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <CheckCircleIcon className="w-3.5 h-3.5" />
                        Підключено
                    </span>
                );
            case 'disconnected':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        <XCircleIcon className="w-3.5 h-3.5" />
                        Не підключено
                    </span>
                );
            case 'syncing':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" />
                        Синхронізація
                    </span>
                );
            case 'error':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        <ExclamationTriangleIcon className="w-3.5 h-3.5" />
                        Помилка
                    </span>
                );
        }
    };

    const connectedCount = integrations.filter(i => i.status === 'connected' || i.status === 'syncing').length;
    const totalProducts = integrations.reduce((sum, i) => sum + i.products, 0);
    const totalOrders = integrations.reduce((sum, i) => sum + i.orders, 0);

    return (
        <div className="space-y-6">
            {/* Page header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Інтеграції та маркетплейси</h1>
                    <p className="text-gray-600">Синхронізація товарів з торговельними платформами</p>
                </div>
                <button
                    onClick={() => setModalType('connect')}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition-colors"
                >
                    <PlusIcon className="w-5 h-5" />
                    Додати інтеграцію
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white rounded-xl shadow-sm p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
                            <CheckCircleIcon className="w-5 h-5 text-teal-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900">{connectedCount}</p>
                            <p className="text-sm text-gray-500">Активних інтеграцій</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <CloudArrowUpIcon className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900">{totalProducts.toLocaleString()}</p>
                            <p className="text-sm text-gray-500">Товарів синхронізовано</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                            <CloudArrowDownIcon className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900">{totalOrders}</p>
                            <p className="text-sm text-gray-500">Замовлень з маркетплейсів</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Error alert */}
            {unresolvedErrors > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <ExclamationCircleIcon className="w-6 h-6 text-red-600" />
                            <div>
                                <p className="font-medium text-red-800">{unresolvedErrors} невирішених помилок</p>
                                <p className="text-sm text-red-600">Деякі інтеграції потребують уваги</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowErrorLogs(true)}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
                        >
                            Переглянути
                        </button>
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className="bg-white rounded-xl shadow-sm">
                <div className="border-b overflow-x-auto">
                    <nav className="flex gap-6 px-6 min-w-max">
                        {[
                            { id: 'marketplaces', name: 'Маркетплейси', icon: LinkIcon },
                            { id: 'statistics', name: 'Статистика', icon: ChartBarIcon },
                            { id: 'orders', name: 'Замовлення', icon: ShoppingCartIcon },
                            { id: 'export', name: 'Експорт фідів', icon: DocumentArrowDownIcon },
                            { id: 'webhooks', name: 'Webhooks', icon: SignalIcon },
                            { id: 'history', name: 'Історія', icon: ClockIcon },
                        ].map((tab) => {
                            const Icon = tab.icon;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as ActiveTab)}
                                    className={`flex items-center gap-2 py-4 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                                        activeTab === tab.id
                                            ? 'border-teal-600 text-teal-600'
                                            : 'border-transparent text-gray-500 hover:text-gray-700'
                                    }`}
                                >
                                    <Icon className="w-4 h-4" />
                                    {tab.name}
                                </button>
                            );
                        })}
                    </nav>
                </div>

                <div className="p-6">
                    {/* Marketplaces tab */}
                    {activeTab === 'marketplaces' && (
                        <div className="grid md:grid-cols-2 gap-4">
                            {integrations.map((integration) => (
                                <div
                                    key={integration.id}
                                    className={`border rounded-xl p-4 transition-all ${
                                        integration.status === 'connected' || integration.status === 'syncing'
                                            ? 'border-green-200 bg-green-50/30'
                                            : integration.status === 'error'
                                                ? 'border-red-200 bg-red-50/30'
                                                : 'border-gray-200'
                                    }`}
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-2xl shadow-sm">
                                                {integration.logo}
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-gray-900">{integration.name}</h3>
                                                <p className="text-xs text-gray-500">{integration.description}</p>
                                            </div>
                                        </div>
                                        {getStatusBadge(integration.status)}
                                    </div>

                                    {(integration.status === 'connected' || integration.status === 'syncing' || integration.status === 'error') && (
                                        <div className="grid grid-cols-3 gap-2 mb-3 text-center">
                                            <div className="bg-white rounded-lg p-2">
                                                <p className="text-lg font-semibold text-gray-900">{integration.products}</p>
                                                <p className="text-xs text-gray-500">Товарів</p>
                                            </div>
                                            <div className="bg-white rounded-lg p-2">
                                                <p className="text-lg font-semibold text-gray-900">{integration.orders}</p>
                                                <p className="text-xs text-gray-500">Замовлень</p>
                                            </div>
                                            <div className="bg-white rounded-lg p-2">
                                                <p className="text-xs font-medium text-gray-900">{integration.syncInterval}</p>
                                                <p className="text-xs text-gray-500">Синхронізація</p>
                                            </div>
                                        </div>
                                    )}

                                    {integration.lastSync && (
                                        <p className="text-xs text-gray-500 mb-3">
                                            <ClockIcon className="w-3.5 h-3.5 inline mr-1" />
                                            Остання синхронізація: {integration.lastSync}
                                        </p>
                                    )}

                                    <div className="flex gap-2">
                                        {integration.status === 'disconnected' ? (
                                            <button
                                                onClick={() => {
                                                    setSelectedIntegration(integration);
                                                    setModalType('connect');
                                                }}
                                                className="flex-1 px-3 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors"
                                            >
                                                Підключити
                                            </button>
                                        ) : (
                                            <>
                                                <button
                                                    onClick={() => handleSync(integration.id)}
                                                    disabled={syncingPlatform === integration.id || integration.status === 'syncing'}
                                                    className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors disabled:opacity-50"
                                                >
                                                    {syncingPlatform === integration.id || integration.status === 'syncing' ? (
                                                        <>
                                                            <ArrowPathIcon className="w-4 h-4 animate-spin" />
                                                            Синхронізація...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <ArrowPathIcon className="w-4 h-4" />
                                                            Синхронізувати
                                                        </>
                                                    )}
                                                </button>
                                                {/* Dropdown menu for settings */}
                                                <div className="relative group">
                                                    <button className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                                                        <Cog6ToothIcon className="w-4 h-4" />
                                                    </button>
                                                    <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                                                        <div className="py-1">
                                                            <button
                                                                onClick={() => openSettingsModal(integration)}
                                                                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                                            >
                                                                <PencilIcon className="w-4 h-4" />
                                                                Редагувати credentials
                                                            </button>
                                                            <button
                                                                onClick={() => openMappingModal(integration)}
                                                                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                                            >
                                                                <TagIcon className="w-4 h-4" />
                                                                Мапінг категорій
                                                            </button>
                                                            <button
                                                                onClick={() => openPricingModal(integration)}
                                                                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                                            >
                                                                <CurrencyDollarIcon className="w-4 h-4" />
                                                                Правила ціноутворення
                                                            </button>
                                                            <button
                                                                onClick={() => openNotificationsModal(integration)}
                                                                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                                            >
                                                                <BellIcon className="w-4 h-4" />
                                                                Сповіщення
                                                            </button>
                                                            <hr className="my-1" />
                                                            <button
                                                                onClick={() => handleDisconnect(integration)}
                                                                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                                                            >
                                                                <TrashIcon className="w-4 h-4" />
                                                                Відключити
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Statistics tab */}
                    {activeTab === 'statistics' && (
                        <div className="space-y-6">
                            {/* Stats filter */}
                            <div className="flex items-center justify-between">
                                <h3 className="font-semibold text-gray-900">Статистика продажів</h3>
                                <select
                                    value={selectedStatsMarketplace}
                                    onChange={(e) => setSelectedStatsMarketplace(e.target.value)}
                                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                                >
                                    <option value="all">Всі маркетплейси</option>
                                    {integrations.filter(i => i.status === 'connected' || i.status === 'syncing').map(i => (
                                        <option key={i.id} value={i.id}>{i.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Summary stats */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl p-4 text-white">
                                    <p className="text-teal-100 text-sm">Загальний дохід</p>
                                    <p className="text-2xl font-bold mt-1">₴{(totalStats.revenue / 1000000).toFixed(2)}M</p>
                                    <p className="text-teal-100 text-xs mt-1 flex items-center gap-1">
                                        <ArrowTrendingUpIcon className="w-3 h-3" /> +12.5% за тиждень
                                    </p>
                                </div>
                                <div className="bg-white border border-gray-200 rounded-xl p-4">
                                    <p className="text-gray-500 text-sm">Замовлень</p>
                                    <p className="text-2xl font-bold text-gray-900 mt-1">{totalStats.orders}</p>
                                    <p className="text-green-600 text-xs mt-1 flex items-center gap-1">
                                        <ArrowTrendingUpIcon className="w-3 h-3" /> +8.3% за тиждень
                                    </p>
                                </div>
                                <div className="bg-white border border-gray-200 rounded-xl p-4">
                                    <p className="text-gray-500 text-sm">Середній чек</p>
                                    <p className="text-2xl font-bold text-gray-900 mt-1">₴{totalStats.avgOrderValue.toLocaleString()}</p>
                                    <p className="text-green-600 text-xs mt-1 flex items-center gap-1">
                                        <ArrowTrendingUpIcon className="w-3 h-3" /> +3.2% за тиждень
                                    </p>
                                </div>
                                <div className="bg-white border border-gray-200 rounded-xl p-4">
                                    <p className="text-gray-500 text-sm">Конверсія</p>
                                    <p className="text-2xl font-bold text-gray-900 mt-1">2.8%</p>
                                    <p className="text-red-600 text-xs mt-1 flex items-center gap-1">
                                        <ArrowTrendingDownIcon className="w-3 h-3" /> -0.3% за тиждень
                                    </p>
                                </div>
                            </div>

                            {/* Revenue chart */}
                            <div className="bg-white border border-gray-200 rounded-xl p-6">
                                <h4 className="font-medium text-gray-900 mb-4">Дохід за останні 7 днів</h4>
                                <div className="flex items-end gap-2 h-48">
                                    {(selectedStatsMarketplace === 'all'
                                        ? marketplaceStats[0].revenueByDay
                                        : marketplaceStats.find(s => s.marketplaceId === selectedStatsMarketplace)?.revenueByDay || []
                                    ).map((day, idx) => {
                                        const maxRevenue = Math.max(...marketplaceStats[0].revenueByDay.map(d => d.revenue));
                                        const height = (day.revenue / maxRevenue) * 100;
                                        return (
                                            <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                                                <div
                                                    className="w-full bg-teal-500 rounded-t-lg transition-all hover:bg-teal-600"
                                                    style={{ height: `${height}%` }}
                                                    title={`₴${day.revenue.toLocaleString()}`}
                                                />
                                                <span className="text-xs text-gray-500">{day.date}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Marketplace comparison */}
                            <div className="grid md:grid-cols-3 gap-4">
                                {marketplaceStats.map(stat => {
                                    const integration = integrations.find(i => i.id === stat.marketplaceId);
                                    return (
                                        <div key={stat.marketplaceId} className="bg-white border border-gray-200 rounded-xl p-4">
                                            <div className="flex items-center gap-3 mb-4">
                                                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-xl">
                                                    {integration?.logo}
                                                </div>
                                                <div>
                                                    <h4 className="font-medium text-gray-900">{integration?.name}</h4>
                                                    <p className="text-sm text-gray-500">{stat.orders} замовлень</p>
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-gray-500">Дохід</span>
                                                    <span className="font-medium">₴{(stat.revenue / 1000).toFixed(0)}K</span>
                                                </div>
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-gray-500">Середній чек</span>
                                                    <span className="font-medium">₴{stat.avgOrderValue.toLocaleString()}</span>
                                                </div>
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-gray-500">Конверсія</span>
                                                    <span className="font-medium">{stat.conversionRate}%</span>
                                                </div>
                                            </div>
                                            <div className="mt-4 pt-4 border-t">
                                                <p className="text-xs text-gray-500 mb-2">Топ товари:</p>
                                                {stat.topProducts.slice(0, 2).map((p, idx) => (
                                                    <div key={idx} className="flex justify-between text-xs py-1">
                                                        <span className="text-gray-700 truncate flex-1">{p.name}</span>
                                                        <span className="text-gray-500 ml-2">{p.sold} шт</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Orders tab */}
                    {activeTab === 'orders' && (
                        <div className="space-y-4">
                            {/* Orders header */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <h3 className="font-semibold text-gray-900">Замовлення з маркетплейсів</h3>
                                    <select
                                        value={ordersFilter}
                                        onChange={(e) => setOrdersFilter(e.target.value)}
                                        className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                                    >
                                        <option value="all">Всі маркетплейси</option>
                                        {integrations.filter(i => i.status === 'connected').map(i => (
                                            <option key={i.id} value={i.id}>{i.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <button className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700">
                                    <ArrowPathIcon className="w-4 h-4 inline mr-2" />
                                    Оновити замовлення
                                </button>
                            </div>

                            {/* Orders table */}
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="text-left text-xs font-medium text-gray-500 uppercase border-b">
                                            <th className="pb-3 pr-4">ID замовлення</th>
                                            <th className="pb-3 pr-4">Маркетплейс</th>
                                            <th className="pb-3 pr-4">Клієнт</th>
                                            <th className="pb-3 pr-4">Дата</th>
                                            <th className="pb-3 pr-4">Сума</th>
                                            <th className="pb-3 pr-4">Статус</th>
                                            <th className="pb-3 pr-4">Синхр.</th>
                                            <th className="pb-3">Дії</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {filteredOrders.map((order) => (
                                            <tr key={order.id} className="hover:bg-gray-50">
                                                <td className="py-3 pr-4">
                                                    <span className="font-mono text-sm">{order.externalId}</span>
                                                </td>
                                                <td className="py-3 pr-4">
                                                    <span className="text-sm">{order.marketplaceName}</span>
                                                </td>
                                                <td className="py-3 pr-4">
                                                    <span className="text-sm">{order.customer}</span>
                                                </td>
                                                <td className="py-3 pr-4">
                                                    <span className="text-sm text-gray-600">{order.date}</span>
                                                </td>
                                                <td className="py-3 pr-4">
                                                    <span className="font-medium">₴{order.total.toLocaleString()}</span>
                                                </td>
                                                <td className="py-3 pr-4">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                                        order.status === 'new' ? 'bg-blue-100 text-blue-700' :
                                                        order.status === 'processing' ? 'bg-yellow-100 text-yellow-700' :
                                                        order.status === 'shipped' ? 'bg-purple-100 text-purple-700' :
                                                        order.status === 'delivered' ? 'bg-green-100 text-green-700' :
                                                        'bg-red-100 text-red-700'
                                                    }`}>
                                                        {order.status === 'new' && 'Новий'}
                                                        {order.status === 'processing' && 'В обробці'}
                                                        {order.status === 'shipped' && 'Відправлено'}
                                                        {order.status === 'delivered' && 'Доставлено'}
                                                        {order.status === 'cancelled' && 'Скасовано'}
                                                    </span>
                                                </td>
                                                <td className="py-3 pr-4">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                                        order.syncStatus === 'synced' ? 'bg-green-100 text-green-700' :
                                                        order.syncStatus === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                                        'bg-red-100 text-red-700'
                                                    }`}>
                                                        {order.syncStatus === 'synced' && 'Синхр.'}
                                                        {order.syncStatus === 'pending' && 'Очікує'}
                                                        {order.syncStatus === 'error' && 'Помилка'}
                                                    </span>
                                                </td>
                                                <td className="py-3">
                                                    <button className="text-teal-600 hover:text-teal-700 text-sm font-medium">
                                                        Деталі
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Auto-confirmation settings */}
                            <div className="bg-gray-50 rounded-xl p-4 mt-6">
                                <h4 className="font-medium text-gray-900 mb-3">Налаштування автопідтвердження</h4>
                                <div className="grid md:grid-cols-2 gap-4">
                                    <label className="flex items-center gap-2">
                                        <input type="checkbox" defaultChecked className="rounded border-gray-300 text-teal-600" />
                                        <span className="text-sm text-gray-700">Автоматично підтверджувати нові замовлення</span>
                                    </label>
                                    <label className="flex items-center gap-2">
                                        <input type="checkbox" defaultChecked className="rounded border-gray-300 text-teal-600" />
                                        <span className="text-sm text-gray-700">Синхронізувати статуси доставки</span>
                                    </label>
                                    <label className="flex items-center gap-2">
                                        <input type="checkbox" className="rounded border-gray-300 text-teal-600" />
                                        <span className="text-sm text-gray-700">Автоматично створювати TTH</span>
                                    </label>
                                    <label className="flex items-center gap-2">
                                        <input type="checkbox" defaultChecked className="rounded border-gray-300 text-teal-600" />
                                        <span className="text-sm text-gray-700">Сповіщати про нові замовлення</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Webhooks tab */}
                    {activeTab === 'webhooks' && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="font-semibold text-gray-900">Webhooks</h3>
                                    <p className="text-sm text-gray-500">Real-time сповіщення від маркетплейсів</p>
                                </div>
                                <button className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700">
                                    <PlusIcon className="w-4 h-4 inline mr-2" />
                                    Додати webhook
                                </button>
                            </div>

                            {/* Webhooks list */}
                            <div className="space-y-3">
                                {webhooks.map((webhook) => {
                                    const integration = integrations.find(i => i.id === webhook.marketplaceId);
                                    return (
                                        <div key={webhook.id} className={`border rounded-xl p-4 ${webhook.active ? 'border-green-200 bg-green-50/30' : 'border-gray-200'}`}>
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-xl shadow-sm">
                                                        {integration?.logo}
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-medium text-gray-900">{integration?.name}</span>
                                                            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                                                                {webhook.event}
                                                            </span>
                                                        </div>
                                                        <p className="text-sm text-gray-500 font-mono">{webhook.url}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    {webhook.lastTriggered && (
                                                        <span className="text-xs text-gray-500">
                                                            Останній: {webhook.lastTriggered}
                                                        </span>
                                                    )}
                                                    <label className="relative inline-flex items-center cursor-pointer">
                                                        <input type="checkbox" defaultChecked={webhook.active} className="sr-only peer" />
                                                        <div className="w-11 h-6 bg-gray-200 peer-focus:ring-4 peer-focus:ring-teal-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                                                    </label>
                                                    <button className="p-2 text-gray-400 hover:text-gray-600">
                                                        <PencilIcon className="w-4 h-4" />
                                                    </button>
                                                    <button className="p-2 text-gray-400 hover:text-red-600">
                                                        <TrashIcon className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Available events */}
                            <div className="bg-blue-50 rounded-xl p-4">
                                <h4 className="font-medium text-blue-900 mb-3">Доступні події</h4>
                                <div className="grid md:grid-cols-3 gap-3">
                                    {[
                                        { event: 'order.created', desc: 'Нове замовлення' },
                                        { event: 'order.status_changed', desc: 'Зміна статусу' },
                                        { event: 'order.cancelled', desc: 'Скасування' },
                                        { event: 'product.updated', desc: 'Оновлення товару' },
                                        { event: 'stock.low', desc: 'Низький залишок' },
                                        { event: 'price.changed', desc: 'Зміна ціни' },
                                    ].map((item) => (
                                        <div key={item.event} className="bg-white rounded-lg p-3">
                                            <code className="text-xs text-purple-600">{item.event}</code>
                                            <p className="text-sm text-gray-600 mt-1">{item.desc}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Export feeds tab */}
                    {activeTab === 'export' && (
                        <div className="space-y-6">
                            <div className="bg-blue-50 rounded-xl p-4">
                                <div className="flex items-start gap-3">
                                    <CloudArrowUpIcon className="w-6 h-6 text-blue-600 flex-shrink-0" />
                                    <div>
                                        <h3 className="font-semibold text-blue-900">Експорт товарів</h3>
                                        <p className="text-sm text-blue-700 mt-1">
                                            Експортуйте каталог товарів у різних форматах для завантаження на маркетплейси вручну
                                            або для налаштування автоматичної синхронізації через URL фіду.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="grid md:grid-cols-2 gap-4">
                                {exportFormats.map((format) => (
                                    <div key={format.id} className="border border-gray-200 rounded-xl p-4">
                                        <div className="flex items-start justify-between mb-3">
                                            <div>
                                                <h3 className="font-semibold text-gray-900">{format.name}</h3>
                                                <p className="text-sm text-gray-500">{format.description}</p>
                                            </div>
                                            <DocumentArrowDownIcon className="w-6 h-6 text-gray-400" />
                                        </div>

                                        <div className="space-y-3">
                                            <div>
                                                <label className="block text-xs font-medium text-gray-500 mb-1">
                                                    URL фіду (для автосинхронізації)
                                                </label>
                                                <div className="flex gap-2">
                                                    <input
                                                        type="text"
                                                        readOnly
                                                        value={`https://myshop.ua/feeds/${format.id}`}
                                                        className="flex-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-600"
                                                    />
                                                    <button className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors">
                                                        Копіювати
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="flex gap-2">
                                                <button className="flex-1 px-3 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors">
                                                    Завантажити файл
                                                </button>
                                                <button className="px-3 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
                                                    Налаштування
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="border border-gray-200 rounded-xl p-4">
                                <h3 className="font-semibold text-gray-900 mb-3">Налаштування експорту</h3>
                                <div className="grid md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Категорії для експорту
                                        </label>
                                        <select className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500">
                                            <option>Всі категорії</option>
                                            <option>Електроніка</option>
                                            <option>Одяг</option>
                                            <option>Дім і сад</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Мінімальний залишок
                                        </label>
                                        <input
                                            type="number"
                                            defaultValue="1"
                                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="flex items-center gap-2">
                                            <input type="checkbox" defaultChecked className="rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
                                            <span className="text-sm text-gray-700">Експортувати тільки товари в наявності</span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* History tab */}
                    {activeTab === 'history' && (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="text-left text-xs font-medium text-gray-500 uppercase">
                                        <th className="pb-3">Платформа</th>
                                        <th className="pb-3">Тип</th>
                                        <th className="pb-3">Дата</th>
                                        <th className="pb-3">Товарів</th>
                                        <th className="pb-3">Тривалість</th>
                                        <th className="pb-3">Статус</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {syncHistory.map((item) => (
                                        <tr key={item.id}>
                                            <td className="py-3 font-medium text-gray-900">{item.platform}</td>
                                            <td className="py-3">
                                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                                    item.type === 'auto' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                                                }`}>
                                                    {item.type === 'auto' ? 'Авто' : 'Ручна'}
                                                </span>
                                            </td>
                                            <td className="py-3 text-sm text-gray-600">{item.date}</td>
                                            <td className="py-3 text-sm text-gray-600">{item.products}</td>
                                            <td className="py-3 text-sm text-gray-600">{item.duration}</td>
                                            <td className="py-3">
                                                {item.status === 'success' && (
                                                    <span className="inline-flex items-center gap-1 text-green-600 text-sm">
                                                        <CheckCircleIcon className="w-4 h-4" />
                                                        Успішно
                                                    </span>
                                                )}
                                                {item.status === 'error' && (
                                                    <span className="inline-flex items-center gap-1 text-red-600 text-sm">
                                                        <XCircleIcon className="w-4 h-4" />
                                                        Помилка
                                                    </span>
                                                )}
                                                {item.status === 'in_progress' && (
                                                    <span className="inline-flex items-center gap-1 text-blue-600 text-sm">
                                                        <ArrowPathIcon className="w-4 h-4 animate-spin" />
                                                        В процесі
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Error logs modal */}
            {showErrorLogs && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div className="flex items-center justify-center min-h-screen px-4 py-8">
                        <div className="fixed inset-0 bg-black/50" onClick={() => setShowErrorLogs(false)} />
                        <div className="relative bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                            <div className="p-6 border-b flex items-center justify-between">
                                <h3 className="text-lg font-semibold text-gray-900">Логи помилок</h3>
                                <button onClick={() => setShowErrorLogs(false)} className="text-gray-400 hover:text-gray-600">
                                    <XCircleIcon className="w-6 h-6" />
                                </button>
                            </div>
                            <div className="p-6 overflow-y-auto flex-1 space-y-3">
                                {errorLogs.map((log) => (
                                    <div key={log.id} className={`border rounded-lg p-4 ${log.resolved ? 'border-gray-200 bg-gray-50' : 'border-red-200 bg-red-50'}`}>
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-center gap-3">
                                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                                    log.type === 'api' ? 'bg-purple-100 text-purple-700' :
                                                    log.type === 'connection' ? 'bg-red-100 text-red-700' :
                                                    log.type === 'sync' ? 'bg-blue-100 text-blue-700' :
                                                    'bg-yellow-100 text-yellow-700'
                                                }`}>
                                                    {log.type}
                                                </span>
                                                <span className="font-medium text-gray-900">{log.marketplaceName}</span>
                                            </div>
                                            <span className="text-xs text-gray-500">{log.timestamp}</span>
                                        </div>
                                        <p className="font-medium text-gray-800 mt-2">{log.message}</p>
                                        <p className="text-sm text-gray-600 mt-1">{log.details}</p>
                                        {!log.resolved && (
                                            <button className="mt-3 text-sm text-teal-600 hover:text-teal-700 font-medium">
                                                Позначити як вирішено
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Connect modal */}
            {modalType === 'connect' && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div className="flex items-center justify-center min-h-screen px-4 py-8">
                        <div className="fixed inset-0 bg-black/50" onClick={closeModal} />
                        <div className="relative bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
                            {/* Modal header */}
                            <div className="p-6 border-b">
                                <div className="flex items-center gap-3">
                                    {selectedIntegration && (
                                        <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center text-2xl">
                                            {selectedIntegration.logo}
                                        </div>
                                    )}
                                    <div>
                                        <h3 className="text-lg font-semibold text-gray-900">
                                            {selectedIntegration ? `Підключити ${selectedIntegration.name}` : 'Додати інтеграцію'}
                                        </h3>
                                        {selectedIntegration && (
                                            <p className="text-sm text-gray-500">{selectedIntegration.description}</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Modal body */}
                            <div className="p-6 overflow-y-auto flex-1">
                                {!selectedIntegration ? (
                                    <div className="space-y-3">
                                        <p className="text-sm text-gray-600 mb-4">Оберіть маркетплейс для підключення:</p>
                                        <div className="grid grid-cols-2 gap-3 max-h-96 overflow-y-auto">
                                            {integrations.filter(i => i.status === 'disconnected').map((integration) => (
                                                <button
                                                    key={integration.id}
                                                    onClick={() => setSelectedIntegration(integration)}
                                                    className="flex flex-col items-center gap-2 p-4 border border-gray-200 rounded-lg hover:border-teal-300 hover:bg-teal-50 transition-colors text-center"
                                                >
                                                    <span className="text-3xl">{integration.logo}</span>
                                                    <div>
                                                        <p className="font-medium text-gray-900 text-sm">{integration.name}</p>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <form className="space-y-4">
                                        {/* Auth method badge and description */}
                                        {marketplaceSettings[selectedIntegration.id] && (
                                            <div className="bg-gray-50 rounded-lg p-4 mb-4">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                                                        marketplaceSettings[selectedIntegration.id].authMethod === 'api_key' ? 'bg-blue-100 text-blue-700' :
                                                        marketplaceSettings[selectedIntegration.id].authMethod === 'oauth' ? 'bg-purple-100 text-purple-700' :
                                                        marketplaceSettings[selectedIntegration.id].authMethod === 'oauth_button' ? 'bg-purple-100 text-purple-700' :
                                                        marketplaceSettings[selectedIntegration.id].authMethod === 'login' ? 'bg-green-100 text-green-700' :
                                                        'bg-orange-100 text-orange-700'
                                                    }`}>
                                                        {marketplaceSettings[selectedIntegration.id].authMethod === 'api_key' && '🔑 API ключ'}
                                                        {marketplaceSettings[selectedIntegration.id].authMethod === 'oauth' && '🔐 OAuth 2.0'}
                                                        {marketplaceSettings[selectedIntegration.id].authMethod === 'oauth_button' && '🔐 OAuth 2.0'}
                                                        {marketplaceSettings[selectedIntegration.id].authMethod === 'login' && '👤 Логін/Пароль'}
                                                        {marketplaceSettings[selectedIntegration.id].authMethod === 'feed' && '📄 XML/YML фід'}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-gray-600">
                                                    {marketplaceSettings[selectedIntegration.id].authDescription}
                                                </p>
                                            </div>
                                        )}

                                        {/* OAuth button for platforms that require it */}
                                        {marketplaceSettings[selectedIntegration.id]?.authMethod === 'oauth_button' && (
                                            <button
                                                type="button"
                                                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors mb-4"
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                </svg>
                                                Авторизуватись через {selectedIntegration.name}
                                            </button>
                                        )}

                                        {/* Dynamic fields based on marketplace */}
                                        {marketplaceSettings[selectedIntegration.id]?.fields.map((field) => (
                                            <div key={field.id}>
                                                {field.type === 'checkbox' ? (
                                                    <label className="flex items-center gap-2">
                                                        <input
                                                            type="checkbox"
                                                            name={field.id}
                                                            className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                                                        />
                                                        <span className="text-sm text-gray-700">{field.label}</span>
                                                    </label>
                                                ) : (
                                                    <>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                                            {field.label}
                                                            {field.required && <span className="text-red-500 ml-1">*</span>}
                                                        </label>
                                                        {field.type === 'select' ? (
                                                            <select
                                                                name={field.id}
                                                                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                                                required={field.required}
                                                            >
                                                                <option value="">Оберіть...</option>
                                                                {field.options?.map((opt) => (
                                                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                                ))}
                                                            </select>
                                                        ) : (
                                                            <input
                                                                type={field.type === 'url' ? 'url' : field.type}
                                                                name={field.id}
                                                                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                                                placeholder={field.placeholder}
                                                                required={field.required}
                                                            />
                                                        )}
                                                        {field.helpText && (
                                                            <p className="mt-1 text-xs text-gray-500">{field.helpText}</p>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        ))}

                                        {/* Sync interval - common for all */}
                                        <div className="pt-4 border-t">
                                            <h4 className="font-medium text-gray-900 mb-3">Налаштування синхронізації</h4>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Інтервал синхронізації
                                                </label>
                                                <select className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500">
                                                    <option value="15">Кожні 15 хвилин</option>
                                                    <option value="30">Кожні 30 хвилин</option>
                                                    <option value="60">Кожну годину</option>
                                                    <option value="120">Кожні 2 години</option>
                                                    <option value="240">Кожні 4 години</option>
                                                    <option value="1440">Раз на день</option>
                                                </select>
                                            </div>
                                            <label className="flex items-center gap-2 mt-3">
                                                <input type="checkbox" defaultChecked className="rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
                                                <span className="text-sm text-gray-700">Увімкнути автоматичну синхронізацію</span>
                                            </label>
                                        </div>
                                    </form>
                                )}
                            </div>

                            {/* Modal footer */}
                            <div className="p-6 border-t bg-gray-50">
                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (selectedIntegration) {
                                                setSelectedIntegration(null);
                                            } else {
                                                closeModal();
                                            }
                                        }}
                                        className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                                    >
                                        {selectedIntegration ? '← Назад' : 'Скасувати'}
                                    </button>
                                    {selectedIntegration && (
                                        <>
                                            <button
                                                type="button"
                                                onClick={() => handleTestConnection(selectedIntegration.id)}
                                                disabled={testingConnection === selectedIntegration.id}
                                                className="px-4 py-2.5 border border-teal-300 text-teal-700 rounded-lg font-medium hover:bg-teal-50 transition-colors disabled:opacity-50"
                                            >
                                                {testingConnection === selectedIntegration.id ? (
                                                    <ArrowPathIcon className="w-5 h-5 animate-spin inline" />
                                                ) : (
                                                    'Тест з\'єднання'
                                                )}
                                            </button>
                                            <button
                                                type="submit"
                                                className="flex-1 px-4 py-2.5 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition-colors"
                                            >
                                                Підключити
                                            </button>
                                        </>
                                    )}
                                </div>
                                {connectionTestResult && (
                                    <div className={`mt-3 p-3 rounded-lg ${connectionTestResult.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                        <div className="flex items-center gap-2">
                                            {connectionTestResult.success ? (
                                                <CheckCircleIcon className="w-5 h-5" />
                                            ) : (
                                                <XCircleIcon className="w-5 h-5" />
                                            )}
                                            <span className="text-sm font-medium">{connectionTestResult.message}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Settings modal (Edit credentials) */}
            {modalType === 'settings' && selectedIntegration && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div className="flex items-center justify-center min-h-screen px-4 py-8">
                        <div className="fixed inset-0 bg-black/50" onClick={closeModal} />
                        <div className="relative bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                            <div className="p-6 border-b">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center text-2xl">
                                        {selectedIntegration.logo}
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-semibold text-gray-900">Налаштування {selectedIntegration.name}</h3>
                                        <p className="text-sm text-gray-500">Редагування credentials та синхронізації</p>
                                    </div>
                                </div>
                            </div>
                            <div className="p-6 overflow-y-auto flex-1 space-y-6">
                                {/* Credentials section */}
                                <div>
                                    <h4 className="font-medium text-gray-900 mb-3">Дані підключення</h4>
                                    <div className="space-y-3">
                                        {marketplaceSettings[selectedIntegration.id]?.fields.filter(f => f.type !== 'checkbox').slice(0, 4).map((field) => (
                                            <div key={field.id}>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    {field.label}
                                                </label>
                                                <input
                                                    type={field.type}
                                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                                                    placeholder={field.placeholder}
                                                    defaultValue={field.type === 'password' ? '••••••••••' : ''}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Sync settings */}
                                <div>
                                    <h4 className="font-medium text-gray-900 mb-3">Налаштування синхронізації</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        {[
                                            { id: 'products', label: 'Товари', interval: 60 },
                                            { id: 'prices', label: 'Ціни', interval: 30 },
                                            { id: 'stock', label: 'Залишки', interval: 15 },
                                            { id: 'orders', label: 'Замовлення', interval: 5 },
                                        ].map((item) => (
                                            <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                                <div className="flex items-center gap-2">
                                                    <input type="checkbox" defaultChecked className="rounded border-gray-300 text-teal-600" />
                                                    <span className="text-sm text-gray-700">{item.label}</span>
                                                </div>
                                                <select className="text-sm border border-gray-300 rounded px-2 py-1">
                                                    <option value="5">5 хв</option>
                                                    <option value="15">15 хв</option>
                                                    <option value="30">30 хв</option>
                                                    <option value="60" selected={item.interval === 60}>1 год</option>
                                                    <option value="120">2 год</option>
                                                </select>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-4">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Пріоритет</label>
                                        <select className="w-full px-4 py-2.5 border border-gray-300 rounded-lg">
                                            <option value="low">Низький</option>
                                            <option value="normal" selected>Нормальний</option>
                                            <option value="high">Високий</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                            <div className="p-6 border-t bg-gray-50 flex gap-3">
                                <button onClick={closeModal} className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-100">
                                    Скасувати
                                </button>
                                <button
                                    onClick={() => handleTestConnection(selectedIntegration.id)}
                                    disabled={testingConnection === selectedIntegration.id}
                                    className="px-4 py-2.5 border border-teal-300 text-teal-700 rounded-lg font-medium hover:bg-teal-50 disabled:opacity-50"
                                >
                                    {testingConnection ? <ArrowPathIcon className="w-5 h-5 animate-spin" /> : 'Тест'}
                                </button>
                                <button className="flex-1 px-4 py-2.5 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700">
                                    Зберегти
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Category mapping modal */}
            {modalType === 'mapping' && selectedIntegration && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div className="flex items-center justify-center min-h-screen px-4 py-8">
                        <div className="fixed inset-0 bg-black/50" onClick={closeModal} />
                        <div className="relative bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                            <div className="p-6 border-b">
                                <h3 className="text-lg font-semibold text-gray-900">Мапінг категорій - {selectedIntegration.name}</h3>
                                <p className="text-sm text-gray-500 mt-1">Зв'яжіть ваші категорії з категоріями маркетплейсу</p>
                            </div>
                            <div className="p-6 overflow-y-auto flex-1">
                                <div className="space-y-3">
                                    {internalCategories.map((cat) => (
                                        <div key={cat.id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                                            <div className="flex-1">
                                                <span className="font-medium text-gray-900">{cat.name}</span>
                                                <span className="text-xs text-gray-500 ml-2">({cat.id})</span>
                                            </div>
                                            <span className="text-gray-400">→</span>
                                            <div className="flex-1">
                                                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                                                    <option value="">Не мапити</option>
                                                    <option value="phones">📱 Мобільні телефони</option>
                                                    <option value="tablets">📱 Планшети</option>
                                                    <option value="laptops">💻 Ноутбуки</option>
                                                    <option value="accessories">🎧 Аксесуари</option>
                                                    <option value="audio">🔊 Аудіотехніка</option>
                                                    <option value="wearables">⌚ Смарт-годинники</option>
                                                </select>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Product filter */}
                                <div className="mt-6 pt-6 border-t">
                                    <h4 className="font-medium text-gray-900 mb-3">Фільтр товарів</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Мін. ціна</label>
                                            <input type="number" className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="0" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Макс. ціна</label>
                                            <input type="number" className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="999999" />
                                        </div>
                                    </div>
                                    <div className="mt-3 space-y-2">
                                        <label className="flex items-center gap-2">
                                            <input type="checkbox" defaultChecked className="rounded border-gray-300 text-teal-600" />
                                            <span className="text-sm text-gray-700">Тільки товари в наявності</span>
                                        </label>
                                        <label className="flex items-center gap-2">
                                            <input type="checkbox" className="rounded border-gray-300 text-teal-600" />
                                            <span className="text-sm text-gray-700">Виключити товари без фото</span>
                                        </label>
                                        <label className="flex items-center gap-2">
                                            <input type="checkbox" className="rounded border-gray-300 text-teal-600" />
                                            <span className="text-sm text-gray-700">Виключити товари без опису</span>
                                        </label>
                                    </div>
                                    <div className="mt-3">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Виключити SKU (через кому)</label>
                                        <textarea className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" rows={2} placeholder="SKU-001, SKU-002, SKU-003" />
                                    </div>
                                </div>
                            </div>
                            <div className="p-6 border-t bg-gray-50 flex gap-3">
                                <button onClick={closeModal} className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-100">
                                    Скасувати
                                </button>
                                <button className="flex-1 px-4 py-2.5 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700">
                                    Зберегти мапінг
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Pricing rules modal */}
            {modalType === 'pricing' && selectedIntegration && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div className="flex items-center justify-center min-h-screen px-4 py-8">
                        <div className="fixed inset-0 bg-black/50" onClick={closeModal} />
                        <div className="relative bg-white rounded-2xl shadow-xl max-w-xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                            <div className="p-6 border-b">
                                <h3 className="text-lg font-semibold text-gray-900">Правила ціноутворення - {selectedIntegration.name}</h3>
                                <p className="text-sm text-gray-500 mt-1">Налаштуйте ціни для цього маркетплейсу</p>
                            </div>
                            <div className="p-6 overflow-y-auto flex-1 space-y-6">
                                {/* Markup */}
                                <div>
                                    <h4 className="font-medium text-gray-900 mb-3">Націнка</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Відсоток (%)</label>
                                            <input type="number" className="w-full px-4 py-2.5 border border-gray-300 rounded-lg" placeholder="0" defaultValue={0} />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Фіксована сума (₴)</label>
                                            <input type="number" className="w-full px-4 py-2.5 border border-gray-300 rounded-lg" placeholder="0" defaultValue={0} />
                                        </div>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-2">Формула: (Базова ціна × (1 + %/100)) + Фіксована сума</p>
                                </div>

                                {/* Rounding */}
                                <div>
                                    <h4 className="font-medium text-gray-900 mb-3">Округлення</h4>
                                    <div className="grid grid-cols-5 gap-2">
                                        {[
                                            { value: 'none', label: 'Без' },
                                            { value: '1', label: 'До 1₴' },
                                            { value: '10', label: 'До 10₴' },
                                            { value: '100', label: 'До 100₴' },
                                            { value: '99', label: 'До X99₴' },
                                        ].map((opt) => (
                                            <label key={opt.value} className="flex items-center justify-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                                                <input type="radio" name="rounding" value={opt.value} className="sr-only peer" />
                                                <span className="text-sm peer-checked:text-teal-600 peer-checked:font-medium">{opt.label}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                {/* Min/Max price */}
                                <div>
                                    <h4 className="font-medium text-gray-900 mb-3">Обмеження ціни</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Мінімальна ціна (₴)</label>
                                            <input type="number" className="w-full px-4 py-2.5 border border-gray-300 rounded-lg" placeholder="Без обмеження" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Максимальна ціна (₴)</label>
                                            <input type="number" className="w-full px-4 py-2.5 border border-gray-300 rounded-lg" placeholder="Без обмеження" />
                                        </div>
                                    </div>
                                </div>

                                {/* Compare at price */}
                                <div>
                                    <h4 className="font-medium text-gray-900 mb-3">Ціна порівняння (для відображення знижки)</h4>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Націнка для старої ціни (%)</label>
                                        <input type="number" className="w-full px-4 py-2.5 border border-gray-300 rounded-lg" placeholder="20" defaultValue={20} />
                                        <p className="text-xs text-gray-500 mt-1">Стара ціна буде показана як: Ціна × (1 + %/100)</p>
                                    </div>
                                </div>

                                {/* Preview */}
                                <div className="bg-gray-50 rounded-lg p-4">
                                    <h4 className="font-medium text-gray-900 mb-2">Приклад</h4>
                                    <div className="flex items-center gap-4">
                                        <div>
                                            <span className="text-sm text-gray-500">Базова ціна:</span>
                                            <span className="ml-2 font-medium">₴1,000</span>
                                        </div>
                                        <span className="text-gray-400">→</span>
                                        <div>
                                            <span className="text-sm text-gray-500">На маркетплейсі:</span>
                                            <span className="ml-2 font-bold text-teal-600">₴1,000</span>
                                            <span className="ml-2 text-sm text-gray-400 line-through">₴1,200</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="p-6 border-t bg-gray-50 flex gap-3">
                                <button onClick={closeModal} className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-100">
                                    Скасувати
                                </button>
                                <button className="flex-1 px-4 py-2.5 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700">
                                    Зберегти правила
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Notifications modal */}
            {modalType === 'notifications' && selectedIntegration && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div className="flex items-center justify-center min-h-screen px-4 py-8">
                        <div className="fixed inset-0 bg-black/50" onClick={closeModal} />
                        <div className="relative bg-white rounded-2xl shadow-xl max-w-xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                            <div className="p-6 border-b">
                                <h3 className="text-lg font-semibold text-gray-900">Сповіщення - {selectedIntegration.name}</h3>
                                <p className="text-sm text-gray-500 mt-1">Налаштуйте сповіщення про події</p>
                            </div>
                            <div className="p-6 overflow-y-auto flex-1 space-y-6">
                                {/* Email notifications */}
                                <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <h4 className="font-medium text-gray-900">Email сповіщення</h4>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input type="checkbox" className="sr-only peer" />
                                            <div className="w-11 h-6 bg-gray-200 peer-focus:ring-4 peer-focus:ring-teal-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                                        </label>
                                    </div>
                                    <input type="email" className="w-full px-4 py-2.5 border border-gray-300 rounded-lg" placeholder="email@example.com" />
                                </div>

                                {/* Telegram notifications */}
                                <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <h4 className="font-medium text-gray-900">Telegram сповіщення</h4>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input type="checkbox" className="sr-only peer" />
                                            <div className="w-11 h-6 bg-gray-200 peer-focus:ring-4 peer-focus:ring-teal-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                                        </label>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <input type="text" className="px-4 py-2.5 border border-gray-300 rounded-lg" placeholder="Bot Token" />
                                        <input type="text" className="px-4 py-2.5 border border-gray-300 rounded-lg" placeholder="Chat ID" />
                                    </div>
                                    <p className="text-xs text-gray-500 mt-2">Отримайте Bot Token від @BotFather та Chat ID від @userinfobot</p>
                                </div>

                                {/* Event types */}
                                <div>
                                    <h4 className="font-medium text-gray-900 mb-3">Типи подій</h4>
                                    <div className="space-y-2">
                                        {[
                                            { id: 'onError', label: 'Помилки синхронізації', desc: 'Сповіщати про помилки API та синхронізації', default: true },
                                            { id: 'onSyncComplete', label: 'Завершення синхронізації', desc: 'Сповіщати після успішної синхронізації', default: false },
                                            { id: 'onLowStock', label: 'Низький залишок', desc: 'Сповіщати коли товар закінчується', default: true },
                                            { id: 'onNewOrder', label: 'Нове замовлення', desc: 'Сповіщати про нові замовлення', default: true },
                                        ].map((event) => (
                                            <label key={event.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
                                                <input type="checkbox" defaultChecked={event.default} className="mt-0.5 rounded border-gray-300 text-teal-600" />
                                                <div>
                                                    <span className="block text-sm font-medium text-gray-900">{event.label}</span>
                                                    <span className="block text-xs text-gray-500">{event.desc}</span>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="p-6 border-t bg-gray-50 flex gap-3">
                                <button onClick={closeModal} className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-100">
                                    Скасувати
                                </button>
                                <button className="px-4 py-2.5 border border-teal-300 text-teal-700 rounded-lg font-medium hover:bg-teal-50">
                                    Тест сповіщення
                                </button>
                                <button className="flex-1 px-4 py-2.5 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700">
                                    Зберегти
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
