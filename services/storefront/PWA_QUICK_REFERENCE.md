# PWA Quick Reference Card

## File Locations

```
/home/sssmmmddd/Code/pro/shop/services/storefront/

├── public/
│   ├── manifest.json              # Web app manifest
│   └── sw-offline.js              # Service worker (14 KB)
│
├── lib/
│   ├── pwa/
│   │   ├── pwa-utils.ts           # PWA utilities (13 KB)
│   │   └── offline-storage.ts     # IndexedDB storage (14 KB)
│   └── hooks/
│       └── usePWA.ts              # React hook (3.6 KB)
│
├── components/
│   ├── InstallPrompt.tsx          # Install banner (6.9 KB)
│   ├── OfflineIndicator.tsx       # Offline status (4.8 KB)
│   ├── PWARegister.tsx            # SW registration (3.0 KB)
│   └── PWASettings.tsx            # Settings panel (8.3 KB)
│
├── app/
│   ├── layout.tsx                 # Updated with PWA components
│   └── offline/
│       └── page.tsx               # Offline fallback (6.8 KB)
│
├── __tests__/lib/
│   └── pwa.test.ts                # Tests (14 KB)
│
├── docs/
│   ├── PWA.md                     # Full documentation (9.3 KB)
│   └── PWA_SETUP.md               # Setup guide (9.7 KB)
│
└── next.config.ts                 # Updated with PWA headers
```

## Key Components

### 1. Service Worker (`/public/sw-offline.js`)
- Caches static assets, API responses, images
- Handles offline requests
- Background sync for cart/orders
- Push notifications

### 2. Web Manifest (`/public/manifest.json`)
- App metadata (name, description)
- Icons (72x72 to 512x512)
- Theme colors (#0d9488)
- Shortcuts (catalog, cart, promotions, profile)

### 3. PWA Utilities (`/lib/pwa/pwa-utils.ts`)
```typescript
import {
  isPWAInstalled,
  isOnline,
  registerServiceWorker,
  showInstallPrompt
} from '@/lib/pwa/pwa-utils';
```

### 4. Offline Storage (`/lib/pwa/offline-storage.ts`)
```typescript
import {
  productStorage,
  cartStorage,
  syncQueueStorage
} from '@/lib/pwa/offline-storage';
```

### 5. usePWA Hook (`/lib/hooks/usePWA.ts`)
```typescript
import { usePWA } from '@/lib/hooks/usePWA';

const {
  isInstalled,
  online,
  install,
  requestNotifications
} = usePWA();
```

## Quick Commands

### Development
```bash
# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run tests
npm test __tests__/lib/pwa.test.ts
```

### Testing PWA
```bash
# 1. Build and start
npm run build && npm start

# 2. Open http://localhost:3000
# 3. Open DevTools > Application > Service Workers
# 4. Test offline mode
```

### Generate VAPID Keys
```bash
npx web-push generate-vapid-keys
```

## Common Tasks

### Check Installation Status
```typescript
const { isInstalled } = usePWA();
if (isInstalled) {
  console.log('App is installed');
}
```

### Show Install Prompt
```typescript
const { canInstall, install } = usePWA();
if (canInstall) {
  await install();
}
```

### Check Online Status
```typescript
const { online, connectionType } = usePWA();
console.log(`Status: ${online ? 'Online' : 'Offline'} (${connectionType})`);
```

### Store Data Offline
```typescript
import { productStorage } from '@/lib/pwa/offline-storage';

// Save products
await productStorage.saveMany(products);

// Get products
const products = await productStorage.getAll();

// Get by category
const electronics = await productStorage.getByCategory('electronics');
```

### Add to Sync Queue
```typescript
import { syncQueueStorage } from '@/lib/pwa/offline-storage';

await syncQueueStorage.add({
  type: 'order',
  url: '/api/orders',
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(orderData),
});
```

### Enable Push Notifications
```typescript
const { requestNotifications, subscribePush } = usePWA();

const permission = await requestNotifications();
if (permission === 'granted') {
  const subscription = await subscribePush();
  // Send to server
}
```

## Cache Strategies

| Content Type | Strategy | TTL |
|-------------|----------|-----|
| Static Assets | Cache First | 7 days |
| API Responses | Network First | 5 minutes |
| Images | Cache First | 30 days |
| Dynamic Pages | Network First | 1 day |

## Environment Variables

```env
# .env.local
NEXT_PUBLIC_BASE_URL=https://techshop.ua
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_public_key
VAPID_PRIVATE_KEY=your_private_key
```

## Icon Checklist

Create in `/public/icons/`:
- [ ] icon-72x72.png
- [ ] icon-96x96.png
- [ ] icon-128x128.png
- [ ] icon-144x144.png
- [ ] icon-152x152.png
- [ ] icon-192x192.png (maskable)
- [ ] icon-384x384.png
- [ ] icon-512x512.png (maskable)
- [ ] badge-72x72.png
- [ ] shortcut-catalog.png
- [ ] shortcut-cart.png
- [ ] shortcut-promo.png
- [ ] shortcut-profile.png

## Screenshots Checklist

Create in `/public/screenshots/`:
- [ ] home-mobile.png (750x1334)
- [ ] catalog-mobile.png (750x1334)
- [ ] home-desktop.png (1920x1080)

## Deployment Checklist

- [ ] Build application (`npm run build`)
- [ ] Verify manifest.json is accessible
- [ ] Verify sw-offline.js is accessible
- [ ] Generate VAPID keys
- [ ] Set environment variables
- [ ] Create all icon assets
- [ ] Create screenshots
- [ ] Test on HTTPS server
- [ ] Run Lighthouse audit (target: PWA 100)
- [ ] Test on iOS Safari
- [ ] Test on Android Chrome
- [ ] Test offline mode
- [ ] Test install prompt
- [ ] Test push notifications

## Troubleshooting

### Service Worker Not Registering
1. Check HTTPS (required in production)
2. Verify `/sw-offline.js` is accessible
3. Check browser console for errors
4. Clear site data and reload

### Install Prompt Not Showing
1. Verify HTTPS
2. Check manifest.json is valid
3. Service worker must be active
4. App not already installed
5. User hasn't dismissed it

### Offline Not Working
1. Visit pages while online first
2. Check cache in DevTools
3. Verify service worker is active
4. Check fetch handler in SW

## Browser Support

| Browser | Version | Support |
|---------|---------|---------|
| Chrome | 90+ | Full |
| Edge | 90+ | Full |
| Firefox | 90+ | Full |
| Safari | 15.4+ | Full |
| iOS Safari | 11.3+ | Partial (no push) |
| Samsung Internet | 15+ | Full |

## Performance Targets

- Performance: 90+
- PWA Score: 100
- Accessibility: 95+
- Best Practices: 95+
- SEO: 100

## Documentation

- **Full Docs**: `/docs/PWA.md`
- **Setup Guide**: `/docs/PWA_SETUP.md`
- **Summary**: `/PWA_IMPLEMENTATION_SUMMARY.md`

## Support

1. Check documentation files
2. Review browser console
3. Use Lighthouse audit
4. Check DevTools Application tab
5. Create GitHub issue

---

**Last Updated**: December 13, 2025
**Version**: 1.0.0
**Status**: Production Ready
