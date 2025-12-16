# ADR-007: Kubernetes як платформа оркестрації

## Статус

Прийнято

## Контекст

Shop Platform потребує надійної платформи для розгортання та оркестрації мікросервісів. Необхідно забезпечити:
- Автоматичне масштабування
- Self-healing (автоматичне відновлення)
- Rolling updates без downtime
- Service discovery
- Load balancing
- Secret management
- Multi-tenant ізоляцію

### Розглянуті альтернативи

1. **Docker Swarm**
   - Простіший у налаштуванні
   - Менша екосистема
   - Обмежені можливості масштабування

2. **HashiCorp Nomad**
   - Легший за Kubernetes
   - Менша спільнота
   - Обмежена інтеграція з cloud providers

3. **Amazon ECS/Fargate**
   - Managed service
   - Vendor lock-in
   - Простіший для AWS-only

4. **Kubernetes**
   - Industry standard
   - Велика екосистема
   - Підтримка всіх cloud providers
   - Складніший у налаштуванні

## Рішення

Використовуємо **Kubernetes** як основну платформу оркестрації.

### Обґрунтування

1. **Industry Standard**: Kubernetes став де-факто стандартом для контейнерної оркестрації
2. **Multi-cloud**: Можливість розгортання на AWS, GCP, Azure, DigitalOcean
3. **Екосистема**: Величезна кількість інструментів та інтеграцій
4. **Масштабування**: Proven scalability для enterprise workloads
5. **Community**: Активна спільнота та підтримка

### Managed Kubernetes

Для production використовуємо managed Kubernetes:
- **AWS**: Amazon EKS
- **DigitalOcean**: DOKS
- **Development**: k3s або minikube

## Архітектура

### Namespace стратегія

```yaml
# Namespaces
apiVersion: v1
kind: Namespace
metadata:
  name: shop-production
  labels:
    environment: production
---
apiVersion: v1
kind: Namespace
metadata:
  name: shop-staging
  labels:
    environment: staging
---
apiVersion: v1
kind: Namespace
metadata:
  name: monitoring
---
apiVersion: v1
kind: Namespace
metadata:
  name: ingress-nginx
```

### Deployment приклад

```yaml
# deployments/api.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: shop-api
  namespace: shop-production
  labels:
    app: shop-api
    version: v1
spec:
  replicas: 3
  selector:
    matchLabels:
      app: shop-api
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  template:
    metadata:
      labels:
        app: shop-api
        version: v1
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "8080"
        prometheus.io/path: "/metrics"
    spec:
      serviceAccountName: shop-api
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        fsGroup: 1000
      containers:
        - name: api
          image: shop-platform/api:1.0.0
          imagePullPolicy: Always
          ports:
            - name: http
              containerPort: 8080
              protocol: TCP
          env:
            - name: ENV
              value: "production"
            - name: POD_NAME
              valueFrom:
                fieldRef:
                  fieldPath: metadata.name
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: shop-secrets
                  key: database-url
            - name: REDIS_URL
              valueFrom:
                secretKeyRef:
                  name: shop-secrets
                  key: redis-url
            - name: JWT_SECRET
              valueFrom:
                secretKeyRef:
                  name: shop-secrets
                  key: jwt-secret
          resources:
            requests:
              cpu: 250m
              memory: 256Mi
            limits:
              cpu: 1000m
              memory: 1Gi
          livenessProbe:
            httpGet:
              path: /health
              port: http
            initialDelaySeconds: 15
            periodSeconds: 20
            timeoutSeconds: 5
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: /ready
              port: http
            initialDelaySeconds: 5
            periodSeconds: 10
            timeoutSeconds: 3
            failureThreshold: 3
          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            capabilities:
              drop:
                - ALL
          volumeMounts:
            - name: tmp
              mountPath: /tmp
      volumes:
        - name: tmp
          emptyDir: {}
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
            - weight: 100
              podAffinityTerm:
                labelSelector:
                  matchExpressions:
                    - key: app
                      operator: In
                      values:
                        - shop-api
                topologyKey: kubernetes.io/hostname
      topologySpreadConstraints:
        - maxSkew: 1
          topologyKey: topology.kubernetes.io/zone
          whenUnsatisfiable: ScheduleAnyway
          labelSelector:
            matchLabels:
              app: shop-api
```

### Service

```yaml
# services/api.yaml
apiVersion: v1
kind: Service
metadata:
  name: shop-api
  namespace: shop-production
  labels:
    app: shop-api
spec:
  type: ClusterIP
  ports:
    - port: 80
      targetPort: http
      protocol: TCP
      name: http
  selector:
    app: shop-api
```

### HorizontalPodAutoscaler

```yaml
# hpa/api.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: shop-api
  namespace: shop-production
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: shop-api
  minReplicas: 3
  maxReplicas: 20
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
    - type: Pods
      pods:
        metric:
          name: http_requests_per_second
        target:
          type: AverageValue
          averageValue: 1000
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Percent
          value: 10
          periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 0
      policies:
        - type: Percent
          value: 100
          periodSeconds: 15
        - type: Pods
          value: 4
          periodSeconds: 15
      selectPolicy: Max
```

### Ingress

```yaml
# ingress/shop.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: shop-ingress
  namespace: shop-production
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/rate-limit: "100"
    nginx.ingress.kubernetes.io/rate-limit-window: "1m"
    nginx.ingress.kubernetes.io/proxy-body-size: "50m"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  tls:
    - hosts:
        - shop.example.com
        - api.shop.example.com
      secretName: shop-tls
  rules:
    - host: api.shop.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: shop-api
                port:
                  number: 80
    - host: shop.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: shop-frontend
                port:
                  number: 80
```

### ConfigMap та Secrets

```yaml
# configmaps/api.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: shop-config
  namespace: shop-production
data:
  LOG_LEVEL: "info"
  LOG_FORMAT: "json"
  CORS_ORIGINS: "https://shop.example.com"
  RATE_LIMIT_ENABLED: "true"
  RATE_LIMIT_REQUESTS: "1000"
  RATE_LIMIT_WINDOW: "1m"
---
# secrets/shop.yaml (encrypted with sealed-secrets or external-secrets)
apiVersion: v1
kind: Secret
metadata:
  name: shop-secrets
  namespace: shop-production
type: Opaque
stringData:
  database-url: "postgres://user:pass@postgres:5432/shop?sslmode=require"
  redis-url: "redis://:password@redis:6379"
  jwt-secret: "your-super-secret-key"
```

### PodDisruptionBudget

```yaml
# pdb/api.yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: shop-api-pdb
  namespace: shop-production
spec:
  minAvailable: 2
  selector:
    matchLabels:
      app: shop-api
```

### NetworkPolicy

```yaml
# networkpolicies/api.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: shop-api-network-policy
  namespace: shop-production
spec:
  podSelector:
    matchLabels:
      app: shop-api
  policyTypes:
    - Ingress
    - Egress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              name: ingress-nginx
        - podSelector:
            matchLabels:
              app: shop-frontend
      ports:
        - protocol: TCP
          port: 8080
  egress:
    - to:
        - podSelector:
            matchLabels:
              app: postgres
      ports:
        - protocol: TCP
          port: 5432
    - to:
        - podSelector:
            matchLabels:
              app: redis
      ports:
        - protocol: TCP
          port: 6379
    - to:
        - namespaceSelector: {}
          podSelector:
            matchLabels:
              k8s-app: kube-dns
      ports:
        - protocol: UDP
          port: 53
```

## Інструменти

### Helm Charts

```yaml
# Chart.yaml
apiVersion: v2
name: shop-platform
description: Shop Platform Helm Chart
type: application
version: 1.0.0
appVersion: "1.0.0"
dependencies:
  - name: postgresql
    version: "12.x.x"
    repository: https://charts.bitnami.com/bitnami
    condition: postgresql.enabled
  - name: redis
    version: "17.x.x"
    repository: https://charts.bitnami.com/bitnami
    condition: redis.enabled
  - name: elasticsearch
    version: "19.x.x"
    repository: https://charts.bitnami.com/bitnami
    condition: elasticsearch.enabled
```

### ArgoCD для GitOps

```yaml
# argocd/application.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: shop-platform
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/your-org/shop-platform
    targetRevision: main
    path: k8s/overlays/production
  destination:
    server: https://kubernetes.default.svc
    namespace: shop-production
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
```

### Cert-Manager

```yaml
# cert-manager/cluster-issuer.yaml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@example.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
      - http01:
          ingress:
            class: nginx
```

## Моніторинг

### ServiceMonitor для Prometheus

```yaml
# monitoring/servicemonitor.yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: shop-api
  namespace: monitoring
  labels:
    release: prometheus
spec:
  selector:
    matchLabels:
      app: shop-api
  namespaceSelector:
    matchNames:
      - shop-production
  endpoints:
    - port: http
      path: /metrics
      interval: 15s
```

## Наслідки

### Позитивні

- Автоматичне масштабування та self-healing
- Портативність між cloud providers
- Декларативна конфігурація
- Велика екосистема інструментів
- Industry-standard практики

### Негативні

- Крива навчання для команди
- Operational complexity
- Потребує dedicated DevOps
- Overhead для малих проектів

### Ризики

- Misconfiguration може призвести до downtime
- Security vulnerabilities в кластері
- Resource exhaustion

## Посилання

- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [AWS EKS Best Practices](https://aws.github.io/aws-eks-best-practices/)
- [Kubernetes Patterns](https://k8spatterns.io/)
- [ArgoCD](https://argo-cd.readthedocs.io/)
