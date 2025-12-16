# Secrets Management

Управління секретами та конфіденційними даними.

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        SECRETS MANAGEMENT                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐                │
│  │ Secret       │────▶│ External     │────▶│ Kubernetes   │                │
│  │ Store        │     │ Secrets      │     │ Secrets      │                │
│  │ (AWS/Vault)  │     │ Operator     │     │              │                │
│  └──────────────┘     └──────────────┘     └──────────────┘                │
│                                                   │                         │
│                                                   ▼                         │
│                                            ┌──────────────┐                │
│                                            │ Application  │                │
│                                            │ Pods         │                │
│                                            └──────────────┘                │
│                                                                              │
│  Supported Backends:                                                        │
│  ├── AWS Secrets Manager                                                    │
│  ├── HashiCorp Vault                                                        │
│  ├── Google Secret Manager                                                  │
│  └── Azure Key Vault                                                        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## External Secrets Operator

### Installation

```bash
# Install External Secrets Operator
helm repo add external-secrets https://charts.external-secrets.io
helm install external-secrets external-secrets/external-secrets \
  -n external-secrets \
  --create-namespace
```

### AWS Secrets Manager Setup

```yaml
# k8s/secrets/cluster-secret-store.yaml
apiVersion: external-secrets.io/v1beta1
kind: ClusterSecretStore
metadata:
  name: aws-secrets-manager
spec:
  provider:
    aws:
      service: SecretsManager
      region: eu-central-1
      auth:
        jwt:
          serviceAccountRef:
            name: external-secrets-sa
            namespace: external-secrets
```

### Secret Definition

```yaml
# k8s/secrets/shop-secrets.yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: shop-secrets
  namespace: production
spec:
  refreshInterval: 1h
  secretStoreRef:
    kind: ClusterSecretStore
    name: aws-secrets-manager
  target:
    name: shop-secrets
    creationPolicy: Owner
  data:
    # Database
    - secretKey: DATABASE_URL
      remoteRef:
        key: shop/production/database
        property: url

    - secretKey: DATABASE_PASSWORD
      remoteRef:
        key: shop/production/database
        property: password

    # Redis
    - secretKey: REDIS_URL
      remoteRef:
        key: shop/production/redis
        property: url

    # JWT
    - secretKey: JWT_SECRET
      remoteRef:
        key: shop/production/auth
        property: jwt_secret

    # Payment providers
    - secretKey: LIQPAY_PRIVATE_KEY
      remoteRef:
        key: shop/production/liqpay
        property: private_key

    - secretKey: MONOBANK_TOKEN
      remoteRef:
        key: shop/production/monobank
        property: token

    # External services
    - secretKey: SENTRY_DSN
      remoteRef:
        key: shop/production/sentry
        property: dsn

    - secretKey: SMTP_PASSWORD
      remoteRef:
        key: shop/production/smtp
        property: password
```

## HashiCorp Vault

### Vault Setup

```bash
# Install Vault
helm repo add hashicorp https://helm.releases.hashicorp.com
helm install vault hashicorp/vault \
  -n vault \
  --create-namespace \
  -f vault-values.yaml

# Initialize Vault
kubectl exec -it vault-0 -n vault -- vault operator init

# Unseal Vault
kubectl exec -it vault-0 -n vault -- vault operator unseal $UNSEAL_KEY_1
kubectl exec -it vault-0 -n vault -- vault operator unseal $UNSEAL_KEY_2
kubectl exec -it vault-0 -n vault -- vault operator unseal $UNSEAL_KEY_3

# Enable KV secrets engine
vault secrets enable -path=shop kv-v2

# Store secrets
vault kv put shop/production/database \
  url="postgres://user:pass@db:5432/shop" \
  password="secure_password"
```

### Vault SecretStore

```yaml
# k8s/secrets/vault-secret-store.yaml
apiVersion: external-secrets.io/v1beta1
kind: ClusterSecretStore
metadata:
  name: vault-backend
spec:
  provider:
    vault:
      server: "https://vault.vault.svc:8200"
      path: "shop"
      version: "v2"
      auth:
        kubernetes:
          mountPath: "kubernetes"
          role: "external-secrets"
          serviceAccountRef:
            name: external-secrets-sa
            namespace: external-secrets
```

## Environment-Specific Secrets

### Development

```yaml
# k8s/secrets/dev-secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: shop-secrets
  namespace: development
type: Opaque
stringData:
  DATABASE_URL: "postgres://shop:dev_password@postgres:5432/shop_dev"
  REDIS_URL: "redis://redis:6379"
  JWT_SECRET: "dev_jwt_secret_not_for_production"
  LIQPAY_PUBLIC_KEY: "sandbox_public_key"
  LIQPAY_PRIVATE_KEY: "sandbox_private_key"
```

### Staging

```yaml
# k8s/secrets/staging-external-secret.yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: shop-secrets
  namespace: staging
spec:
  refreshInterval: 30m
  secretStoreRef:
    kind: ClusterSecretStore
    name: aws-secrets-manager
  target:
    name: shop-secrets
  dataFrom:
    - extract:
        key: shop/staging
```

## Secret Rotation

### Automatic Rotation (AWS)

```python
# lambda/rotate_db_password.py
import boto3
import psycopg2

def lambda_handler(event, context):
    secret_id = event['SecretId']
    step = event['Step']

    secrets_client = boto3.client('secretsmanager')

    if step == 'createSecret':
        # Generate new password
        new_password = secrets_client.get_random_password(
            PasswordLength=32,
            ExcludeCharacters='/@"'
        )['RandomPassword']

        # Store pending secret
        secrets_client.put_secret_value(
            SecretId=secret_id,
            ClientRequestToken=event['ClientRequestToken'],
            SecretString=json.dumps({'password': new_password}),
            VersionStages=['AWSPENDING']
        )

    elif step == 'setSecret':
        # Update database password
        pending = get_secret_value(secrets_client, secret_id, 'AWSPENDING')
        current = get_secret_value(secrets_client, secret_id, 'AWSCURRENT')

        conn = psycopg2.connect(
            host=current['host'],
            user='admin',
            password=current['admin_password'],
            database='postgres'
        )

        with conn.cursor() as cur:
            cur.execute(f"ALTER USER {current['username']} PASSWORD %s",
                       (pending['password'],))
        conn.commit()

    elif step == 'finishSecret':
        # Move pending to current
        secrets_client.update_secret_version_stage(
            SecretId=secret_id,
            VersionStage='AWSCURRENT',
            MoveToVersionId=event['ClientRequestToken'],
            RemoveFromVersionId=get_current_version(secrets_client, secret_id)
        )
```

### Rotation Schedule

```yaml
# AWS CloudFormation
AWSTemplateFormatVersion: '2010-09-09'
Resources:
  DatabaseSecret:
    Type: AWS::SecretsManager::Secret
    Properties:
      Name: shop/production/database
      GenerateSecretString:
        SecretStringTemplate: '{"username": "shop_app"}'
        GenerateStringKey: "password"
        PasswordLength: 32

  DatabaseSecretRotation:
    Type: AWS::SecretsManager::RotationSchedule
    Properties:
      SecretId: !Ref DatabaseSecret
      RotationLambdaARN: !GetAtt RotationLambda.Arn
      RotationRules:
        AutomaticallyAfterDays: 30
```

## Best Practices

### Secret Organization

```
shop/
├── production/
│   ├── database        # DB credentials
│   ├── redis           # Redis credentials
│   ├── auth            # JWT, OAuth secrets
│   ├── liqpay          # LiqPay API keys
│   ├── monobank        # Monobank token
│   ├── smtp            # Email credentials
│   └── sentry          # Sentry DSN
├── staging/
│   └── ...
└── development/
    └── ...
```

### Access Control

```hcl
# Vault policy
path "shop/production/*" {
  capabilities = ["read"]
}

path "shop/staging/*" {
  capabilities = ["read", "list"]
}

# Deny access to other environments
path "shop/development/*" {
  capabilities = ["deny"]
}
```

### Audit Logging

```yaml
# Enable audit logging in Vault
vault audit enable file file_path=/vault/logs/audit.log

# AWS CloudTrail for Secrets Manager
# Automatically logged
```

## Application Usage

### Go

```go
// Secrets are injected as environment variables
func LoadConfig() *Config {
    return &Config{
        DatabaseURL:     os.Getenv("DATABASE_URL"),
        RedisURL:        os.Getenv("REDIS_URL"),
        JWTSecret:       os.Getenv("JWT_SECRET"),
        LiqPayPrivate:   os.Getenv("LIQPAY_PRIVATE_KEY"),
    }
}
```

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
spec:
  template:
    spec:
      containers:
        - name: app
          envFrom:
            - secretRef:
                name: shop-secrets
```

## Monitoring

### Alerts

```yaml
# Alert on secret access failures
groups:
  - name: secrets
    rules:
      - alert: SecretSyncFailed
        expr: |
          externalsecret_status_condition{condition="Ready", status="False"} == 1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "External secret sync failed: {{ $labels.name }}"
```

## See Also

- [Kubernetes Deployment](./KUBERNETES.md)
- [Helm Charts](../infrastructure/HELM.md)
- [Security](../compliance/SECURITY.md)
