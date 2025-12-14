# Architecture Decision Records (ADR)

Документація архітектурних рішень проекту Shop Platform.

## Що таке ADR?

Architecture Decision Record — це документ, який фіксує важливе архітектурне рішення разом з контекстом та наслідками.

## Структура ADR

```markdown
# ADR-XXX: Title

## Status
Proposed | Accepted | Deprecated | Superseded by ADR-YYY

## Context
Опис проблеми або контексту, що призвів до рішення.

## Decision
Прийняте рішення та його обґрунтування.

## Consequences
Позитивні та негативні наслідки рішення.
```

## Список ADR

| ID | Назва | Статус | Дата |
|----|-------|--------|------|
| [ADR-001](./ADR-001-microservices.md) | Мікросервісна архітектура | Accepted | 2024-01-15 |
| [ADR-002](./ADR-002-go-backend.md) | Go як мова бекенду | Accepted | 2024-01-15 |
| [ADR-003](./ADR-003-nextjs-frontend.md) | Next.js для фронтенду | Accepted | 2024-01-15 |
| [ADR-004](./ADR-004-postgresql.md) | PostgreSQL як основна БД | Accepted | 2024-01-20 |
| [ADR-005](./ADR-005-elasticsearch.md) | Elasticsearch для пошуку | Accepted | 2024-01-25 |
| [ADR-006](./ADR-006-event-driven.md) | Event-driven архітектура | Accepted | 2024-02-01 |
| [ADR-007](./ADR-007-kubernetes.md) | Kubernetes для оркестрації | Accepted | 2024-02-10 |
| [ADR-008](./ADR-008-api-versioning.md) | Версіонування API | Accepted | 2024-02-15 |

## Як створити новий ADR

1. Скопіюйте шаблон `ADR-TEMPLATE.md`
2. Назвіть файл `ADR-XXX-short-title.md`
3. Заповніть всі секції
4. Створіть PR для review
5. Після затвердження - оновіть статус на Accepted
