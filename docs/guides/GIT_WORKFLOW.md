# Git Workflow

Процес роботи з Git у проекті Shop Platform.

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           GIT WORKFLOW                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  main ──────●─────────────●─────────────●─────────────●────────▶           │
│             │             ▲             ▲             ▲                      │
│             │             │             │             │                      │
│  develop ───●──●──●──●────┼──●──●──●────┼──●──●──●────┼────────▶           │
│                │  │  ▲    │     │  ▲    │     │  ▲    │                      │
│                │  │  │    │     │  │    │     │  │    │                      │
│  feature/───●──●──┘  │    │     │  │    │     │  │    │                      │
│  SHOP-123       └────┘    │     │  │    │     │  │    │                      │
│                           │     │  │    │     │  │    │                      │
│  feature/─────────────●───┼──●──┘  │    │     │  │    │                      │
│  SHOP-124                 │        │    │     │  │    │                      │
│                           │        │    │     │  │    │                      │
│  release/─────────────────●────────┘    │     │  │    │                      │
│  v1.2.0                                 │     │  │    │                      │
│                                         │     │  │    │                      │
│  hotfix/────────────────────────────────●─────┘  │    │                      │
│  fix-checkout                                    │    │                      │
│                                                  │    │                      │
│  release/────────────────────────────────────────●────┘                      │
│  v1.2.1                                                                      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Branches

### Main Branches

| Branch | Purpose | Protected |
|--------|---------|-----------|
| `main` | Production code | Yes |
| `develop` | Integration branch | Yes |

### Supporting Branches

| Type | Pattern | Base | Merge To |
|------|---------|------|----------|
| Feature | `feature/SHOP-*` | develop | develop |
| Bugfix | `bugfix/SHOP-*` | develop | develop |
| Release | `release/v*` | develop | main, develop |
| Hotfix | `hotfix/*` | main | main, develop |

## Workflow

### Feature Development

```bash
# 1. Create feature branch from develop
git checkout develop
git pull origin develop
git checkout -b feature/SHOP-123-add-payment-method

# 2. Make changes
# ... implement feature ...

# 3. Commit changes
git add .
git commit -m "feat(payment): add Monobank integration

- Add Monobank API client
- Implement payment webhook handler
- Add unit tests

Closes SHOP-123"

# 4. Push branch
git push -u origin feature/SHOP-123-add-payment-method

# 5. Create Pull Request to develop
# Use GitHub/GitLab UI

# 6. After merge, delete branch
git checkout develop
git pull origin develop
git branch -d feature/SHOP-123-add-payment-method
```

### Release Process

```bash
# 1. Create release branch
git checkout develop
git pull origin develop
git checkout -b release/v1.2.0

# 2. Update version
npm version 1.2.0 --no-git-tag-version
# Update CHANGELOG.md

# 3. Commit version bump
git add .
git commit -m "chore(release): prepare v1.2.0"

# 4. Create PR to main
# After approval and merge:

# 5. Tag release
git checkout main
git pull origin main
git tag -a v1.2.0 -m "Release v1.2.0"
git push origin v1.2.0

# 6. Merge back to develop
git checkout develop
git merge main
git push origin develop
```

### Hotfix Process

```bash
# 1. Create hotfix branch from main
git checkout main
git pull origin main
git checkout -b hotfix/fix-checkout-bug

# 2. Fix the issue
# ... fix bug ...

# 3. Commit
git add .
git commit -m "fix(checkout): resolve payment processing error

Payment was failing due to incorrect API endpoint.

Fixes SHOP-456"

# 4. Create PR to main (urgent review)

# 5. After merge, tag and merge to develop
git checkout main
git pull origin main
git tag -a v1.1.1 -m "Hotfix v1.1.1"
git push origin v1.1.1

git checkout develop
git merge main
git push origin develop
```

## Commit Messages

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation |
| `style` | Formatting |
| `refactor` | Code restructuring |
| `perf` | Performance improvement |
| `test` | Adding tests |
| `chore` | Maintenance |
| `ci` | CI/CD changes |

### Examples

```bash
# Feature
git commit -m "feat(cart): add quantity selector component

- Implement +/- buttons
- Add input validation
- Handle max quantity limit

Closes SHOP-123"

# Bug fix
git commit -m "fix(auth): resolve token refresh issue

The refresh token was not being sent with the correct headers.

Fixes SHOP-456"

# Documentation
git commit -m "docs(api): update payment endpoints documentation"

# Breaking change
git commit -m "feat(api)!: change order response format

BREAKING CHANGE: The order response now returns items as an array
instead of an object. Update your code to handle the new format."
```

## Pull Requests

### PR Template

```markdown
## Summary
Brief description of changes.

## Type of Change
- [ ] Feature
- [ ] Bug fix
- [ ] Documentation
- [ ] Refactoring

## Related Issues
Closes #123

## Changes Made
- Added X component
- Updated Y service
- Fixed Z bug

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests pass
- [ ] Manual testing completed

## Screenshots (if applicable)

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No console.log statements
```

### Review Process

1. **Author**
   - Create PR with clear description
   - Assign reviewers
   - Link related issues

2. **Reviewer**
   - Review code changes
   - Check tests
   - Approve or request changes

3. **Merge**
   - Squash and merge for features
   - Merge commit for releases

## Branch Protection

### main

```yaml
# Branch protection rules
protection_rules:
  required_reviews: 2
  dismiss_stale_reviews: true
  require_code_owner_review: true
  required_status_checks:
    - ci/build
    - ci/test
    - security/scan
  enforce_admins: true
  restrict_pushes: true
```

### develop

```yaml
protection_rules:
  required_reviews: 1
  required_status_checks:
    - ci/build
    - ci/test
```

## Git Hooks

### Pre-commit

```bash
#!/bin/sh
# .husky/pre-commit

# Lint staged files
npx lint-staged

# Run type check
npm run type-check
```

### Commit-msg

```bash
#!/bin/sh
# .husky/commit-msg

# Validate commit message format
npx commitlint --edit $1
```

### Configuration

```json
// package.json
{
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.go": ["gofmt -w", "golangci-lint run"]
  },
  "commitlint": {
    "extends": ["@commitlint/config-conventional"]
  }
}
```

## Best Practices

### Do's

- Write clear commit messages
- Keep commits atomic
- Pull before push
- Review your own code first
- Keep PRs small (< 400 lines)

### Don'ts

- Force push to shared branches
- Commit directly to main/develop
- Commit sensitive data
- Leave console.log statements
- Merge without tests passing

## Useful Commands

```bash
# Interactive rebase (before PR)
git rebase -i HEAD~3

# Amend last commit
git commit --amend

# Cherry-pick commit
git cherry-pick <commit-hash>

# Stash changes
git stash
git stash pop

# View branch graph
git log --oneline --graph --all

# Clean up merged branches
git branch --merged | grep -v main | xargs git branch -d
```

## See Also

- [CI/CD Pipeline](./CI_CD_PIPELINE.md)
- [Release Process](./RELEASE_PROCESS.md)
- [Contributing](../../CONTRIBUTING.md)
