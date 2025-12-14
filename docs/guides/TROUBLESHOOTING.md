# Troubleshooting Guide

Керівництво з вирішення типових проблем.

## Діагностика

### Перевірка здоров'я сервісів

```bash
# Health check endpoints
curl http://localhost:8080/health
curl http://localhost:8081/health  # OMS
curl http://localhost:8082/health  # CRM

# Детальна інформація
curl http://localhost:8080/health/ready
curl http://localhost:8080/health/live
```

### Логи

```bash
# Docker Compose
docker compose logs -f core
docker compose logs -f oms
docker compose logs --tail=100 postgres

# Kubernetes
kubectl logs -f deployment/core-service -n shop
kubectl logs -f deployment/oms-service -n shop --since=1h

# Пошук помилок
docker compose logs | grep -i error
kubectl logs deployment/core-service | grep -E "(ERROR|FATAL)"
```

### Метрики

```bash
# Prometheus metrics
curl http://localhost:8080/metrics

# Перевірка конкретних метрик
curl -s http://localhost:8080/metrics | grep http_requests_total
curl -s http://localhost:8080/metrics | grep database_connections
```

## Проблеми з базою даних

### PostgreSQL не запускається

**Симптоми:**
```
FATAL: could not create lock file "/var/run/postgresql/.s.PGSQL.5432.lock"
```

**Рішення:**
```bash
# Перевірка процесів
ps aux | grep postgres

# Зупинка старого процесу
sudo pkill postgres

# Очищення lock файлів
sudo rm -f /var/run/postgresql/.s.PGSQL.5432.lock

# Перезапуск
docker compose restart postgres
```

### Connection refused

**Симптоми:**
```
dial tcp 127.0.0.1:5432: connect: connection refused
```

**Рішення:**
```bash
# Перевірка статусу
docker compose ps postgres

# Перевірка логів
docker compose logs postgres

# Перезапуск
docker compose up -d postgres

# Очікування готовності
until docker compose exec postgres pg_isready; do sleep 1; done
```

### Too many connections

**Симптоми:**
```
FATAL: too many connections for role "app_user"
```

**Рішення:**
```bash
# Перевірка активних з'єднань
docker compose exec postgres psql -U postgres -c "SELECT count(*) FROM pg_stat_activity;"

# Закриття неактивних
docker compose exec postgres psql -U postgres -c "
  SELECT pg_terminate_backend(pid)
  FROM pg_stat_activity
  WHERE state = 'idle'
  AND query_start < now() - interval '10 minutes';
"

# Збільшення ліміту (postgresql.conf)
max_connections = 200

# Перезапуск
docker compose restart postgres
```

### Slow queries

**Діагностика:**
```sql
-- Активні запити
SELECT pid, now() - query_start AS duration, query
FROM pg_stat_activity
WHERE state = 'active'
ORDER BY duration DESC;

-- Запити довше 5 секунд
SELECT pid, query, now() - query_start AS duration
FROM pg_stat_activity
WHERE state = 'active' AND now() - query_start > interval '5 seconds';

-- Заблоковані запити
SELECT blocked.pid, blocked.query, blocking.pid AS blocking_pid
FROM pg_stat_activity blocked
JOIN pg_stat_activity blocking ON blocked.wait_event_type = 'Lock';
```

**Рішення:**
```sql
-- Скасування повільного запиту
SELECT pg_cancel_backend(pid);

-- Примусове завершення
SELECT pg_terminate_backend(pid);

-- Аналіз запиту
EXPLAIN ANALYZE SELECT ...;

-- Створення індексу
CREATE INDEX CONCURRENTLY idx_orders_customer ON orders(customer_id);
```

## Проблеми з Redis

### Redis недоступний

**Симптоми:**
```
dial tcp: lookup redis: no such host
```

**Рішення:**
```bash
# Перевірка
docker compose ps redis
docker compose logs redis

# Тест з'єднання
docker compose exec redis redis-cli ping

# Перезапуск
docker compose restart redis
```

### Memory issues

**Симптоми:**
```
OOM command not allowed when used memory > 'maxmemory'
```

**Рішення:**
```bash
# Перевірка пам'яті
docker compose exec redis redis-cli info memory

# Очищення кешу
docker compose exec redis redis-cli FLUSHDB

# Збільшення ліміту (redis.conf)
maxmemory 512mb
maxmemory-policy allkeys-lru

# Перезапуск
docker compose restart redis
```

## Проблеми з RabbitMQ

### Queue not found

**Симптоми:**
```
NOT_FOUND - no queue 'order.created' in vhost '/'
```

**Рішення:**
```bash
# Перевірка черг
docker compose exec rabbitmq rabbitmqctl list_queues

# Перезапуск consumer для створення черг
docker compose restart core

# Ручне створення через Management UI
# http://localhost:15672
```

### Messages stuck in queue

**Діагностика:**
```bash
# Кількість повідомлень
docker compose exec rabbitmq rabbitmqctl list_queues name messages

# Детальна інформація
docker compose exec rabbitmq rabbitmqctl list_queues name messages consumers
```

**Рішення:**
```bash
# Перезапуск consumers
docker compose restart core oms notification

# Очищення черги
docker compose exec rabbitmq rabbitmqctl purge_queue order.created

# Перевірка dead letter queue
docker compose exec rabbitmq rabbitmqctl list_queues name messages | grep dead
```

### Connection refused

```bash
# Перевірка порту
nc -zv localhost 5672

# Перевірка користувача
docker compose exec rabbitmq rabbitmqctl authenticate_user guest guest

# Логи
docker compose logs rabbitmq | grep -i error
```

## Проблеми з Elasticsearch

### Cluster health yellow/red

**Діагностика:**
```bash
curl -X GET "localhost:9200/_cluster/health?pretty"
curl -X GET "localhost:9200/_cat/indices?v"
curl -X GET "localhost:9200/_cat/shards?v"
```

**Рішення (yellow - unassigned replicas):**
```bash
# Для single-node
curl -X PUT "localhost:9200/products/_settings" -H 'Content-Type: application/json' -d'
{
  "index": {
    "number_of_replicas": 0
  }
}'
```

### Out of disk space

```bash
# Перевірка
curl -X GET "localhost:9200/_cat/allocation?v"

# Очищення старих індексів
curl -X DELETE "localhost:9200/logs-2023-*"

# Зміна watermark
curl -X PUT "localhost:9200/_cluster/settings" -H 'Content-Type: application/json' -d'
{
  "transient": {
    "cluster.routing.allocation.disk.watermark.low": "90%",
    "cluster.routing.allocation.disk.watermark.high": "95%"
  }
}'
```

### Search timeout

```bash
# Збільшення timeout
curl -X GET "localhost:9200/products/_search?timeout=30s" -H 'Content-Type: application/json' -d'
{
  "query": { "match_all": {} }
}'

# Оптимізація індексу
curl -X POST "localhost:9200/products/_forcemerge?max_num_segments=1"
```

## Проблеми з API

### 401 Unauthorized

**Перевірка:**
```bash
# Декодування JWT
echo "eyJhbGci..." | cut -d'.' -f2 | base64 -d | jq

# Перевірка терміну дії
# exp - Unix timestamp
```

**Рішення:**
- Оновити access token через refresh token
- Перевірити JWT_SECRET в конфігурації
- Перевірити системний час на сервері

### 403 Forbidden

**Перевірка:**
```bash
# Перевірка ролей користувача
curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/v1/me
```

**Рішення:**
- Перевірити RBAC permissions
- Переконатися в правильному tenant_id

### 429 Too Many Requests

**Рішення:**
```bash
# Перевірка rate limit headers
curl -I http://localhost:8080/api/v1/products

# X-RateLimit-Remaining: 95
# X-RateLimit-Reset: 1704096060

# Очікування до reset або збільшення ліміту
```

### 500 Internal Server Error

**Діагностика:**
```bash
# Перевірка логів
docker compose logs --tail=50 core | grep -A5 "500"

# Перевірка request_id
curl -v http://localhost:8080/api/v1/products
# X-Request-ID: abc123

# Пошук в логах
docker compose logs core | grep "abc123"
```

### 502 Bad Gateway / 504 Gateway Timeout

**Перевірка:**
```bash
# Статус backend сервісів
curl http://localhost:8080/health

# Перевірка nginx/traefik
docker compose logs nginx
docker compose logs traefik

# Збільшення timeout
# nginx.conf: proxy_read_timeout 60s;
```

## Проблеми з Docker

### Container keeps restarting

```bash
# Перевірка причини
docker compose ps
docker compose logs core --tail=50

# Перевірка ресурсів
docker stats

# Перевірка exit code
docker inspect core --format='{{.State.ExitCode}}'
# Exit code 137 = OOM killed
# Exit code 1 = Application error
```

### Out of disk space

```bash
# Перевірка
docker system df

# Очищення
docker system prune -a --volumes

# Видалення невикористаних images
docker image prune -a

# Видалення volumes
docker volume prune
```

### Network issues

```bash
# Перевірка мережі
docker network ls
docker network inspect shop_default

# Перевірка DNS
docker compose exec core nslookup postgres
docker compose exec core ping postgres

# Перезапуск мережі
docker compose down
docker network rm shop_default
docker compose up -d
```

## Проблеми з Kubernetes

### Pod не запускається

```bash
# Статус
kubectl get pods -n shop
kubectl describe pod core-service-xxx -n shop

# Логи init containers
kubectl logs core-service-xxx -c init-db -n shop

# Events
kubectl get events -n shop --sort-by='.lastTimestamp'
```

### CrashLoopBackOff

```bash
# Логи попередньої версії
kubectl logs core-service-xxx -n shop --previous

# Перевірка ресурсів
kubectl top pods -n shop

# Опис проблеми
kubectl describe pod core-service-xxx -n shop | grep -A10 "State:"
```

### ImagePullBackOff

```bash
# Перевірка image
kubectl describe pod xxx | grep -A5 "Image:"

# Перевірка secrets
kubectl get secrets -n shop
kubectl describe secret regcred -n shop

# Створення secret для registry
kubectl create secret docker-registry regcred \
  --docker-server=ghcr.io \
  --docker-username=xxx \
  --docker-password=xxx
```

### PVC Pending

```bash
# Статус
kubectl get pvc -n shop
kubectl describe pvc postgres-data -n shop

# Перевірка storage class
kubectl get storageclass
kubectl describe storageclass standard
```

## Performance Issues

### High CPU Usage

```bash
# Ідентифікація
docker stats
kubectl top pods -n shop

# Profiling (Go)
curl http://localhost:8080/debug/pprof/profile?seconds=30 > cpu.prof
go tool pprof cpu.prof

# Типові причини:
# - Нескінченні цикли
# - Неоптимізовані запити
# - Відсутні індекси
```

### High Memory Usage

```bash
# Heap dump (Go)
curl http://localhost:8080/debug/pprof/heap > heap.prof
go tool pprof heap.prof

# Перевірка goroutines
curl http://localhost:8080/debug/pprof/goroutine?debug=1
```

### Slow Response Times

**Трейсинг:**
```bash
# Request з trace
curl -H "X-Request-ID: test123" http://localhost:8080/api/v1/products

# Пошук в логах
docker compose logs | grep "test123"

# Jaeger UI
# http://localhost:16686
```

**Типові причини:**
- N+1 queries
- Відсутні індекси
- Великі payload
- External API delays

## Відновлення даних

### Backup PostgreSQL

```bash
# Створення backup
docker compose exec postgres pg_dump -U postgres shopdb > backup.sql

# Відновлення
docker compose exec -T postgres psql -U postgres shopdb < backup.sql
```

### Backup Redis

```bash
# Snapshot
docker compose exec redis redis-cli BGSAVE

# Копіювання dump.rdb
docker compose cp redis:/data/dump.rdb ./backup/
```

### Відновлення з backup

```bash
# Зупинка сервісів
docker compose stop core oms

# Відновлення PostgreSQL
docker compose exec -T postgres psql -U postgres -c "DROP DATABASE shopdb;"
docker compose exec -T postgres psql -U postgres -c "CREATE DATABASE shopdb;"
docker compose exec -T postgres psql -U postgres shopdb < backup.sql

# Відновлення Redis
docker compose stop redis
docker compose cp ./backup/dump.rdb redis:/data/
docker compose start redis

# Запуск сервісів
docker compose start core oms
```

## Контакти підтримки

| Рівень | Канал | Час відповіді |
|--------|-------|---------------|
| Critical | PagerDuty | 15 хв |
| High | Slack #incidents | 1 год |
| Normal | Jira | 24 год |
| Low | Email | 72 год |

## Корисні команди

```bash
# Швидкий restart всього
docker compose down && docker compose up -d

# Повне очищення
docker compose down -v --remove-orphans
docker system prune -af
docker compose up -d --build

# Логи всіх сервісів в один файл
docker compose logs > all-logs.txt 2>&1

# Моніторинг в реальному часі
watch -n 1 'docker compose ps'
watch -n 1 'kubectl get pods -n shop'
```
