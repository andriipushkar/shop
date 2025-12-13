#!/usr/bin/env ts-node
/**
 * Security Audit Script - Скрипт аудиту безпеки
 * Перевірка конфігурації безпеки та пошук вразливостей
 * Запуск: npm run security-audit або ts-node scripts/security-audit.ts
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface SecurityIssue {
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  category: string;
  message: string;
  file?: string;
  line?: number;
  recommendation?: string;
}

const issues: SecurityIssue[] = [];

/**
 * Кольори для консолі
 */
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

/**
 * Лог з кольором
 */
function log(message: string, color: keyof typeof colors = 'reset'): void {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Додавання проблеми
 */
function addIssue(issue: SecurityIssue): void {
  issues.push(issue);
}

/**
 * 1. Перевірка npm пакетів на вразливості
 */
async function checkNpmAudit(): Promise<void> {
  log('\n🔍 Перевірка npm пакетів на вразливості...', 'cyan');

  try {
    const result = execSync('npm audit --json', {
      cwd: process.cwd(),
      encoding: 'utf-8',
    });

    const auditData = JSON.parse(result);

    if (auditData.metadata) {
      const { vulnerabilities } = auditData.metadata;

      if (vulnerabilities.critical > 0) {
        addIssue({
          severity: 'critical',
          category: 'Dependencies',
          message: `Знайдено ${vulnerabilities.critical} критичних вразливостей в залежностях`,
          recommendation: 'Запустіть: npm audit fix --force',
        });
      }

      if (vulnerabilities.high > 0) {
        addIssue({
          severity: 'high',
          category: 'Dependencies',
          message: `Знайдено ${vulnerabilities.high} високих вразливостей в залежностях`,
          recommendation: 'Запустіть: npm audit fix',
        });
      }

      if (vulnerabilities.moderate > 0) {
        addIssue({
          severity: 'medium',
          category: 'Dependencies',
          message: `Знайдено ${vulnerabilities.moderate} середніх вразливостей в залежностях`,
          recommendation: 'Запустіть: npm audit fix',
        });
      }

      log(
        `✓ Критичних: ${vulnerabilities.critical}, Високих: ${vulnerabilities.high}, Середніх: ${vulnerabilities.moderate}`,
        vulnerabilities.critical > 0 || vulnerabilities.high > 0 ? 'red' : 'green'
      );
    }
  } catch (error: any) {
    if (error.status === 1) {
      // npm audit повертає код 1 якщо знайдені вразливості
      try {
        const auditData = JSON.parse(error.stdout);
        const { vulnerabilities } = auditData.metadata;

        if (vulnerabilities.critical > 0 || vulnerabilities.high > 0) {
          addIssue({
            severity: vulnerabilities.critical > 0 ? 'critical' : 'high',
            category: 'Dependencies',
            message: `Знайдено вразливості: критичних ${vulnerabilities.critical}, високих ${vulnerabilities.high}`,
            recommendation: 'Запустіть: npm audit fix',
          });
        }
      } catch (parseError) {
        log('⚠ Помилка парсингу результатів npm audit', 'yellow');
      }
    } else {
      log('⚠ Помилка виконання npm audit', 'yellow');
    }
  }
}

/**
 * 2. Перевірка наявності важливих файлів безпеки
 */
function checkSecurityFiles(): void {
  log('\n🔍 Перевірка файлів безпеки...', 'cyan');

  const requiredFiles = [
    { path: '.env.example', message: 'Файл .env.example не знайдено' },
    { path: '.gitignore', message: 'Файл .gitignore не знайдено' },
  ];

  const sensitiveFiles = [
    { path: '.env', message: '.env файл повинен бути в .gitignore' },
    { path: '.env.local', message: '.env.local повинен бути в .gitignore' },
  ];

  requiredFiles.forEach(({ path: filePath, message }) => {
    if (!fs.existsSync(path.join(process.cwd(), filePath))) {
      addIssue({
        severity: 'medium',
        category: 'Configuration',
        message,
        file: filePath,
        recommendation: `Створіть файл ${filePath}`,
      });
      log(`✗ ${message}`, 'yellow');
    } else {
      log(`✓ ${filePath} знайдено`, 'green');
    }
  });

  // Перевірка .gitignore
  const gitignorePath = path.join(process.cwd(), '.gitignore');
  if (fs.existsSync(gitignorePath)) {
    const gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');

    sensitiveFiles.forEach(({ path: filePath, message }) => {
      if (
        fs.existsSync(path.join(process.cwd(), filePath)) &&
        !gitignoreContent.includes(filePath)
      ) {
        addIssue({
          severity: 'critical',
          category: 'Configuration',
          message,
          file: filePath,
          recommendation: `Додайте ${filePath} до .gitignore`,
        });
        log(`✗ ${message}`, 'red');
      }
    });

    // Перевірка чи .env в gitignore
    if (!gitignoreContent.includes('.env')) {
      addIssue({
        severity: 'critical',
        category: 'Configuration',
        message: '.env файли не додані до .gitignore',
        recommendation: 'Додайте .env* до .gitignore',
      });
    }
  }
}

/**
 * 3. Перевірка змінних оточення
 */
function checkEnvironmentVariables(): void {
  log('\n🔍 Перевірка змінних оточення...', 'cyan');

  const requiredEnvVars = [
    'DATABASE_URL',
    'NEXTAUTH_SECRET',
    'NEXTAUTH_URL',
  ];

  const sensitiveEnvVars = [
    'API_KEY',
    'SECRET',
    'PASSWORD',
    'PRIVATE_KEY',
    'TOKEN',
  ];

  // Перевірка обов'язкових змінних
  requiredEnvVars.forEach((envVar) => {
    if (!process.env[envVar]) {
      addIssue({
        severity: 'high',
        category: 'Environment',
        message: `Обов'язкова змінна оточення ${envVar} не встановлена`,
        recommendation: `Додайте ${envVar} до .env файлу`,
      });
      log(`✗ ${envVar} не встановлено`, 'red');
    } else {
      log(`✓ ${envVar} встановлено`, 'green');
    }
  });

  // Перевірка дефолтних значень
  if (process.env.NEXTAUTH_SECRET === 'change-this-secret') {
    addIssue({
      severity: 'critical',
      category: 'Environment',
      message: 'NEXTAUTH_SECRET має дефолтне значення',
      recommendation: 'Згенеруйте криптографічно безпечний секрет',
    });
    log('✗ NEXTAUTH_SECRET має дефолтне значення', 'red');
  }

  if (process.env.CSRF_SECRET === 'default-csrf-secret-change-in-production') {
    addIssue({
      severity: 'critical',
      category: 'Environment',
      message: 'CSRF_SECRET має дефолтне значення',
      recommendation: 'Згенеруйте криптографічно безпечний секрет',
    });
  }
}

/**
 * 4. Перевірка коду на небезпечні патерни
 */
function checkCodePatterns(): void {
  log('\n🔍 Сканування коду на небезпечні патерни...', 'cyan');

  const dangerousPatterns = [
    {
      pattern: /eval\s*\(/g,
      message: 'Використання eval() небезпечне',
      severity: 'high' as const,
    },
    {
      pattern: /dangerouslySetInnerHTML/g,
      message: 'Використання dangerouslySetInnerHTML може призвести до XSS',
      severity: 'medium' as const,
    },
    {
      pattern: /process\.env\./g,
      message: 'Прямий доступ до process.env (перевірте чи не витікають секрети)',
      severity: 'info' as const,
    },
    {
      pattern: /localStorage\.setItem\s*\(\s*['"`]token/gi,
      message: 'Зберігання токенів в localStorage небезпечне',
      severity: 'high' as const,
    },
  ];

  function scanDirectory(dir: string): void {
    const files = fs.readdirSync(dir);

    files.forEach((file) => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);

      // Пропускаємо node_modules, .next, та інші
      if (
        file === 'node_modules' ||
        file === '.next' ||
        file === 'dist' ||
        file === 'build' ||
        file.startsWith('.')
      ) {
        return;
      }

      if (stat.isDirectory()) {
        scanDirectory(filePath);
      } else if (
        file.endsWith('.ts') ||
        file.endsWith('.tsx') ||
        file.endsWith('.js') ||
        file.endsWith('.jsx')
      ) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');

        dangerousPatterns.forEach(({ pattern, message, severity }) => {
          lines.forEach((line, index) => {
            if (pattern.test(line)) {
              addIssue({
                severity,
                category: 'Code Pattern',
                message,
                file: filePath.replace(process.cwd(), ''),
                line: index + 1,
                recommendation: 'Перевірте використання цього паттерну',
              });
            }
          });
        });
      }
    });
  }

  const dirsToScan = ['app', 'lib', 'components', 'pages'];
  dirsToScan.forEach((dir) => {
    const dirPath = path.join(process.cwd(), dir);
    if (fs.existsSync(dirPath)) {
      scanDirectory(dirPath);
    }
  });

  log('✓ Сканування коду завершено', 'green');
}

/**
 * 5. Перевірка конфігурації безпеки
 */
function checkSecurityConfiguration(): void {
  log('\n🔍 Перевірка конфігурації безпеки...', 'cyan');

  // Перевірка next.config
  const nextConfigPath = path.join(process.cwd(), 'next.config.ts');
  if (fs.existsSync(nextConfigPath)) {
    const config = fs.readFileSync(nextConfigPath, 'utf-8');

    if (!config.includes('poweredByHeader: false')) {
      addIssue({
        severity: 'low',
        category: 'Configuration',
        message: 'Рекомендується вимкнути X-Powered-By заголовок',
        file: 'next.config.ts',
        recommendation: 'Додайте poweredByHeader: false до конфігурації',
      });
    } else {
      log('✓ X-Powered-By вимкнено', 'green');
    }

    if (!config.includes('reactStrictMode: true')) {
      addIssue({
        severity: 'low',
        category: 'Configuration',
        message: 'Рекомендується увімкнути React Strict Mode',
        file: 'next.config.ts',
        recommendation: 'Додайте reactStrictMode: true',
      });
    } else {
      log('✓ React Strict Mode увімкнено', 'green');
    }

    // Перевірка security headers
    const securityHeaders = [
      'X-Frame-Options',
      'X-Content-Type-Options',
      'Content-Security-Policy',
      'Strict-Transport-Security',
    ];

    securityHeaders.forEach((header) => {
      if (!config.includes(header)) {
        addIssue({
          severity: 'medium',
          category: 'Security Headers',
          message: `${header} заголовок не налаштований`,
          file: 'next.config.ts',
          recommendation: `Додайте ${header} до конфігурації`,
        });
        log(`✗ ${header} не налаштований`, 'yellow');
      } else {
        log(`✓ ${header} налаштований`, 'green');
      }
    });
  }

  // Перевірка middleware
  const middlewarePath = path.join(process.cwd(), 'middleware.ts');
  if (fs.existsSync(middlewarePath)) {
    const middleware = fs.readFileSync(middlewarePath, 'utf-8');

    if (!middleware.includes('rate') && !middleware.includes('limit')) {
      addIssue({
        severity: 'medium',
        category: 'Middleware',
        message: 'Rate limiting не налаштований в middleware',
        file: 'middleware.ts',
        recommendation: 'Додайте rate limiting до middleware',
      });
    } else {
      log('✓ Rate limiting налаштовано', 'green');
    }

    if (!middleware.includes('csrf') && !middleware.includes('CSRF')) {
      addIssue({
        severity: 'medium',
        category: 'Middleware',
        message: 'CSRF захист не налаштований в middleware',
        file: 'middleware.ts',
        recommendation: 'Додайте CSRF захист до middleware',
      });
    } else {
      log('✓ CSRF захист налаштовано', 'green');
    }
  }
}

/**
 * 6. Генерація звіту
 */
function generateReport(): void {
  log('\n' + '='.repeat(80), 'bright');
  log('📊 ЗВІТ АУДИТУ БЕЗПЕКИ', 'bright');
  log('='.repeat(80), 'bright');

  const severityCounts = {
    critical: issues.filter((i) => i.severity === 'critical').length,
    high: issues.filter((i) => i.severity === 'high').length,
    medium: issues.filter((i) => i.severity === 'medium').length,
    low: issues.filter((i) => i.severity === 'low').length,
    info: issues.filter((i) => i.severity === 'info').length,
  };

  log('\n📈 Статистика:', 'cyan');
  log(`   Критичні: ${severityCounts.critical}`, severityCounts.critical > 0 ? 'red' : 'green');
  log(`   Високі: ${severityCounts.high}`, severityCounts.high > 0 ? 'red' : 'green');
  log(`   Середні: ${severityCounts.medium}`, severityCounts.medium > 0 ? 'yellow' : 'green');
  log(`   Низькі: ${severityCounts.low}`, 'blue');
  log(`   Інформаційні: ${severityCounts.info}`, 'blue');

  if (issues.length === 0) {
    log('\n✅ Проблем не знайдено!', 'green');
    return;
  }

  // Групування за severity
  const grouped = {
    critical: issues.filter((i) => i.severity === 'critical'),
    high: issues.filter((i) => i.severity === 'high'),
    medium: issues.filter((i) => i.severity === 'medium'),
    low: issues.filter((i) => i.severity === 'low'),
    info: issues.filter((i) => i.severity === 'info'),
  };

  Object.entries(grouped).forEach(([severity, items]) => {
    if (items.length === 0) return;

    const color =
      severity === 'critical' || severity === 'high'
        ? 'red'
        : severity === 'medium'
        ? 'yellow'
        : 'blue';

    log(`\n${'━'.repeat(80)}`, color);
    log(`🔴 ${severity.toUpperCase()} (${items.length})`, color);
    log('━'.repeat(80), color);

    items.forEach((issue, index) => {
      log(`\n${index + 1}. [${issue.category}] ${issue.message}`, color);
      if (issue.file) {
        log(`   📁 Файл: ${issue.file}${issue.line ? `:${issue.line}` : ''}`, 'blue');
      }
      if (issue.recommendation) {
        log(`   💡 Рекомендація: ${issue.recommendation}`, 'cyan');
      }
    });
  });

  // Збереження звіту в JSON
  const reportPath = path.join(process.cwd(), 'security-audit-report.json');
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        summary: severityCounts,
        issues,
      },
      null,
      2
    )
  );

  log(`\n📄 Повний звіт збережено: ${reportPath}`, 'cyan');

  // Exit code
  if (severityCounts.critical > 0 || severityCounts.high > 0) {
    log('\n❌ Аудит завершився з критичними або високими проблемами', 'red');
    process.exit(1);
  } else {
    log('\n✅ Аудит завершився успішно', 'green');
    process.exit(0);
  }
}

/**
 * Головна функція
 */
async function main(): Promise<void> {
  log('🔒 SECURITY AUDIT - Аудит безпеки додатку', 'bright');
  log(`📅 ${new Date().toLocaleString('uk-UA')}\n`, 'blue');

  await checkNpmAudit();
  checkSecurityFiles();
  checkEnvironmentVariables();
  checkCodePatterns();
  checkSecurityConfiguration();

  generateReport();
}

// Запуск
main().catch((error) => {
  log(`\n❌ Помилка виконання аудиту: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
