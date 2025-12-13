# PWA Setup Guide

## Quick Start

### 1. Install Dependencies

All required dependencies are already included in `package.json`:
- `next` - Next.js framework with PWA support
- No additional PWA libraries needed (vanilla implementation)

### 2. Service Worker Registration

The service worker is automatically registered via the `PWARegister` component in the root layout:

```tsx
// app/layout.tsx
import PWARegister from "@/components/PWARegister";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <PWARegister />
        {/* other components */}
      </body>
    </html>
  );
}
```

### 3. Manifest Configuration

The web app manifest is located at `/public/manifest.json` and is already linked in the layout:

```tsx
export const metadata: Metadata = {
  manifest: "/manifest.json",
  // ...other metadata
};
```

### 4. Icon Assets

Create the following icon files in `/public/icons/`:
- `icon-72x72.png`
- `icon-96x96.png`
- `icon-128x128.png`
- `icon-144x144.png`
- `icon-152x152.png`
- `icon-192x192.png` (maskable)
- `icon-384x384.png`
- `icon-512x512.png` (maskable)
- `badge-72x72.png` (for notifications)

Additional shortcut icons:
- `shortcut-catalog.png`
- `shortcut-cart.png`
- `shortcut-promo.png`
- `shortcut-profile.png`

### 5. Screenshots (Optional but Recommended)

Create screenshots in `/public/screenshots/`:
- `home-mobile.png` (750x1334)
- `catalog-mobile.png` (750x1334)
- `home-desktop.png` (1920x1080)

## Development

### Testing PWA Locally

1. **Build for Production**:
   ```bash
   npm run build
   npm start
   ```

2. **Open Chrome DevTools**:
   - Go to Application tab
   - Check "Service Workers" section
   - Verify service worker is registered

3. **Test Offline Mode**:
   - Check "Offline" checkbox in DevTools
   - Navigate the site
   - Verify cached content loads

### Testing Install Prompt

1. Clear site data in DevTools
2. Reload the page
3. Wait 3 seconds for install prompt
4. Click "Install" or use browser install button

### Testing on Mobile

#### Android
1. Build and deploy to a test server with HTTPS
2. Open in Chrome Android
3. Look for "Add to Home Screen" in menu
4. Install and test

#### iOS
1. Deploy to HTTPS server
2. Open in Safari iOS
3. Tap Share > Add to Home Screen
4. Test installed app

## Production Deployment

### Prerequisites
- HTTPS is **required** for PWA features
- Valid SSL certificate
- Proper server configuration

### Deployment Steps

1. **Build the application**:
   ```bash
   npm run build
   ```

2. **Verify manifest is accessible**:
   ```
   https://yourdomain.com/manifest.json
   ```

3. **Verify service worker is accessible**:
   ```
   https://yourdomain.com/sw-offline.js
   ```

4. **Test with Lighthouse**:
   - Open Chrome DevTools
   - Go to Lighthouse tab
   - Run PWA audit
   - Aim for 100 score

### Server Configuration

#### Nginx Example

```nginx
# Service Worker
location /sw-offline.js {
    add_header Cache-Control "public, max-age=0, must-revalidate";
    add_header Service-Worker-Allowed "/";
}

# Manifest
location /manifest.json {
    add_header Cache-Control "public, max-age=604800";
    add_header Content-Type "application/manifest+json";
}

# Icons
location /icons/ {
    add_header Cache-Control "public, max-age=31536000, immutable";
}
```

#### Apache Example

```apache
# .htaccess
<Files "sw-offline.js">
    Header set Cache-Control "public, max-age=0, must-revalidate"
    Header set Service-Worker-Allowed "/"
</Files>

<Files "manifest.json">
    Header set Cache-Control "public, max-age=604800"
    Header set Content-Type "application/manifest+json"
</Files>

<IfModule mod_headers.c>
    <FilesMatch "\.(png|jpg|jpeg|gif|svg|ico)$">
        Header set Cache-Control "public, max-age=31536000, immutable"
    </FilesMatch>
</IfModule>
```

## Environment Variables

Add these to your `.env.local` (development) and production environment:

```env
# Base URL for the app
NEXT_PUBLIC_BASE_URL=https://techshop.ua

# VAPID keys for push notifications (generate with web-push library)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_public_key_here
VAPID_PRIVATE_KEY=your_private_key_here
```

### Generating VAPID Keys

```bash
npx web-push generate-vapid-keys
```

## Using PWA Features in Your Code

### Check Installation Status

```tsx
import { usePWA } from '@/lib/hooks/usePWA';

function MyComponent() {
  const { isInstalled, canInstall, install } = usePWA();

  return (
    <div>
      {isInstalled ? (
        <p>App is installed</p>
      ) : canInstall ? (
        <button onClick={install}>Install App</button>
      ) : null}
    </div>
  );
}
```

### Check Online Status

```tsx
import { usePWA } from '@/lib/hooks/usePWA';

function MyComponent() {
  const { online, connectionType, slowConnection } = usePWA();

  return (
    <div>
      {!online && <p>You are offline</p>}
      {slowConnection && <p>Slow connection detected</p>}
      <p>Connection: {connectionType}</p>
    </div>
  );
}
```

### Store Data Offline

```tsx
import { productStorage } from '@/lib/pwa/offline-storage';

async function saveProducts(products) {
  await productStorage.saveMany(products);
}

async function loadProducts() {
  return await productStorage.getAll();
}
```

### Background Sync

```tsx
import { syncQueueStorage } from '@/lib/pwa/offline-storage';
import { usePWA } from '@/lib/hooks/usePWA';

function MyComponent() {
  const { syncData } = usePWA();

  async function placeOrder(orderData) {
    // Add to sync queue
    await syncQueueStorage.add({
      type: 'order',
      url: '/api/orders',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData),
    });

    // Trigger background sync
    await syncData('sync-orders');
  }

  return <button onClick={() => placeOrder(data)}>Place Order</button>;
}
```

### Push Notifications

```tsx
import { usePWA } from '@/lib/hooks/usePWA';

function NotificationSettings() {
  const { notificationPermission, requestNotifications, subscribePush } = usePWA();

  async function enableNotifications() {
    const permission = await requestNotifications();

    if (permission === 'granted') {
      const subscription = await subscribePush();
      // Send subscription to server
      await fetch('/api/push/subscribe', {
        method: 'POST',
        body: JSON.stringify(subscription),
      });
    }
  }

  return (
    <button
      onClick={enableNotifications}
      disabled={notificationPermission === 'granted'}
    >
      {notificationPermission === 'granted' ? 'Enabled' : 'Enable Notifications'}
    </button>
  );
}
```

## Monitoring and Analytics

### Track PWA Installation

```tsx
useEffect(() => {
  window.addEventListener('appinstalled', () => {
    // Track installation
    gtag('event', 'pwa_install', {
      event_category: 'PWA',
      event_label: 'App Installed',
    });
  });
}, []);
```

### Track Offline Usage

```tsx
import { addNetworkListener } from '@/lib/pwa/pwa-utils';

useEffect(() => {
  const cleanup = addNetworkListener((online) => {
    if (!online) {
      // Track offline usage
      gtag('event', 'offline_mode', {
        event_category: 'PWA',
        event_label: 'User went offline',
      });
    }
  });

  return cleanup;
}, []);
```

### Monitor Cache Performance

Check service worker cache hits in Chrome DevTools:
1. Application tab
2. Cache Storage
3. View cached resources

## Troubleshooting

### Service Worker Not Updating

**Problem**: Changes to service worker not reflected

**Solution**:
1. Update `CACHE_VERSION` in `sw-offline.js`
2. Clear site data in DevTools
3. Hard reload (Ctrl+Shift+R)

### Install Prompt Not Showing

**Problem**: BeforeInstallPrompt event not firing

**Solution**:
1. Verify HTTPS (required)
2. Check manifest.json is valid
3. Service worker must be registered
4. User hasn't dismissed it before
5. App not already installed

### Offline Page Not Loading

**Problem**: Navigation shows blank page offline

**Solution**:
1. Ensure `/offline` is in STATIC_ASSETS cache
2. Verify service worker fetch handler
3. Check network tab for failed requests

### Push Notifications Not Working

**Problem**: Notifications not appearing

**Solution**:
1. Check notification permission is granted
2. Verify VAPID keys are configured
3. Test with browser notification API
4. Check service worker is active

## Best Practices

### 1. Cache Strategy
- **Static assets**: Cache First (long TTL)
- **API responses**: Network First (short TTL)
- **Images**: Cache First with size limits
- **User content**: Network First

### 2. Update Strategy
- Increment cache version on changes
- Show update notification to users
- Allow users to refresh manually
- Implement skip waiting carefully

### 3. Storage Management
- Set reasonable cache size limits
- Clean old caches regularly
- Monitor storage usage
- Request persistent storage for important data

### 4. User Experience
- Show offline indicator
- Provide feedback for sync operations
- Handle errors gracefully
- Allow users to control PWA features

### 5. Performance
- Minimize service worker size
- Use efficient caching strategies
- Lazy load non-critical code
- Monitor cache hit rates

## Resources

- [PWA Documentation](./PWA.md)
- [Next.js PWA Guide](https://nextjs.org/docs/pages/building-your-application/configuring/progressive-web-apps)
- [Web.dev PWA](https://web.dev/progressive-web-apps/)
- [MDN Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Workbox](https://developers.google.com/web/tools/workbox) (for advanced caching)

## Support

For issues or questions:
1. Check [PWA.md](./PWA.md) documentation
2. Review browser console for errors
3. Use Lighthouse for PWA audit
4. Check DevTools Application tab
5. Create GitHub issue with details
