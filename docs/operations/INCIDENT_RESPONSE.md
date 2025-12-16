# Incident Response

Процедури реагування на інциденти та збої.

## Incident Severity Levels

| Level | Name | Description | Response Time | Examples |
|-------|------|-------------|---------------|----------|
| SEV1 | Critical | Повна недоступність | 15 хв | Сайт лежить, платежі не працюють |
| SEV2 | Major | Серйозна деградація | 30 хв | Пошук не працює, повільна робота |
| SEV3 | Minor | Часткові проблеми | 4 год | Один модуль не працює |
| SEV4 | Low | Мінімальний вплив | 24 год | Косметичні баги |

## Incident Response Process

```
┌─────────────────────────────────────────────────────────────────┐
│                    INCIDENT LIFECYCLE                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   │
│   │ Detection│──▶│ Triage   │──▶│ Response │──▶│ Recovery │   │
│   └──────────┘   └──────────┘   └──────────┘   └──────────┘   │
│                                                    │            │
│                                                    ▼            │
│                                           ┌──────────────┐     │
│                                           │ Post-mortem  │     │
│                                           └──────────────┘     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## 1. Detection

### Alert Channels
- Prometheus/Alertmanager alerts
- User reports (support tickets)
- Synthetic monitoring
- APM tools (Sentry, Datadog)

### Initial Assessment
```
□ Який сервіс затронуто?
□ Скільки користувачів постраждало?
□ Коли почалась проблема?
□ Чи є пов'язані алерти?
□ Чи були нещодавні деплої?
```

## 2. Triage

### Determine Severity

| Criteria | SEV1 | SEV2 | SEV3 | SEV4 |
|----------|------|------|------|------|
| User Impact | >50% | 10-50% | <10% | Minimal |
| Revenue Impact | Direct loss | Potential loss | Minor | None |
| Data Loss | Yes | Possible | No | No |

### Communication Template

```
🚨 INCIDENT DECLARED

Severity: SEV1
Title: [Brief description]
Impact: [Who/what is affected]
Start Time: [When detected]
Incident Lead: [Name]
Status: Investigating

Updates will be posted every 30 minutes.
```

## 3. Response

### Assemble Response Team

| Role | Responsibility |
|------|----------------|
| Incident Commander | Координація, рішення |
| Tech Lead | Технічне розслідування |
| Communications | Інформування стейкхолдерів |
| Scribe | Документування |

### Investigation Checklist

```
□ Check recent deployments
  git log --oneline -10 --all

□ Check error logs
  kubectl logs -f deployment/core-service --tail=100

□ Check metrics
  - Error rate
  - Latency
  - Resource usage

□ Check external dependencies
  - Database
  - Redis
  - Elasticsearch
  - External APIs

□ Check infrastructure
  - Kubernetes pods
  - Network
  - DNS
```

### Common Issues & Quick Fixes

| Issue | Check | Quick Fix |
|-------|-------|-----------|
| High CPU | `top`, metrics | Scale up, restart |
| Memory leak | `free -m`, metrics | Restart service |
| DB connections | `pg_stat_activity` | Restart, increase pool |
| Disk full | `df -h` | Clean logs, expand |
| DNS issues | `dig`, `nslookup` | Flush cache |
| Certificate | `openssl s_client` | Renew cert |

### Escalation Path

```
Level 1: On-call Engineer (0-15 min)
    ↓
Level 2: Team Lead (15-30 min)
    ↓
Level 3: Engineering Manager (30-60 min)
    ↓
Level 4: CTO (60+ min)
```

## 4. Recovery

### Mitigation Options

1. **Rollback** - Повернути попередню версію
   ```bash
   kubectl rollout undo deployment/core-service
   ```

2. **Scale** - Збільшити ресурси
   ```bash
   kubectl scale deployment/core-service --replicas=5
   ```

3. **Restart** - Перезапустити сервіс
   ```bash
   kubectl rollout restart deployment/core-service
   ```

4. **Feature Flag** - Вимкнути проблемну функцію
   ```bash
   curl -X POST /api/admin/features/disable/search
   ```

5. **Traffic Shift** - Перенаправити трафік
   ```bash
   kubectl apply -f backup-ingress.yaml
   ```

### Verification

```
□ Error rate normalized
□ Latency returned to baseline
□ User reports stopped
□ All health checks passing
□ Synthetic monitoring green
```

### Resolution Communication

```
✅ INCIDENT RESOLVED

Title: [Brief description]
Duration: [Start] - [End] ([Total time])
Impact: [Summary of user impact]
Root Cause: [Brief explanation]
Resolution: [What was done]

Full post-mortem will follow within 48 hours.
```

## 5. Post-Mortem

### Template

```markdown
# Post-Mortem: [Incident Title]

## Summary
- **Date**: YYYY-MM-DD
- **Duration**: X hours Y minutes
- **Severity**: SEV1
- **Impact**: [User/business impact]

## Timeline
- HH:MM - [Event]
- HH:MM - [Event]
- ...

## Root Cause
[Detailed technical explanation]

## Contributing Factors
1. [Factor 1]
2. [Factor 2]

## What Went Well
- [Item 1]
- [Item 2]

## What Could Be Improved
- [Item 1]
- [Item 2]

## Action Items
| Action | Owner | Due Date | Status |
|--------|-------|----------|--------|
| [Action 1] | [Name] | [Date] | [ ] |
| [Action 2] | [Name] | [Date] | [ ] |

## Lessons Learned
[Key takeaways]
```

### Blameless Culture

- Фокус на системах, не на людях
- Помилки = можливості для навчання
- Відкрите обговорення
- Конструктивні висновки

## On-Call Rotation

### Schedule
- Primary: 1 тиждень
- Secondary: backup

### Responsibilities
- Моніторинг алертів
- Перша лінія реагування
- Ескалація при потребі
- Документування інцидентів

### Handoff Checklist
```
□ Активні інциденти
□ Відкриті тікети
□ Заплановані зміни
□ Відомі проблеми
```

## Tools & Resources

### Runbooks
- [High Error Rate](../guides/RUNBOOKS.md#high-error-rate)
- [Database Issues](../guides/RUNBOOKS.md#database-issues)
- [Memory Leak](../guides/RUNBOOKS.md#memory-leak)

### Dashboards
- Service Overview: `https://grafana.shop.ua/d/overview`
- Infrastructure: `https://grafana.shop.ua/d/infra`

### Contact List
| Role | Name | Phone | Slack |
|------|------|-------|-------|
| Incident Commander | [Name] | +380... | @name |
| Database DBA | [Name] | +380... | @name |
| Infrastructure | [Name] | +380... | @name |

## See Also

- [Monitoring Setup](./MONITORING_SETUP.md)
- [Alerting Rules](./ALERTING_RULES.md)
- [Disaster Recovery](./DISASTER_RECOVERY.md)
- [Runbooks](../guides/RUNBOOKS.md)
