# Game Day Runbook

Цей документ описує процедуру проведення Game Day — контрольованого тестування стійкості системи під час симульованих збоїв.

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           GAME DAY ARCHITECTURE                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │   k6 Load   │    │ Chaos Mesh  │    │  Grafana    │    │   Alerts    │  │
│  │   Tests     │    │ Experiments │    │  Dashboard  │    │   PagerDuty │  │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘    └──────┬──────┘  │
│         │                  │                  │                  │          │
│         ▼                  ▼                  ▼                  ▼          │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        SHOP PLATFORM                                 │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐   │   │
│  │  │  Core   │  │   OMS   │  │   CRM   │  │ Notify  │  │  Store  │   │   │
│  │  │   API   │◄─┤ Service │◄─┤ Service │  │ Service │  │  front  │   │   │
│  │  └────┬────┘  └────┬────┘  └─────────┘  └─────────┘  └─────────┘   │   │
│  │       │            │                                                │   │
│  │       ▼            ▼                                                │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐                │   │
│  │  │ Postgres│  │  Redis  │  │RabbitMQ │  │ Elastic │                │   │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Pre-Game Day Checklist

### 1. Підготовка середовища

```bash
# Переконайтеся, що ви на staging/sandbox кластері
kubectl config current-context

# Перевірте стан подів
kubectl get pods -n shop

# Перевірте, що Chaos Mesh встановлено
kubectl get pods -n chaos-mesh

# Перевірте доступність Grafana
curl -s http://grafana.shop.example.com/api/health
```

### 2. Підготовка моніторингу

- [ ] Відкрийте Grafana dashboard: `SRE Battle Dashboard`
- [ ] Налаштуйте часовий діапазон: Last 1 hour, Auto-refresh 10s
- [ ] Відкрийте Jaeger для трейсів
- [ ] Підготуйте Slack канал `#game-day-live`

### 3. Оповіщення команди

```
🎮 GAME DAY STARTING

Дата: [DATE]
Час: [TIME] - [END_TIME]
Середовище: Staging
Ведучий: [NAME]

Очікувані експерименти:
1. Pod failure (OMS service)
2. Network latency injection
3. CPU stress test

Dashboards: [LINK]
```

## Game Day Scenarios

### Scenario 1: OMS Service Failure

**Гіпотеза:** Якщо OMS сервіс недоступний, checkout повинен повернути зрозуміле повідомлення про помилку, а не "білий екран". Circuit breaker повинен спрацювати протягом 30 секунд.

**SLO Target:**
- 95% успішних замовлень протягом тесту
- Час відновлення < 60 секунд

#### Кроки виконання:

```bash
# 1. Запустіть базовий load test
k6 run --env API_URL=https://staging-api.shop.example.com \
       tests/load/chaos-battle-test.js &

# 2. Зачекайте 2 хвилини для стабілізації baseline

# 3. Запустіть chaos experiment
kubectl apply -f infrastructure/kubernetes/chaos-mesh/experiments/pod-chaos.yaml

# 4. Спостерігайте за метриками (5 хвилин)
# - Circuit breaker status
# - Error rate
# - Order success rate

# 5. Видаліть experiment
kubectl delete -f infrastructure/kubernetes/chaos-mesh/experiments/pod-chaos.yaml

# 6. Спостерігайте за відновленням (5 хвилин)
```

#### Очікувані результати:

| Метрика | Очікування | Критичне значення |
|---------|------------|-------------------|
| Error Rate | < 5% | > 10% = FAIL |
| Order Success | > 95% | < 90% = FAIL |
| Circuit Breaker Trip Time | < 30s | > 60s = FAIL |
| Recovery Time | < 60s | > 120s = FAIL |

#### Запитання для обговорення:

1. Чи отримав користувач зрозуміле повідомлення про помилку?
2. Чи були втрачені замовлення?
3. Чи спрацював retry механізм?
4. Чи з'явився alert у PagerDuty?

---

### Scenario 2: Database Latency

**Гіпотеза:** При збільшенні latency до БД на 2 секунди, система повинна переключитися на read replica або повернути cached дані.

**SLO Target:**
- p95 latency < 3 секунди
- Читання продуктів працює без помилок

#### Кроки виконання:

```bash
# 1. Запустіть load test з фокусом на read операції
k6 run --env API_URL=https://staging-api.shop.example.com \
       --env SCENARIO=browse \
       tests/load/chaos-battle-test.js &

# 2. Застосуйте network chaos
kubectl apply -f - <<EOF
apiVersion: chaos-mesh.org/v1alpha1
kind: NetworkChaos
metadata:
  name: db-latency
  namespace: shop
spec:
  action: delay
  mode: all
  selector:
    namespaces:
      - shop
    labelSelectors:
      app: postgres
  delay:
    latency: "2000ms"
    jitter: "500ms"
  duration: "5m"
EOF

# 3. Спостерігайте за метриками

# 4. Видаліть experiment
kubectl delete networkchaos db-latency -n shop
```

#### Очікувані результати:

| Метрика | Очікування | Критичне значення |
|---------|------------|-------------------|
| Product List p95 | < 3s | > 5s = FAIL |
| Cache Hit Rate | > 80% | < 50% = FAIL |
| Error Rate | < 1% | > 5% = FAIL |

---

### Scenario 3: Memory Pressure

**Гіпотеза:** При збільшенні memory pressure, pod повинен бути перезапущений через OOMKilled, а новий pod повинен підхопити трафік без втрати замовлень.

#### Кроки виконання:

```bash
# 1. Запустіть stress chaos
kubectl apply -f infrastructure/kubernetes/chaos-mesh/experiments/stress-chaos.yaml

# 2. Спостерігайте за pod restarts
watch kubectl get pods -n shop -l app=core-service

# 3. Перевірте, чи VPA змінив requests
kubectl describe vpa core-service-vpa -n shop

# 4. Видаліть experiment
kubectl delete -f infrastructure/kubernetes/chaos-mesh/experiments/stress-chaos.yaml
```

---

### Scenario 4: Full Checkout Under Chaos

**Гіпотеза:** Навіть при комбінації chaos experiments, система повинна обробити 95% замовлень.

#### Кроки виконання:

```bash
# 1. Запустіть повний battle test
k6 run --env API_URL=https://staging-api.shop.example.com \
       --env CHAOS_ACTIVE=true \
       tests/load/chaos-battle-test.js

# 2. Паралельно запустіть workflow
kubectl apply -f infrastructure/kubernetes/chaos-mesh/experiments/workflow.yaml

# 3. Дочекайтеся завершення тесту (15 хвилин)

# 4. Зберіть результати
cat tests/load/chaos-battle-results.txt
```

## Post-Game Day

### 1. Зберіть артефакти

```bash
# Експортуйте Grafana dashboard snapshot
curl -X POST http://grafana.shop.example.com/api/snapshots \
     -H "Content-Type: application/json" \
     -d '{"dashboard": {...}, "name": "GameDay-2024-01-15"}'

# Збережіть k6 результати
cp tests/load/chaos-battle-results.json \
   docs/operations/game-day-results/$(date +%Y-%m-%d)/

# Збережіть pod logs
kubectl logs -n shop -l app=core-service --since=2h > \
   docs/operations/game-day-results/$(date +%Y-%m-%d)/core-service.log
```

### 2. Заповніть Post-Mortem Template

```markdown
## Game Day Post-Mortem: [DATE]

### Учасники
- Ведучий: [NAME]
- SRE: [NAME]
- Backend: [NAME]

### Результати експериментів

| Scenario | Status | Notes |
|----------|--------|-------|
| OMS Failure | ✅ PASS | Circuit breaker спрацював за 15s |
| DB Latency | ⚠️ PARTIAL | Cache miss rate вищий за очікуваний |
| Memory Pressure | ✅ PASS | VPA автоматично збільшив limits |
| Full Checkout | ✅ PASS | 97% success rate |

### Виявлені проблеми

1. **Issue:** [Description]
   - **Severity:** P2
   - **Action:** [Jira ticket]
   - **Owner:** [Name]

### Action Items

- [ ] Збільшити cache TTL для product catalog
- [ ] Додати retry для OMS calls
- [ ] Оновити alerting thresholds
```

### 3. Schedule Follow-up

- Створіть Jira tickets для виявлених проблем
- Заплануйте наступний Game Day через 4 тижні
- Поділіться результатами з командою

## Emergency Procedures

### Abort Game Day

Якщо ситуація вийшла з-під контролю:

```bash
# 1. Видаліть всі chaos experiments
kubectl delete --all podchaos,networkchaos,stresschaos,iochaos,httpchaos -n shop

# 2. Зупиніть k6
pkill k6

# 3. Перевірте стан системи
kubectl get pods -n shop

# 4. Якщо потрібно, rollback deployments
kubectl rollout restart deployment -n shop
```

### Escalation

| Рівень | Умова | Дія |
|--------|-------|-----|
| L1 | Error rate > 10% | Зупиніть поточний experiment |
| L2 | Error rate > 20% | Abort Game Day |
| L3 | Повний outage | Виклик on-call SRE |

## Appendix

### Корисні команди

```bash
# Перегляд chaos experiments
kubectl get podchaos,networkchaos,stresschaos -A

# Logs chaos mesh controller
kubectl logs -n chaos-mesh -l app.kubernetes.io/component=controller-manager

# Real-time pod status
watch -n 1 'kubectl get pods -n shop -o wide'

# Database connections
kubectl exec -n shop deploy/core-service -- env | grep DATABASE
```

### Посилання

- [Grafana Dashboard](https://grafana.shop.example.com/d/sre-battle-dashboard)
- [Jaeger](https://jaeger.shop.example.com)
- [Chaos Mesh Dashboard](https://chaos-mesh.shop.example.com)
- [k6 Cloud](https://app.k6.io)
