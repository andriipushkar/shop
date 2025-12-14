# ADR-002: Go як мова бекенду

## Status

Accepted

## Date

2024-01-15

## Context

Потрібно було обрати мову програмування для бекенд сервісів з урахуванням:

- Високої продуктивності під навантаженням
- Простоти deployment та operations
- Доступності розробників на ринку України
- Швидкості розробки

**Альтернативи:**

1. **Go** - компільована, проста, висока продуктивність
2. **Node.js** - велика екосистема, спільна мова з фронтендом
3. **Java/Kotlin** - зріла екосистема, enterprise ready
4. **Rust** - максимальна продуктивність, memory safety
5. **Python** - швидка розробка, ML екосистема

## Decision

Обрано **Go** як основну мову бекенду.

### Обґрунтування

**Продуктивність:**
- Компільована мова з низьким footprint
- Goroutines для ефективної конкурентності
- Мінімальний memory usage
- Швидкий cold start (важливо для serverless/k8s)

**Developer Experience:**
- Проста мова, швидкий онбординг
- Сильна стандартна бібліотека
- Вбудоване форматування (gofmt)
- Швидка компіляція

**Operational Benefits:**
- Single binary deployment
- Немає runtime dependencies
- Вбудований profiling (pprof)
- Cross-compilation

**Ecosystem:**
- Gin - швидкий HTTP framework
- GORM - ORM для роботи з БД
- Prometheus client - для метрик
- Хороша підтримка cloud providers

### Stack

| Компонент | Бібліотека |
|-----------|------------|
| HTTP Framework | Gin |
| ORM | GORM |
| Configuration | Viper |
| Logging | Zap |
| Validation | go-playground/validator |
| Testing | testify |
| Mocking | mockery |

## Consequences

### Позитивні

- ✅ **Продуктивність**: низький latency, високий throughput
- ✅ **Простота**: легко читати та підтримувати код
- ✅ **Deployment**: прості бінарні файли без залежностей
- ✅ **Observability**: вбудований pprof, хороша інтеграція з Prometheus
- ✅ **Hiring**: зростаючий пул Go розробників в Україні

### Негативні

- ❌ **Verbose**: більше boilerplate коду порівняно з Python/Node
- ❌ **Generics**: нещодавно додані, екосистема ще адаптується
- ❌ **Error handling**: багато повторюваного коду для помилок
- ❌ **ORM limitations**: GORM не такий потужний як Hibernate

### Coding Standards

```go
// Error handling - завжди перевіряти
result, err := doSomething()
if err != nil {
    return fmt.Errorf("doSomething failed: %w", err)
}

// Context - передавати завжди
func (s *Service) GetUser(ctx context.Context, id string) (*User, error)

// Dependency injection - через конструктори
func NewUserService(repo UserRepository, cache Cache) *UserService

// Testing - table-driven tests
func TestCalculatePrice(t *testing.T) {
    tests := []struct {
        name     string
        input    int
        expected int
    }{
        {"zero", 0, 0},
        {"positive", 100, 110},
    }
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            // ...
        })
    }
}
```

## Related Decisions

- [ADR-004: PostgreSQL як основна БД](./ADR-004-postgresql.md)
