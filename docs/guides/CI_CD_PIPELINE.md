# CI/CD Pipeline

Continuous Integration та Continuous Deployment з GitHub Actions.

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CI/CD PIPELINE                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────┐   ┌────────┐   ┌────────┐   ┌────────┐   ┌────────┐           │
│  │ Commit │──▶│ Build  │──▶│ Test   │──▶│ Deploy │──▶│ Monitor│           │
│  │        │   │        │   │        │   │ Stage  │   │        │           │
│  └────────┘   └────────┘   └────────┘   └────────┘   └────────┘           │
│                                              │                              │
│                                              ▼                              │
│                                         ┌────────┐                          │
│                                         │ Deploy │                          │
│                                         │ Prod   │                          │
│                                         └────────┘                          │
│                                                                              │
│  Stages:                                                                    │
│  ├── Lint & Format Check                                                    │
│  ├── Unit Tests                                                             │
│  ├── Integration Tests                                                      │
│  ├── Build Docker Images                                                    │
│  ├── Security Scan                                                          │
│  ├── Deploy to Staging                                                      │
│  ├── E2E Tests                                                              │
│  └── Deploy to Production (manual approval)                                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## GitHub Actions Workflows

### CI Workflow

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  GO_VERSION: '1.21'
  NODE_VERSION: '18'

jobs:
  lint:
    name: Lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Go
        uses: actions/setup-go@v4
        with:
          go-version: ${{ env.GO_VERSION }}

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}

      - name: Go Lint
        uses: golangci/golangci-lint-action@v3
        with:
          version: latest
          working-directory: services/core

      - name: ESLint
        run: |
          cd services/storefront
          npm ci
          npm run lint

  test-backend:
    name: Test Backend
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: shop_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

      redis:
        image: redis:7
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v4

      - name: Setup Go
        uses: actions/setup-go@v4
        with:
          go-version: ${{ env.GO_VERSION }}

      - name: Run Tests
        run: |
          cd services/core
          go test -v -race -coverprofile=coverage.out ./...
        env:
          DATABASE_URL: postgres://test:test@localhost:5432/shop_test?sslmode=disable
          REDIS_URL: redis://localhost:6379

      - name: Upload Coverage
        uses: codecov/codecov-action@v3
        with:
          files: services/core/coverage.out

  test-frontend:
    name: Test Frontend
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
          cache-dependency-path: services/storefront/package-lock.json

      - name: Install Dependencies
        run: |
          cd services/storefront
          npm ci

      - name: Run Tests
        run: |
          cd services/storefront
          npm run test -- --coverage

      - name: Upload Coverage
        uses: codecov/codecov-action@v3
        with:
          files: services/storefront/coverage/lcov.info

  build:
    name: Build
    needs: [lint, test-backend, test-frontend]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Login to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and Push Core
        uses: docker/build-push-action@v5
        with:
          context: services/core
          push: ${{ github.event_name != 'pull_request' }}
          tags: |
            ghcr.io/${{ github.repository }}/core:${{ github.sha }}
            ghcr.io/${{ github.repository }}/core:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Build and Push Storefront
        uses: docker/build-push-action@v5
        with:
          context: services/storefront
          push: ${{ github.event_name != 'pull_request' }}
          tags: |
            ghcr.io/${{ github.repository }}/storefront:${{ github.sha }}
            ghcr.io/${{ github.repository }}/storefront:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max

  security:
    name: Security Scan
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: 'ghcr.io/${{ github.repository }}/core:${{ github.sha }}'
          format: 'sarif'
          output: 'trivy-results.sarif'

      - name: Upload Trivy scan results
        uses: github/codeql-action/upload-sarif@v2
        with:
          sarif_file: 'trivy-results.sarif'
```

### Deploy Workflow

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:
    inputs:
      environment:
        description: 'Environment to deploy'
        required: true
        default: 'staging'
        type: choice
        options:
          - staging
          - production

jobs:
  deploy-staging:
    name: Deploy to Staging
    runs-on: ubuntu-latest
    environment: staging
    if: github.event_name == 'push' || github.event.inputs.environment == 'staging'
    steps:
      - uses: actions/checkout@v4

      - name: Configure kubectl
        uses: azure/k8s-set-context@v3
        with:
          kubeconfig: ${{ secrets.KUBECONFIG_STAGING }}

      - name: Setup Helm
        uses: azure/setup-helm@v3

      - name: Deploy with Helm
        run: |
          helm upgrade --install shop-staging deploy/helm/shop-platform \
            -f deploy/helm/shop-platform/values.yaml \
            -f deploy/helm/shop-platform/values-staging.yaml \
            -n staging \
            --set global.image.tag=${{ github.sha }} \
            --wait --timeout 10m

      - name: Verify Deployment
        run: |
          kubectl rollout status deployment/shop-staging-core -n staging
          kubectl rollout status deployment/shop-staging-storefront -n staging

      - name: Run Smoke Tests
        run: |
          curl -f https://staging.shop.ua/health || exit 1
          curl -f https://staging-api.shop.ua/health || exit 1

  e2e-tests:
    name: E2E Tests
    needs: deploy-staging
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 18

      - name: Install Playwright
        run: |
          npm ci
          npx playwright install --with-deps

      - name: Run E2E Tests
        run: npx playwright test
        env:
          BASE_URL: https://staging.shop.ua

      - name: Upload Results
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/

  deploy-production:
    name: Deploy to Production
    needs: e2e-tests
    runs-on: ubuntu-latest
    environment: production
    if: github.event.inputs.environment == 'production' || (github.event_name == 'push' && github.ref == 'refs/heads/main')
    steps:
      - uses: actions/checkout@v4

      - name: Configure kubectl
        uses: azure/k8s-set-context@v3
        with:
          kubeconfig: ${{ secrets.KUBECONFIG_PRODUCTION }}

      - name: Setup Helm
        uses: azure/setup-helm@v3

      - name: Deploy with Helm
        run: |
          helm upgrade --install shop-prod deploy/helm/shop-platform \
            -f deploy/helm/shop-platform/values.yaml \
            -f deploy/helm/shop-platform/values-production.yaml \
            -n production \
            --set global.image.tag=${{ github.sha }} \
            --wait --timeout 15m

      - name: Verify Deployment
        run: |
          kubectl rollout status deployment/shop-prod-core -n production
          kubectl rollout status deployment/shop-prod-storefront -n production

      - name: Notify Slack
        uses: slackapi/slack-github-action@v1.24.0
        with:
          payload: |
            {
              "text": "Production deployment completed",
              "blocks": [
                {
                  "type": "section",
                  "text": {
                    "type": "mrkdwn",
                    "text": "✅ *Production Deploy Complete*\n*Commit:* ${{ github.sha }}\n*By:* ${{ github.actor }}"
                  }
                }
              ]
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }}
```

### Rollback Workflow

```yaml
# .github/workflows/rollback.yml
name: Rollback

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
      revision:
        description: 'Helm revision to rollback to (leave empty for previous)'
        required: false

jobs:
  rollback:
    name: Rollback Deployment
    runs-on: ubuntu-latest
    environment: ${{ github.event.inputs.environment }}
    steps:
      - name: Configure kubectl
        uses: azure/k8s-set-context@v3
        with:
          kubeconfig: ${{ secrets[format('KUBECONFIG_{0}', github.event.inputs.environment)] }}

      - name: Setup Helm
        uses: azure/setup-helm@v3

      - name: Rollback
        run: |
          RELEASE_NAME="shop-${{ github.event.inputs.environment == 'production' && 'prod' || github.event.inputs.environment }}"
          NAMESPACE="${{ github.event.inputs.environment }}"

          if [ -n "${{ github.event.inputs.revision }}" ]; then
            helm rollback $RELEASE_NAME ${{ github.event.inputs.revision }} -n $NAMESPACE
          else
            helm rollback $RELEASE_NAME -n $NAMESPACE
          fi

      - name: Verify Rollback
        run: |
          kubectl rollout status deployment/shop-${{ github.event.inputs.environment == 'production' && 'prod' || github.event.inputs.environment }}-core -n ${{ github.event.inputs.environment }}

      - name: Notify Slack
        uses: slackapi/slack-github-action@v1.24.0
        with:
          payload: |
            {
              "text": "⚠️ Rollback performed on ${{ github.event.inputs.environment }}"
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }}
```

## Branch Strategy

```
main (production)
  │
  └── develop (staging)
        │
        ├── feature/SHOP-123-add-payment
        ├── feature/SHOP-124-improve-search
        └── bugfix/SHOP-125-fix-checkout
```

## Environment Protection Rules

### Staging
- Require status checks: CI must pass
- Auto-deploy on push to main

### Production
- Require status checks: CI + E2E must pass
- Require manual approval from 1 reviewer
- Restrict deployments to specific branches

## Secrets Configuration

| Secret | Description | Environments |
|--------|-------------|--------------|
| `KUBECONFIG_STAGING` | K8s config for staging | staging |
| `KUBECONFIG_PRODUCTION` | K8s config for production | production |
| `SLACK_WEBHOOK` | Slack notifications | all |
| `CODECOV_TOKEN` | Code coverage upload | all |

## See Also

- [Git Workflow](./GIT_WORKFLOW.md)
- [E2E Testing](./E2E_TESTING.md)
- [Kubernetes Deployment](../deployment/KUBERNETES.md)
