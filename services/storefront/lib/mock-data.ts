// Mock data generator for 5000 products and 100 promotions

export interface Category {
    id: string;
    name: string;
    slug: string;
    parentId?: string;
    icon?: string;
    productCount?: number;
}

export interface Product {
    id: string;
    name: string;
    price: number;
    oldPrice?: number;
    sku: string;
    stock: number;
    image_url: string;
    category_id: string;
    category?: Category;
    brand: string;
    description: string;
    rating: number;
    reviewCount: number;
    isNew?: boolean;
    isBestseller?: boolean;
    attributes?: Record<string, string>;
}

export interface Promotion {
    id: number;
    name: string;
    type: 'percentage' | 'fixed' | 'bundle' | 'gift';
    discount: number;
    code?: string;
    startDate: string;
    endDate: string;
    minOrderAmount?: number;
    maxDiscount?: number;
    categoryIds?: string[];
    productIds?: string[];
    usageLimit?: number;
    usedCount: number;
    isActive: boolean;
}

// Categories structure (50+ categories)
export const categories: Category[] = [
    // Electronics
    { id: 'cat-1', name: 'Електроніка', slug: 'electronics', icon: '📱' },
    { id: 'cat-1-1', name: 'Смартфони', slug: 'smartphones', parentId: 'cat-1' },
    { id: 'cat-1-2', name: 'Планшети', slug: 'tablets', parentId: 'cat-1' },
    { id: 'cat-1-3', name: 'Ноутбуки', slug: 'laptops', parentId: 'cat-1' },
    { id: 'cat-1-4', name: 'Комп\'ютери', slug: 'computers', parentId: 'cat-1' },
    { id: 'cat-1-5', name: 'Телевізори', slug: 'tvs', parentId: 'cat-1' },
    { id: 'cat-1-6', name: 'Аудіотехніка', slug: 'audio', parentId: 'cat-1' },
    { id: 'cat-1-7', name: 'Фото та відео', slug: 'photo-video', parentId: 'cat-1' },
    { id: 'cat-1-8', name: 'Ігрові консолі', slug: 'gaming-consoles', parentId: 'cat-1' },
    { id: 'cat-1-9', name: 'Аксесуари', slug: 'electronics-accessories', parentId: 'cat-1' },
    { id: 'cat-1-10', name: 'Розумні годинники', slug: 'smartwatches', parentId: 'cat-1' },

    // Home appliances
    { id: 'cat-2', name: 'Побутова техніка', slug: 'home-appliances', icon: '🏠' },
    { id: 'cat-2-1', name: 'Холодильники', slug: 'refrigerators', parentId: 'cat-2' },
    { id: 'cat-2-2', name: 'Пральні машини', slug: 'washing-machines', parentId: 'cat-2' },
    { id: 'cat-2-3', name: 'Посудомийні машини', slug: 'dishwashers', parentId: 'cat-2' },
    { id: 'cat-2-4', name: 'Пилососи', slug: 'vacuum-cleaners', parentId: 'cat-2' },
    { id: 'cat-2-5', name: 'Мікрохвильовки', slug: 'microwaves', parentId: 'cat-2' },
    { id: 'cat-2-6', name: 'Духові шафи', slug: 'ovens', parentId: 'cat-2' },
    { id: 'cat-2-7', name: 'Варильні поверхні', slug: 'cooktops', parentId: 'cat-2' },
    { id: 'cat-2-8', name: 'Кондиціонери', slug: 'air-conditioners', parentId: 'cat-2' },
    { id: 'cat-2-9', name: 'Обігрівачі', slug: 'heaters', parentId: 'cat-2' },
    { id: 'cat-2-10', name: 'Водонагрівачі', slug: 'water-heaters', parentId: 'cat-2' },

    // Kitchen appliances
    { id: 'cat-3', name: 'Кухонна техніка', slug: 'kitchen-appliances', icon: '🍳' },
    { id: 'cat-3-1', name: 'Кавоварки', slug: 'coffee-makers', parentId: 'cat-3' },
    { id: 'cat-3-2', name: 'Чайники', slug: 'kettles', parentId: 'cat-3' },
    { id: 'cat-3-3', name: 'Блендери', slug: 'blenders', parentId: 'cat-3' },
    { id: 'cat-3-4', name: 'Мультиварки', slug: 'multicookers', parentId: 'cat-3' },
    { id: 'cat-3-5', name: 'Тостери', slug: 'toasters', parentId: 'cat-3' },
    { id: 'cat-3-6', name: 'М\'ясорубки', slug: 'meat-grinders', parentId: 'cat-3' },
    { id: 'cat-3-7', name: 'Міксери', slug: 'mixers', parentId: 'cat-3' },
    { id: 'cat-3-8', name: 'Соковижималки', slug: 'juicers', parentId: 'cat-3' },

    // Clothing
    { id: 'cat-4', name: 'Одяг', slug: 'clothing', icon: '👔' },
    { id: 'cat-4-1', name: 'Чоловічий одяг', slug: 'mens-clothing', parentId: 'cat-4' },
    { id: 'cat-4-2', name: 'Жіночий одяг', slug: 'womens-clothing', parentId: 'cat-4' },
    { id: 'cat-4-3', name: 'Дитячий одяг', slug: 'kids-clothing', parentId: 'cat-4' },
    { id: 'cat-4-4', name: 'Спортивний одяг', slug: 'sportswear', parentId: 'cat-4' },
    { id: 'cat-4-5', name: 'Верхній одяг', slug: 'outerwear', parentId: 'cat-4' },
    { id: 'cat-4-6', name: 'Нижня білизна', slug: 'underwear', parentId: 'cat-4' },

    // Footwear
    { id: 'cat-5', name: 'Взуття', slug: 'footwear', icon: '👟' },
    { id: 'cat-5-1', name: 'Чоловіче взуття', slug: 'mens-shoes', parentId: 'cat-5' },
    { id: 'cat-5-2', name: 'Жіноче взуття', slug: 'womens-shoes', parentId: 'cat-5' },
    { id: 'cat-5-3', name: 'Дитяче взуття', slug: 'kids-shoes', parentId: 'cat-5' },
    { id: 'cat-5-4', name: 'Спортивне взуття', slug: 'sport-shoes', parentId: 'cat-5' },

    // Beauty
    { id: 'cat-6', name: 'Краса та здоров\'я', slug: 'beauty-health', icon: '💄' },
    { id: 'cat-6-1', name: 'Косметика', slug: 'cosmetics', parentId: 'cat-6' },
    { id: 'cat-6-2', name: 'Парфумерія', slug: 'perfumes', parentId: 'cat-6' },
    { id: 'cat-6-3', name: 'Догляд за шкірою', slug: 'skincare', parentId: 'cat-6' },
    { id: 'cat-6-4', name: 'Догляд за волоссям', slug: 'haircare', parentId: 'cat-6' },
    { id: 'cat-6-5', name: 'Медичні товари', slug: 'medical', parentId: 'cat-6' },

    // Sport
    { id: 'cat-7', name: 'Спорт і туризм', slug: 'sports-tourism', icon: '⚽' },
    { id: 'cat-7-1', name: 'Фітнес', slug: 'fitness', parentId: 'cat-7' },
    { id: 'cat-7-2', name: 'Велосипеди', slug: 'bicycles', parentId: 'cat-7' },
    { id: 'cat-7-3', name: 'Туристичне спорядження', slug: 'camping', parentId: 'cat-7' },
    { id: 'cat-7-4', name: 'Зимові види спорту', slug: 'winter-sports', parentId: 'cat-7' },
    { id: 'cat-7-5', name: 'Водні види спорту', slug: 'water-sports', parentId: 'cat-7' },

    // Home & Garden
    { id: 'cat-8', name: 'Дім і сад', slug: 'home-garden', icon: '🏡' },
    { id: 'cat-8-1', name: 'Меблі', slug: 'furniture', parentId: 'cat-8' },
    { id: 'cat-8-2', name: 'Текстиль', slug: 'textiles', parentId: 'cat-8' },
    { id: 'cat-8-3', name: 'Освітлення', slug: 'lighting', parentId: 'cat-8' },
    { id: 'cat-8-4', name: 'Декор', slug: 'decor', parentId: 'cat-8' },
    { id: 'cat-8-5', name: 'Садові інструменти', slug: 'garden-tools', parentId: 'cat-8' },
    { id: 'cat-8-6', name: 'Посуд', slug: 'tableware', parentId: 'cat-8' },

    // Kids
    { id: 'cat-9', name: 'Дитячі товари', slug: 'kids', icon: '🧸' },
    { id: 'cat-9-1', name: 'Іграшки', slug: 'toys', parentId: 'cat-9' },
    { id: 'cat-9-2', name: 'Дитячий транспорт', slug: 'kids-transport', parentId: 'cat-9' },
    { id: 'cat-9-3', name: 'Для немовлят', slug: 'baby', parentId: 'cat-9' },
    { id: 'cat-9-4', name: 'Дитячі меблі', slug: 'kids-furniture', parentId: 'cat-9' },

    // Auto
    { id: 'cat-10', name: 'Автотовари', slug: 'auto', icon: '🚗' },
    { id: 'cat-10-1', name: 'Автоелектроніка', slug: 'car-electronics', parentId: 'cat-10' },
    { id: 'cat-10-2', name: 'Автохімія', slug: 'car-chemicals', parentId: 'cat-10' },
    { id: 'cat-10-3', name: 'Автоаксесуари', slug: 'car-accessories', parentId: 'cat-10' },
    { id: 'cat-10-4', name: 'Шини та диски', slug: 'tires-wheels', parentId: 'cat-10' },

    // Books & Stationery
    { id: 'cat-11', name: 'Книги та канцелярія', slug: 'books-stationery', icon: '📚' },
    { id: 'cat-11-1', name: 'Книги', slug: 'books', parentId: 'cat-11' },
    { id: 'cat-11-2', name: 'Канцелярія', slug: 'stationery', parentId: 'cat-11' },
    { id: 'cat-11-3', name: 'Товари для школи', slug: 'school-supplies', parentId: 'cat-11' },

    // Pets
    { id: 'cat-12', name: 'Зоотовари', slug: 'pets', icon: '🐕' },
    { id: 'cat-12-1', name: 'Для собак', slug: 'dogs', parentId: 'cat-12' },
    { id: 'cat-12-2', name: 'Для котів', slug: 'cats', parentId: 'cat-12' },
    { id: 'cat-12-3', name: 'Для птахів', slug: 'birds', parentId: 'cat-12' },
    { id: 'cat-12-4', name: 'Акваріумістика', slug: 'aquarium', parentId: 'cat-12' },

    // Food
    { id: 'cat-13', name: 'Продукти харчування', slug: 'food', icon: '🍎' },
    { id: 'cat-13-1', name: 'Кава та чай', slug: 'coffee-tea', parentId: 'cat-13' },
    { id: 'cat-13-2', name: 'Солодощі', slug: 'sweets', parentId: 'cat-13' },
    { id: 'cat-13-3', name: 'Здорове харчування', slug: 'healthy-food', parentId: 'cat-13' },
    { id: 'cat-13-4', name: 'Напої', slug: 'drinks', parentId: 'cat-13' },
];

// Brands by category
const brandsByCategory: Record<string, string[]> = {
    'cat-1-1': ['Apple', 'Samsung', 'Xiaomi', 'OnePlus', 'Google', 'OPPO', 'Realme', 'Nothing', 'Motorola', 'Nokia'],
    'cat-1-2': ['Apple', 'Samsung', 'Xiaomi', 'Lenovo', 'Huawei', 'Microsoft', 'Amazon'],
    'cat-1-3': ['Apple', 'ASUS', 'Lenovo', 'HP', 'Dell', 'Acer', 'MSI', 'Huawei', 'Microsoft'],
    'cat-1-4': ['ASUS', 'MSI', 'Lenovo', 'HP', 'Dell', 'Acer', 'Intel', 'AMD'],
    'cat-1-5': ['Samsung', 'LG', 'Sony', 'Philips', 'TCL', 'Hisense', 'Xiaomi'],
    'cat-1-6': ['Sony', 'JBL', 'Bose', 'Marshall', 'Harman Kardon', 'Bang & Olufsen', 'Sonos'],
    'cat-1-7': ['Canon', 'Nikon', 'Sony', 'Fujifilm', 'Panasonic', 'GoPro', 'DJI'],
    'cat-1-8': ['Sony', 'Microsoft', 'Nintendo', 'Valve'],
    'cat-1-9': ['Apple', 'Samsung', 'Anker', 'Baseus', 'Belkin', 'Ugreen'],
    'cat-1-10': ['Apple', 'Samsung', 'Garmin', 'Amazfit', 'Xiaomi', 'Huawei'],
    'cat-2-1': ['Samsung', 'LG', 'Bosch', 'Siemens', 'Electrolux', 'Beko', 'Gorenje'],
    'cat-2-2': ['Samsung', 'LG', 'Bosch', 'Siemens', 'Electrolux', 'Beko', 'Gorenje', 'Whirlpool'],
    'cat-2-3': ['Bosch', 'Siemens', 'Electrolux', 'Gorenje', 'Whirlpool', 'Samsung'],
    'cat-2-4': ['Dyson', 'Samsung', 'Philips', 'Xiaomi', 'Bosch', 'Rowenta', 'Electrolux'],
    'cat-2-5': ['Samsung', 'LG', 'Bosch', 'Siemens', 'Panasonic', 'Sharp'],
    'cat-2-6': ['Bosch', 'Siemens', 'Electrolux', 'Gorenje', 'Samsung', 'Whirlpool'],
    'cat-2-7': ['Bosch', 'Siemens', 'Electrolux', 'Gorenje', 'Samsung', 'Whirlpool'],
    'cat-2-8': ['Samsung', 'LG', 'Daikin', 'Mitsubishi', 'Gree', 'Cooper&Hunter'],
    'cat-2-9': ['Electrolux', 'Philips', 'Rowenta', 'Xiaomi', 'Ballu'],
    'cat-2-10': ['Bosch', 'Electrolux', 'Ariston', 'Atlantic', 'Gorenje'],
    'cat-3-1': ['DeLonghi', 'Philips', 'Krups', 'Nespresso', 'Jura', 'Siemens', 'Bosch'],
    'cat-3-2': ['Philips', 'Bosch', 'Braun', 'Tefal', 'Xiaomi', 'Electrolux'],
    'cat-3-3': ['Philips', 'Braun', 'Bosch', 'Xiaomi', 'Tefal', 'KitchenAid'],
    'cat-3-4': ['Philips', 'Redmond', 'Tefal', 'Moulinex', 'Polaris'],
    'cat-3-5': ['Philips', 'Bosch', 'Tefal', 'Russell Hobbs', 'Electrolux'],
    'cat-3-6': ['Bosch', 'Philips', 'Braun', 'Moulinex', 'Zelmer'],
    'cat-3-7': ['Bosch', 'Philips', 'Braun', 'KitchenAid', 'Moulinex'],
    'cat-3-8': ['Philips', 'Braun', 'Bosch', 'Moulinex', 'Hurom'],
    'cat-4-1': ['Nike', 'Adidas', 'Puma', 'Under Armour', 'Reebok', 'Tommy Hilfiger', 'Hugo Boss', 'Lacoste'],
    'cat-4-2': ['Zara', 'H&M', 'Mango', 'Reserved', 'Massimo Dutti', 'Nike', 'Adidas'],
    'cat-4-3': ['Carter\'s', 'H&M', 'Zara Kids', 'Gap Kids', 'Reserved Kids'],
    'cat-4-4': ['Nike', 'Adidas', 'Puma', 'Under Armour', 'Reebok', 'New Balance'],
    'cat-4-5': ['The North Face', 'Columbia', 'Canada Goose', 'Moncler', 'Patagonia'],
    'cat-4-6': ['Calvin Klein', 'Tommy Hilfiger', 'Victoria\'s Secret', 'Intimissimi'],
    'cat-5-1': ['Nike', 'Adidas', 'Puma', 'New Balance', 'Reebok', 'Timberland', 'Clarks'],
    'cat-5-2': ['Nike', 'Adidas', 'Puma', 'New Balance', 'Reebok', 'Converse', 'Vans'],
    'cat-5-3': ['Nike', 'Adidas', 'Puma', 'Geox', 'Ecco', 'Timberland'],
    'cat-5-4': ['Nike', 'Adidas', 'Puma', 'New Balance', 'Reebok', 'ASICS', 'Under Armour'],
    'cat-6-1': ['MAC', 'Maybelline', 'L\'Oreal', 'NYX', 'Fenty Beauty', 'Charlotte Tilbury'],
    'cat-6-2': ['Chanel', 'Dior', 'Gucci', 'Tom Ford', 'Yves Saint Laurent', 'Versace'],
    'cat-6-3': ['La Roche-Posay', 'CeraVe', 'The Ordinary', 'Clinique', 'Estee Lauder'],
    'cat-6-4': ['L\'Oreal', 'Kerastase', 'Olaplex', 'Moroccanoil', 'Redken'],
    'cat-6-5': ['Omron', 'Braun', 'Philips', 'Beurer', 'Microlife'],
    'cat-7-1': ['Technogym', 'Life Fitness', 'Horizon', 'Kettler', 'Torneo'],
    'cat-7-2': ['Giant', 'Trek', 'Specialized', 'Cannondale', 'Scott', 'Merida'],
    'cat-7-3': ['The North Face', 'Columbia', 'Jack Wolfskin', 'Mammut', 'Salomon'],
    'cat-7-4': ['Rossignol', 'Atomic', 'Salomon', 'Head', 'Fischer'],
    'cat-7-5': ['Speedo', 'Arena', 'TYR', 'Aqua Sphere'],
    'cat-8-1': ['IKEA', 'JYSK', 'Ashley', 'Natuzzi', 'BoConcept'],
    'cat-8-2': ['IKEA', 'JYSK', 'H&M Home', 'Zara Home', 'Dormeo'],
    'cat-8-3': ['Philips', 'IKEA', 'Eglo', 'Maxus', 'Feron'],
    'cat-8-4': ['IKEA', 'H&M Home', 'Zara Home', 'Kare Design'],
    'cat-8-5': ['Gardena', 'Bosch', 'Makita', 'Stihl', 'Husqvarna'],
    'cat-8-6': ['Luminarc', 'Villeroy & Boch', 'WMF', 'Tefal', 'IKEA'],
    'cat-9-1': ['LEGO', 'Hasbro', 'Mattel', 'Fisher-Price', 'Playmobil', 'Hot Wheels'],
    'cat-9-2': ['Xiaomi', 'Segway', 'Razor', 'Micro', 'Globber'],
    'cat-9-3': ['Philips Avent', 'Chicco', 'NUK', 'Tommee Tippee', 'Pampers'],
    'cat-9-4': ['IKEA', 'Pinio', 'Cilek', 'Team7'],
    'cat-10-1': ['Pioneer', 'Alpine', 'Kenwood', 'JVC', 'Sony'],
    'cat-10-2': ['Sonax', 'Meguiar\'s', 'Chemical Guys', 'Turtle Wax'],
    'cat-10-3': ['Thule', 'Autostandart', 'AVS', 'Carex'],
    'cat-10-4': ['Michelin', 'Continental', 'Pirelli', 'Bridgestone', 'Goodyear', 'Nokian'],
    'cat-11-1': ['Penguin', 'HarperCollins', 'Vivat', 'Ranok', 'Видавництво Старого Лева'],
    'cat-11-2': ['Moleskine', 'Leuchtturm1917', 'Paper Mate', 'Pilot', 'Faber-Castell'],
    'cat-11-3': ['KITE', 'Zibi', '1 Вересня', 'Economix'],
    'cat-12-1': ['Royal Canin', 'Hill\'s', 'Purina', 'Brit', 'Acana'],
    'cat-12-2': ['Royal Canin', 'Hill\'s', 'Purina', 'Brit', 'Whiskas'],
    'cat-12-3': ['Versele-Laga', 'Padovan', 'Vitakraft', 'Trixie'],
    'cat-12-4': ['Tetra', 'JBL', 'Sera', 'Aquael'],
    'cat-13-1': ['Lavazza', 'Illy', 'Jacobs', 'Nescafe', 'Lipton', 'Ahmad Tea'],
    'cat-13-2': ['Roshen', 'Milka', 'Ferrero', 'Lindt', 'Kinder'],
    'cat-13-3': ['Bob\'s Red Mill', 'Navitas', 'NOW Foods', 'Jarrow Formulas'],
    'cat-13-4': ['Coca-Cola', 'Pepsi', 'Schweppes', 'Моршинська', 'Боржомі'],
};

// Product name templates by category
const productTemplates: Record<string, { names: string[], priceRange: [number, number], attributes?: string[] }> = {
    'cat-1-1': {
        names: ['Pro', 'Ultra', 'Max', 'Plus', 'Lite', 'Mini', 'SE', 'Note', 'Edge', 'Fold'],
        priceRange: [5999, 79999],
        attributes: ['Екран', 'Камера', 'Батарея', 'Пам\'ять', 'ОЗП']
    },
    'cat-1-2': {
        names: ['Tab', 'Pad', 'Pro', 'Air', 'Mini', 'Plus', 'SE', 'Lite'],
        priceRange: [4999, 49999],
        attributes: ['Екран', 'Процесор', 'Пам\'ять', 'ОЗП', 'Батарея']
    },
    'cat-1-3': {
        names: ['Pro', 'Air', 'Book', 'Ultra', 'Slim', 'Gaming', 'Studio', 'X'],
        priceRange: [15999, 149999],
        attributes: ['Екран', 'Процесор', 'ОЗП', 'SSD', 'Відеокарта']
    },
    'cat-1-4': {
        names: ['Gaming PC', 'Workstation', 'Desktop', 'Tower', 'Compact', 'Mini PC'],
        priceRange: [19999, 199999],
        attributes: ['Процесор', 'ОЗП', 'SSD', 'Відеокарта', 'БП']
    },
    'cat-1-5': {
        names: ['QLED', 'OLED', 'Neo QLED', 'Crystal UHD', 'NanoCell', 'Smart TV'],
        priceRange: [9999, 199999],
        attributes: ['Діагональ', 'Роздільність', 'Smart TV', 'HDR']
    },
    'cat-1-6': {
        names: ['Soundbar', 'Speaker', 'Headphones', 'Earbuds', 'Home Theater', 'Subwoofer'],
        priceRange: [999, 49999],
        attributes: ['Потужність', 'Тип', 'Bluetooth', 'Батарея']
    },
    'cat-1-7': {
        names: ['EOS', 'Alpha', 'Z', 'X-T', 'GFX', 'Lumix', 'Hero', 'Mavic'],
        priceRange: [9999, 149999],
        attributes: ['Матриця', 'Об\'єктив', 'Відео', 'Стабілізація']
    },
    'cat-1-8': {
        names: ['PlayStation 5', 'Xbox Series X', 'Nintendo Switch', 'Steam Deck'],
        priceRange: [9999, 29999],
        attributes: ['Пам\'ять', 'Роздільність', 'Контролер']
    },
    'cat-1-9': {
        names: ['Case', 'Charger', 'Cable', 'Adapter', 'Stand', 'Holder', 'Screen Protector'],
        priceRange: [99, 2999],
        attributes: ['Сумісність', 'Матеріал', 'Колір']
    },
    'cat-1-10': {
        names: ['Watch', 'Band', 'Fit', 'Active', 'Sport', 'Pro', 'Ultra'],
        priceRange: [1999, 39999],
        attributes: ['Екран', 'Батарея', 'Водозахист', 'Датчики']
    },
    'cat-2-1': {
        names: ['No Frost', 'Side-by-Side', 'French Door', 'Двокамерний', 'Однокамерний'],
        priceRange: [9999, 89999],
        attributes: ['Об\'єм', 'Клас', 'No Frost', 'Інвертор']
    },
    'cat-2-2': {
        names: ['Slim', 'Повнорозмірна', 'Вузька', 'З сушкою', 'Інвертор'],
        priceRange: [9999, 49999],
        attributes: ['Завантаження', 'Оберти', 'Клас', 'Програми']
    },
    'cat-2-3': {
        names: ['Вбудована', 'Вільностояча', 'Компактна', 'Повнорозмірна'],
        priceRange: [12999, 59999],
        attributes: ['Місткість', 'Програми', 'Клас', 'Тип сушіння']
    },
    'cat-2-4': {
        names: ['Безпровідний', 'Робот', 'Вертикальний', 'Миючий', 'Циклонний'],
        priceRange: [1999, 39999],
        attributes: ['Потужність', 'Тип', 'Фільтр', 'Об\'єм']
    },
    'cat-2-5': {
        names: ['Соло', 'Гриль', 'Конвекція', 'Інвертор', 'Вбудована'],
        priceRange: [2999, 24999],
        attributes: ['Об\'єм', 'Потужність', 'Програми', 'Гриль']
    },
    'cat-2-6': {
        names: ['Електрична', 'Газова', 'Вбудована', 'Парова', 'З конвекцією'],
        priceRange: [9999, 49999],
        attributes: ['Об\'єм', 'Тип', 'Конвекція', 'Очищення']
    },
    'cat-2-7': {
        names: ['Індукційна', 'Електрична', 'Газова', 'Комбінована', 'Доміно'],
        priceRange: [5999, 39999],
        attributes: ['Конфорки', 'Тип', 'Управління', 'Розмір']
    },
    'cat-2-8': {
        names: ['Спліт-система', 'Мульти-спліт', 'Інверторний', 'WiFi', 'Очищення'],
        priceRange: [12999, 89999],
        attributes: ['BTU', 'Площа', 'Клас', 'Інвертор']
    },
    'cat-2-9': {
        names: ['Конвектор', 'Масляний', 'Інфрачервоний', 'Тепловентилятор', 'Керамічний'],
        priceRange: [999, 9999],
        attributes: ['Потужність', 'Площа', 'Тип', 'Термостат']
    },
    'cat-2-10': {
        names: ['Накопичувальний', 'Проточний', 'Бойлер', 'Сухий ТЕН', 'Емальований'],
        priceRange: [3999, 24999],
        attributes: ['Об\'єм', 'Потужність', 'Тип', 'Захист']
    },
    'cat-3-1': {
        names: ['Еспресо', 'Капсульна', 'Рожкова', 'Автомат', 'Крапельна', 'Турка'],
        priceRange: [1499, 89999],
        attributes: ['Тип', 'Тиск', 'Капучинатор', 'Помел']
    },
    'cat-3-2': {
        names: ['Електричний', 'Термопот', 'Скляний', 'Металевий', 'Смарт'],
        priceRange: [499, 4999],
        attributes: ['Об\'єм', 'Потужність', 'Матеріал', 'Фільтр']
    },
    'cat-3-3': {
        names: ['Стаціонарний', 'Занурювальний', 'Вакуумний', 'Портативний'],
        priceRange: [999, 14999],
        attributes: ['Потужність', 'Об\'єм', 'Швидкості', 'Насадки']
    },
    'cat-3-4': {
        names: ['Класична', 'Скороварка', '3D нагрів', 'Індукційна', 'WiFi'],
        priceRange: [1999, 12999],
        attributes: ['Об\'єм', 'Програми', 'Потужність', 'Покриття']
    },
    'cat-3-5': {
        names: ['Класичний', 'Смарт', 'З грилем', 'Сендвічниця', '4 слоти'],
        priceRange: [599, 4999],
        attributes: ['Слоти', 'Потужність', 'Режими', 'Розморозка']
    },
    'cat-3-6': {
        names: ['Електрична', 'Механічна', 'Потужна', 'Реверс', 'З насадками'],
        priceRange: [1999, 9999],
        attributes: ['Потужність', 'Продуктивність', 'Насадки', 'Реверс']
    },
    'cat-3-7': {
        names: ['Ручний', 'Стаціонарний', 'Планетарний', 'Професійний'],
        priceRange: [699, 24999],
        attributes: ['Потужність', 'Швидкості', 'Насадки', 'Чаша']
    },
    'cat-3-8': {
        names: ['Відцентрова', 'Шнекова', 'Цитрус-прес', 'Комбінована'],
        priceRange: [999, 19999],
        attributes: ['Тип', 'Потужність', 'Об\'єм', 'Швидкості']
    },
    'cat-4-1': {
        names: ['Футболка', 'Сорочка', 'Джинси', 'Светр', 'Куртка', 'Піджак', 'Шорти', 'Брюки'],
        priceRange: [399, 9999],
        attributes: ['Розмір', 'Колір', 'Матеріал', 'Сезон']
    },
    'cat-4-2': {
        names: ['Сукня', 'Блуза', 'Спідниця', 'Джинси', 'Светр', 'Кардиган', 'Топ', 'Брюки'],
        priceRange: [499, 14999],
        attributes: ['Розмір', 'Колір', 'Матеріал', 'Сезон']
    },
    'cat-4-3': {
        names: ['Футболка', 'Худі', 'Джинси', 'Куртка', 'Светр', 'Шорти', 'Комбінезон'],
        priceRange: [299, 4999],
        attributes: ['Вік', 'Розмір', 'Колір', 'Матеріал']
    },
    'cat-4-4': {
        names: ['Футболка', 'Шорти', 'Легінси', 'Топ', 'Толстовка', 'Костюм', 'Куртка'],
        priceRange: [499, 7999],
        attributes: ['Розмір', 'Колір', 'Матеріал', 'Тип']
    },
    'cat-4-5': {
        names: ['Куртка', 'Пуховик', 'Пальто', 'Парка', 'Бомбер', 'Вітровка', 'Плащ'],
        priceRange: [1999, 49999],
        attributes: ['Розмір', 'Колір', 'Матеріал', 'Сезон']
    },
    'cat-4-6': {
        names: ['Труси', 'Бюстгальтер', 'Комплект', 'Боксери', 'Майка', 'Шкарпетки'],
        priceRange: [199, 2999],
        attributes: ['Розмір', 'Колір', 'Матеріал', 'Тип']
    },
    'cat-5-1': {
        names: ['Кросівки', 'Туфлі', 'Черевики', 'Мокасини', 'Сандалі', 'Кеди', 'Лофери'],
        priceRange: [999, 14999],
        attributes: ['Розмір', 'Колір', 'Матеріал', 'Сезон']
    },
    'cat-5-2': {
        names: ['Кросівки', 'Туфлі', 'Черевики', 'Балетки', 'Босоніжки', 'Сандалі', 'Чоботи'],
        priceRange: [999, 19999],
        attributes: ['Розмір', 'Колір', 'Матеріал', 'Сезон']
    },
    'cat-5-3': {
        names: ['Кросівки', 'Черевики', 'Сандалі', 'Гумаки', 'Кеди', 'Тапочки'],
        priceRange: [599, 4999],
        attributes: ['Розмір', 'Колір', 'Матеріал', 'Сезон']
    },
    'cat-5-4': {
        names: ['Кросівки для бігу', 'Тренувальні', 'Футбольні бутси', 'Баскетбольні', 'Теніс'],
        priceRange: [1499, 12999],
        attributes: ['Розмір', 'Колір', 'Тип', 'Призначення']
    },
    'cat-6-1': {
        names: ['Помада', 'Тіні', 'Туш', 'Тональний', 'Пудра', 'Рум\'яна', 'Підводка', 'Основа'],
        priceRange: [199, 2999],
        attributes: ['Колір', 'Тип', 'Об\'єм', 'Ефект']
    },
    'cat-6-2': {
        names: ['Eau de Parfum', 'Eau de Toilette', 'Cologne', 'Intense', 'Limited'],
        priceRange: [999, 12999],
        attributes: ['Об\'єм', 'Тип', 'Ноти', 'Стійкість']
    },
    'cat-6-3': {
        names: ['Крем', 'Сироватка', 'Маска', 'Тонік', 'Пілінг', 'Гель', 'Молочко'],
        priceRange: [299, 4999],
        attributes: ['Тип шкіри', 'Об\'єм', 'Ефект', 'Вік']
    },
    'cat-6-4': {
        names: ['Шампунь', 'Кондиціонер', 'Маска', 'Олія', 'Спрей', 'Сироватка'],
        priceRange: [199, 2999],
        attributes: ['Тип волосся', 'Об\'єм', 'Ефект']
    },
    'cat-6-5': {
        names: ['Тонометр', 'Термометр', 'Інгалятор', 'Глюкометр', 'Ваги', 'Масажер'],
        priceRange: [399, 9999],
        attributes: ['Тип', 'Точність', 'Пам\'ять', 'Живлення']
    },
    'cat-7-1': {
        names: ['Бігова доріжка', 'Велотренажер', 'Еліптичний', 'Гантелі', 'Штанга', 'Лава'],
        priceRange: [999, 89999],
        attributes: ['Тип', 'Навантаження', 'Програми', 'Розмір']
    },
    'cat-7-2': {
        names: ['Гірський', 'Шосейний', 'Міський', 'BMX', 'Складний', 'Електро'],
        priceRange: [5999, 149999],
        attributes: ['Рама', 'Колеса', 'Швидкості', 'Гальма']
    },
    'cat-7-3': {
        names: ['Намет', 'Спальник', 'Килимок', 'Рюкзак', 'Ліхтар', 'Посуд'],
        priceRange: [499, 19999],
        attributes: ['Місткість', 'Вага', 'Сезон', 'Матеріал']
    },
    'cat-7-4': {
        names: ['Лижі', 'Сноуборд', 'Черевики', 'Палиці', 'Шолом', 'Маска'],
        priceRange: [999, 49999],
        attributes: ['Розмір', 'Рівень', 'Тип', 'Матеріал']
    },
    'cat-7-5': {
        names: ['Купальник', 'Окуляри', 'Шапочка', 'Ласти', 'Маска', 'Надувний'],
        priceRange: [299, 9999],
        attributes: ['Розмір', 'Матеріал', 'Тип']
    },
    'cat-8-1': {
        names: ['Диван', 'Ліжко', 'Шафа', 'Стіл', 'Стілець', 'Комод', 'Тумба', 'Полиця'],
        priceRange: [1999, 79999],
        attributes: ['Матеріал', 'Колір', 'Розмір', 'Стиль']
    },
    'cat-8-2': {
        names: ['Постіль', 'Рушник', 'Плед', 'Подушка', 'Ковдра', 'Штори', 'Килим'],
        priceRange: [299, 14999],
        attributes: ['Матеріал', 'Розмір', 'Колір']
    },
    'cat-8-3': {
        names: ['Люстра', 'Торшер', 'Бра', 'Настільна лампа', 'Світлодіодна стрічка', 'Лампа'],
        priceRange: [199, 19999],
        attributes: ['Тип', 'Потужність', 'Колір світла', 'Стиль']
    },
    'cat-8-4': {
        names: ['Картина', 'Ваза', 'Свічка', 'Рамка', 'Годинник', 'Дзеркало', 'Статуетка'],
        priceRange: [99, 9999],
        attributes: ['Стиль', 'Матеріал', 'Колір', 'Розмір']
    },
    'cat-8-5': {
        names: ['Газонокосарка', 'Тріммер', 'Мотоблок', 'Секатор', 'Лопата', 'Граблі'],
        priceRange: [199, 49999],
        attributes: ['Тип', 'Потужність', 'Матеріал']
    },
    'cat-8-6': {
        names: ['Набір тарілок', 'Чашки', 'Столові прибори', 'Каструля', 'Сковорода', 'Контейнер'],
        priceRange: [199, 9999],
        attributes: ['Матеріал', 'Кількість', 'Колір', 'Призначення']
    },
    'cat-9-1': {
        names: ['Конструктор', 'Лялька', 'Машинка', 'М\'яка іграшка', 'Настільна гра', 'Пазли'],
        priceRange: [199, 9999],
        attributes: ['Вік', 'Тип', 'Матеріал', 'Кількість']
    },
    'cat-9-2': {
        names: ['Самокат', 'Електросамокат', 'Гіроборд', 'Велосипед', 'Ролики', 'Санки'],
        priceRange: [999, 29999],
        attributes: ['Вік', 'Навантаження', 'Колеса', 'Тип']
    },
    'cat-9-3': {
        names: ['Пляшечка', 'Соска', 'Підгузки', 'Візок', 'Автокрісло', 'Ванночка'],
        priceRange: [99, 29999],
        attributes: ['Вік', 'Розмір', 'Тип', 'Матеріал']
    },
    'cat-9-4': {
        names: ['Ліжечко', 'Пеленальний столик', 'Шафа', 'Стіл', 'Стілець', 'Манеж'],
        priceRange: [1999, 19999],
        attributes: ['Вік', 'Матеріал', 'Колір', 'Розмір']
    },
    'cat-10-1': {
        names: ['Відеореєстратор', 'Навігатор', 'Магнітола', 'Парктронік', 'Камера'],
        priceRange: [999, 19999],
        attributes: ['Роздільність', 'Екран', 'GPS', 'WiFi']
    },
    'cat-10-2': {
        names: ['Шампунь', 'Поліроль', 'Очисник', 'Захист', 'Освіжувач', 'Антифриз'],
        priceRange: [99, 999],
        attributes: ['Об\'єм', 'Призначення', 'Тип']
    },
    'cat-10-3': {
        names: ['Чохол', 'Килимок', 'Тримач', 'Багажник', 'Чохли сидінь', 'Органайзер'],
        priceRange: [199, 9999],
        attributes: ['Матеріал', 'Розмір', 'Сумісність']
    },
    'cat-10-4': {
        names: ['Літні шини', 'Зимові шини', 'Всесезонні', 'Литі диски', 'Сталеві диски'],
        priceRange: [1999, 19999],
        attributes: ['Розмір', 'Індекс', 'Сезон', 'Тип']
    },
    'cat-11-1': {
        names: ['Роман', 'Детектив', 'Фантастика', 'Підручник', 'Словник', 'Біографія'],
        priceRange: [99, 999],
        attributes: ['Жанр', 'Мова', 'Сторінки', 'Обкладинка']
    },
    'cat-11-2': {
        names: ['Ручка', 'Олівець', 'Блокнот', 'Папір', 'Скріпки', 'Степлер', 'Файли'],
        priceRange: [19, 499],
        attributes: ['Тип', 'Колір', 'Кількість']
    },
    'cat-11-3': {
        names: ['Рюкзак', 'Пенал', 'Зошит', 'Щоденник', 'Фарби', 'Пластилін'],
        priceRange: [49, 2999],
        attributes: ['Клас', 'Тип', 'Розмір', 'Колір']
    },
    'cat-12-1': {
        names: ['Корм сухий', 'Корм вологий', 'Ласощі', 'Іграшка', 'Повідець', 'Миска'],
        priceRange: [99, 4999],
        attributes: ['Вік', 'Розмір', 'Вага', 'Смак']
    },
    'cat-12-2': {
        names: ['Корм сухий', 'Корм вологий', 'Наповнювач', 'Дряпка', 'Лежанка', 'Іграшка'],
        priceRange: [99, 9999],
        attributes: ['Вік', 'Вага', 'Смак', 'Тип']
    },
    'cat-12-3': {
        names: ['Корм', 'Клітка', 'Годівниця', 'Поїлка', 'Іграшка', 'Гілка'],
        priceRange: [49, 4999],
        attributes: ['Вид', 'Розмір', 'Тип']
    },
    'cat-12-4': {
        names: ['Акваріум', 'Фільтр', 'Компресор', 'Корм', 'Декор', 'Освітлення'],
        priceRange: [199, 19999],
        attributes: ['Об\'єм', 'Тип', 'Потужність']
    },
    'cat-13-1': {
        names: ['Мелена кава', 'Зернова кава', 'Розчинна', 'Чорний чай', 'Зелений чай', 'Трав\'яний'],
        priceRange: [79, 1499],
        attributes: ['Тип', 'Вага', 'Країна', 'Смак']
    },
    'cat-13-2': {
        names: ['Цукерки', 'Шоколад', 'Печиво', 'Торт', 'Вафлі', 'Мармелад'],
        priceRange: [29, 999],
        attributes: ['Тип', 'Вага', 'Смак']
    },
    'cat-13-3': {
        names: ['Мюслі', 'Протеїн', 'Вітаміни', 'Суперфуд', 'Батончик', 'Насіння'],
        priceRange: [99, 1999],
        attributes: ['Тип', 'Вага', 'Склад']
    },
    'cat-13-4': {
        names: ['Вода', 'Сік', 'Газована', 'Енергетик', 'Чай холодний', 'Лимонад'],
        priceRange: [19, 199],
        attributes: ['Тип', 'Об\'єм', 'Смак']
    },
};

// Seeded random number generator for consistent data
function seededRandom(seed: number): () => number {
    return function() {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        return seed / 0x7fffffff;
    };
}

// Generate 5000 products
function generateProducts(): Product[] {
    const products: Product[] = [];
    const random = seededRandom(42);

    // Get all subcategories (categories with parentId)
    const subcategories = categories.filter(c => c.parentId);
    let productId = 1;

    // Calculate products per category to reach ~5000 total
    const productsPerCategory = Math.ceil(5000 / subcategories.length);

    for (const category of subcategories) {
        const template = productTemplates[category.id] || {
            names: ['Продукт'],
            priceRange: [999, 9999] as [number, number]
        };
        const brands = brandsByCategory[category.id] || ['Generic'];

        for (let i = 0; i < productsPerCategory && products.length < 5000; i++) {
            const brand = brands[Math.floor(random() * brands.length)];
            const nameSuffix = template.names[Math.floor(random() * template.names.length)];
            const modelNumber = Math.floor(random() * 900) + 100;
            const year = 2023 + Math.floor(random() * 2);

            const basePrice = template.priceRange[0] +
                Math.floor(random() * (template.priceRange[1] - template.priceRange[0]));

            // Round to nice numbers, ensure minimum price of 99
            const price = Math.max(99, Math.round(basePrice / 100) * 100 - 1);

            // Some products have old price (discount)
            const hasDiscount = random() < 0.3;
            // Old price should be higher than current price (10-50% more)
            const oldPrice = hasDiscount ? Math.round(price * (1.15 + random() * 0.35)) : undefined;

            const product: Product = {
                id: `prod-${productId}`,
                name: `${brand} ${nameSuffix} ${modelNumber} (${year})`,
                price,
                oldPrice,
                sku: `SKU-${category.id.toUpperCase()}-${String(productId).padStart(6, '0')}`,
                stock: Math.floor(random() * 100),
                image_url: `/products/${category.slug || category.id}/${productId % 20 + 1}.jpg`,
                category_id: category.id,
                category: category,
                brand,
                description: `${brand} ${nameSuffix} - якісний товар від провідного виробника. Модель ${year} року з покращеними характеристиками.`,
                rating: Math.round((3.5 + random() * 1.5) * 10) / 10,
                reviewCount: Math.floor(random() * 500),
                isNew: random() < 0.15,
                isBestseller: random() < 0.1,
            };

            // Add attributes if template has them
            if (template.attributes) {
                product.attributes = {};
                for (const attr of template.attributes) {
                    product.attributes[attr] = `Значення ${attr}`;
                }
            }

            products.push(product);
            productId++;
        }
    }

    return products;
}

// Generate 100 promotions
function generatePromotions(): Promotion[] {
    const promotions: Promotion[] = [];
    const random = seededRandom(123);

    const promoNames = [
        'Зимовий розпродаж', 'Новорічні знижки', 'Чорна п\'ятниця', 'Кіберпонеділок',
        'Весняні знижки', 'Літній розпродаж', 'Осінній сейл', 'День народження магазину',
        'Знижки до 8 березня', 'Акція до Дня закоханих', 'Великодні знижки', 'Back to School',
        'Знижки на електроніку', 'Знижки на побутову техніку', 'Знижки на одяг', 'Знижки на взуття',
        'Тижневий розпродаж', 'Вихідні знижки', 'Flash Sale', 'Супер ціни',
        'Гарячі пропозиції', 'Знижки для нових клієнтів', 'Бонусні дні', 'Подвійний кешбек',
        'Безкоштовна доставка', 'Подарунок до покупки', 'Знижка на другий товар', 'Сімейні знижки',
        'Студентська знижка', 'Пенсійна знижка', 'VIP знижки', 'Ексклюзивна пропозиція',
    ];

    const promoCodes = [
        'WINTER24', 'NEWYEAR25', 'BLACKFRI', 'CYBER24', 'SPRING25', 'SUMMER24',
        'FALL24', 'BDAY2024', 'MARCH8', 'LOVE14', 'EASTER24', 'SCHOOL24',
        'TECH20', 'HOME15', 'STYLE30', 'SHOES25', 'WEEK10', 'WEEKEND20',
        'FLASH50', 'SUPER15', 'HOT25', 'NEWUSER', 'BONUS30', 'CASH2X',
        'FREESHIP', 'GIFT2024', 'SECOND50', 'FAMILY20', 'STUDENT15', 'SENIOR10',
        'VIP30', 'EXCLUSIVE', 'SAVE10', 'SAVE15', 'SAVE20', 'SAVE25', 'SAVE30',
        'DEAL10', 'DEAL20', 'DEAL30', 'PROMO10', 'PROMO20', 'PROMO30',
        'DISCOUNT10', 'DISCOUNT20', 'DISCOUNT30', 'SALE10', 'SALE20', 'SALE30',
        'OFFER10', 'OFFER20', 'OFFER30', 'SPECIAL10', 'SPECIAL20', 'SPECIAL30',
    ];

    const subcategories = categories.filter(c => c.parentId);

    for (let i = 0; i < 100; i++) {
        const type = ['percentage', 'fixed', 'bundle', 'gift'][Math.floor(random() * 4)] as Promotion['type'];
        const discount = type === 'percentage'
            ? Math.floor(random() * 50) + 5
            : type === 'fixed'
                ? Math.floor(random() * 500) * 10 + 100
                : Math.floor(random() * 30) + 10;

        const startMonth = Math.floor(random() * 12) + 1;
        const startDay = Math.floor(random() * 28) + 1;
        const duration = Math.floor(random() * 30) + 7;

        const startDate = new Date(2024, startMonth - 1, startDay);
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + duration);

        const hasCategory = random() < 0.4;
        const categoryIds = hasCategory
            ? [subcategories[Math.floor(random() * subcategories.length)].id]
            : undefined;

        const promotion: Promotion = {
            id: i + 1,
            name: promoNames[i % promoNames.length] + (i >= promoNames.length ? ` ${Math.floor(i / promoNames.length) + 1}` : ''),
            type,
            discount,
            code: promoCodes[i % promoCodes.length] + (i >= promoCodes.length ? Math.floor(i / promoCodes.length) : ''),
            startDate: startDate.toLocaleDateString('uk-UA'),
            endDate: endDate.toLocaleDateString('uk-UA'),
            minOrderAmount: random() < 0.5 ? Math.floor(random() * 10) * 500 + 500 : undefined,
            maxDiscount: type === 'percentage' && random() < 0.3 ? Math.floor(random() * 50) * 100 + 500 : undefined,
            categoryIds,
            usageLimit: random() < 0.6 ? Math.floor(random() * 1000) + 100 : undefined,
            usedCount: Math.floor(random() * 500),
            isActive: random() < 0.7,
        };

        promotions.push(promotion);
    }

    return promotions;
}

// Export generated data
export const products: Product[] = generateProducts();
export const promotions: Promotion[] = generatePromotions();

// Helper functions
export function getProductsByCategory(categoryId: string): Product[] {
    return products.filter(p => p.category_id === categoryId);
}

export function getProductById(id: string): Product | undefined {
    return products.find(p => p.id === id);
}

export function searchProducts(query: string): Product[] {
    const lowerQuery = query.toLowerCase();
    return products.filter(p =>
        p.name.toLowerCase().includes(lowerQuery) ||
        p.brand.toLowerCase().includes(lowerQuery) ||
        p.description.toLowerCase().includes(lowerQuery)
    );
}

export function getActivePromotions(): Promotion[] {
    return promotions.filter(p => p.isActive);
}

export function getPromotionByCode(code: string): Promotion | undefined {
    return promotions.find(p => p.code?.toLowerCase() === code.toLowerCase() && p.isActive);
}

export function getCategoryById(id: string): Category | undefined {
    return categories.find(c => c.id === id);
}

export function getCategoryBySlug(slug: string): Category | undefined {
    return categories.find(c => c.slug === slug);
}

export function getSubcategories(parentId: string): Category[] {
    return categories.filter(c => c.parentId === parentId);
}

export function getRootCategories(): Category[] {
    return categories.filter(c => !c.parentId);
}

// Statistics
export const stats = {
    totalProducts: products.length,
    totalCategories: categories.length,
    totalPromotions: promotions.length,
    activePromotions: promotions.filter(p => p.isActive).length,
    productsWithDiscount: products.filter(p => p.oldPrice).length,
    newProducts: products.filter(p => p.isNew).length,
    bestsellers: products.filter(p => p.isBestseller).length,
};

console.log(`Generated ${stats.totalProducts} products, ${stats.totalCategories} categories, ${stats.totalPromotions} promotions`);
