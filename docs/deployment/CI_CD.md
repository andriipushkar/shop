# CI/CD Pipeline

Конфігурація Continuous Integration та Continuous Deployment.

## Огляд

| Етап | Інструмент | Тригер |
|------|------------|--------|
| CI | GitHub Actions | Push, PR |
| CD (Staging) | GitHub Actions | Merge to develop |
| CD (Production) | GitHub Actions | Release tag |
| Registry | GitHub Container Registry | CI build |

## Архітектура Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                      CI/CD PIPELINE                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────────┐ │
│  │   Push   │──▶│   Lint   │──▶│   Test   │──▶│    Build     │ │
│  │   / PR   │   │          │   │          │   │              │ │
│  └──────────┘   └──────────┘   └──────────┘   └──────┬───────┘ │
│                                                       │         │
│                                               ┌───────▼───────┐ │
│                                               │  Push Image   │ │
│                                               │   to GHCR     │ │
│                                               └───────┬───────┘ │
│                                                       │         │
│         ┌─────────────────────────────────────────────┤         │
│         │                                             │         │
│         ▼                                             ▼         │
│  ┌─────────────┐                              ┌─────────────┐  │
│  │   Staging   │                              │ Production  │  │
│  │   Deploy    │                              │   Deploy    │  │
│  │  (develop)  │                              │ (v* tag)    │  │
│  └─────────────┘                              └─────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## GitHub Actions Workflows

### CI Pipeline (.github/workflows/ci.yml)

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

env:
  GO_VERSION: '1.24'
  NODE_VERSION: '20'
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  # ============================================
  # LINT
  # ============================================
  lint-go:
    name: Lint Go
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-go@v5
        with:
          go-version: ${{ env.GO_VERSION }}

      - name: golangci-lint
        uses: golangci/golangci-lint-action@v3
        with:
          version: latest
          working-directory: services/core

  lint-frontend:
    name: Lint Frontend
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
          cache-dependency-path: apps/admin/package-lock.json

      - name: Install dependencies
        run: npm ci
        working-directory: apps/admin

      - name: ESLint
        run: npm run lint
        working-directory: apps/admin

      - name: TypeScript check
        run: npm run type-check
        working-directory: apps/admin

  # ============================================
  # TEST
  # ============================================
  test-go:
    name: Test Go
    runs-on: ubuntu-latest
    needs: lint-go

    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: testdb
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-go@v5
        with:
          go-version: ${{ env.GO_VERSION }}

      - name: Run tests
        run: |
          go test -race -coverprofile=coverage.out -covermode=atomic ./...
        working-directory: services/core
        env:
          DATABASE_URL: postgres://test:test@localhost:5432/testdb?sslmode=disable
          REDIS_URL: redis://localhost:6379

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: services/core/coverage.out
          flags: backend

  test-frontend:
    name: Test Frontend
    runs-on: ubuntu-latest
    needs: lint-frontend
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
          cache-dependency-path: apps/admin/package-lock.json

      - name: Install dependencies
        run: npm ci
        working-directory: apps/admin

      - name: Run tests
        run: npm test -- --coverage --watchAll=false
        working-directory: apps/admin

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: apps/admin/coverage/lcov.info
          flags: frontend

  # ============================================
  # BUILD
  # ============================================
  build:
    name: Build
    runs-on: ubuntu-latest
    needs: [test-go, test-frontend]
    if: github.event_name == 'push'

    permissions:
      contents: read
      packages: write

    strategy:
      matrix:
        service: [core, oms, crm, notification, admin, storefront]
        include:
          - service: core
            context: services/core
          - service: oms
            context: services/oms
          - service: crm
            context: services/crm
          - service: notification
            context: services/notification
          - service: admin
            context: apps/admin
          - service: storefront
            context: apps/storefront

    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Login to GHCR
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}-${{ matrix.service }}
          tags: |
            type=ref,event=branch
            type=ref,event=pr
            type=sha,prefix=
            type=raw,value=latest,enable=${{ github.ref == 'refs/heads/main' }}

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: ${{ matrix.context }}
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          build-args: |
            VERSION=${{ github.sha }}

  # ============================================
  # SECURITY SCAN
  # ============================================
  security-scan:
    name: Security Scan
    runs-on: ubuntu-latest
    needs: build
    steps:
      - uses: actions/checkout@v4

      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: '${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}-core:${{ github.sha }}'
          format: 'sarif'
          output: 'trivy-results.sarif'

      - name: Upload Trivy scan results
        uses: github/codeql-action/upload-sarif@v2
        with:
          sarif_file: 'trivy-results.sarif'
```

### CD Staging (.github/workflows/cd-staging.yml)

```yaml
name: CD Staging

on:
  push:
    branches: [develop]

env:
  CLUSTER_NAME: shop-staging
  AWS_REGION: eu-central-1

jobs:
  deploy:
    name: Deploy to Staging
    runs-on: ubuntu-latest
    environment: staging

    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Update kubeconfig
        run: |
          aws eks update-kubeconfig --name ${{ env.CLUSTER_NAME }} --region ${{ env.AWS_REGION }}

      - name: Deploy to Kubernetes
        run: |
          # Update image tags
          cd kubernetes/overlays/staging
          kustomize edit set image \
            ghcr.io/${{ github.repository }}-core:${{ github.sha }} \
            ghcr.io/${{ github.repository }}-oms:${{ github.sha }} \
            ghcr.io/${{ github.repository }}-admin:${{ github.sha }} \
            ghcr.io/${{ github.repository }}-storefront:${{ github.sha }}

          # Apply
          kubectl apply -k .

      - name: Wait for rollout
        run: |
          kubectl rollout status deployment/core -n shop-staging --timeout=300s
          kubectl rollout status deployment/oms -n shop-staging --timeout=300s
          kubectl rollout status deployment/admin -n shop-staging --timeout=300s

      - name: Run smoke tests
        run: |
          STAGING_URL="https://staging-api.yourstore.com"

          # Health check
          curl -f "$STAGING_URL/health" || exit 1

          # Basic API check
          curl -f "$STAGING_URL/api/v1/products?limit=1" || exit 1

      - name: Notify Slack
        if: always()
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          fields: repo,message,commit,author,action,eventName,ref,workflow
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

### CD Production (.github/workflows/cd-production.yml)

```yaml
name: CD Production

on:
  push:
    tags:
      - 'v*'

env:
  CLUSTER_NAME: shop-production
  AWS_REGION: eu-central-1

jobs:
  deploy:
    name: Deploy to Production
    runs-on: ubuntu-latest
    environment: production

    steps:
      - uses: actions/checkout@v4

      - name: Get version from tag
        id: version
        run: echo "VERSION=${GITHUB_REF#refs/tags/}" >> $GITHUB_OUTPUT

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Update kubeconfig
        run: |
          aws eks update-kubeconfig --name ${{ env.CLUSTER_NAME }} --region ${{ env.AWS_REGION }}

      - name: Deploy to Kubernetes
        run: |
          cd kubernetes/overlays/production
          kustomize edit set image \
            ghcr.io/${{ github.repository }}-core:${{ steps.version.outputs.VERSION }} \
            ghcr.io/${{ github.repository }}-oms:${{ steps.version.outputs.VERSION }} \
            ghcr.io/${{ github.repository }}-admin:${{ steps.version.outputs.VERSION }} \
            ghcr.io/${{ github.repository }}-storefront:${{ steps.version.outputs.VERSION }}

          kubectl apply -k .

      - name: Wait for rollout
        run: |
          kubectl rollout status deployment/core -n shop-production --timeout=600s
          kubectl rollout status deployment/oms -n shop-production --timeout=600s

      - name: Run smoke tests
        run: |
          PROD_URL="https://api.yourstore.com"
          curl -f "$PROD_URL/health" || exit 1

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v1
        with:
          generate_release_notes: true

      - name: Notify Slack
        if: always()
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          text: "Production deployment ${{ steps.version.outputs.VERSION }}: ${{ job.status }}"
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

### E2E Tests (.github/workflows/e2e.yml)

```yaml
name: E2E Tests

on:
  deployment_status:

jobs:
  e2e:
    if: github.event.deployment_status.state == 'success'
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install Playwright
        run: |
          cd e2e
          npm ci
          npx playwright install --with-deps

      - name: Run E2E tests
        run: |
          cd e2e
          npx playwright test
        env:
          BASE_URL: ${{ github.event.deployment_status.target_url }}

      - name: Upload test results
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: e2e/playwright-report/
          retention-days: 30
```

### Database Migration (.github/workflows/migration.yml)

```yaml
name: Database Migration

on:
  workflow_dispatch:
    inputs:
      environment:
        description: 'Environment'
        required: true
        type: choice
        options:
          - staging
          - production
      action:
        description: 'Migration action'
        required: true
        type: choice
        options:
          - up
          - down
          - status

jobs:
  migrate:
    runs-on: ubuntu-latest
    environment: ${{ github.event.inputs.environment }}

    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: eu-central-1

      - name: Get database credentials
        id: db
        run: |
          DB_SECRET=$(aws secretsmanager get-secret-value --secret-id shop-${{ github.event.inputs.environment }}-db --query SecretString --output text)
          echo "DATABASE_URL=$(echo $DB_SECRET | jq -r '.url')" >> $GITHUB_OUTPUT

      - name: Run migration
        run: |
          go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest
          migrate -path migrations -database "${{ steps.db.outputs.DATABASE_URL }}" ${{ github.event.inputs.action }}
```

## Branch Protection Rules

### main branch

```yaml
# Required status checks:
- lint-go
- lint-frontend
- test-go
- test-frontend
- build
- security-scan

# Rules:
- Require pull request reviews: 1
- Require status checks to pass
- Require branches to be up to date
- Require signed commits
- Include administrators
```

### develop branch

```yaml
# Required status checks:
- lint-go
- lint-frontend
- test-go
- test-frontend

# Rules:
- Require status checks to pass
```

## Secrets Configuration

### Repository Secrets

| Secret | Description |
|--------|-------------|
| `AWS_ACCESS_KEY_ID` | AWS credentials for deployment |
| `AWS_SECRET_ACCESS_KEY` | AWS credentials |
| `SLACK_WEBHOOK_URL` | Slack notifications |
| `CODECOV_TOKEN` | Code coverage upload |

### Environment Secrets

#### Staging

| Secret | Description |
|--------|-------------|
| `KUBECONFIG` | Kubernetes config |
| `DATABASE_URL` | Staging DB URL |

#### Production

| Secret | Description |
|--------|-------------|
| `KUBECONFIG` | Kubernetes config |
| `DATABASE_URL` | Production DB URL |

## Deployment Environments

### GitHub Environments

```yaml
# Settings > Environments

staging:
  deployment_branch_policy:
    protected_branches: false
    custom_branches:
      - develop

production:
  deployment_branch_policy:
    protected_branches: true
  required_reviewers:
    - @devops-team
  wait_timer: 5 # minutes
```

## Rollback

### Manual Rollback

```bash
# Kubernetes
kubectl rollout undo deployment/core -n shop-production

# To specific revision
kubectl rollout undo deployment/core -n shop-production --to-revision=3

# Check history
kubectl rollout history deployment/core -n shop-production
```

### Automated Rollback (in workflow)

```yaml
- name: Deploy with auto-rollback
  run: |
    kubectl apply -k kubernetes/overlays/production

    if ! kubectl rollout status deployment/core -n shop-production --timeout=300s; then
      echo "Deployment failed, rolling back..."
      kubectl rollout undo deployment/core -n shop-production
      exit 1
    fi
```

## Caching Strategy

```yaml
# Go modules
- uses: actions/cache@v3
  with:
    path: |
      ~/.cache/go-build
      ~/go/pkg/mod
    key: ${{ runner.os }}-go-${{ hashFiles('**/go.sum') }}

# Node modules
- uses: actions/cache@v3
  with:
    path: ~/.npm
    key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}

# Docker layers
- uses: docker/build-push-action@v5
  with:
    cache-from: type=gha
    cache-to: type=gha,mode=max
```

## Notifications

### Slack Integration

```yaml
- name: Slack Notification
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    fields: repo,message,commit,author,action,eventName,ref,workflow,job,took
    custom_payload: |
      {
        "attachments": [{
          "color": "${{ job.status == 'success' && 'good' || 'danger' }}",
          "title": "${{ github.workflow }}",
          "text": "Deployment to ${{ github.event.inputs.environment }}: ${{ job.status }}"
        }]
      }
  env:
    SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

## Метрики CI/CD

| Метрика | Target |
|---------|--------|
| Build Time | < 10 min |
| Test Coverage | > 70% |
| Deploy Frequency | Daily |
| Lead Time | < 1 day |
| MTTR | < 1 hour |
| Change Failure Rate | < 5% |
