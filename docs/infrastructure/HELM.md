# Helm Charts

Helm charts для деплою Shop Platform на Kubernetes.

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           HELM CHART STRUCTURE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  deploy/helm/shop-platform/                                                 │
│  ├── Chart.yaml              # Chart metadata                               │
│  ├── values.yaml             # Default values                               │
│  ├── values-staging.yaml     # Staging overrides                            │
│  ├── values-production.yaml  # Production overrides                         │
│  ├── templates/                                                             │
│  │   ├── _helpers.tpl        # Template helpers                             │
│  │   ├── configmap.yaml      # ConfigMaps                                   │
│  │   ├── deployment.yaml     # Deployments                                  │
│  │   ├── service.yaml        # Services                                     │
│  │   ├── ingress.yaml        # Ingress                                      │
│  │   ├── hpa.yaml            # Horizontal Pod Autoscaler                    │
│  │   ├── pdb.yaml            # Pod Disruption Budget                        │
│  │   ├── secrets.yaml        # Secrets (external-secrets)                   │
│  │   └── serviceaccount.yaml # Service Account                              │
│  └── charts/                 # Subcharts (dependencies)                     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Chart.yaml

```yaml
# deploy/helm/shop-platform/Chart.yaml
apiVersion: v2
name: shop-platform
description: Shop.ua E-commerce Platform
type: application
version: 1.0.0
appVersion: "1.0.0"

dependencies:
  - name: postgresql
    version: "12.x.x"
    repository: "https://charts.bitnami.com/bitnami"
    condition: postgresql.enabled

  - name: redis
    version: "17.x.x"
    repository: "https://charts.bitnami.com/bitnami"
    condition: redis.enabled

  - name: elasticsearch
    version: "19.x.x"
    repository: "https://charts.bitnami.com/bitnami"
    condition: elasticsearch.enabled

  - name: rabbitmq
    version: "11.x.x"
    repository: "https://charts.bitnami.com/bitnami"
    condition: rabbitmq.enabled
```

## Values Configuration

### Default Values

```yaml
# deploy/helm/shop-platform/values.yaml

# Global settings
global:
  environment: development
  domain: shop.local
  imageRegistry: ghcr.io/shop
  imagePullSecrets:
    - name: ghcr-secret

# Core Service
core:
  enabled: true
  replicaCount: 2
  image:
    repository: core
    tag: latest
    pullPolicy: IfNotPresent

  resources:
    requests:
      cpu: 100m
      memory: 256Mi
    limits:
      cpu: 1000m
      memory: 1Gi

  env:
    LOG_LEVEL: info
    DB_MAX_CONNECTIONS: "50"

  service:
    type: ClusterIP
    port: 8080

  autoscaling:
    enabled: true
    minReplicas: 2
    maxReplicas: 10
    targetCPUUtilizationPercentage: 70
    targetMemoryUtilizationPercentage: 80

  ingress:
    enabled: true
    className: nginx
    annotations:
      cert-manager.io/cluster-issuer: letsencrypt-prod
    hosts:
      - host: api.shop.local
        paths:
          - path: /
            pathType: Prefix
    tls:
      - secretName: api-tls
        hosts:
          - api.shop.local

# OMS Service
oms:
  enabled: true
  replicaCount: 2
  image:
    repository: oms
    tag: latest

  resources:
    requests:
      cpu: 100m
      memory: 256Mi
    limits:
      cpu: 500m
      memory: 512Mi

# Storefront
storefront:
  enabled: true
  replicaCount: 3
  image:
    repository: storefront
    tag: latest

  resources:
    requests:
      cpu: 100m
      memory: 256Mi
    limits:
      cpu: 1000m
      memory: 1Gi

  env:
    NEXT_PUBLIC_API_URL: https://api.shop.local

  ingress:
    enabled: true
    hosts:
      - host: shop.local
        paths:
          - path: /
            pathType: Prefix

# Admin Panel
admin:
  enabled: true
  replicaCount: 2
  image:
    repository: admin
    tag: latest

  ingress:
    enabled: true
    hosts:
      - host: admin.shop.local
        paths:
          - path: /
            pathType: Prefix

# PostgreSQL (Bitnami subchart)
postgresql:
  enabled: true
  auth:
    postgresPassword: ""  # Set via secret
    database: shop
  primary:
    persistence:
      size: 50Gi
  metrics:
    enabled: true

# Redis (Bitnami subchart)
redis:
  enabled: true
  auth:
    enabled: true
    password: ""  # Set via secret
  master:
    persistence:
      size: 10Gi
  metrics:
    enabled: true

# Elasticsearch
elasticsearch:
  enabled: true
  master:
    replicaCount: 3
  data:
    replicaCount: 2

# RabbitMQ
rabbitmq:
  enabled: true
  auth:
    username: shop
    password: ""  # Set via secret
  persistence:
    size: 10Gi
```

### Production Values

```yaml
# deploy/helm/shop-platform/values-production.yaml

global:
  environment: production
  domain: shop.ua

core:
  replicaCount: 5
  image:
    tag: "1.0.0"

  resources:
    requests:
      cpu: 500m
      memory: 512Mi
    limits:
      cpu: 2000m
      memory: 2Gi

  autoscaling:
    minReplicas: 5
    maxReplicas: 20

  ingress:
    hosts:
      - host: api.shop.ua
        paths:
          - path: /
            pathType: Prefix
    tls:
      - secretName: api-shop-ua-tls
        hosts:
          - api.shop.ua

storefront:
  replicaCount: 5
  image:
    tag: "1.0.0"

  resources:
    requests:
      cpu: 500m
      memory: 512Mi
    limits:
      cpu: 2000m
      memory: 2Gi

  ingress:
    hosts:
      - host: shop.ua
        paths:
          - path: /
            pathType: Prefix
      - host: www.shop.ua
        paths:
          - path: /
            pathType: Prefix

postgresql:
  primary:
    persistence:
      size: 200Gi
    resources:
      requests:
        cpu: 1000m
        memory: 2Gi

redis:
  master:
    persistence:
      size: 50Gi
```

## Templates

### Deployment Template

```yaml
# deploy/helm/shop-platform/templates/deployment.yaml
{{- range $name, $service := .Values }}
{{- if and (kindIs "map" $service) ($service.enabled) (hasKey $service "image") }}
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "shop-platform.fullname" $ }}-{{ $name }}
  labels:
    {{- include "shop-platform.labels" $ | nindent 4 }}
    app.kubernetes.io/component: {{ $name }}
spec:
  {{- if not $service.autoscaling.enabled }}
  replicas: {{ $service.replicaCount }}
  {{- end }}
  selector:
    matchLabels:
      {{- include "shop-platform.selectorLabels" $ | nindent 6 }}
      app.kubernetes.io/component: {{ $name }}
  template:
    metadata:
      annotations:
        checksum/config: {{ include (print $.Template.BasePath "/configmap.yaml") $ | sha256sum }}
      labels:
        {{- include "shop-platform.selectorLabels" $ | nindent 8 }}
        app.kubernetes.io/component: {{ $name }}
    spec:
      {{- with $.Values.global.imagePullSecrets }}
      imagePullSecrets:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      serviceAccountName: {{ include "shop-platform.serviceAccountName" $ }}
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
      containers:
        - name: {{ $name }}
          image: "{{ $.Values.global.imageRegistry }}/{{ $service.image.repository }}:{{ $service.image.tag }}"
          imagePullPolicy: {{ $service.image.pullPolicy }}
          ports:
            - name: http
              containerPort: {{ $service.service.port | default 8080 }}
              protocol: TCP
          envFrom:
            - configMapRef:
                name: {{ include "shop-platform.fullname" $ }}-{{ $name }}
            - secretRef:
                name: {{ include "shop-platform.fullname" $ }}-secrets
          {{- with $service.env }}
          env:
            {{- range $key, $value := . }}
            - name: {{ $key }}
              value: {{ $value | quote }}
            {{- end }}
          {{- end }}
          livenessProbe:
            httpGet:
              path: /health
              port: http
            initialDelaySeconds: 30
            periodSeconds: 10
            timeoutSeconds: 5
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: /ready
              port: http
            initialDelaySeconds: 5
            periodSeconds: 5
            timeoutSeconds: 3
            successThreshold: 1
          resources:
            {{- toYaml $service.resources | nindent 12 }}
      {{- with $service.nodeSelector }}
      nodeSelector:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      {{- with $service.affinity }}
      affinity:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      {{- with $service.tolerations }}
      tolerations:
        {{- toYaml . | nindent 8 }}
      {{- end }}
{{- end }}
{{- end }}
```

### HPA Template

```yaml
# deploy/helm/shop-platform/templates/hpa.yaml
{{- range $name, $service := .Values }}
{{- if and (kindIs "map" $service) ($service.enabled) (hasKey $service "autoscaling") }}
{{- if $service.autoscaling.enabled }}
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: {{ include "shop-platform.fullname" $ }}-{{ $name }}
  labels:
    {{- include "shop-platform.labels" $ | nindent 4 }}
    app.kubernetes.io/component: {{ $name }}
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: {{ include "shop-platform.fullname" $ }}-{{ $name }}
  minReplicas: {{ $service.autoscaling.minReplicas }}
  maxReplicas: {{ $service.autoscaling.maxReplicas }}
  metrics:
    {{- if $service.autoscaling.targetCPUUtilizationPercentage }}
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: {{ $service.autoscaling.targetCPUUtilizationPercentage }}
    {{- end }}
    {{- if $service.autoscaling.targetMemoryUtilizationPercentage }}
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: {{ $service.autoscaling.targetMemoryUtilizationPercentage }}
    {{- end }}
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
{{- end }}
{{- end }}
{{- end }}
```

## Installation Commands

```bash
# Add Bitnami repo for dependencies
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update

# Install dependencies
cd deploy/helm/shop-platform
helm dependency update

# Install to staging
helm upgrade --install shop-staging . \
  -f values.yaml \
  -f values-staging.yaml \
  -n staging \
  --create-namespace \
  --set postgresql.auth.postgresPassword=$DB_PASSWORD \
  --set redis.auth.password=$REDIS_PASSWORD

# Install to production
helm upgrade --install shop-prod . \
  -f values.yaml \
  -f values-production.yaml \
  -n production \
  --create-namespace \
  --set postgresql.auth.postgresPassword=$DB_PASSWORD \
  --set redis.auth.password=$REDIS_PASSWORD

# Dry run (test)
helm upgrade --install shop-staging . \
  -f values.yaml \
  --dry-run --debug

# Uninstall
helm uninstall shop-staging -n staging
```

## Secrets Management

```yaml
# Using External Secrets Operator
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: shop-secrets
spec:
  refreshInterval: 1h
  secretStoreRef:
    kind: ClusterSecretStore
    name: aws-secrets-manager
  target:
    name: shop-platform-secrets
  data:
    - secretKey: DATABASE_URL
      remoteRef:
        key: shop/production/database
        property: url
    - secretKey: REDIS_URL
      remoteRef:
        key: shop/production/redis
        property: url
```

## See Also

- [Kubernetes Deployment](../deployment/KUBERNETES.md)
- [Secrets Management](../deployment/SECRETS_MANAGEMENT.md)
- [CI/CD Pipeline](../guides/CI_CD_PIPELINE.md)
