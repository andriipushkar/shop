import { NextRequest, NextResponse } from 'next/server';

/**
 * API Route: Get comparable attributes for a category
 * GET /api/compare/attributes?categoryId=xxx
 */

interface AttributeDefinition {
  key: string;
  label: string;
  type: 'text' | 'number' | 'boolean' | 'rating' | 'select';
  unit?: string;
  options?: string[];
  description?: string;
}

interface CategoryAttributes {
  categoryId: string;
  categoryName: string;
  attributes: AttributeDefinition[];
}

/**
 * Predefined attribute schemas for different categories
 * In a real application, this would come from a database
 */
const categoryAttributeSchemas: Record<string, CategoryAttributes> = {
  // Smartphones
  'cat-1-1': {
    categoryId: 'cat-1-1',
    categoryName: 'Смартфони',
    attributes: [
      { key: 'screen_size', label: 'Діагональ екрану', type: 'number', unit: 'дюймів' },
      { key: 'screen_resolution', label: 'Роздільна здатність', type: 'text' },
      { key: 'processor', label: 'Процесор', type: 'text' },
      { key: 'ram', label: "Оперативна пам'ять", type: 'number', unit: 'ГБ' },
      { key: 'storage', label: "Вбудована пам'ять", type: 'number', unit: 'ГБ' },
      { key: 'battery', label: 'Ємність батареї', type: 'number', unit: 'мАг' },
      { key: 'camera_main', label: 'Основна камера', type: 'number', unit: 'МП' },
      { key: 'camera_front', label: 'Фронтальна камера', type: 'number', unit: 'МП' },
      { key: 'os', label: 'Операційна система', type: 'text' },
      { key: '5g_support', label: 'Підтримка 5G', type: 'boolean' },
      { key: 'nfc', label: 'NFC', type: 'boolean' },
      { key: 'wireless_charging', label: 'Бездротова зарядка', type: 'boolean' },
      { key: 'waterproof', label: 'Захист від вологи', type: 'text' },
      { key: 'weight', label: 'Вага', type: 'number', unit: 'г' },
      { key: 'color', label: 'Колір', type: 'text' },
    ],
  },

  // Laptops
  'cat-1-3': {
    categoryId: 'cat-1-3',
    categoryName: 'Ноутбуки',
    attributes: [
      { key: 'screen_size', label: 'Діагональ екрану', type: 'number', unit: 'дюймів' },
      { key: 'screen_resolution', label: 'Роздільна здатність', type: 'text' },
      { key: 'processor', label: 'Процесор', type: 'text' },
      { key: 'ram', label: "Оперативна пам'ять", type: 'number', unit: 'ГБ' },
      { key: 'storage_type', label: 'Тип накопичувача', type: 'select', options: ['SSD', 'HDD', 'SSD + HDD'] },
      { key: 'storage', label: "Об'єм накопичувача", type: 'number', unit: 'ГБ' },
      { key: 'graphics_card', label: 'Відеокарта', type: 'text' },
      { key: 'os', label: 'Операційна система', type: 'text' },
      { key: 'battery_life', label: 'Час роботи від батареї', type: 'number', unit: 'годин' },
      { key: 'weight', label: 'Вага', type: 'number', unit: 'кг' },
      { key: 'ports_usb', label: 'Кількість USB портів', type: 'number' },
      { key: 'hdmi', label: 'HDMI', type: 'boolean' },
      { key: 'webcam', label: 'Веб-камера', type: 'boolean' },
      { key: 'backlit_keyboard', label: 'Підсвітка клавіатури', type: 'boolean' },
      { key: 'touchscreen', label: 'Сенсорний екран', type: 'boolean' },
    ],
  },

  // TVs
  'cat-1-5': {
    categoryId: 'cat-1-5',
    categoryName: 'Телевізори',
    attributes: [
      { key: 'screen_size', label: 'Діагональ екрану', type: 'number', unit: 'дюймів' },
      { key: 'resolution', label: 'Роздільна здатність', type: 'select', options: ['HD', 'Full HD', '4K UHD', '8K'] },
      { key: 'screen_type', label: 'Тип матриці', type: 'select', options: ['LED', 'OLED', 'QLED', 'NanoCell'] },
      { key: 'smart_tv', label: 'Smart TV', type: 'boolean' },
      { key: 'os', label: 'Операційна система', type: 'text' },
      { key: 'refresh_rate', label: 'Частота оновлення', type: 'number', unit: 'Гц' },
      { key: 'hdr', label: 'Підтримка HDR', type: 'boolean' },
      { key: 'hdmi_ports', label: 'Кількість HDMI', type: 'number' },
      { key: 'usb_ports', label: 'Кількість USB', type: 'number' },
      { key: 'wifi', label: 'Wi-Fi', type: 'boolean' },
      { key: 'bluetooth', label: 'Bluetooth', type: 'boolean' },
      { key: 'voice_control', label: 'Голосове керування', type: 'boolean' },
      { key: 'sound_power', label: 'Потужність звуку', type: 'number', unit: 'Вт' },
    ],
  },

  // Refrigerators
  'cat-2-1': {
    categoryId: 'cat-2-1',
    categoryName: 'Холодильники',
    attributes: [
      { key: 'type', label: 'Тип', type: 'select', options: ['Однокамерний', 'Двокамерний', 'Side-by-Side', 'French Door'] },
      { key: 'total_volume', label: 'Загальний об\'єм', type: 'number', unit: 'л' },
      { key: 'fridge_volume', label: 'Об\'єм холодильної камери', type: 'number', unit: 'л' },
      { key: 'freezer_volume', label: 'Об\'єм морозильної камери', type: 'number', unit: 'л' },
      { key: 'energy_class', label: 'Клас енергоспоживання', type: 'select', options: ['A+++', 'A++', 'A+', 'A', 'B', 'C'] },
      { key: 'no_frost', label: 'No Frost', type: 'boolean' },
      { key: 'compressor_type', label: 'Тип компресора', type: 'select', options: ['Звичайний', 'Інверторний', 'Лінійний інверторний'] },
      { key: 'height', label: 'Висота', type: 'number', unit: 'см' },
      { key: 'width', label: 'Ширина', type: 'number', unit: 'см' },
      { key: 'depth', label: 'Глибина', type: 'number', unit: 'см' },
      { key: 'noise_level', label: 'Рівень шуму', type: 'number', unit: 'дБ' },
      { key: 'color', label: 'Колір', type: 'text' },
    ],
  },

  // Washing Machines
  'cat-2-2': {
    categoryId: 'cat-2-2',
    categoryName: 'Пральні машини',
    attributes: [
      { key: 'type', label: 'Тип', type: 'select', options: ['Фронтальна', 'Вертикальна'] },
      { key: 'load_capacity', label: 'Максимальне завантаження', type: 'number', unit: 'кг' },
      { key: 'max_spin_speed', label: 'Максимальні оберти віджиму', type: 'number', unit: 'об/хв' },
      { key: 'energy_class', label: 'Клас енергоспоживання', type: 'select', options: ['A+++', 'A++', 'A+', 'A', 'B', 'C'] },
      { key: 'inverter_motor', label: 'Інверторний двигун', type: 'boolean' },
      { key: 'programs_count', label: 'Кількість програм', type: 'number' },
      { key: 'steam', label: 'Обробка парою', type: 'boolean' },
      { key: 'drying', label: 'Функція сушіння', type: 'boolean' },
      { key: 'wifi', label: 'Wi-Fi', type: 'boolean' },
      { key: 'child_lock', label: 'Захист від дітей', type: 'boolean' },
      { key: 'noise_wash', label: 'Рівень шуму при пранні', type: 'number', unit: 'дБ' },
      { key: 'noise_spin', label: 'Рівень шуму при віджимі', type: 'number', unit: 'дБ' },
      { key: 'color', label: 'Колір', type: 'text' },
    ],
  },
};

/**
 * Get default attributes for any category
 */
const defaultAttributes: AttributeDefinition[] = [
  { key: 'brand', label: 'Бренд', type: 'text' },
  { key: 'model', label: 'Модель', type: 'text' },
  { key: 'price', label: 'Ціна', type: 'number', unit: '₴' },
  { key: 'warranty', label: 'Гарантія', type: 'number', unit: 'місяців' },
  { key: 'country', label: 'Країна виробник', type: 'text' },
  { key: 'color', label: 'Колір', type: 'text' },
];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('categoryId');

    if (!categoryId) {
      return NextResponse.json(
        { error: 'categoryId is required' },
        { status: 400 }
      );
    }

    // Get category-specific attributes or default
    const categoryAttrs = categoryAttributeSchemas[categoryId];

    if (categoryAttrs) {
      return NextResponse.json({
        success: true,
        data: categoryAttrs,
      });
    }

    // Return default attributes if category not found
    return NextResponse.json({
      success: true,
      data: {
        categoryId,
        categoryName: 'Загальна категорія',
        attributes: defaultAttributes,
      },
    });
  } catch (error) {
    console.error('Error fetching comparable attributes:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/compare/attributes
 * Update attribute definitions for a category (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    // In a real app, you would:
    // 1. Check authentication/authorization
    // 2. Validate the request body
    // 3. Save to database
    // 4. Return updated schema

    const body = await request.json();

    return NextResponse.json({
      success: true,
      message: 'Attributes updated successfully',
      data: body,
    });
  } catch (error) {
    console.error('Error updating attributes:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
