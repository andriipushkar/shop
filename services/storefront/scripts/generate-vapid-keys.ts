#!/usr/bin/env node

/**
 * Генератор VAPID ключів для Web Push Notifications
 *
 * VAPID (Voluntary Application Server Identification) - це стандарт
 * для ідентифікації вашого сервера при відправці push-повідомлень.
 *
 * Використання:
 *   npm run generate-vapid-keys
 *   або
 *   npx ts-node scripts/generate-vapid-keys.ts
 *
 * Після генерації додайте ключі в .env файл:
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY=<public-key>
 *   VAPID_PRIVATE_KEY=<private-key>
 */

import { webcrypto } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

// Функція для конвертації ArrayBuffer в base64url
function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return Buffer.from(binary, 'binary')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// Генерує VAPID ключі
async function generateVapidKeys() {
  try {
    console.log('\n🔐 Генерація VAPID ключів для Web Push Notifications...\n');

    // Генеруємо пару ключів використовуючи Web Crypto API
    const keyPair = await webcrypto.subtle.generateKey(
      {
        name: 'ECDSA',
        namedCurve: 'P-256',
      },
      true, // extractable
      ['sign', 'verify']
    );

    // Експортуємо публічний ключ
    const publicKeyBuffer = await webcrypto.subtle.exportKey(
      'spki',
      keyPair.publicKey
    );

    // Експортуємо приватний ключ
    const privateKeyBuffer = await webcrypto.subtle.exportKey(
      'pkcs8',
      keyPair.privateKey
    );

    // Конвертуємо в base64url формат (стандарт для VAPID)
    const publicKey = arrayBufferToBase64Url(publicKeyBuffer);
    const privateKey = arrayBufferToBase64Url(privateKeyBuffer);

    // Виводимо результати
    console.log('✅ VAPID ключі успішно згенеровані!\n');
    console.log('━'.repeat(80));
    console.log('\n📋 Скопіюйте ці значення у ваш .env файл:\n');
    console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY="${publicKey}"`);
    console.log(`VAPID_PRIVATE_KEY="${privateKey}"`);
    console.log(`VAPID_SUBJECT="mailto:admin@techshop.ua"`);
    console.log('\n' + '━'.repeat(80) + '\n');

    // Пропонуємо автоматично додати в .env.example
    const envExamplePath = path.join(process.cwd(), '.env.example');

    console.log('💡 Поради:\n');
    console.log('1. Публічний ключ (NEXT_PUBLIC_VAPID_PUBLIC_KEY) буде доступний в браузері');
    console.log('2. Приватний ключ (VAPID_PRIVATE_KEY) НІКОЛИ не повинен потрапити на клієнт');
    console.log('3. VAPID_SUBJECT має бути mailto: адресою або URL вашого сайту');
    console.log('4. Зберігайте ці ключі в безпеці - не комітьте їх в git!');
    console.log('5. Використовуйте різні ключі для production та development\n');

    // Створюємо sample .env файл з ключами
    const envSample = `
# VAPID Keys для Web Push Notifications
# Згенеровано: ${new Date().toISOString()}
NEXT_PUBLIC_VAPID_PUBLIC_KEY="${publicKey}"
VAPID_PRIVATE_KEY="${privateKey}"
VAPID_SUBJECT="mailto:admin@techshop.ua"
`;

    const outputPath = path.join(process.cwd(), '.env.vapid.sample');
    fs.writeFileSync(outputPath, envSample.trim() + '\n');

    console.log(`✅ Ключі також збережені в ${outputPath}\n`);

    // Перевіряємо чи існує .env файл
    const envPath = path.join(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf-8');

      if (!envContent.includes('NEXT_PUBLIC_VAPID_PUBLIC_KEY')) {
        console.log('⚠️  УВАГА: Ваш .env файл не містить VAPID ключів.');
        console.log('   Скопіюйте значення з .env.vapid.sample або додайте вручну.\n');
      } else {
        console.log('ℹ️  Ваш .env вже містить VAPID ключі.');
        console.log('   Якщо хочете оновити - замініть старі значення на нові.\n');
      }
    }

    // Інформація про використання
    console.log('━'.repeat(80));
    console.log('\n📚 Як використовувати VAPID ключі:\n');
    console.log('1. Додайте ключі у ваш .env файл');
    console.log('2. У коді для підписки на push-повідомлення використовуйте:');
    console.log('   const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;');
    console.log('3. Для відправки push-повідомлень використовуйте:');
    console.log('   web-push library з приватним ключем\n');
    console.log('━'.repeat(80) + '\n');

  } catch (error) {
    console.error('❌ Помилка при генерації VAPID ключів:', error);
    process.exit(1);
  }
}

// Додаткова функція для валідації існуючих ключів
export async function validateVapidKeys(publicKey: string, privateKey: string): Promise<boolean> {
  try {
    // Конвертуємо base64url в ArrayBuffer
    const publicKeyBuffer = Buffer.from(publicKey, 'base64url');
    const privateKeyBuffer = Buffer.from(privateKey, 'base64url');

    // Намагаємось імпортувати ключі
    await webcrypto.subtle.importKey(
      'spki',
      publicKeyBuffer,
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['verify']
    );

    await webcrypto.subtle.importKey(
      'pkcs8',
      privateKeyBuffer,
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['sign']
    );

    return true;
  } catch (error) {
    console.error('❌ Невалідні VAPID ключі:', error);
    return false;
  }
}

// Функція для відображення інформації про ключі
export function displayKeyInfo(publicKey: string): void {
  console.log('\n📊 Інформація про VAPID ключ:\n');
  console.log(`Публічний ключ: ${publicKey.substring(0, 32)}...`);
  console.log(`Довжина: ${publicKey.length} символів`);
  console.log(`Формат: Base64URL\n`);
}

// Експортуємо для використання в інших скриптах
export { generateVapidKeys };

// Запускаємо якщо викликано безпосередньо
if (require.main === module) {
  generateVapidKeys().catch(console.error);
}
