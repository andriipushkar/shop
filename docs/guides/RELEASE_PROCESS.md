# Release Process

Процес випуску нових версій Shop Platform.

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          RELEASE PROCESS                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. Prepare  ──▶  2. Test  ──▶  3. Release  ──▶  4. Deploy  ──▶  5. Verify │
│                                                                              │
│  Steps:                                                                     │
│  ├── Create release branch                                                 │
│  ├── Update version & changelog                                            │
│  ├── Run full test suite                                                   │
│  ├── Create release tag                                                    │
│  ├── Build & publish artifacts                                             │
│  ├── Deploy to staging                                                     │
│  ├── Run smoke tests                                                       │
│  ├── Deploy to production                                                  │
│  └── Post-release verification                                             │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Version Numbering

### Semantic Versioning

```
MAJOR.MINOR.PATCH[-PRERELEASE]

Examples:
1.0.0       - Initial release
1.1.0       - New features (backward compatible)
1.1.1       - Bug fixes
2.0.0       - Breaking changes
1.2.0-rc.1  - Release candidate
1.2.0-beta.1 - Beta release
```

### Version Guidelines

| Change Type | Version Bump | Example |
|-------------|--------------|---------|
| Breaking API change | MAJOR | 1.0.0 → 2.0.0 |
| New feature | MINOR | 1.0.0 → 1.1.0 |
| Bug fix | PATCH | 1.0.0 → 1.0.1 |
| Security fix | PATCH | 1.0.0 → 1.0.1 |

## Release Checklist

### Pre-Release

- [ ] All tests passing on develop
- [ ] No critical bugs in backlog
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
- [ ] API documentation current
- [ ] Database migrations reviewed

### Release

- [ ] Release branch created
- [ ] Version bumped
- [ ] CHANGELOG finalized
- [ ] PR to main approved
- [ ] Tag created
- [ ] Docker images built
- [ ] Helm chart updated

### Post-Release

- [ ] Deployed to staging
- [ ] Smoke tests passed
- [ ] Deployed to production
- [ ] Health checks green
- [ ] Release notes published
- [ ] Team notified

## Step-by-Step Process

### 1. Create Release Branch

```bash
# Ensure develop is up to date
git checkout develop
git pull origin develop

# Create release branch
git checkout -b release/v1.2.0

# Verify branch
git log --oneline -10
```

### 2. Update Version

```bash
# Backend version
# services/core/version.go
const Version = "1.2.0"

# Frontend version
cd services/storefront
npm version 1.2.0 --no-git-tag-version

# Update Helm chart
# deploy/helm/shop-platform/Chart.yaml
version: 1.2.0
appVersion: "1.2.0"
```

### 3. Update CHANGELOG

```markdown
## [1.2.0] - 2024-02-15

### Added
- Nova Poshta delivery integration (#123)
- Product recommendations API (#145)
- Admin dashboard analytics (#167)

### Changed
- Improved checkout performance (#178)
- Updated payment provider SDK (#189)

### Fixed
- Cart calculation bug (#190)
- Mobile navigation issues (#195)

### Security
- Updated dependencies with security patches
```

### 4. Create PR and Merge

```bash
# Commit changes
git add .
git commit -m "chore(release): prepare v1.2.0"

# Push branch
git push -u origin release/v1.2.0

# Create PR to main via GitHub UI
# Request reviews
# Merge after approval
```

### 5. Create Tag

```bash
# Checkout main
git checkout main
git pull origin main

# Create annotated tag
git tag -a v1.2.0 -m "Release v1.2.0

Changes:
- Nova Poshta delivery integration
- Product recommendations API
- Admin dashboard analytics
- Performance improvements
- Bug fixes

Full changelog: https://github.com/shop/shop-platform/blob/main/CHANGELOG.md"

# Push tag
git push origin v1.2.0
```

### 6. Build Artifacts

```yaml
# Triggered automatically by tag push
# .github/workflows/release.yml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
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

      - name: Extract version
        id: version
        run: echo "version=${GITHUB_REF#refs/tags/v}" >> $GITHUB_OUTPUT

      - name: Build and push Core
        uses: docker/build-push-action@v5
        with:
          context: services/core
          push: true
          tags: |
            ghcr.io/${{ github.repository }}/core:${{ steps.version.outputs.version }}
            ghcr.io/${{ github.repository }}/core:latest

      - name: Build and push Storefront
        uses: docker/build-push-action@v5
        with:
          context: services/storefront
          push: true
          tags: |
            ghcr.io/${{ github.repository }}/storefront:${{ steps.version.outputs.version }}
            ghcr.io/${{ github.repository }}/storefront:latest

  helm:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Package Helm chart
        run: |
          helm package deploy/helm/shop-platform

      - name: Push to Helm repository
        run: |
          helm push shop-platform-*.tgz oci://ghcr.io/${{ github.repository }}/charts

  release:
    needs: [build, helm]
    runs-on: ubuntu-latest
    steps:
      - name: Create GitHub Release
        uses: softprops/action-gh-release@v1
        with:
          generate_release_notes: true
          files: |
            deploy/helm/shop-platform-*.tgz
```

### 7. Deploy to Staging

```bash
# Deploy via Helm
helm upgrade --install shop-staging deploy/helm/shop-platform \
  -f deploy/helm/shop-platform/values-staging.yaml \
  -n staging \
  --set global.image.tag=1.2.0 \
  --wait

# Verify deployment
kubectl get pods -n staging
kubectl logs -f deployment/shop-staging-core -n staging
```

### 8. Run Smoke Tests

```bash
# Run automated smoke tests
npx playwright test --project=smoke --config=playwright.staging.config.ts

# Manual verification
curl -f https://staging.shop.ua/health
curl -f https://staging-api.shop.ua/health
```

### 9. Deploy to Production

```bash
# Deploy with manual approval in CI/CD
# Or manual deployment:

helm upgrade --install shop-prod deploy/helm/shop-platform \
  -f deploy/helm/shop-platform/values-production.yaml \
  -n production \
  --set global.image.tag=1.2.0 \
  --wait --timeout 15m

# Verify
kubectl rollout status deployment/shop-prod-core -n production
```

### 10. Post-Release

```bash
# Merge main back to develop
git checkout develop
git merge main
git push origin develop

# Announce release
# - Slack notification
# - Email to stakeholders
# - Update status page
```

## Hotfix Process

### Emergency Fix

```bash
# Create hotfix from main
git checkout main
git pull origin main
git checkout -b hotfix/v1.2.1-fix-checkout

# Make fix
# ... fix the issue ...

# Commit
git add .
git commit -m "fix(checkout): resolve payment processing error

The payment was failing due to incorrect API endpoint configuration.

Fixes #234"

# Push and create PR to main
git push -u origin hotfix/v1.2.1-fix-checkout

# After merge, tag immediately
git checkout main
git pull origin main
git tag -a v1.2.1 -m "Hotfix v1.2.1 - Fix checkout payment error"
git push origin v1.2.1

# Deploy to production ASAP
# Then merge to develop
git checkout develop
git merge main
git push origin develop
```

## Rollback Procedure

### Quick Rollback

```bash
# Rollback Helm release
helm rollback shop-prod -n production

# Or deploy previous version
helm upgrade --install shop-prod deploy/helm/shop-platform \
  -n production \
  --set global.image.tag=1.1.0 \
  --wait
```

### Database Rollback

```bash
# If migrations need rollback
kubectl exec -it shop-prod-core-xxx -n production -- \
  ./migrate down 1

# Verify database state
kubectl exec -it shop-prod-core-xxx -n production -- \
  ./migrate version
```

## Release Schedule

| Type | Frequency | Day |
|------|-----------|-----|
| Major | Quarterly | Monday |
| Minor | Bi-weekly | Tuesday |
| Patch | As needed | Any day |
| Hotfix | Immediately | Any time |

## Release Notes Template

```markdown
# Shop Platform v1.2.0

Release Date: February 15, 2024

## Highlights

- **Nova Poshta Integration** - Native delivery support
- **Product Recommendations** - AI-powered suggestions
- **Performance Improvements** - 30% faster checkout

## New Features

### Nova Poshta Delivery
Customers can now select Nova Poshta warehouses directly in checkout.

### Product Recommendations
Personalized product suggestions based on browsing history.

## Improvements

- Checkout page loads 30% faster
- Updated payment provider SDK

## Bug Fixes

- Fixed cart calculation for discounted items
- Resolved mobile navigation issues

## Breaking Changes

None in this release.

## Upgrade Guide

1. Update Helm chart
2. Run database migrations
3. Clear CDN cache

## Known Issues

- None reported

## Contributors

Thanks to all contributors!
```

## See Also

- [Git Workflow](./GIT_WORKFLOW.md)
- [CI/CD Pipeline](./CI_CD_PIPELINE.md)
- [Deployment](../deployment/KUBERNETES.md)
