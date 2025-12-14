# Runbooks

Операційні процедури для типових сценаріїв.

## Огляд

| Категорія | Runbooks |
|-----------|----------|
| Incidents | High CPU, Memory, Disk |
| Database | Slow queries, Connection issues |
| Services | Restart, Scale, Deploy |
| Recovery | Rollback, Restore |

---

## Incident Response

### INC-001: High CPU Usage

**Симптоми:**
- Alert: `HighCPUUsage`
- Response time збільшився
- Pods throttling

**Діагностика:**

```bash
# 1. Визначити pod з високим CPU
kubectl top pods -n shop --sort-by=cpu

# 2. Перевірити процеси в контейнері
kubectl exec -it <pod-name> -n shop -- top

# 3. Перевірити логи
kubectl logs <pod-name> -n shop --tail=100

# 4. Перевірити метрики
curl -s http://localhost:9090/api/v1/query?query=rate(container_cpu_usage_seconds_total[5m])
```

**Рішення:**

```bash
# Варіант A: Scale up
kubectl scale deployment core --replicas=5 -n shop

# Варіант B: Restart проблемного pod
kubectl delete pod <pod-name> -n shop

# Варіант C: Rollback якщо проблема з'явилась після deploy
kubectl rollout undo deployment/core -n shop

# Варіант D: Increase resource limits
kubectl patch deployment core -n shop -p '{"spec":{"template":{"spec":{"containers":[{"name":"core","resources":{"limits":{"cpu":"1000m"}}}]}}}}'
```

**Постмортем:**
- Перевірити що змінилось (deploy, traffic spike)
- Оптимізувати код якщо потрібно
- Оновити alerts thresholds

---

### INC-002: High Memory Usage

**Симптоми:**
- Alert: `HighMemoryUsage`
- OOMKilled events
- Service restarts

**Діагностика:**

```bash
# 1. Перевірити memory usage
kubectl top pods -n shop --sort-by=memory

# 2. Перевірити OOM events
kubectl get events -n shop | grep -i oom

# 3. Heap dump (Go)
kubectl exec -it <pod-name> -n shop -- curl -o /tmp/heap.prof http://localhost:8080/debug/pprof/heap
kubectl cp shop/<pod-name>:/tmp/heap.prof ./heap.prof
go tool pprof heap.prof
```

**Рішення:**

```bash
# Варіант A: Restart pod
kubectl delete pod <pod-name> -n shop

# Варіант B: Increase memory limits
kubectl patch deployment core -n shop -p '{"spec":{"template":{"spec":{"containers":[{"name":"core","resources":{"limits":{"memory":"1Gi"}}}]}}}}'

# Варіант C: Scale horizontally
kubectl scale deployment core --replicas=5 -n shop
```

---

### INC-003: Disk Space Low

**Симптоми:**
- Alert: `DiskSpaceLow`
- Database errors
- Log write failures

**Діагностика:**

```bash
# 1. Перевірити disk usage
kubectl exec -it postgres-0 -n shop -- df -h

# 2. Знайти великі файли
kubectl exec -it postgres-0 -n shop -- du -sh /* | sort -rh | head -20

# 3. Перевірити PVC
kubectl get pvc -n shop
kubectl describe pvc postgres-data-postgres-0 -n shop
```

**Рішення:**

```bash
# Варіант A: Очистити старі логи
kubectl exec -it postgres-0 -n shop -- find /var/log -name "*.log" -mtime +7 -delete

# Варіант B: VACUUM FULL (PostgreSQL)
kubectl exec -it postgres-0 -n shop -- psql -U shop -d shopdb -c "VACUUM FULL;"

# Варіант C: Resize PVC (якщо підтримується)
kubectl patch pvc postgres-data-postgres-0 -n shop -p '{"spec":{"resources":{"requests":{"storage":"200Gi"}}}}'

# Варіант D: Архівування старих даних
kubectl exec -it postgres-0 -n shop -- psql -U shop -d shopdb -c "DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '90 days';"
```

---

## Database Operations

### DB-001: Slow Queries

**Симптоми:**
- Alert: `SlowQueries`
- High response time
- Database CPU high

**Діагностика:**

```bash
# 1. Знайти повільні запити
kubectl exec -it postgres-0 -n shop -- psql -U shop -d shopdb -c "
SELECT
    pid,
    now() - query_start AS duration,
    query
FROM pg_stat_activity
WHERE state = 'active'
  AND now() - query_start > interval '5 seconds'
ORDER BY duration DESC;
"

# 2. Топ запитів по часу
kubectl exec -it postgres-0 -n shop -- psql -U shop -d shopdb -c "
SELECT
    round(total_exec_time::numeric, 2) as total_time_ms,
    calls,
    round(mean_exec_time::numeric, 2) as avg_time_ms,
    query
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 10;
"

# 3. Перевірити locks
kubectl exec -it postgres-0 -n shop -- psql -U shop -d shopdb -c "
SELECT
    blocked.pid AS blocked_pid,
    blocked.query AS blocked_query,
    blocking.pid AS blocking_pid,
    blocking.query AS blocking_query
FROM pg_stat_activity blocked
JOIN pg_stat_activity blocking ON blocked.wait_event_type = 'Lock';
"
```

**Рішення:**

```bash
# Варіант A: Kill повільний запит
kubectl exec -it postgres-0 -n shop -- psql -U shop -d shopdb -c "SELECT pg_cancel_backend(<pid>);"

# Варіант B: Kill примусово
kubectl exec -it postgres-0 -n shop -- psql -U shop -d shopdb -c "SELECT pg_terminate_backend(<pid>);"

# Варіант C: Створити missing індекс
kubectl exec -it postgres-0 -n shop -- psql -U shop -d shopdb -c "CREATE INDEX CONCURRENTLY idx_orders_customer ON orders(customer_id);"

# Варіант D: ANALYZE таблиці
kubectl exec -it postgres-0 -n shop -- psql -U shop -d shopdb -c "ANALYZE orders;"
```

---

### DB-002: Connection Pool Exhausted

**Симптоми:**
- Alert: `DBConnectionPoolExhausted`
- "too many connections" errors
- Services failing to connect

**Діагностика:**

```bash
# 1. Перевірити кількість з'єднань
kubectl exec -it postgres-0 -n shop -- psql -U shop -d shopdb -c "
SELECT
    count(*) as total,
    count(*) FILTER (WHERE state = 'active') as active,
    count(*) FILTER (WHERE state = 'idle') as idle,
    count(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction
FROM pg_stat_activity
WHERE datname = 'shopdb';
"

# 2. З'єднання по клієнтах
kubectl exec -it postgres-0 -n shop -- psql -U shop -d shopdb -c "
SELECT
    client_addr,
    count(*) as connections
FROM pg_stat_activity
WHERE datname = 'shopdb'
GROUP BY client_addr
ORDER BY connections DESC;
"
```

**Рішення:**

```bash
# Варіант A: Kill idle з'єднання
kubectl exec -it postgres-0 -n shop -- psql -U shop -d shopdb -c "
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle'
  AND query_start < now() - interval '10 minutes';
"

# Варіант B: Restart PgBouncer
kubectl rollout restart deployment/pgbouncer -n shop

# Варіант C: Increase max_connections
kubectl exec -it postgres-0 -n shop -- psql -U postgres -c "ALTER SYSTEM SET max_connections = 300;"
kubectl exec -it postgres-0 -n shop -- psql -U postgres -c "SELECT pg_reload_conf();"

# Варіант D: Scale down та up сервіси
kubectl scale deployment core --replicas=0 -n shop
sleep 30
kubectl scale deployment core --replicas=3 -n shop
```

---

## Service Operations

### SVC-001: Restart Service

**Процедура:**

```bash
# Graceful restart (rolling)
kubectl rollout restart deployment/core -n shop

# Перевірка статусу
kubectl rollout status deployment/core -n shop

# Якщо потрібен hard restart
kubectl delete pods -l app=core -n shop
```

---

### SVC-002: Scale Service

**Процедура:**

```bash
# Manual scaling
kubectl scale deployment/core --replicas=5 -n shop

# Або через HPA
kubectl patch hpa core-hpa -n shop -p '{"spec":{"minReplicas":5,"maxReplicas":15}}'

# Перевірка
kubectl get hpa -n shop
kubectl get pods -l app=core -n shop
```

---

### SVC-003: Deploy New Version

**Процедура:**

```bash
# 1. Перевірити поточну версію
kubectl get deployment core -n shop -o jsonpath='{.spec.template.spec.containers[0].image}'

# 2. Update image
kubectl set image deployment/core core=ghcr.io/org/shop-core:v2.1.0 -n shop

# 3. Моніторинг rollout
kubectl rollout status deployment/core -n shop

# 4. Перевірка
kubectl get pods -l app=core -n shop
curl https://api.yourstore.com/health

# 5. Якщо проблеми - rollback
kubectl rollout undo deployment/core -n shop
```

---

### SVC-004: Emergency Rollback

**Процедура:**

```bash
# 1. Негайний rollback
kubectl rollout undo deployment/core -n shop

# 2. Перевірка
kubectl rollout status deployment/core -n shop

# 3. Якщо потрібна конкретна версія
kubectl rollout history deployment/core -n shop
kubectl rollout undo deployment/core --to-revision=3 -n shop

# 4. Notify team
curl -X POST -H 'Content-type: application/json' \
    --data '{"text":"Emergency rollback performed on core service"}' \
    $SLACK_WEBHOOK_URL
```

---

## Recovery Operations

### REC-001: Restore Database from Backup

**Процедура:**

```bash
# 1. Зупинити сервіси
kubectl scale deployment --all --replicas=0 -n shop

# 2. Список доступних backup
aws s3 ls s3://shop-backups/postgres/ | tail -10

# 3. Download backup
aws s3 cp s3://shop-backups/postgres/shopdb_20240115_020000.sql.gz /tmp/

# 4. Restore
kubectl exec -it postgres-0 -n shop -- bash
gunzip -c /tmp/shopdb_20240115_020000.sql.gz | psql -U shop -d shopdb

# 5. Verify
psql -U shop -d shopdb -c "SELECT count(*) FROM orders;"

# 6. Restart сервіси
kubectl scale deployment --all --replicas=3 -n shop

# 7. Перевірка
curl https://api.yourstore.com/health
```

---

### REC-002: Redis Recovery

**Процедура:**

```bash
# 1. Перевірити статус
kubectl exec -it redis-0 -n shop -- redis-cli ping

# 2. Якщо Redis не відповідає - restart
kubectl delete pod redis-0 -n shop

# 3. Якщо потрібне відновлення з backup
aws s3 cp s3://shop-backups/redis/dump_latest.rdb.gz /tmp/
gunzip /tmp/dump_latest.rdb.gz
kubectl cp /tmp/dump_latest.rdb shop/redis-0:/data/dump.rdb
kubectl delete pod redis-0 -n shop

# 4. Перевірка
kubectl exec -it redis-0 -n shop -- redis-cli dbsize
```

---

### REC-003: Elasticsearch Recovery

**Процедура:**

```bash
# 1. Перевірити cluster health
curl -s http://elasticsearch:9200/_cluster/health?pretty

# 2. Якщо red - перевірити shards
curl -s http://elasticsearch:9200/_cat/shards?v | grep -v STARTED

# 3. Reroute unassigned shards
curl -X POST "http://elasticsearch:9200/_cluster/reroute?retry_failed=true"

# 4. Якщо потрібен reindex
curl -X DELETE "http://elasticsearch:9200/products"
# Run reindex job
kubectl create job --from=cronjob/reindex-products reindex-now -n shop

# 5. Restore from snapshot
curl -X POST "http://elasticsearch:9200/_snapshot/s3_backup/snapshot_20240115/_restore" \
    -H 'Content-Type: application/json' -d'
{
    "indices": "products,orders",
    "ignore_unavailable": true
}'
```

---

## Maintenance Operations

### MAINT-001: Database Maintenance

**Weekly:**

```bash
# VACUUM ANALYZE
kubectl exec -it postgres-0 -n shop -- psql -U shop -d shopdb -c "VACUUM ANALYZE;"

# Reindex (during low traffic)
kubectl exec -it postgres-0 -n shop -- psql -U shop -d shopdb -c "REINDEX DATABASE shopdb;"
```

**Monthly:**

```bash
# VACUUM FULL (requires downtime or replica)
kubectl exec -it postgres-0 -n shop -- psql -U shop -d shopdb -c "VACUUM FULL orders;"
```

---

### MAINT-002: Log Rotation

**Процедура:**

```bash
# Kubernetes автоматично ротує логи, але для custom логів:

# Очистка логів старше 7 днів
kubectl exec -it <pod> -n shop -- find /var/log/app -name "*.log" -mtime +7 -delete

# Ротація активного лога
kubectl exec -it <pod> -n shop -- bash -c "mv /var/log/app/app.log /var/log/app/app.log.1 && kill -USR1 1"
```

---

### MAINT-003: Certificate Renewal

**Процедура:**

```bash
# Cert-manager автоматично оновлює сертифікати
# Перевірка статусу:

kubectl get certificates -n shop
kubectl describe certificate shop-tls -n shop

# Примусове оновлення:
kubectl delete secret shop-tls -n shop
# cert-manager автоматично створить новий
```

---

## Contacts

### Escalation Path

| Level | Contact | Response Time |
|-------|---------|---------------|
| L1 | On-call engineer | 15 min |
| L2 | Team lead | 30 min |
| L3 | CTO | 1 hour |

### External Contacts

| Service | Contact |
|---------|---------|
| AWS Support | aws-support@company.com |
| LiqPay Support | support@liqpay.ua |
| Nova Poshta API | api@novaposhta.ua |

---

## Templates

### Incident Report Template

```markdown
# Incident Report: [TITLE]

**Date:** YYYY-MM-DD
**Duration:** HH:MM - HH:MM
**Severity:** P1/P2/P3
**Lead:** [Name]

## Summary
Brief description of what happened.

## Timeline
- HH:MM - Alert triggered
- HH:MM - Investigation started
- HH:MM - Root cause identified
- HH:MM - Fix deployed
- HH:MM - Resolved

## Root Cause
What caused the incident.

## Impact
- Users affected: X
- Revenue impact: $X
- SLA impact: X%

## Resolution
What was done to fix it.

## Action Items
- [ ] Action 1 - Owner - Due date
- [ ] Action 2 - Owner - Due date

## Lessons Learned
What we learned and how to prevent this in the future.
```
