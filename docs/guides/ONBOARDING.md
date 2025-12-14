# Developer Onboarding Guide

Ласкаво просимо до команди Shop Platform!

## Перший день

### 1. Доступи

Запросіть у Team Lead доступи до:

| Сервіс | URL | Опис |
|--------|-----|------|
| GitHub | github.com/org/shop | Репозиторії коду |
| Slack | shop-team.slack.com | Комунікація |
| Jira | shop.atlassian.net | Завдання |
| Figma | figma.com/@shop | Дизайн |
| AWS Console | aws.amazon.com | Хмарна інфраструктура |
| Grafana | grafana.yourstore.com | Моніторинг |
| ArgoCD | argocd.yourstore.com | Deployment |
| Sentry | sentry.io/shop | Error tracking |

### 2. Налаштування робочого середовища

#### Необхідне ПЗ

```bash
# macOS
brew install go node docker docker-compose kubectl helm

# Ubuntu
sudo apt update
sudo apt install -y golang nodejs npm docker.io docker-compose

# Go version
go version  # >= 1.24

# Node version
node -v  # >= 20.x
```

#### IDE

Рекомендовано: **VS Code** або **GoLand**

VS Code extensions:
- Go
- ESLint
- Prettier
- GitLens
- Docker
- Kubernetes

#### Git

```bash
# Налаштування
git config --global user.name "Your Name"
git config --global user.email "your.email@company.com"

# SSH ключ
ssh-keygen -t ed25519 -C "your.email@company.com"
cat ~/.ssh/id_ed25519.pub  # Додати в GitHub Settings → SSH Keys
```

### 3. Клонування репозиторіїв

```bash
# Основні репозиторії
mkdir -p ~/projects/shop
cd ~/projects/shop

git clone git@github.com:org/shop-core.git
git clone git@github.com:org/shop-storefront.git
git clone git@github.com:org/shop-admin.git
git clone git@github.com:org/shop-infra.git
```

### 4. Локальний запуск

```bash
cd shop-core

# Скопіювати env файл
cp .env.example .env

# Запустити інфраструктуру
docker-compose up -d postgres redis elasticsearch rabbitmq

# Запустити міграції
go run cmd/migrate/main.go up

# Запустити сервер
go run cmd/server/main.go
```

---

## Перший тиждень

### Day 1-2: Ознайомлення

- [ ] Прочитати [README.md](../README.md)
- [ ] Пройти [Quickstart Guide](./QUICKSTART.md)
- [ ] Ознайомитись з [Architecture](../ARCHITECTURE.md)
- [ ] Переглянути [API Documentation](../api/README.md)

### Day 3-4: Перше завдання

- [ ] Взяти невелике завдання з Jira (label: `good-first-issue`)
- [ ] Створити feature branch
- [ ] Написати код та тести
- [ ] Створити Pull Request
- [ ] Пройти Code Review

### Day 5: Знайомство з процесами

- [ ] Участь у Daily Standup
- [ ] Ознайомитись з [Contributing Guide](./CONTRIBUTING.md)
- [ ] Налаштувати сповіщення в Slack

---

## Архітектура проекту

### Мікросервіси

```
┌─────────────────────────────────────────────────────────────┐
│                        Storefront                            │
│                      (Next.js 16)                            │
└─────────────────────────┬───────────────────────────────────┘
                          │
                    ┌─────▼─────┐
                    │   Nginx   │
                    │   (API    │
                    │  Gateway) │
                    └─────┬─────┘
                          │
    ┌─────────────────────┼─────────────────────┐
    │                     │                     │
┌───▼───┐           ┌─────▼─────┐         ┌────▼────┐
│ Core  │           │    OMS    │         │   CRM   │
│ API   │           │  Service  │         │ Service │
└───┬───┘           └─────┬─────┘         └────┬────┘
    │                     │                    │
    └─────────────────────┼────────────────────┘
                          │
              ┌───────────┼───────────┐
              │           │           │
         ┌────▼────┐ ┌────▼────┐ ┌────▼────┐
         │PostgreSQL│ │  Redis  │ │Elastic- │
         │         │ │         │ │search   │
         └─────────┘ └─────────┘ └─────────┘
```

### Ключові технології

| Категорія | Технологія |
|-----------|------------|
| Backend | Go 1.24, Gin, GORM |
| Frontend | Next.js 16, React 19, TypeScript |
| Database | PostgreSQL 15 |
| Cache | Redis 7 |
| Search | Elasticsearch 8.11 |
| Queue | RabbitMQ |
| Container | Docker, Kubernetes |
| CI/CD | GitHub Actions, ArgoCD |
| Monitoring | Prometheus, Grafana, Loki |

---

## Структура коду

### Backend (Go)

```
services/core/
├── cmd/
│   ├── server/           # Main application
│   └── migrate/          # Database migrations
├── internal/
│   ├── config/           # Configuration
│   ├── handlers/         # HTTP handlers
│   ├── services/         # Business logic
│   ├── repositories/     # Data access
│   ├── models/           # Domain models
│   ├── middleware/       # HTTP middleware
│   └── dto/              # Data transfer objects
├── pkg/
│   ├── liqpay/           # LiqPay client
│   ├── novaposhta/       # Nova Poshta client
│   └── monobank/         # Monobank client
├── migrations/           # SQL migrations
└── tests/                # Integration tests
```

### Frontend (Next.js)

```
services/storefront/
├── app/                  # App Router pages
│   ├── (shop)/           # Shop pages group
│   ├── (auth)/           # Auth pages group
│   └── api/              # API routes
├── components/
│   ├── ui/               # Reusable UI components
│   ├── product/          # Product components
│   ├── cart/             # Cart components
│   └── checkout/         # Checkout components
├── lib/
│   ├── api/              # API client
│   ├── hooks/            # Custom hooks
│   └── utils/            # Utilities
├── styles/               # Global styles
└── public/               # Static assets
```

---

## Git Workflow

### Branching Strategy

```
main (production)
  │
  └── develop (staging)
        │
        ├── feature/SHOP-123-add-payment
        ├── feature/SHOP-124-fix-cart
        └── hotfix/SHOP-125-critical-bug
```

### Branch Naming

```
feature/SHOP-123-short-description
bugfix/SHOP-124-fix-something
hotfix/SHOP-125-urgent-fix
chore/SHOP-126-update-deps
```

### Commit Messages

```
feat(cart): add promo code validation

- Add PromoCodeService
- Add validation rules
- Add unit tests

Closes SHOP-123
```

Типи:
- `feat`: Нова функціональність
- `fix`: Виправлення багу
- `docs`: Документація
- `style`: Форматування
- `refactor`: Рефакторинг
- `test`: Тести
- `chore`: Інше

### Pull Request Flow

1. Створити branch від `develop`
2. Написати код та тести
3. Переконатись що CI проходить
4. Створити PR з описом змін
5. Пройти Code Review (мінімум 1 approve)
6. Merge до `develop`

---

## Code Style

### Go

```go
// Використовуємо gofmt та golangci-lint
// Перед commit:
make lint
make test
```

Правила:
- Максимальна довжина рядка: 120 символів
- Використовувати context для всіх операцій
- Error handling: завжди перевіряти помилки
- Naming: CamelCase для exported, camelCase для internal

### TypeScript/React

```bash
# Linting
npm run lint
npm run format
```

Правила:
- Functional components
- Hooks замість class components
- TypeScript strict mode
- ESLint + Prettier

---

## Testing

### Backend

```bash
# Unit tests
go test ./...

# З покриттям
go test -cover ./...

# Integration tests
go test -tags=integration ./...
```

### Frontend

```bash
# Unit tests
npm test

# E2E tests
npm run test:e2e
```

### Мінімальне покриття

- Backend: 80%
- Frontend: 70%

---

## Deployment

### Environments

| Environment | Branch | URL |
|-------------|--------|-----|
| Development | feature/* | localhost |
| Staging | develop | staging.yourstore.com |
| Production | main | yourstore.com |

### Deploy Process

```bash
# Staging (автоматично при merge в develop)
git checkout develop
git merge feature/SHOP-123-feature
git push

# Production (через GitHub Release)
git checkout main
git merge develop
git tag v1.2.3
git push --tags
```

---

## Корисні команди

### Docker

```bash
# Запустити все
docker-compose up -d

# Переглянути логи
docker-compose logs -f core

# Зупинити все
docker-compose down

# Очистити volumes
docker-compose down -v
```

### Database

```bash
# Підключитись до PostgreSQL
docker-compose exec postgres psql -U shop -d shopdb

# Міграції
go run cmd/migrate/main.go up
go run cmd/migrate/main.go down
go run cmd/migrate/main.go create add_new_table
```

### Kubernetes

```bash
# Подивитись pods
kubectl get pods -n shop

# Логи
kubectl logs -f deployment/core -n shop

# Port forward
kubectl port-forward svc/core 8080:8080 -n shop
```

---

## Контакти

### Team Leads

| Роль | Ім'я | Slack |
|------|------|-------|
| Tech Lead | Олександр | @alex |
| Backend Lead | Марія | @maria |
| Frontend Lead | Дмитро | @dmitry |
| DevOps Lead | Андрій | @andrii |

### Slack Channels

| Channel | Опис |
|---------|------|
| #shop-general | Загальні питання |
| #shop-dev | Технічні обговорення |
| #shop-alerts | Моніторинг |
| #shop-deploys | Деплойменти |
| #shop-random | Неформальне спілкування |

### Regular Meetings

| Meeting | Час | Частота |
|---------|-----|---------|
| Daily Standup | 10:00 | Щодня |
| Sprint Planning | 10:00 Mon | Раз на 2 тижні |
| Sprint Retro | 16:00 Fri | Раз на 2 тижні |
| Tech Talk | 15:00 Wed | Щотижня |

---

## Перевірочний список

### Перший день
- [ ] Отримати всі доступи
- [ ] Налаштувати робоче середовище
- [ ] Клонувати репозиторії
- [ ] Запустити проект локально

### Перший тиждень
- [ ] Прочитати документацію
- [ ] Виконати перше завдання
- [ ] Створити перший PR
- [ ] Пройти code review

### Перший місяць
- [ ] Ознайомитись з усіма сервісами
- [ ] Взяти участь у on-call ротації
- [ ] Провести Tech Talk
- [ ] Запропонувати покращення

---

## FAQ

### Як отримати доступ до production?

Доступ до production надається після:
1. Проходження випробувального терміну
2. Ознайомлення з security policies
3. Підпису NDA

### Що робити якщо CI падає?

1. Перевірити логи в GitHub Actions
2. Виправити проблему локально
3. Запушити fix
4. Якщо не зрозуміло - спитати в #shop-dev

### Як налагоджувати production issues?

1. Перевірити Grafana dashboards
2. Переглянути логи в Loki
3. Перевірити Sentry на помилки
4. Ескалювати до on-call engineer

### Куди звертатись з питаннями?

1. Технічні питання → #shop-dev
2. Процесні питання → Team Lead
3. HR питання → HR manager
4. Термінові питання → Slack DM
