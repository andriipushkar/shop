# Contributing Guide

Керівництво для контриб'юторів проекту.

## Як почати

### 1. Fork & Clone

```bash
# Fork репозиторію через GitHub UI

# Clone вашого fork
git clone https://github.com/YOUR_USERNAME/shop-platform.git
cd shop-platform

# Додайте upstream remote
git remote add upstream https://github.com/original-org/shop-platform.git
```

### 2. Налаштування середовища

```bash
# Встановлення залежностей
make setup

# Запуск інфраструктури
docker compose up -d

# Запуск тестів для перевірки
make test
```

### 3. Створення branch

```bash
# Оновлення main
git checkout main
git pull upstream main

# Створення feature branch
git checkout -b feature/TICKET-123-description
```

## Workflow

### Development Process

1. **Issue** - Створіть або знайдіть issue
2. **Branch** - Створіть feature branch
3. **Code** - Напишіть код
4. **Test** - Додайте тести
5. **Docs** - Оновіть документацію
6. **PR** - Створіть Pull Request
7. **Review** - Пройдіть code review
8. **Merge** - Після approval

### Commit Guidelines

Використовуємо [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat` - Нова функціональність
- `fix` - Виправлення бага
- `docs` - Документація
- `style` - Форматування (не змінює код)
- `refactor` - Рефакторинг
- `test` - Тести
- `chore` - Інше (build, ci, etc.)

**Приклади:**

```bash
feat(products): add bulk import functionality

Implement CSV import for products with validation and progress tracking.

- Add CSV parser with column mapping
- Add validation for required fields
- Add progress webhook notifications

Closes #234

---

fix(checkout): prevent double payment submission

Add loading state to prevent users from clicking pay button multiple times.

Fixes #456

---

docs(api): add webhooks documentation

- Document all webhook events
- Add payload examples
- Add signature verification guide
```

### Branch Naming

```
feature/TICKET-123-short-description
bugfix/TICKET-456-fix-description
hotfix/TICKET-789-urgent-fix
refactor/improve-something
docs/update-something
```

## Pull Request

### Створення PR

1. Push ваш branch:
```bash
git push origin feature/TICKET-123-description
```

2. Створіть PR через GitHub UI

3. Заповніть template:

```markdown
## Description
Brief description of what this PR does.

## Type of Change
- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to change)
- [ ] Documentation update

## How Has This Been Tested?
Describe the tests you ran to verify your changes.

- [ ] Unit tests
- [ ] Integration tests
- [ ] Manual testing

## Checklist
- [ ] My code follows the project's style guidelines
- [ ] I have performed a self-review of my code
- [ ] I have commented my code where necessary
- [ ] I have updated the documentation
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix/feature works
- [ ] All new and existing tests pass

## Screenshots (if applicable)

## Related Issues
Closes #XXX
```

### PR Requirements

- [ ] CI проходить (tests, lint, build)
- [ ] Code coverage не знизився
- [ ] Є мінімум 1 approval
- [ ] Немає merge conflicts
- [ ] Branch up to date з main

### Code Review Guidelines

**Для автора:**
- Тримайте PR невеликими (< 400 рядків)
- Описуйте контекст та рішення
- Відповідайте на коментарі протягом 24 годин
- Використовуйте "Resolve" після виправлення

**Для рев'ювера:**
- Будьте конструктивними
- Пояснюйте "чому", не тільки "що"
- Відмічайте гарний код
- Використовуйте suggestions для простих змін

## Code Standards

### Go

```go
// golangci-lint конфігурація
// .golangci.yml
linters:
  enable:
    - gofumpt
    - govet
    - errcheck
    - staticcheck
    - gosimple
    - ineffassign
    - unused
    - misspell
    - goimports
    - revive

linters-settings:
  gofumpt:
    extra-rules: true
  revive:
    rules:
      - name: exported
        arguments:
          - checkPrivateReceivers
```

**Обов'язково:**
- `gofumpt` для форматування
- `golangci-lint` без warnings
- Unit тести для нового коду
- Коментарі для exported functions

### TypeScript

```json
// .eslintrc.json
{
  "extends": [
    "next/core-web-vitals",
    "plugin:@typescript-eslint/recommended",
    "prettier"
  ],
  "rules": {
    "@typescript-eslint/explicit-function-return-type": "warn",
    "@typescript-eslint/no-unused-vars": "error",
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn"
  }
}
```

**Обов'язково:**
- ESLint + Prettier без warnings
- TypeScript strict mode
- Типізація props та return types
- Jest тести для компонентів

### SQL

```sql
-- Naming conventions
-- Tables: plural, snake_case
CREATE TABLE order_items (...);

-- Columns: snake_case
SELECT customer_id, created_at FROM orders;

-- Indexes: idx_table_column
CREATE INDEX idx_orders_customer_id ON orders(customer_id);

-- Foreign keys: fk_table_reference
ALTER TABLE orders ADD CONSTRAINT fk_orders_customer
    FOREIGN KEY (customer_id) REFERENCES customers(id);
```

## Testing Requirements

### Unit Tests

```bash
# Мінімальне покриття
# Go: 70%
# TypeScript: 70%

# Перевірка
make test-coverage
```

### Що тестувати

- Business logic
- Edge cases
- Error handling
- Input validation

### Що НЕ тестувати

- Приватні методи (через public API)
- Getters/setters без логіки
- Фреймворк код

## Documentation

### Коли оновлювати

- Нові API endpoints
- Зміна поведінки
- Нові конфігураційні параметри
- Breaking changes

### Формат

```markdown
## Feature Name

Short description.

### Configuration

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `PARAM`   | string | "" | What it does |

### Usage

```go
// Code example
```

### API

```
POST /api/v1/endpoint
```

Request:
```json
{
  "field": "value"
}
```
```

## Issue Guidelines

### Bug Report

```markdown
**Describe the bug**
A clear description of what the bug is.

**To Reproduce**
Steps to reproduce:
1. Go to '...'
2. Click on '...'
3. See error

**Expected behavior**
What you expected to happen.

**Screenshots**
If applicable.

**Environment:**
- OS: [e.g. Ubuntu 22.04]
- Browser: [e.g. Chrome 120]
- Version: [e.g. v1.2.3]

**Additional context**
Any other context.
```

### Feature Request

```markdown
**Is your feature request related to a problem?**
A clear description of the problem.

**Describe the solution you'd like**
What you want to happen.

**Describe alternatives you've considered**
Other solutions you've thought about.

**Additional context**
Any other context or screenshots.
```

## Release Process

### Versioning

Використовуємо [Semantic Versioning](https://semver.org/):

- **MAJOR** - Breaking changes
- **MINOR** - New features (backward compatible)
- **PATCH** - Bug fixes (backward compatible)

### Changelog

```markdown
# Changelog

## [1.2.0] - 2024-01-15

### Added
- Product bulk import (#234)
- Webhook notifications (#235)

### Changed
- Improved search performance (#240)

### Fixed
- Cart calculation bug (#456)

### Deprecated
- Old payment API (use v2)

### Removed
- Legacy export format

### Security
- Updated dependencies
```

## Отримання допомоги

- **Slack:** #dev-help
- **Email:** dev@yourstore.com
- **Discussions:** GitHub Discussions

## Визнання

Контриб'ютори додаються до:
- README.md Contributors section
- Release notes
- Annual contributors report

Дякуємо за ваш внесок!
