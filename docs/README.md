# Shop Platform - Documentation

## Overview

Shop Platform is a comprehensive multi-tenant SaaS e-commerce solution built with modern microservices architecture. The platform enables businesses to launch and manage online stores with advanced features including warehouse management, marketplace integrations, analytics, and more.

## Documentation Structure

### Getting Started
- [Quick Start Guide](./guides/QUICKSTART.md) - Get up and running in minutes
- [Installation](./guides/INSTALLATION.md) - Detailed installation instructions
- [Configuration](./guides/CONFIGURATION.md) - Environment variables and settings

### Architecture
- [System Architecture](./ARCHITECTURE.md) - High-level system design
- [Microservices Overview](./services/README.md) - All services explained
- [Database Schema](./DATABASE.md) - Database structure and relationships
- [Event Bus](./EVENT_BUS.md) - RabbitMQ events and messaging

### Services Documentation
- [Core Service](./services/CORE.md) - Product catalog, inventory, search
- [OMS Service](./services/OMS.md) - Order management system
- [CRM Service](./services/CRM.md) - Customer relationship management
- [Notification Service](./services/NOTIFICATION.md) - Email, SMS, push notifications
- [Telegram Bot](./services/TELEGRAM_BOT.md) - Telegram integration
- [Storefront](./services/STOREFRONT.md) - Customer-facing web app (Next.js)
- [Admin Panel](./services/ADMIN.md) - Back-office management (Next.js)

### Modules Documentation
- [Warehouse & WMS](./modules/WAREHOUSE.md) - Warehouse management system
- [Payments](./modules/PAYMENTS.md) - Payment processing integrations
- [Delivery & Logistics](./modules/DELIVERY.md) - Shipping and tracking
- [Marketplace Integrations](./modules/MARKETPLACES.md) - Rozetka, Prom, etc.
- [Analytics & Reporting](./modules/ANALYTICS.md) - Business intelligence
- [Loyalty Program](./modules/LOYALTY.md) - Points and tiers system
- [Search](./modules/SEARCH.md) - Elasticsearch integration
- [Webhooks](./modules/WEBHOOKS.md) - Webhook system for integrations
- [Security](./modules/SECURITY.md) - Authentication, authorization, RBAC
- [i18n](./modules/I18N.md) - Localization and multi-language support

### API Reference
- [REST API Overview](./api/README.md) - API conventions and authentication
- [Core API](./api/CORE_API.md) - Products, categories, inventory
- [OMS API](./api/OMS_API.md) - Orders, cart, checkout
- [Authentication API](./api/AUTHENTICATION.md) - Auth, tokens, OAuth2

### Infrastructure & DevOps
- [Infrastructure Overview](./INFRASTRUCTURE.md) - AWS, Kubernetes setup
- [Deployment Guide](./deployment/README.md) - Production deployment
- [Docker Setup](./deployment/DOCKER.md) - Container configuration
- [Kubernetes](./deployment/KUBERNETES.md) - K8s manifests and Helm
- [CI/CD Pipeline](./deployment/CI_CD.md) - GitHub Actions workflow
- [Monitoring](./deployment/MONITORING.md) - Prometheus, Grafana, Jaeger

### Advanced Topics
- [API Gateway](./API_GATEWAY.md) - Rate limiting, API keys
- [App Store](./APP_STORE.md) - Third-party integrations
- [Domain Management](./DOMAIN_MANAGEMENT.md) - Custom domains, SSL
- [Global Search](./GLOBAL_SEARCH.md) - Cross-tenant search
- [Advanced Features](./ADVANCED_FEATURES.md) - AI, fraud detection, etc.

### Development
- [Development Setup](./guides/DEVELOPMENT.md) - Local development environment
- [Testing Guide](./guides/TESTING.md) - Unit, integration, E2E tests
- [Contributing](./guides/CONTRIBUTING.md) - How to contribute
- [Migration Guide](./guides/MIGRATION.md) - Database and version migrations
- [Troubleshooting](./guides/TROUBLESHOOTING.md) - Common issues and solutions

### Reference
- [Glossary](./GLOSSARY.md) - Terms and definitions
- [FAQ](./FAQ.md) - Frequently asked questions
- [Changelog](./CHANGELOG.md) - Version history

---

## Technology Stack

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| Go | 1.24 | Microservices |
| PostgreSQL | 15 | Primary database |
| Redis | 7 | Caching, sessions |
| Elasticsearch | 8.11 | Full-text search |
| RabbitMQ | 3.12 | Message broker |
| MinIO | Latest | S3-compatible storage |

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 16 | React framework |
| React | 19 | UI library |
| TypeScript | 5.x | Type safety |
| Tailwind CSS | 3.x | Styling |
| Prisma | 5.x | ORM |

### Infrastructure
| Technology | Purpose |
|------------|---------|
| Docker | Containerization |
| Kubernetes | Orchestration |
| Terraform | Infrastructure as Code |
| Prometheus | Metrics |
| Grafana | Dashboards |
| Jaeger | Distributed tracing |

---

## Quick Links

- [Quick Start](./guides/QUICKSTART.md)
- [API Documentation](./api/README.md)
- [Configuration](./guides/CONFIGURATION.md)
- [Troubleshooting](./guides/TROUBLESHOOTING.md)
- [FAQ](./FAQ.md)
- [Changelog](./CHANGELOG.md)
- [Glossary](./GLOSSARY.md)

---

## Support

For questions and support:
- Create an issue in the repository
- Check the [FAQ](./FAQ.md)
- Review [Troubleshooting](./guides/TROUBLESHOOTING.md)
- Read the [Glossary](./GLOSSARY.md) for terminology
