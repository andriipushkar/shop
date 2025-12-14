# Kubernetes Deployment

Детальна конфігурація Kubernetes для production deployment.

## Огляд

| Компонент | Тип | Replicas |
|-----------|-----|----------|
| Core Service | Deployment | 3 |
| OMS Service | Deployment | 2 |
| CRM Service | Deployment | 2 |
| Notification | Deployment | 2 |
| Admin | Deployment | 2 |
| Storefront | Deployment | 3 |
| PostgreSQL | StatefulSet | 1 (3 з HA) |
| Redis | StatefulSet | 1 (3 з HA) |

## Структура

```
kubernetes/
├── base/
│   ├── namespace.yaml
│   ├── configmap.yaml
│   ├── secrets.yaml
│   ├── services/
│   │   ├── core/
│   │   │   ├── deployment.yaml
│   │   │   ├── service.yaml
│   │   │   └── hpa.yaml
│   │   ├── oms/
│   │   ├── crm/
│   │   ├── notification/
│   │   ├── admin/
│   │   └── storefront/
│   ├── databases/
│   │   ├── postgres/
│   │   └── redis/
│   ├── ingress/
│   │   └── ingress.yaml
│   └── kustomization.yaml
├── overlays/
│   ├── development/
│   │   └── kustomization.yaml
│   ├── staging/
│   │   └── kustomization.yaml
│   └── production/
│       ├── kustomization.yaml
│       ├── replicas-patch.yaml
│       └── resources-patch.yaml
└── helm/
    └── shop-platform/
        ├── Chart.yaml
        ├── values.yaml
        └── templates/
```

## Base Manifests

### Namespace

```yaml
# kubernetes/base/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: shop
  labels:
    name: shop
    istio-injection: enabled
```

### ConfigMap

```yaml
# kubernetes/base/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: shop-config
  namespace: shop
data:
  ENV: "production"
  LOG_LEVEL: "info"
  LOG_FORMAT: "json"

  # Database
  DATABASE_HOST: "postgres.shop.svc.cluster.local"
  DATABASE_PORT: "5432"
  DATABASE_NAME: "shopdb"
  DATABASE_SSLMODE: "require"

  # Redis
  REDIS_HOST: "redis.shop.svc.cluster.local"
  REDIS_PORT: "6379"

  # RabbitMQ
  RABBITMQ_HOST: "rabbitmq.shop.svc.cluster.local"
  RABBITMQ_PORT: "5672"
  RABBITMQ_VHOST: "shop"

  # Elasticsearch
  ELASTICSEARCH_URL: "http://elasticsearch.shop.svc.cluster.local:9200"

  # Services
  CORE_SERVICE_URL: "http://core.shop.svc.cluster.local:8080"
  OMS_SERVICE_URL: "http://oms.shop.svc.cluster.local:8081"
  CRM_SERVICE_URL: "http://crm.shop.svc.cluster.local:8082"
```

### Secrets

```yaml
# kubernetes/base/secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: shop-secrets
  namespace: shop
type: Opaque
stringData:
  DATABASE_PASSWORD: "${DATABASE_PASSWORD}"
  REDIS_PASSWORD: "${REDIS_PASSWORD}"
  RABBITMQ_PASSWORD: "${RABBITMQ_PASSWORD}"
  JWT_PRIVATE_KEY: "${JWT_PRIVATE_KEY}"
  JWT_PUBLIC_KEY: "${JWT_PUBLIC_KEY}"
  LIQPAY_PRIVATE_KEY: "${LIQPAY_PRIVATE_KEY}"
  NOVA_POSHTA_API_KEY: "${NOVA_POSHTA_API_KEY}"
---
apiVersion: v1
kind: Secret
metadata:
  name: docker-registry
  namespace: shop
type: kubernetes.io/dockerconfigjson
data:
  .dockerconfigjson: ${DOCKER_CONFIG_JSON}
```

## Service Deployments

### Core Service

```yaml
# kubernetes/base/services/core/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: core
  namespace: shop
  labels:
    app: core
    version: v1
spec:
  replicas: 3
  selector:
    matchLabels:
      app: core
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  template:
    metadata:
      labels:
        app: core
        version: v1
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "8080"
        prometheus.io/path: "/metrics"
    spec:
      serviceAccountName: shop-service

      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
            - weight: 100
              podAffinityTerm:
                labelSelector:
                  matchLabels:
                    app: core
                topologyKey: kubernetes.io/hostname

      initContainers:
        - name: wait-for-db
          image: busybox:1.36
          command: ['sh', '-c', 'until nc -z postgres 5432; do echo waiting for postgres; sleep 2; done']

        - name: migrations
          image: ghcr.io/your-org/shop-core:${VERSION}
          command: ['./server', 'migrate', 'up']
          envFrom:
            - configMapRef:
                name: shop-config
            - secretRef:
                name: shop-secrets

      containers:
        - name: core
          image: ghcr.io/your-org/shop-core:${VERSION}
          imagePullPolicy: Always

          ports:
            - name: http
              containerPort: 8080
              protocol: TCP

          envFrom:
            - configMapRef:
                name: shop-config
            - secretRef:
                name: shop-secrets

          env:
            - name: POD_NAME
              valueFrom:
                fieldRef:
                  fieldPath: metadata.name
            - name: POD_NAMESPACE
              valueFrom:
                fieldRef:
                  fieldPath: metadata.namespace

          resources:
            requests:
              cpu: "100m"
              memory: "128Mi"
            limits:
              cpu: "500m"
              memory: "512Mi"

          livenessProbe:
            httpGet:
              path: /health/live
              port: http
            initialDelaySeconds: 15
            periodSeconds: 20
            timeoutSeconds: 5
            failureThreshold: 3

          readinessProbe:
            httpGet:
              path: /health/ready
              port: http
            initialDelaySeconds: 5
            periodSeconds: 10
            timeoutSeconds: 5
            failureThreshold: 3

          lifecycle:
            preStop:
              exec:
                command: ["/bin/sh", "-c", "sleep 10"]

          volumeMounts:
            - name: tmp
              mountPath: /tmp

      volumes:
        - name: tmp
          emptyDir: {}

      imagePullSecrets:
        - name: docker-registry

      terminationGracePeriodSeconds: 30
```

### Service

```yaml
# kubernetes/base/services/core/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: core
  namespace: shop
  labels:
    app: core
spec:
  type: ClusterIP
  ports:
    - name: http
      port: 8080
      targetPort: http
      protocol: TCP
  selector:
    app: core
```

### HPA (Horizontal Pod Autoscaler)

```yaml
# kubernetes/base/services/core/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: core-hpa
  namespace: shop
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: core
  minReplicas: 3
  maxReplicas: 10
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

### PodDisruptionBudget

```yaml
# kubernetes/base/services/core/pdb.yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: core-pdb
  namespace: shop
spec:
  minAvailable: 2
  selector:
    matchLabels:
      app: core
```

## Database StatefulSets

### PostgreSQL

```yaml
# kubernetes/base/databases/postgres/statefulset.yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
  namespace: shop
spec:
  serviceName: postgres
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
        - name: postgres
          image: postgres:15-alpine

          ports:
            - containerPort: 5432
              name: postgres

          env:
            - name: POSTGRES_USER
              value: shop
            - name: POSTGRES_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: shop-secrets
                  key: DATABASE_PASSWORD
            - name: POSTGRES_DB
              value: shopdb
            - name: PGDATA
              value: /var/lib/postgresql/data/pgdata

          resources:
            requests:
              cpu: "500m"
              memory: "1Gi"
            limits:
              cpu: "2"
              memory: "4Gi"

          volumeMounts:
            - name: postgres-data
              mountPath: /var/lib/postgresql/data

          livenessProbe:
            exec:
              command:
                - pg_isready
                - -U
                - shop
            initialDelaySeconds: 30
            periodSeconds: 10

          readinessProbe:
            exec:
              command:
                - pg_isready
                - -U
                - shop
            initialDelaySeconds: 5
            periodSeconds: 5

  volumeClaimTemplates:
    - metadata:
        name: postgres-data
      spec:
        accessModes: ["ReadWriteOnce"]
        storageClassName: gp3
        resources:
          requests:
            storage: 100Gi
---
apiVersion: v1
kind: Service
metadata:
  name: postgres
  namespace: shop
spec:
  type: ClusterIP
  ports:
    - port: 5432
      targetPort: 5432
  selector:
    app: postgres
```

### Redis

```yaml
# kubernetes/base/databases/redis/statefulset.yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: redis
  namespace: shop
spec:
  serviceName: redis
  replicas: 1
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
    spec:
      containers:
        - name: redis
          image: redis:7-alpine

          command:
            - redis-server
            - --appendonly
            - "yes"
            - --maxmemory
            - "1gb"
            - --maxmemory-policy
            - allkeys-lru
            - --requirepass
            - $(REDIS_PASSWORD)

          env:
            - name: REDIS_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: shop-secrets
                  key: REDIS_PASSWORD

          ports:
            - containerPort: 6379
              name: redis

          resources:
            requests:
              cpu: "100m"
              memory: "256Mi"
            limits:
              cpu: "500m"
              memory: "1Gi"

          volumeMounts:
            - name: redis-data
              mountPath: /data

          livenessProbe:
            exec:
              command:
                - redis-cli
                - ping
            initialDelaySeconds: 30
            periodSeconds: 10

  volumeClaimTemplates:
    - metadata:
        name: redis-data
      spec:
        accessModes: ["ReadWriteOnce"]
        storageClassName: gp3
        resources:
          requests:
            storage: 10Gi
---
apiVersion: v1
kind: Service
metadata:
  name: redis
  namespace: shop
spec:
  type: ClusterIP
  ports:
    - port: 6379
      targetPort: 6379
  selector:
    app: redis
```

## Ingress

### NGINX Ingress

```yaml
# kubernetes/base/ingress/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: shop-ingress
  namespace: shop
  annotations:
    kubernetes.io/ingress.class: nginx
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/proxy-body-size: "50m"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "60"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "60"
    nginx.ingress.kubernetes.io/rate-limit: "100"
    nginx.ingress.kubernetes.io/rate-limit-window: "1m"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
spec:
  tls:
    - hosts:
        - api.yourstore.com
        - admin.yourstore.com
        - yourstore.com
      secretName: shop-tls
  rules:
    - host: api.yourstore.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: core
                port:
                  number: 8080

    - host: admin.yourstore.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: admin
                port:
                  number: 3000

    - host: yourstore.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: storefront
                port:
                  number: 3000
```

## Kustomize

### Base kustomization.yaml

```yaml
# kubernetes/base/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

namespace: shop

resources:
  - namespace.yaml
  - configmap.yaml
  - secrets.yaml
  - services/core/deployment.yaml
  - services/core/service.yaml
  - services/core/hpa.yaml
  - services/oms/deployment.yaml
  - services/oms/service.yaml
  - services/crm/deployment.yaml
  - services/crm/service.yaml
  - services/notification/deployment.yaml
  - services/notification/service.yaml
  - services/admin/deployment.yaml
  - services/admin/service.yaml
  - services/storefront/deployment.yaml
  - services/storefront/service.yaml
  - databases/postgres/statefulset.yaml
  - databases/redis/statefulset.yaml
  - ingress/ingress.yaml

commonLabels:
  app.kubernetes.io/part-of: shop-platform

images:
  - name: ghcr.io/your-org/shop-core
    newTag: latest
  - name: ghcr.io/your-org/shop-oms
    newTag: latest
  - name: ghcr.io/your-org/shop-admin
    newTag: latest
  - name: ghcr.io/your-org/shop-storefront
    newTag: latest
```

### Production Overlay

```yaml
# kubernetes/overlays/production/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

namespace: shop-production

resources:
  - ../../base

namePrefix: prod-

commonLabels:
  environment: production

images:
  - name: ghcr.io/your-org/shop-core
    newTag: v2.0.0
  - name: ghcr.io/your-org/shop-oms
    newTag: v2.0.0

patchesStrategicMerge:
  - replicas-patch.yaml
  - resources-patch.yaml

configMapGenerator:
  - name: shop-config
    behavior: merge
    literals:
      - ENV=production
      - LOG_LEVEL=warn
```

```yaml
# kubernetes/overlays/production/replicas-patch.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: core
spec:
  replicas: 5
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: storefront
spec:
  replicas: 5
```

## Helm Chart

### Chart.yaml

```yaml
# kubernetes/helm/shop-platform/Chart.yaml
apiVersion: v2
name: shop-platform
description: Shop Platform Helm Chart
type: application
version: 1.0.0
appVersion: "2.0.0"

dependencies:
  - name: postgresql
    version: "12.x.x"
    repository: "https://charts.bitnami.com/bitnami"
    condition: postgresql.enabled

  - name: redis
    version: "17.x.x"
    repository: "https://charts.bitnami.com/bitnami"
    condition: redis.enabled

  - name: rabbitmq
    version: "12.x.x"
    repository: "https://charts.bitnami.com/bitnami"
    condition: rabbitmq.enabled
```

### values.yaml

```yaml
# kubernetes/helm/shop-platform/values.yaml
global:
  environment: production
  imageRegistry: ghcr.io/your-org
  imagePullSecrets:
    - docker-registry

core:
  enabled: true
  replicaCount: 3
  image:
    repository: shop-core
    tag: latest
    pullPolicy: Always

  resources:
    requests:
      cpu: 100m
      memory: 128Mi
    limits:
      cpu: 500m
      memory: 512Mi

  autoscaling:
    enabled: true
    minReplicas: 3
    maxReplicas: 10
    targetCPUUtilizationPercentage: 70

  service:
    type: ClusterIP
    port: 8080

oms:
  enabled: true
  replicaCount: 2

crm:
  enabled: true
  replicaCount: 2

admin:
  enabled: true
  replicaCount: 2

storefront:
  enabled: true
  replicaCount: 3

postgresql:
  enabled: true
  auth:
    database: shopdb
    username: shop
    existingSecret: shop-secrets

  primary:
    persistence:
      size: 100Gi
      storageClass: gp3

redis:
  enabled: true
  auth:
    existingSecret: shop-secrets

  master:
    persistence:
      size: 10Gi

rabbitmq:
  enabled: true
  auth:
    existingPasswordSecret: shop-secrets

ingress:
  enabled: true
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
  hosts:
    - host: api.yourstore.com
      paths:
        - path: /
          service: core
    - host: admin.yourstore.com
      paths:
        - path: /
          service: admin
    - host: yourstore.com
      paths:
        - path: /
          service: storefront
  tls:
    - secretName: shop-tls
      hosts:
        - api.yourstore.com
        - admin.yourstore.com
        - yourstore.com
```

## Команди

### kubectl

```bash
# Apply manifests
kubectl apply -k kubernetes/overlays/production

# Check status
kubectl get pods -n shop
kubectl get svc -n shop
kubectl get ingress -n shop

# Logs
kubectl logs -f deployment/core -n shop

# Scale
kubectl scale deployment core --replicas=5 -n shop

# Rollout
kubectl rollout status deployment/core -n shop
kubectl rollout history deployment/core -n shop
kubectl rollout undo deployment/core -n shop
```

### Helm

```bash
# Install
helm install shop ./kubernetes/helm/shop-platform -n shop --create-namespace

# Upgrade
helm upgrade shop ./kubernetes/helm/shop-platform -n shop

# Values override
helm upgrade shop ./kubernetes/helm/shop-platform -n shop \
  --set core.replicaCount=5 \
  --set global.environment=production

# Uninstall
helm uninstall shop -n shop
```

## Моніторинг

### ServiceMonitor (Prometheus)

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: core-monitor
  namespace: shop
spec:
  selector:
    matchLabels:
      app: core
  endpoints:
    - port: http
      path: /metrics
      interval: 30s
```
