# Service Level Agreement (SLA)

Угода про рівень обслуговування для Shop Platform.

## Огляд

| Метрика | Target | Measurement |
|---------|--------|-------------|
| Availability | 99.9% | Monthly |
| Response Time (P95) | < 200ms | 5-minute average |
| Error Rate | < 0.1% | Hourly |
| Time to Recovery | < 30 min | Per incident |

---

## 1. Availability

### Definition

**Availability** = (Total Minutes - Downtime Minutes) / Total Minutes × 100%

### Targets

| Tier | Availability | Downtime/Month | Downtime/Year |
|------|--------------|----------------|---------------|
| **Tier 1** (Production) | 99.9% | ~43 min | ~8.7 hours |
| **Tier 2** (Staging) | 99% | ~7.3 hours | ~3.6 days |
| **Tier 3** (Dev) | 95% | ~36 hours | ~18 days |

### Exclusions

Downtime не враховується для:
- Scheduled maintenance (з попередженням за 7 днів)
- Third-party service outages (LiqPay, Nova Poshta)
- Force majeure events
- Customer-caused issues

### Maintenance Windows

| Environment | Window | Frequency |
|-------------|--------|-----------|
| Production | Sun 02:00-04:00 UTC | Weekly |
| Staging | Daily 00:00-06:00 UTC | Daily |

---

## 2. Performance

### Response Time SLOs

| Endpoint | P50 | P95 | P99 |
|----------|-----|-----|-----|
| Product List | 50ms | 150ms | 300ms |
| Product Detail | 30ms | 100ms | 200ms |
| Search | 50ms | 150ms | 300ms |
| Cart Operations | 30ms | 100ms | 200ms |
| Checkout | 100ms | 300ms | 500ms |
| Payment Init | 200ms | 500ms | 1s |

### Throughput

| Metric | Target |
|--------|--------|
| Requests per second | > 1000 RPS |
| Concurrent users | > 5000 |
| Order processing | > 100 orders/min |

### Database

| Metric | Target |
|--------|--------|
| Query P95 | < 50ms |
| Connection pool usage | < 80% |
| Replication lag | < 1s |

---

## 3. Error Rates

### HTTP Errors

| Error Type | Target |
|------------|--------|
| 5xx errors | < 0.1% |
| 4xx errors | < 1% (excluding 404) |
| Timeout errors | < 0.01% |

### Business Errors

| Error Type | Target |
|------------|--------|
| Payment failures | < 2% |
| Delivery calculation errors | < 0.5% |
| Stock sync errors | < 0.1% |

---

## 4. Incident Response

### Severity Levels

| Severity | Impact | Example |
|----------|--------|---------|
| **P1 - Critical** | Service down, data loss | Production outage |
| **P2 - High** | Major feature broken | Checkout not working |
| **P3 - Medium** | Feature degraded | Slow search |
| **P4 - Low** | Minor issue | UI bug |

### Response Times

| Severity | Initial Response | Updates | Resolution Target |
|----------|------------------|---------|-------------------|
| P1 | 15 min | Every 30 min | 2 hours |
| P2 | 30 min | Every 1 hour | 4 hours |
| P3 | 2 hours | Every 4 hours | 24 hours |
| P4 | 24 hours | Daily | 1 week |

### Escalation Matrix

| Level | Time | Contact |
|-------|------|---------|
| L1 | 0 min | On-call engineer |
| L2 | 30 min | Team lead |
| L3 | 1 hour | CTO |
| L4 | 2 hours | CEO |

---

## 5. Data & Security

### Data Backup

| Data Type | Frequency | Retention | RTO |
|-----------|-----------|-----------|-----|
| Database (full) | Daily | 30 days | 4 hours |
| Database (WAL) | Continuous | 7 days | 1 hour |
| File storage | Daily | 90 days | 8 hours |
| Logs | Daily | 30 days | 24 hours |

### Recovery Objectives

| Metric | Target |
|--------|--------|
| RPO (Recovery Point Objective) | < 1 hour |
| RTO (Recovery Time Objective) | < 4 hours |

### Security

| Metric | Target |
|--------|--------|
| Vulnerability patching (Critical) | < 24 hours |
| Vulnerability patching (High) | < 7 days |
| Security audit | Quarterly |
| Penetration testing | Annually |

---

## 6. Monitoring & Alerting

### Metrics Collection

| Component | Interval |
|-----------|----------|
| Application metrics | 15s |
| Infrastructure metrics | 30s |
| Log collection | Real-time |
| Traces | 10% sampling |

### Alert Thresholds

```yaml
# Critical Alerts (P1)
- name: ServiceDown
  condition: up == 0 for 1m
  severity: critical

- name: HighErrorRate
  condition: error_rate > 5% for 5m
  severity: critical

- name: DatabaseDown
  condition: pg_up == 0 for 30s
  severity: critical

# Warning Alerts (P2-P3)
- name: HighLatency
  condition: latency_p95 > 500ms for 10m
  severity: warning

- name: HighCPU
  condition: cpu_usage > 80% for 15m
  severity: warning

- name: LowDiskSpace
  condition: disk_free < 20% for 5m
  severity: warning
```

### On-Call Schedule

| Role | Coverage | Rotation |
|------|----------|----------|
| Primary | 24/7 | Weekly |
| Secondary | 24/7 | Weekly |
| Manager | 24/7 | Monthly |

---

## 7. Support

### Support Channels

| Channel | Hours | Response Time |
|---------|-------|---------------|
| Email | 24/7 | 4 hours |
| Slack | Business hours | 30 min |
| Phone | Business hours | Immediate |
| Status Page | 24/7 | Real-time |

### Business Hours

Monday - Friday: 09:00 - 18:00 EET (Kyiv time)

### Status Page

URL: https://status.yourstore.com

Components monitored:
- API
- Storefront
- Admin Panel
- Payments
- Delivery
- Search

---

## 8. Reporting

### Regular Reports

| Report | Frequency | Recipients |
|--------|-----------|------------|
| Uptime Report | Weekly | Engineering |
| Performance Report | Weekly | Engineering |
| Incident Report | Per incident | All stakeholders |
| Security Report | Monthly | Management |
| SLA Compliance | Monthly | Management |

### Metrics Dashboard

Real-time dashboards available at:
- Grafana: https://grafana.yourstore.com
- Status Page: https://status.yourstore.com

---

## 9. Compliance

### Service Credits

При невиконанні SLA:

| Availability | Credit |
|--------------|--------|
| 99.0% - 99.9% | 10% |
| 95.0% - 99.0% | 25% |
| < 95.0% | 50% |

### Credit Request

1. Submit request within 30 days of incident
2. Include incident date/time and impact
3. Credits applied to next billing cycle
4. Maximum credit: 100% of monthly fee

---

## 10. Review & Updates

### SLA Review

- Quarterly review of SLA metrics
- Annual review of SLA terms
- Changes require 30-day notice

### Contact

For SLA-related inquiries:
- Email: sla@yourstore.com
- Slack: #sla-support

---

## Appendix

### Definitions

| Term | Definition |
|------|------------|
| Availability | Percentage of time service is operational |
| Downtime | Period when service is unavailable |
| Response Time | Time from request to first byte |
| Error Rate | Percentage of failed requests |
| RPO | Maximum acceptable data loss |
| RTO | Maximum acceptable downtime |

### Measurement Tools

| Metric | Tool |
|--------|------|
| Availability | Prometheus + Blackbox |
| Response Time | Prometheus + Histogram |
| Error Rate | Prometheus + Loki |
| Uptime | Pingdom / UptimeRobot |

### Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2024-01-15 | Initial SLA |
| 1.1 | 2024-03-01 | Added security metrics |
| 1.2 | 2024-06-01 | Updated response times |
