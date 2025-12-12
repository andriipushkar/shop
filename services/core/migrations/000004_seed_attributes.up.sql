-- Seed Data for Attributes System
-- Migration: 000004_seed_attributes

-- ===================
-- 1. ATTRIBUTE GROUPS
-- ===================

INSERT INTO attribute_groups (id, code, name, sort_order, is_active, created_at) VALUES
-- Загальні групи
('a0000001-0000-0000-0000-000000000001', 'general', '{"uk": "Загальні характеристики", "en": "General"}', 1, true, NOW()),
('a0000001-0000-0000-0000-000000000002', 'technical', '{"uk": "Технічні характеристики", "en": "Technical Specifications"}', 2, true, NOW()),
('a0000001-0000-0000-0000-000000000003', 'physical', '{"uk": "Фізичні характеристики", "en": "Physical Characteristics"}', 3, true, NOW()),
('a0000001-0000-0000-0000-000000000004', 'warranty', '{"uk": "Гарантія та сервіс", "en": "Warranty & Service"}', 4, true, NOW()),
('a0000001-0000-0000-0000-000000000005', 'fashion', '{"uk": "Розміри та стиль", "en": "Size & Style"}', 5, true, NOW()),
('a0000001-0000-0000-0000-000000000006', 'materials', '{"uk": "Матеріали", "en": "Materials"}', 6, true, NOW())
ON CONFLICT (code) DO NOTHING;

-- ===================
-- 2. UNIVERSAL ATTRIBUTES
-- ===================

INSERT INTO attributes (id, code, name, type, unit, is_filterable, is_searchable, is_comparable, is_visible_on_product, sort_order, is_active, created_at, updated_at) VALUES
-- Загальні для всіх
('b0000001-0000-0000-0000-000000000001', 'brand', '{"uk": "Бренд", "en": "Brand"}', 'select', NULL, true, true, true, true, 1, true, NOW(), NOW()),
('b0000001-0000-0000-0000-000000000002', 'country', '{"uk": "Країна виробник", "en": "Country of Origin"}', 'select', NULL, true, true, false, true, 2, true, NOW(), NOW()),
('b0000001-0000-0000-0000-000000000003', 'warranty_months', '{"uk": "Гарантія", "en": "Warranty"}', 'number', 'міс', true, false, true, true, 3, true, NOW(), NOW()),
('b0000001-0000-0000-0000-000000000004', 'color', '{"uk": "Колір", "en": "Color"}', 'color', NULL, true, true, true, true, 4, true, NOW(), NOW()),

-- Електроніка - Смартфони
('b0000002-0000-0000-0000-000000000001', 'screen_diag', '{"uk": "Діагональ екрану", "en": "Screen Diagonal"}', 'number', 'дюйм', true, false, true, true, 10, true, NOW(), NOW()),
('b0000002-0000-0000-0000-000000000002', 'ram', '{"uk": "Оперативна пам''ять", "en": "RAM"}', 'select', 'ГБ', true, true, true, true, 11, true, NOW(), NOW()),
('b0000002-0000-0000-0000-000000000003', 'storage', '{"uk": "Вбудована пам''ять", "en": "Internal Storage"}', 'select', 'ГБ', true, true, true, true, 12, true, NOW(), NOW()),
('b0000002-0000-0000-0000-000000000004', 'battery', '{"uk": "Ємність акумулятора", "en": "Battery Capacity"}', 'number', 'мАг', true, false, true, true, 13, true, NOW(), NOW()),
('b0000002-0000-0000-0000-000000000005', 'nfc', '{"uk": "Наявність NFC", "en": "NFC Support"}', 'bool', NULL, true, false, true, true, 14, true, NOW(), NOW()),
('b0000002-0000-0000-0000-000000000006', 'sim_count', '{"uk": "Кількість SIM-карт", "en": "Number of SIM Cards"}', 'select', NULL, true, false, true, true, 15, true, NOW(), NOW()),
('b0000002-0000-0000-0000-000000000007', 'screen_res', '{"uk": "Роздільна здатність екрану", "en": "Screen Resolution"}', 'select', NULL, true, false, true, true, 16, true, NOW(), NOW()),

-- Електроніка - Ноутбуки
('b0000003-0000-0000-0000-000000000001', 'cpu_series', '{"uk": "Серія процесора", "en": "CPU Series"}', 'select', NULL, true, true, true, true, 20, true, NOW(), NOW()),
('b0000003-0000-0000-0000-000000000002', 'gpu_type', '{"uk": "Тип відеокарти", "en": "GPU Type"}', 'select', NULL, true, true, true, true, 21, true, NOW(), NOW()),
('b0000003-0000-0000-0000-000000000003', 'ssd_capacity', '{"uk": "Об''єм SSD", "en": "SSD Capacity"}', 'select', 'ГБ', true, true, true, true, 22, true, NOW(), NOW()),
('b0000003-0000-0000-0000-000000000004', 'os', '{"uk": "Операційна система", "en": "Operating System"}', 'select', NULL, true, true, true, true, 23, true, NOW(), NOW()),

-- Електроніка - Телевізори
('b0000004-0000-0000-0000-000000000001', 'tv_diag', '{"uk": "Діагональ", "en": "Screen Size"}', 'number', 'дюйм', true, true, true, true, 30, true, NOW(), NOW()),
('b0000004-0000-0000-0000-000000000002', 'smart_tv', '{"uk": "Smart TV", "en": "Smart TV Platform"}', 'select', NULL, true, true, true, true, 31, true, NOW(), NOW()),
('b0000004-0000-0000-0000-000000000003', 'matrix_type', '{"uk": "Тип матриці", "en": "Panel Type"}', 'select', NULL, true, true, true, true, 32, true, NOW(), NOW()),
('b0000004-0000-0000-0000-000000000004', 'vesa', '{"uk": "Кріплення VESA", "en": "VESA Mount"}', 'text', NULL, false, false, true, true, 33, true, NOW(), NOW()),

-- Одяг та Взуття
('b0000005-0000-0000-0000-000000000001', 'clothing_size', '{"uk": "Розмір одягу", "en": "Clothing Size"}', 'select', NULL, true, true, true, true, 40, true, NOW(), NOW()),
('b0000005-0000-0000-0000-000000000002', 'shoe_size', '{"uk": "Розмір взуття", "en": "Shoe Size"}', 'select', NULL, true, true, true, true, 41, true, NOW(), NOW()),
('b0000005-0000-0000-0000-000000000003', 'gender', '{"uk": "Стать", "en": "Gender"}', 'select', NULL, true, true, false, true, 42, true, NOW(), NOW()),
('b0000005-0000-0000-0000-000000000004', 'season', '{"uk": "Сезон", "en": "Season"}', 'select', NULL, true, true, true, true, 43, true, NOW(), NOW()),
('b0000005-0000-0000-0000-000000000005', 'upper_material', '{"uk": "Матеріал верху", "en": "Upper Material"}', 'select', NULL, true, true, true, true, 44, true, NOW(), NOW()),
('b0000005-0000-0000-0000-000000000006', 'lining_material', '{"uk": "Матеріал підкладки", "en": "Lining Material"}', 'select', NULL, true, false, true, true, 45, true, NOW(), NOW()),
('b0000005-0000-0000-0000-000000000007', 'style', '{"uk": "Стиль", "en": "Style"}', 'select', NULL, true, true, false, true, 46, true, NOW(), NOW()),
('b0000005-0000-0000-0000-000000000008', 'material_comp', '{"uk": "Склад тканини", "en": "Fabric Composition"}', 'text', NULL, false, true, true, true, 47, true, NOW(), NOW()),
('b0000005-0000-0000-0000-000000000009', 'hood', '{"uk": "Наявність капюшона", "en": "Hood"}', 'bool', NULL, true, false, true, true, 48, true, NOW(), NOW()),
('b0000005-0000-0000-0000-000000000010', 'fastener', '{"uk": "Застібка", "en": "Fastener"}', 'select', NULL, true, false, true, true, 49, true, NOW(), NOW()),
('b0000005-0000-0000-0000-000000000011', 'waist_height', '{"uk": "Посадка", "en": "Waist Height"}', 'select', NULL, true, true, true, true, 50, true, NOW(), NOW()),
('b0000005-0000-0000-0000-000000000012', 'cut_type', '{"uk": "Крій", "en": "Cut Type"}', 'select', NULL, true, true, true, true, 51, true, NOW(), NOW()),

-- Товари для дому - Меблі
('b0000006-0000-0000-0000-000000000001', 'dimensions', '{"uk": "Габарити (ШхВхГ)", "en": "Dimensions (WxHxD)"}', 'text', 'см', false, false, true, true, 60, true, NOW(), NOW()),
('b0000006-0000-0000-0000-000000000002', 'upholstery', '{"uk": "Оббивка", "en": "Upholstery"}', 'select', NULL, true, true, true, true, 61, true, NOW(), NOW()),
('b0000006-0000-0000-0000-000000000003', 'mechanism', '{"uk": "Механізм розкладання", "en": "Folding Mechanism"}', 'select', NULL, true, true, true, true, 62, true, NOW(), NOW()),
('b0000006-0000-0000-0000-000000000004', 'sleeping_place', '{"uk": "Розмір спального місця", "en": "Sleeping Area Size"}', 'text', 'см', false, false, true, true, 63, true, NOW(), NOW()),

-- Освітлення
('b0000007-0000-0000-0000-000000000001', 'base_type', '{"uk": "Тип цоколя", "en": "Socket Type"}', 'select', NULL, true, true, true, true, 70, true, NOW(), NOW()),
('b0000007-0000-0000-0000-000000000002', 'power', '{"uk": "Потужність", "en": "Power"}', 'number', 'Вт', true, false, true, true, 71, true, NOW(), NOW()),
('b0000007-0000-0000-0000-000000000003', 'light_temp', '{"uk": "Температура світла", "en": "Light Temperature"}', 'select', NULL, true, true, true, true, 72, true, NOW(), NOW()),

-- Текстиль
('b0000008-0000-0000-0000-000000000001', 'bed_size', '{"uk": "Розмір білизни", "en": "Bedding Size"}', 'select', NULL, true, true, true, true, 80, true, NOW(), NOW()),
('b0000008-0000-0000-0000-000000000002', 'fabric_type', '{"uk": "Тканина", "en": "Fabric Type"}', 'select', NULL, true, true, true, true, 81, true, NOW(), NOW()),
('b0000008-0000-0000-0000-000000000003', 'density', '{"uk": "Щільність", "en": "Density"}', 'number', 'г/м²', true, false, true, true, 82, true, NOW(), NOW()),

-- Парфумерія
('b0000009-0000-0000-0000-000000000001', 'volume', '{"uk": "Об''єм", "en": "Volume"}', 'number', 'мл', true, true, true, true, 90, true, NOW(), NOW()),
('b0000009-0000-0000-0000-000000000002', 'perfume_type', '{"uk": "Тип парфуму", "en": "Perfume Type"}', 'select', NULL, true, true, true, true, 91, true, NOW(), NOW()),
('b0000009-0000-0000-0000-000000000003', 'scent_group', '{"uk": "Група аромату", "en": "Scent Group"}', 'select', NULL, true, true, true, true, 92, true, NOW(), NOW()),
('b0000009-0000-0000-0000-000000000004', 'top_notes', '{"uk": "Початкова нота", "en": "Top Notes"}', 'text', NULL, false, true, true, true, 93, true, NOW(), NOW()),

-- Побутова хімія
('b0000010-0000-0000-0000-000000000001', 'chem_form', '{"uk": "Форма випуску", "en": "Form"}', 'select', NULL, true, true, true, true, 100, true, NOW(), NOW()),
('b0000010-0000-0000-0000-000000000002', 'weight_vol', '{"uk": "Вага/Об''єм", "en": "Weight/Volume"}', 'text', NULL, true, true, true, true, 101, true, NOW(), NOW()),
('b0000010-0000-0000-0000-000000000003', 'purpose', '{"uk": "Призначення", "en": "Purpose"}', 'select', NULL, true, true, true, true, 102, true, NOW(), NOW()),
('b0000010-0000-0000-0000-000000000004', 'organic', '{"uk": "Безфосфатний", "en": "Phosphate-free"}', 'bool', NULL, true, false, true, true, 103, true, NOW(), NOW()),

-- Електроінструмент
('b0000011-0000-0000-0000-000000000001', 'power_source', '{"uk": "Живлення", "en": "Power Source"}', 'select', NULL, true, true, true, true, 110, true, NOW(), NOW()),
('b0000011-0000-0000-0000-000000000002', 'tool_power', '{"uk": "Потужність", "en": "Power"}', 'number', 'Вт', true, false, true, true, 111, true, NOW(), NOW()),
('b0000011-0000-0000-0000-000000000003', 'max_rpm', '{"uk": "Оберти", "en": "Max RPM"}', 'number', 'об/хв', true, false, true, true, 112, true, NOW(), NOW()),
('b0000011-0000-0000-0000-000000000004', 'chuck_type', '{"uk": "Тип патрона", "en": "Chuck Type"}', 'select', NULL, true, true, true, true, 113, true, NOW(), NOW()),

-- Шини
('b0000012-0000-0000-0000-000000000001', 'tire_width', '{"uk": "Ширина", "en": "Width"}', 'select', 'мм', true, true, true, true, 120, true, NOW(), NOW()),
('b0000012-0000-0000-0000-000000000002', 'tire_profile', '{"uk": "Профіль", "en": "Profile"}', 'select', NULL, true, true, true, true, 121, true, NOW(), NOW()),
('b0000012-0000-0000-0000-000000000003', 'rim_diam', '{"uk": "Діаметр", "en": "Rim Diameter"}', 'select', NULL, true, true, true, true, 122, true, NOW(), NOW()),
('b0000012-0000-0000-0000-000000000004', 'tire_season', '{"uk": "Сезонність", "en": "Season"}', 'select', NULL, true, true, true, true, 123, true, NOW(), NOW())
ON CONFLICT (code) DO NOTHING;

-- ===================
-- 3. ATTRIBUTE OPTIONS
-- ===================

-- Кольори
INSERT INTO attribute_options (id, attribute_id, value, label, color_hex, sort_order, is_active, created_at) VALUES
('c0000001-0000-0000-0000-000000000001', 'b0000001-0000-0000-0000-000000000004', 'black', '{"uk": "Чорний", "en": "Black"}', '#000000', 1, true, NOW()),
('c0000001-0000-0000-0000-000000000002', 'b0000001-0000-0000-0000-000000000004', 'white', '{"uk": "Білий", "en": "White"}', '#FFFFFF', 2, true, NOW()),
('c0000001-0000-0000-0000-000000000003', 'b0000001-0000-0000-0000-000000000004', 'gray', '{"uk": "Сірий", "en": "Gray"}', '#808080', 3, true, NOW()),
('c0000001-0000-0000-0000-000000000004', 'b0000001-0000-0000-0000-000000000004', 'red', '{"uk": "Червоний", "en": "Red"}', '#FF0000', 4, true, NOW()),
('c0000001-0000-0000-0000-000000000005', 'b0000001-0000-0000-0000-000000000004', 'blue', '{"uk": "Синій", "en": "Blue"}', '#0000FF', 5, true, NOW()),
('c0000001-0000-0000-0000-000000000006', 'b0000001-0000-0000-0000-000000000004', 'green', '{"uk": "Зелений", "en": "Green"}', '#008000', 6, true, NOW()),
('c0000001-0000-0000-0000-000000000007', 'b0000001-0000-0000-0000-000000000004', 'yellow', '{"uk": "Жовтий", "en": "Yellow"}', '#FFFF00', 7, true, NOW()),
('c0000001-0000-0000-0000-000000000008', 'b0000001-0000-0000-0000-000000000004', 'pink', '{"uk": "Рожевий", "en": "Pink"}', '#FFC0CB', 8, true, NOW()),
('c0000001-0000-0000-0000-000000000009', 'b0000001-0000-0000-0000-000000000004', 'purple', '{"uk": "Фіолетовий", "en": "Purple"}', '#800080', 9, true, NOW()),
('c0000001-0000-0000-0000-000000000010', 'b0000001-0000-0000-0000-000000000004', 'beige', '{"uk": "Бежевий", "en": "Beige"}', '#F5F5DC', 10, true, NOW())
ON CONFLICT DO NOTHING;

-- RAM
INSERT INTO attribute_options (id, attribute_id, value, label, sort_order, is_active, created_at) VALUES
('c0000002-0000-0000-0000-000000000001', 'b0000002-0000-0000-0000-000000000002', '4', '{"uk": "4 ГБ", "en": "4 GB"}', 1, true, NOW()),
('c0000002-0000-0000-0000-000000000002', 'b0000002-0000-0000-0000-000000000002', '6', '{"uk": "6 ГБ", "en": "6 GB"}', 2, true, NOW()),
('c0000002-0000-0000-0000-000000000003', 'b0000002-0000-0000-0000-000000000002', '8', '{"uk": "8 ГБ", "en": "8 GB"}', 3, true, NOW()),
('c0000002-0000-0000-0000-000000000004', 'b0000002-0000-0000-0000-000000000002', '12', '{"uk": "12 ГБ", "en": "12 GB"}', 4, true, NOW()),
('c0000002-0000-0000-0000-000000000005', 'b0000002-0000-0000-0000-000000000002', '16', '{"uk": "16 ГБ", "en": "16 GB"}', 5, true, NOW()),
('c0000002-0000-0000-0000-000000000006', 'b0000002-0000-0000-0000-000000000002', '32', '{"uk": "32 ГБ", "en": "32 GB"}', 6, true, NOW())
ON CONFLICT DO NOTHING;

-- Storage
INSERT INTO attribute_options (id, attribute_id, value, label, sort_order, is_active, created_at) VALUES
('c0000003-0000-0000-0000-000000000001', 'b0000002-0000-0000-0000-000000000003', '64', '{"uk": "64 ГБ", "en": "64 GB"}', 1, true, NOW()),
('c0000003-0000-0000-0000-000000000002', 'b0000002-0000-0000-0000-000000000003', '128', '{"uk": "128 ГБ", "en": "128 GB"}', 2, true, NOW()),
('c0000003-0000-0000-0000-000000000003', 'b0000002-0000-0000-0000-000000000003', '256', '{"uk": "256 ГБ", "en": "256 GB"}', 3, true, NOW()),
('c0000003-0000-0000-0000-000000000004', 'b0000002-0000-0000-0000-000000000003', '512', '{"uk": "512 ГБ", "en": "512 GB"}', 4, true, NOW()),
('c0000003-0000-0000-0000-000000000005', 'b0000002-0000-0000-0000-000000000003', '1024', '{"uk": "1 ТБ", "en": "1 TB"}', 5, true, NOW())
ON CONFLICT DO NOTHING;

-- SIM Count
INSERT INTO attribute_options (id, attribute_id, value, label, sort_order, is_active, created_at) VALUES
('c0000004-0000-0000-0000-000000000001', 'b0000002-0000-0000-0000-000000000006', '1', '{"uk": "1 SIM", "en": "1 SIM"}', 1, true, NOW()),
('c0000004-0000-0000-0000-000000000002', 'b0000002-0000-0000-0000-000000000006', '2', '{"uk": "2 SIM", "en": "2 SIM"}', 2, true, NOW()),
('c0000004-0000-0000-0000-000000000003', 'b0000002-0000-0000-0000-000000000006', 'esim', '{"uk": "eSIM", "en": "eSIM"}', 3, true, NOW()),
('c0000004-0000-0000-0000-000000000004', 'b0000002-0000-0000-0000-000000000006', 'dual_esim', '{"uk": "2 SIM + eSIM", "en": "Dual SIM + eSIM"}', 4, true, NOW())
ON CONFLICT DO NOTHING;

-- CPU Series
INSERT INTO attribute_options (id, attribute_id, value, label, sort_order, is_active, created_at) VALUES
('c0000005-0000-0000-0000-000000000001', 'b0000003-0000-0000-0000-000000000001', 'i3', '{"uk": "Intel Core i3", "en": "Intel Core i3"}', 1, true, NOW()),
('c0000005-0000-0000-0000-000000000002', 'b0000003-0000-0000-0000-000000000001', 'i5', '{"uk": "Intel Core i5", "en": "Intel Core i5"}', 2, true, NOW()),
('c0000005-0000-0000-0000-000000000003', 'b0000003-0000-0000-0000-000000000001', 'i7', '{"uk": "Intel Core i7", "en": "Intel Core i7"}', 3, true, NOW()),
('c0000005-0000-0000-0000-000000000004', 'b0000003-0000-0000-0000-000000000001', 'i9', '{"uk": "Intel Core i9", "en": "Intel Core i9"}', 4, true, NOW()),
('c0000005-0000-0000-0000-000000000005', 'b0000003-0000-0000-0000-000000000001', 'ryzen5', '{"uk": "AMD Ryzen 5", "en": "AMD Ryzen 5"}', 5, true, NOW()),
('c0000005-0000-0000-0000-000000000006', 'b0000003-0000-0000-0000-000000000001', 'ryzen7', '{"uk": "AMD Ryzen 7", "en": "AMD Ryzen 7"}', 6, true, NOW()),
('c0000005-0000-0000-0000-000000000007', 'b0000003-0000-0000-0000-000000000001', 'm2', '{"uk": "Apple M2", "en": "Apple M2"}', 7, true, NOW()),
('c0000005-0000-0000-0000-000000000008', 'b0000003-0000-0000-0000-000000000001', 'm3', '{"uk": "Apple M3", "en": "Apple M3"}', 8, true, NOW())
ON CONFLICT DO NOTHING;

-- GPU Type
INSERT INTO attribute_options (id, attribute_id, value, label, sort_order, is_active, created_at) VALUES
('c0000006-0000-0000-0000-000000000001', 'b0000003-0000-0000-0000-000000000002', 'integrated', '{"uk": "Інтегрована", "en": "Integrated"}', 1, true, NOW()),
('c0000006-0000-0000-0000-000000000002', 'b0000003-0000-0000-0000-000000000002', 'nvidia', '{"uk": "NVIDIA GeForce", "en": "NVIDIA GeForce"}', 2, true, NOW()),
('c0000006-0000-0000-0000-000000000003', 'b0000003-0000-0000-0000-000000000002', 'amd', '{"uk": "AMD Radeon", "en": "AMD Radeon"}', 3, true, NOW())
ON CONFLICT DO NOTHING;

-- SSD Capacity
INSERT INTO attribute_options (id, attribute_id, value, label, sort_order, is_active, created_at) VALUES
('c0000007-0000-0000-0000-000000000001', 'b0000003-0000-0000-0000-000000000003', '256', '{"uk": "256 ГБ", "en": "256 GB"}', 1, true, NOW()),
('c0000007-0000-0000-0000-000000000002', 'b0000003-0000-0000-0000-000000000003', '512', '{"uk": "512 ГБ", "en": "512 GB"}', 2, true, NOW()),
('c0000007-0000-0000-0000-000000000003', 'b0000003-0000-0000-0000-000000000003', '1024', '{"uk": "1 ТБ", "en": "1 TB"}', 3, true, NOW()),
('c0000007-0000-0000-0000-000000000004', 'b0000003-0000-0000-0000-000000000003', '2048', '{"uk": "2 ТБ", "en": "2 TB"}', 4, true, NOW())
ON CONFLICT DO NOTHING;

-- OS
INSERT INTO attribute_options (id, attribute_id, value, label, sort_order, is_active, created_at) VALUES
('c0000008-0000-0000-0000-000000000001', 'b0000003-0000-0000-0000-000000000004', 'windows', '{"uk": "Windows 11", "en": "Windows 11"}', 1, true, NOW()),
('c0000008-0000-0000-0000-000000000002', 'b0000003-0000-0000-0000-000000000004', 'macos', '{"uk": "macOS", "en": "macOS"}', 2, true, NOW()),
('c0000008-0000-0000-0000-000000000003', 'b0000003-0000-0000-0000-000000000004', 'linux', '{"uk": "Linux", "en": "Linux"}', 3, true, NOW()),
('c0000008-0000-0000-0000-000000000004', 'b0000003-0000-0000-0000-000000000004', 'none', '{"uk": "Без ОС", "en": "No OS"}', 4, true, NOW())
ON CONFLICT DO NOTHING;

-- Smart TV
INSERT INTO attribute_options (id, attribute_id, value, label, sort_order, is_active, created_at) VALUES
('c0000009-0000-0000-0000-000000000001', 'b0000004-0000-0000-0000-000000000002', 'webos', '{"uk": "WebOS", "en": "WebOS"}', 1, true, NOW()),
('c0000009-0000-0000-0000-000000000002', 'b0000004-0000-0000-0000-000000000002', 'tizen', '{"uk": "Tizen", "en": "Tizen"}', 2, true, NOW()),
('c0000009-0000-0000-0000-000000000003', 'b0000004-0000-0000-0000-000000000002', 'android', '{"uk": "Android TV", "en": "Android TV"}', 3, true, NOW()),
('c0000009-0000-0000-0000-000000000004', 'b0000004-0000-0000-0000-000000000002', 'google', '{"uk": "Google TV", "en": "Google TV"}', 4, true, NOW()),
('c0000009-0000-0000-0000-000000000005', 'b0000004-0000-0000-0000-000000000002', 'none', '{"uk": "Без Smart TV", "en": "No Smart TV"}', 5, true, NOW())
ON CONFLICT DO NOTHING;

-- Matrix Type
INSERT INTO attribute_options (id, attribute_id, value, label, sort_order, is_active, created_at) VALUES
('c0000010-0000-0000-0000-000000000001', 'b0000004-0000-0000-0000-000000000003', 'led', '{"uk": "LED", "en": "LED"}', 1, true, NOW()),
('c0000010-0000-0000-0000-000000000002', 'b0000004-0000-0000-0000-000000000003', 'oled', '{"uk": "OLED", "en": "OLED"}', 2, true, NOW()),
('c0000010-0000-0000-0000-000000000003', 'b0000004-0000-0000-0000-000000000003', 'qled', '{"uk": "QLED", "en": "QLED"}', 3, true, NOW()),
('c0000010-0000-0000-0000-000000000004', 'b0000004-0000-0000-0000-000000000003', 'nanocell', '{"uk": "NanoCell", "en": "NanoCell"}', 4, true, NOW())
ON CONFLICT DO NOTHING;

-- Clothing Sizes
INSERT INTO attribute_options (id, attribute_id, value, label, sort_order, is_active, created_at) VALUES
('c0000011-0000-0000-0000-000000000001', 'b0000005-0000-0000-0000-000000000001', 'xs', '{"uk": "XS", "en": "XS"}', 1, true, NOW()),
('c0000011-0000-0000-0000-000000000002', 'b0000005-0000-0000-0000-000000000001', 's', '{"uk": "S", "en": "S"}', 2, true, NOW()),
('c0000011-0000-0000-0000-000000000003', 'b0000005-0000-0000-0000-000000000001', 'm', '{"uk": "M", "en": "M"}', 3, true, NOW()),
('c0000011-0000-0000-0000-000000000004', 'b0000005-0000-0000-0000-000000000001', 'l', '{"uk": "L", "en": "L"}', 4, true, NOW()),
('c0000011-0000-0000-0000-000000000005', 'b0000005-0000-0000-0000-000000000001', 'xl', '{"uk": "XL", "en": "XL"}', 5, true, NOW()),
('c0000011-0000-0000-0000-000000000006', 'b0000005-0000-0000-0000-000000000001', 'xxl', '{"uk": "XXL", "en": "XXL"}', 6, true, NOW()),
('c0000011-0000-0000-0000-000000000007', 'b0000005-0000-0000-0000-000000000001', '3xl', '{"uk": "3XL", "en": "3XL"}', 7, true, NOW())
ON CONFLICT DO NOTHING;

-- Shoe Sizes
INSERT INTO attribute_options (id, attribute_id, value, label, sort_order, is_active, created_at)
SELECT
    'c0000012-0000-0000-0000-' || LPAD(size::text, 12, '0'),
    'b0000005-0000-0000-0000-000000000002',
    size::text,
    format('{"uk": "%s", "en": "%s"}', size, size)::jsonb,
    size - 35,
    true,
    NOW()
FROM generate_series(36, 46) as size
ON CONFLICT DO NOTHING;

-- Gender
INSERT INTO attribute_options (id, attribute_id, value, label, sort_order, is_active, created_at) VALUES
('c0000013-0000-0000-0000-000000000001', 'b0000005-0000-0000-0000-000000000003', 'male', '{"uk": "Чоловіча", "en": "Male"}', 1, true, NOW()),
('c0000013-0000-0000-0000-000000000002', 'b0000005-0000-0000-0000-000000000003', 'female', '{"uk": "Жіноча", "en": "Female"}', 2, true, NOW()),
('c0000013-0000-0000-0000-000000000003', 'b0000005-0000-0000-0000-000000000003', 'unisex', '{"uk": "Унісекс", "en": "Unisex"}', 3, true, NOW())
ON CONFLICT DO NOTHING;

-- Season
INSERT INTO attribute_options (id, attribute_id, value, label, sort_order, is_active, created_at) VALUES
('c0000014-0000-0000-0000-000000000001', 'b0000005-0000-0000-0000-000000000004', 'winter', '{"uk": "Зима", "en": "Winter"}', 1, true, NOW()),
('c0000014-0000-0000-0000-000000000002', 'b0000005-0000-0000-0000-000000000004', 'summer', '{"uk": "Літо", "en": "Summer"}', 2, true, NOW()),
('c0000014-0000-0000-0000-000000000003', 'b0000005-0000-0000-0000-000000000004', 'demi', '{"uk": "Демісезон", "en": "Spring/Autumn"}', 3, true, NOW()),
('c0000014-0000-0000-0000-000000000004', 'b0000005-0000-0000-0000-000000000004', 'all', '{"uk": "Всесезонний", "en": "All Season"}', 4, true, NOW())
ON CONFLICT DO NOTHING;

-- Upper Material (Shoes)
INSERT INTO attribute_options (id, attribute_id, value, label, sort_order, is_active, created_at) VALUES
('c0000015-0000-0000-0000-000000000001', 'b0000005-0000-0000-0000-000000000005', 'leather', '{"uk": "Шкіра", "en": "Leather"}', 1, true, NOW()),
('c0000015-0000-0000-0000-000000000002', 'b0000005-0000-0000-0000-000000000005', 'suede', '{"uk": "Замша", "en": "Suede"}', 2, true, NOW()),
('c0000015-0000-0000-0000-000000000003', 'b0000005-0000-0000-0000-000000000005', 'textile', '{"uk": "Текстиль", "en": "Textile"}', 3, true, NOW()),
('c0000015-0000-0000-0000-000000000004', 'b0000005-0000-0000-0000-000000000005', 'synthetic', '{"uk": "Синтетика", "en": "Synthetic"}', 4, true, NOW()),
('c0000015-0000-0000-0000-000000000005', 'b0000005-0000-0000-0000-000000000005', 'eco_leather', '{"uk": "Еко-шкіра", "en": "Eco Leather"}', 5, true, NOW())
ON CONFLICT DO NOTHING;

-- Style
INSERT INTO attribute_options (id, attribute_id, value, label, sort_order, is_active, created_at) VALUES
('c0000016-0000-0000-0000-000000000001', 'b0000005-0000-0000-0000-000000000007', 'sport', '{"uk": "Спортивний", "en": "Sport"}', 1, true, NOW()),
('c0000016-0000-0000-0000-000000000002', 'b0000005-0000-0000-0000-000000000007', 'classic', '{"uk": "Класичний", "en": "Classic"}', 2, true, NOW()),
('c0000016-0000-0000-0000-000000000003', 'b0000005-0000-0000-0000-000000000007', 'casual', '{"uk": "Casual", "en": "Casual"}', 3, true, NOW()),
('c0000016-0000-0000-0000-000000000004', 'b0000005-0000-0000-0000-000000000007', 'business', '{"uk": "Діловий", "en": "Business"}', 4, true, NOW())
ON CONFLICT DO NOTHING;

-- Fastener
INSERT INTO attribute_options (id, attribute_id, value, label, sort_order, is_active, created_at) VALUES
('c0000017-0000-0000-0000-000000000001', 'b0000005-0000-0000-0000-000000000010', 'zipper', '{"uk": "Блискавка", "en": "Zipper"}', 1, true, NOW()),
('c0000017-0000-0000-0000-000000000002', 'b0000005-0000-0000-0000-000000000010', 'buttons', '{"uk": "Гудзики", "en": "Buttons"}', 2, true, NOW()),
('c0000017-0000-0000-0000-000000000003', 'b0000005-0000-0000-0000-000000000010', 'velcro', '{"uk": "Липучка", "en": "Velcro"}', 3, true, NOW()),
('c0000017-0000-0000-0000-000000000004', 'b0000005-0000-0000-0000-000000000010', 'none', '{"uk": "Без застібки", "en": "None"}', 4, true, NOW())
ON CONFLICT DO NOTHING;

-- Waist Height
INSERT INTO attribute_options (id, attribute_id, value, label, sort_order, is_active, created_at) VALUES
('c0000018-0000-0000-0000-000000000001', 'b0000005-0000-0000-0000-000000000011', 'high', '{"uk": "Висока", "en": "High"}', 1, true, NOW()),
('c0000018-0000-0000-0000-000000000002', 'b0000005-0000-0000-0000-000000000011', 'medium', '{"uk": "Середня", "en": "Medium"}', 2, true, NOW()),
('c0000018-0000-0000-0000-000000000003', 'b0000005-0000-0000-0000-000000000011', 'low', '{"uk": "Низька", "en": "Low"}', 3, true, NOW())
ON CONFLICT DO NOTHING;

-- Cut Type (Jeans)
INSERT INTO attribute_options (id, attribute_id, value, label, sort_order, is_active, created_at) VALUES
('c0000019-0000-0000-0000-000000000001', 'b0000005-0000-0000-0000-000000000012', 'skinny', '{"uk": "Skinny", "en": "Skinny"}', 1, true, NOW()),
('c0000019-0000-0000-0000-000000000002', 'b0000005-0000-0000-0000-000000000012', 'straight', '{"uk": "Straight", "en": "Straight"}', 2, true, NOW()),
('c0000019-0000-0000-0000-000000000003', 'b0000005-0000-0000-0000-000000000012', 'mom', '{"uk": "Mom", "en": "Mom"}', 3, true, NOW()),
('c0000019-0000-0000-0000-000000000004', 'b0000005-0000-0000-0000-000000000012', 'cargo', '{"uk": "Cargo", "en": "Cargo"}', 4, true, NOW()),
('c0000019-0000-0000-0000-000000000005', 'b0000005-0000-0000-0000-000000000012', 'wide', '{"uk": "Wide Leg", "en": "Wide Leg"}', 5, true, NOW())
ON CONFLICT DO NOTHING;

-- Upholstery
INSERT INTO attribute_options (id, attribute_id, value, label, sort_order, is_active, created_at) VALUES
('c0000020-0000-0000-0000-000000000001', 'b0000006-0000-0000-0000-000000000002', 'fabric', '{"uk": "Тканина", "en": "Fabric"}', 1, true, NOW()),
('c0000020-0000-0000-0000-000000000002', 'b0000006-0000-0000-0000-000000000002', 'leather', '{"uk": "Шкіра", "en": "Leather"}', 2, true, NOW()),
('c0000020-0000-0000-0000-000000000003', 'b0000006-0000-0000-0000-000000000002', 'eco_leather', '{"uk": "Еко-шкіра", "en": "Eco Leather"}', 3, true, NOW()),
('c0000020-0000-0000-0000-000000000004', 'b0000006-0000-0000-0000-000000000002', 'velour', '{"uk": "Велюр", "en": "Velour"}', 4, true, NOW())
ON CONFLICT DO NOTHING;

-- Mechanism
INSERT INTO attribute_options (id, attribute_id, value, label, sort_order, is_active, created_at) VALUES
('c0000021-0000-0000-0000-000000000001', 'b0000006-0000-0000-0000-000000000003', 'book', '{"uk": "Книжка", "en": "Book"}', 1, true, NOW()),
('c0000021-0000-0000-0000-000000000002', 'b0000006-0000-0000-0000-000000000003', 'accordion', '{"uk": "Акордеон", "en": "Accordion"}', 2, true, NOW()),
('c0000021-0000-0000-0000-000000000003', 'b0000006-0000-0000-0000-000000000003', 'dolphin', '{"uk": "Дельфін", "en": "Dolphin"}', 3, true, NOW()),
('c0000021-0000-0000-0000-000000000004', 'b0000006-0000-0000-0000-000000000003', 'eurobook', '{"uk": "Єврокнижка", "en": "Eurobook"}', 4, true, NOW()),
('c0000021-0000-0000-0000-000000000005', 'b0000006-0000-0000-0000-000000000003', 'none', '{"uk": "Не розкладається", "en": "Non-folding"}', 5, true, NOW())
ON CONFLICT DO NOTHING;

-- Base Type (Lighting)
INSERT INTO attribute_options (id, attribute_id, value, label, sort_order, is_active, created_at) VALUES
('c0000022-0000-0000-0000-000000000001', 'b0000007-0000-0000-0000-000000000001', 'e27', '{"uk": "E27", "en": "E27"}', 1, true, NOW()),
('c0000022-0000-0000-0000-000000000002', 'b0000007-0000-0000-0000-000000000001', 'e14', '{"uk": "E14", "en": "E14"}', 2, true, NOW()),
('c0000022-0000-0000-0000-000000000003', 'b0000007-0000-0000-0000-000000000001', 'gu10', '{"uk": "GU10", "en": "GU10"}', 3, true, NOW()),
('c0000022-0000-0000-0000-000000000004', 'b0000007-0000-0000-0000-000000000001', 'led', '{"uk": "LED вбудований", "en": "Built-in LED"}', 4, true, NOW())
ON CONFLICT DO NOTHING;

-- Light Temperature
INSERT INTO attribute_options (id, attribute_id, value, label, sort_order, is_active, created_at) VALUES
('c0000023-0000-0000-0000-000000000001', 'b0000007-0000-0000-0000-000000000003', 'warm', '{"uk": "Тепле (2700-3000K)", "en": "Warm (2700-3000K)"}', 1, true, NOW()),
('c0000023-0000-0000-0000-000000000002', 'b0000007-0000-0000-0000-000000000003', 'neutral', '{"uk": "Нейтральне (4000K)", "en": "Neutral (4000K)"}', 2, true, NOW()),
('c0000023-0000-0000-0000-000000000003', 'b0000007-0000-0000-0000-000000000003', 'cold', '{"uk": "Холодне (5000-6500K)", "en": "Cold (5000-6500K)"}', 3, true, NOW())
ON CONFLICT DO NOTHING;

-- Bed Size
INSERT INTO attribute_options (id, attribute_id, value, label, sort_order, is_active, created_at) VALUES
('c0000024-0000-0000-0000-000000000001', 'b0000008-0000-0000-0000-000000000001', 'single', '{"uk": "Полуторний", "en": "Single"}', 1, true, NOW()),
('c0000024-0000-0000-0000-000000000002', 'b0000008-0000-0000-0000-000000000001', 'euro', '{"uk": "Євро", "en": "Euro"}', 2, true, NOW()),
('c0000024-0000-0000-0000-000000000003', 'b0000008-0000-0000-0000-000000000001', 'family', '{"uk": "Сімейний", "en": "Family"}', 3, true, NOW()),
('c0000024-0000-0000-0000-000000000004', 'b0000008-0000-0000-0000-000000000001', 'double', '{"uk": "Двоспальний", "en": "Double"}', 4, true, NOW())
ON CONFLICT DO NOTHING;

-- Fabric Type
INSERT INTO attribute_options (id, attribute_id, value, label, sort_order, is_active, created_at) VALUES
('c0000025-0000-0000-0000-000000000001', 'b0000008-0000-0000-0000-000000000002', 'satin', '{"uk": "Сатин", "en": "Satin"}', 1, true, NOW()),
('c0000025-0000-0000-0000-000000000002', 'b0000008-0000-0000-0000-000000000002', 'byaz', '{"uk": "Бязь", "en": "Byaz"}', 2, true, NOW()),
('c0000025-0000-0000-0000-000000000003', 'b0000008-0000-0000-0000-000000000002', 'ranforce', '{"uk": "Ранфорс", "en": "Ranforce"}', 3, true, NOW()),
('c0000025-0000-0000-0000-000000000004', 'b0000008-0000-0000-0000-000000000002', 'silk', '{"uk": "Шовк", "en": "Silk"}', 4, true, NOW())
ON CONFLICT DO NOTHING;

-- Perfume Type
INSERT INTO attribute_options (id, attribute_id, value, label, sort_order, is_active, created_at) VALUES
('c0000026-0000-0000-0000-000000000001', 'b0000009-0000-0000-0000-000000000002', 'edt', '{"uk": "Туалетна вода", "en": "Eau de Toilette"}', 1, true, NOW()),
('c0000026-0000-0000-0000-000000000002', 'b0000009-0000-0000-0000-000000000002', 'edp', '{"uk": "Парфумована вода", "en": "Eau de Parfum"}', 2, true, NOW()),
('c0000026-0000-0000-0000-000000000003', 'b0000009-0000-0000-0000-000000000002', 'cologne', '{"uk": "Одеколон", "en": "Cologne"}', 3, true, NOW()),
('c0000026-0000-0000-0000-000000000004', 'b0000009-0000-0000-0000-000000000002', 'parfum', '{"uk": "Парфуми", "en": "Parfum"}', 4, true, NOW())
ON CONFLICT DO NOTHING;

-- Scent Group
INSERT INTO attribute_options (id, attribute_id, value, label, sort_order, is_active, created_at) VALUES
('c0000027-0000-0000-0000-000000000001', 'b0000009-0000-0000-0000-000000000003', 'floral', '{"uk": "Квіткові", "en": "Floral"}', 1, true, NOW()),
('c0000027-0000-0000-0000-000000000002', 'b0000009-0000-0000-0000-000000000003', 'citrus', '{"uk": "Цитрусові", "en": "Citrus"}', 2, true, NOW()),
('c0000027-0000-0000-0000-000000000003', 'b0000009-0000-0000-0000-000000000003', 'woody', '{"uk": "Деревні", "en": "Woody"}', 3, true, NOW()),
('c0000027-0000-0000-0000-000000000004', 'b0000009-0000-0000-0000-000000000003', 'oriental', '{"uk": "Східні", "en": "Oriental"}', 4, true, NOW()),
('c0000027-0000-0000-0000-000000000005', 'b0000009-0000-0000-0000-000000000003', 'fresh', '{"uk": "Свіжі", "en": "Fresh"}', 5, true, NOW())
ON CONFLICT DO NOTHING;

-- Chemical Form
INSERT INTO attribute_options (id, attribute_id, value, label, sort_order, is_active, created_at) VALUES
('c0000028-0000-0000-0000-000000000001', 'b0000010-0000-0000-0000-000000000001', 'gel', '{"uk": "Гель", "en": "Gel"}', 1, true, NOW()),
('c0000028-0000-0000-0000-000000000002', 'b0000010-0000-0000-0000-000000000001', 'powder', '{"uk": "Порошок", "en": "Powder"}', 2, true, NOW()),
('c0000028-0000-0000-0000-000000000003', 'b0000010-0000-0000-0000-000000000001', 'capsules', '{"uk": "Капсули", "en": "Capsules"}', 3, true, NOW()),
('c0000028-0000-0000-0000-000000000004', 'b0000010-0000-0000-0000-000000000001', 'spray', '{"uk": "Спрей", "en": "Spray"}', 4, true, NOW()),
('c0000028-0000-0000-0000-000000000005', 'b0000010-0000-0000-0000-000000000001', 'liquid', '{"uk": "Рідина", "en": "Liquid"}', 5, true, NOW())
ON CONFLICT DO NOTHING;

-- Power Source
INSERT INTO attribute_options (id, attribute_id, value, label, sort_order, is_active, created_at) VALUES
('c0000029-0000-0000-0000-000000000001', 'b0000011-0000-0000-0000-000000000001', 'mains', '{"uk": "Мережа 220В", "en": "Mains 220V"}', 1, true, NOW()),
('c0000029-0000-0000-0000-000000000002', 'b0000011-0000-0000-0000-000000000001', 'battery', '{"uk": "Акумулятор", "en": "Battery"}', 2, true, NOW()),
('c0000029-0000-0000-0000-000000000003', 'b0000011-0000-0000-0000-000000000001', 'hybrid', '{"uk": "Мережа + Акумулятор", "en": "Mains + Battery"}', 3, true, NOW())
ON CONFLICT DO NOTHING;

-- Chuck Type
INSERT INTO attribute_options (id, attribute_id, value, label, sort_order, is_active, created_at) VALUES
('c0000030-0000-0000-0000-000000000001', 'b0000011-0000-0000-0000-000000000004', 'keyless', '{"uk": "Швидкозатискний", "en": "Keyless"}', 1, true, NOW()),
('c0000030-0000-0000-0000-000000000002', 'b0000011-0000-0000-0000-000000000004', 'sds_plus', '{"uk": "SDS+", "en": "SDS+"}', 2, true, NOW()),
('c0000030-0000-0000-0000-000000000003', 'b0000011-0000-0000-0000-000000000004', 'sds_max', '{"uk": "SDS-Max", "en": "SDS-Max"}', 3, true, NOW())
ON CONFLICT DO NOTHING;

-- Tire Width
INSERT INTO attribute_options (id, attribute_id, value, label, sort_order, is_active, created_at)
SELECT
    'c0000031-0000-0000-0000-' || LPAD(width::text, 12, '0'),
    'b0000012-0000-0000-0000-000000000001',
    width::text,
    format('{"uk": "%s мм", "en": "%s mm"}', width, width)::jsonb,
    (width - 155) / 10,
    true,
    NOW()
FROM (VALUES (155), (165), (175), (185), (195), (205), (215), (225), (235), (245), (255), (265)) AS t(width)
ON CONFLICT DO NOTHING;

-- Tire Season
INSERT INTO attribute_options (id, attribute_id, value, label, sort_order, is_active, created_at) VALUES
('c0000032-0000-0000-0000-000000000001', 'b0000012-0000-0000-0000-000000000004', 'winter', '{"uk": "Зимові", "en": "Winter"}', 1, true, NOW()),
('c0000032-0000-0000-0000-000000000002', 'b0000012-0000-0000-0000-000000000004', 'summer', '{"uk": "Літні", "en": "Summer"}', 2, true, NOW()),
('c0000032-0000-0000-0000-000000000003', 'b0000012-0000-0000-0000-000000000004', 'all_season', '{"uk": "Всесезонні", "en": "All Season"}', 3, true, NOW())
ON CONFLICT DO NOTHING;

-- Screen Resolution
INSERT INTO attribute_options (id, attribute_id, value, label, sort_order, is_active, created_at) VALUES
('c0000033-0000-0000-0000-000000000001', 'b0000002-0000-0000-0000-000000000007', 'hd', '{"uk": "HD (720p)", "en": "HD (720p)"}', 1, true, NOW()),
('c0000033-0000-0000-0000-000000000002', 'b0000002-0000-0000-0000-000000000007', 'fhd', '{"uk": "Full HD (1080p)", "en": "Full HD (1080p)"}', 2, true, NOW()),
('c0000033-0000-0000-0000-000000000003', 'b0000002-0000-0000-0000-000000000007', '2k', '{"uk": "2K (1440p)", "en": "2K (1440p)"}', 3, true, NOW()),
('c0000033-0000-0000-0000-000000000004', 'b0000002-0000-0000-0000-000000000007', '4k', '{"uk": "4K (2160p)", "en": "4K (2160p)"}', 4, true, NOW())
ON CONFLICT DO NOTHING;
