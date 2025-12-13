/**
 * B2B Price List Generator
 * Генерація прайс-листів для партнерів
 */

import type { PriceListConfig, PriceListProduct, ShopInfo } from './types';

export class PriceListGenerator {
  /**
   * Generate Excel price list (XLSX format)
   * Згенерувати прайс-лист в форматі Excel
   */
  async generateXLSX(products: PriceListProduct[]): Promise<Buffer> {
    // In a real implementation, use a library like 'exceljs' or 'xlsx'
    // For now, generate a simple CSV that can be opened in Excel
    const csv = this.generateCSV(products);
    return Buffer.from(csv, 'utf-8');
  }

  /**
   * Generate CSV price list
   * Згенерувати прайс-лист в форматі CSV
   */
  generateCSV(products: PriceListProduct[]): string {
    const headers = [
      'SKU',
      'Назва',
      'Name',
      'Категорія',
      'Category',
      'Бренд',
      'Ціна',
      'Стара ціна',
      'Наявність',
      'Штрихкод',
      'Вага (кг)',
      'Довжина (см)',
      'Ширина (см)',
      'Висота (см)',
      'Посилання на зображення'
    ];

    const rows = products.map(p => [
      p.sku,
      p.nameUk || p.name,
      p.name,
      p.categoryUk || p.category,
      p.category,
      p.brand,
      p.price.toFixed(2),
      p.oldPrice?.toFixed(2) || '',
      p.stock,
      p.barcode || '',
      p.weight?.toFixed(3) || '',
      p.dimensions?.length || '',
      p.dimensions?.width || '',
      p.dimensions?.height || '',
      p.imageUrl || ''
    ]);

    const csvRows = [headers, ...rows];
    return csvRows.map(row =>
      row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ).join('\n');
  }

  /**
   * Generate XML price list (universal format)
   * Згенерувати прайс-лист в форматі XML
   */
  generateXML(products: PriceListProduct[]): string {
    const items = products.map(p => `
  <item>
    <sku>${this.escapeXml(p.sku)}</sku>
    <name>${this.escapeXml(p.name)}</name>
    <nameUk>${this.escapeXml(p.nameUk || p.name)}</nameUk>
    <description>${this.escapeXml(p.description || '')}</description>
    <descriptionUk>${this.escapeXml(p.descriptionUk || p.description || '')}</descriptionUk>
    <category>${this.escapeXml(p.category)}</category>
    <categoryUk>${this.escapeXml(p.categoryUk || p.category)}</categoryUk>
    <brand>${this.escapeXml(p.brand)}</brand>
    <price>${p.price.toFixed(2)}</price>
    ${p.oldPrice ? `<oldPrice>${p.oldPrice.toFixed(2)}</oldPrice>` : ''}
    <stock>${p.stock}</stock>
    ${p.imageUrl ? `<imageUrl>${this.escapeXml(p.imageUrl)}</imageUrl>` : ''}
    ${p.barcode ? `<barcode>${this.escapeXml(p.barcode)}</barcode>` : ''}
    ${p.weight ? `<weight>${p.weight.toFixed(3)}</weight>` : ''}
    ${p.dimensions ? `
    <dimensions>
      <length>${p.dimensions.length}</length>
      <width>${p.dimensions.width}</width>
      <height>${p.dimensions.height}</height>
    </dimensions>` : ''}
  </item>`).join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<pricelist>
  <generated>${new Date().toISOString()}</generated>
  <items>${items}
  </items>
</pricelist>`;
  }

  /**
   * Generate YML (Yandex Market Language) for Ukrainian marketplaces
   * Згенерувати YML для українських маркетплейсів
   */
  generateYML(products: PriceListProduct[], shopInfo: ShopInfo): string {
    const offers = products.map(p => {
      const available = p.stock > 0 ? 'true' : 'false';

      return `
    <offer id="${this.escapeXml(p.sku)}" available="${available}">
      <url>${this.escapeXml(shopInfo.url)}/product/${this.escapeXml(p.sku)}</url>
      <price>${p.price.toFixed(2)}</price>
      ${p.oldPrice ? `<oldprice>${p.oldPrice.toFixed(2)}</oldprice>` : ''}
      <currencyId>UAH</currencyId>
      <categoryId>${this.escapeXml(p.category)}</categoryId>
      ${p.imageUrl ? `<picture>${this.escapeXml(p.imageUrl)}</picture>` : ''}
      <name>${this.escapeXml(p.nameUk || p.name)}</name>
      <vendor>${this.escapeXml(p.brand)}</vendor>
      ${p.description ? `<description>${this.escapeXml(p.descriptionUk || p.description)}</description>` : ''}
      ${p.barcode ? `<barcode>${this.escapeXml(p.barcode)}</barcode>` : ''}
      ${p.weight ? `<weight>${p.weight.toFixed(3)}</weight>` : ''}
      ${p.dimensions ? `
      <dimensions>${p.dimensions.length}/${p.dimensions.width}/${p.dimensions.height}</dimensions>` : ''}
    </offer>`;
    }).join('');

    const categories = [...new Set(products.map(p => p.category))].map((cat, idx) =>
      `    <category id="${this.escapeXml(cat)}">${this.escapeXml(cat)}</category>`
    ).join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE yml_catalog SYSTEM "shops.dtd">
<yml_catalog date="${new Date().toISOString()}">
  <shop>
    <name>${this.escapeXml(shopInfo.name)}</name>
    <company>${this.escapeXml(shopInfo.company)}</company>
    <url>${this.escapeXml(shopInfo.url)}</url>
    <currencies>
      <currency id="UAH" rate="1"/>
    </currencies>
    <categories>
${categories}
    </categories>
    <offers>${offers}
    </offers>
  </shop>
</yml_catalog>`;
  }

  /**
   * Generate Rozetka XML feed
   * Згенерувати XML фід для Rozetka
   */
  generateRozetkaFeed(products: PriceListProduct[]): string {
    const items = products.map(p => {
      const available = p.stock > 0 ? 'true' : 'false';

      return `
  <item>
    <g:id>${this.escapeXml(p.sku)}</g:id>
    <g:title>${this.escapeXml(p.nameUk || p.name)}</g:title>
    <g:description>${this.escapeXml(p.descriptionUk || p.description || '')}</g:description>
    <g:link>https://yourshop.com/product/${this.escapeXml(p.sku)}</g:link>
    ${p.imageUrl ? `<g:image_link>${this.escapeXml(p.imageUrl)}</g:image_link>` : ''}
    <g:condition>new</g:condition>
    <g:availability>${available ? 'in stock' : 'out of stock'}</g:availability>
    <g:price>${p.price.toFixed(2)} UAH</g:price>
    <g:brand>${this.escapeXml(p.brand)}</g:brand>
    ${p.barcode ? `<g:gtin>${this.escapeXml(p.barcode)}</g:gtin>` : ''}
    <g:product_type>${this.escapeXml(p.categoryUk || p.category)}</g:product_type>
    <g:google_product_category>${this.escapeXml(p.category)}</g:google_product_category>
  </item>`;
    }).join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>Product Feed</title>
    <link>https://yourshop.com</link>
    <description>Product feed for Rozetka</description>${items}
  </channel>
</rss>`;
  }

  /**
   * Generate Prom.ua XML feed
   * Згенерувати XML фід для Prom.ua
   */
  generatePromFeed(products: PriceListProduct[]): string {
    const items = products.map(p => {
      const available = p.stock > 0 ? 'в наявності' : 'немає в наявності';

      return `
  <item>
    <id>${this.escapeXml(p.sku)}</id>
    <name>${this.escapeXml(p.nameUk || p.name)}</name>
    <keywords>${this.escapeXml(p.nameUk || p.name)}</keywords>
    <description>${this.escapeXml(p.descriptionUk || p.description || '')}</description>
    <price>${p.price.toFixed(2)}</price>
    <currency>UAH</currency>
    ${p.oldPrice ? `<price_old>${p.oldPrice.toFixed(2)}</price_old>` : ''}
    ${p.imageUrl ? `<picture>${this.escapeXml(p.imageUrl)}</picture>` : ''}
    <url>https://yourshop.com/product/${this.escapeXml(p.sku)}</url>
    <stock_quantity>${p.stock}</stock_quantity>
    <vendor>${this.escapeXml(p.brand)}</vendor>
    <categoryId>${this.escapeXml(p.category)}</categoryId>
    <available>${available}</available>
    ${p.barcode ? `<barcode>${this.escapeXml(p.barcode)}</barcode>` : ''}
  </item>`;
    }).join('');

    const categories = [...new Set(products.map(p => p.category))].map(cat =>
      `  <category id="${this.escapeXml(cat)}"><![CDATA[${cat}]]></category>`
    ).join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<price>
  <date>${new Date().toISOString()}</date>
  <categories>
${categories}
  </categories>
  <items>${items}
  </items>
</price>`;
  }

  /**
   * Escape XML special characters
   * Екранувати спеціальні символи XML
   */
  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Generate price list by config
   * Згенерувати прайс-лист за конфігурацією
   */
  async generate(products: PriceListProduct[], config: PriceListConfig): Promise<Buffer | string> {
    // Filter products
    let filteredProducts = products;

    if (config.categories && config.categories.length > 0) {
      filteredProducts = filteredProducts.filter(p =>
        config.categories!.includes(p.category)
      );
    }

    if (config.minStock !== undefined) {
      filteredProducts = filteredProducts.filter(p => p.stock >= config.minStock!);
    }

    if (!config.includeImages) {
      filteredProducts = filteredProducts.map(p => ({
        ...p,
        imageUrl: undefined
      }));
    }

    if (!config.includeStock) {
      filteredProducts = filteredProducts.map(p => ({
        ...p,
        stock: 0
      }));
    }

    // Generate based on format
    switch (config.format) {
      case 'xlsx':
        return await this.generateXLSX(filteredProducts);
      case 'csv':
        return this.generateCSV(filteredProducts);
      case 'xml':
        return this.generateXML(filteredProducts);
      case 'yml':
        return this.generateYML(filteredProducts, {
          name: 'Your Shop',
          company: 'Your Company',
          url: 'https://yourshop.com',
          currencies: ['UAH']
        });
      default:
        throw new Error(`Unsupported format: ${config.format}`);
    }
  }
}

// Singleton instance
export const priceListGenerator = new PriceListGenerator();
