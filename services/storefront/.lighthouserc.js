/**
 * Lighthouse CI Configuration
 *
 * Configuration for automated Lighthouse audits in CI/CD pipeline.
 * Defines performance budgets and assertion thresholds.
 */

module.exports = {
  ci: {
    collect: {
      // URLs to audit
      url: [
        'http://localhost:3000',
        'http://localhost:3000/products',
        'http://localhost:3000/catalog',
        'http://localhost:3000/cart',
      ],
      // Number of runs per URL
      numberOfRuns: 3,
      // Lighthouse settings
      settings: {
        preset: 'desktop',
        // Additional Chrome flags
        chromeFlags: '--no-sandbox --disable-gpu',
        // Only run specific categories
        onlyCategories: [
          'performance',
          'accessibility',
          'best-practices',
          'seo',
        ],
      },
      // Start server before running tests
      startServerCommand: 'npm run build && npm run start',
      startServerReadyPattern: 'Ready',
      startServerReadyTimeout: 60000,
    },

    assert: {
      // Performance budgets - fail if thresholds not met
      assertions: {
        // Category scores (0-1)
        'categories:performance': ['error', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['error', { minScore: 0.9 }],
        'categories:seo': ['error', { minScore: 0.9 }],

        // Core Web Vitals
        'first-contentful-paint': ['error', { maxNumericValue: 1800 }], // 1.8s
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }], // 2.5s
        'total-blocking-time': ['error', { maxNumericValue: 200 }], // 200ms
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }], // 0.1
        'speed-index': ['error', { maxNumericValue: 3400 }], // 3.4s
        'interactive': ['error', { maxNumericValue: 3800 }], // 3.8s

        // Resource budgets
        'resource-summary:script:size': ['error', { maxNumericValue: 350000 }], // 350KB
        'resource-summary:stylesheet:size': [
          'error',
          { maxNumericValue: 50000 },
        ], // 50KB
        'resource-summary:image:size': ['error', { maxNumericValue: 500000 }], // 500KB
        'resource-summary:font:size': ['error', { maxNumericValue: 100000 }], // 100KB
        'resource-summary:total:size': [
          'error',
          { maxNumericValue: 2000000 },
        ], // 2MB

        // Best practices
        'uses-responsive-images': ['error', { minScore: 0.9 }],
        'uses-optimized-images': ['error', { minScore: 0.9 }],
        'modern-image-formats': ['warn', { minScore: 0.8 }],
        'uses-text-compression': ['error', { minScore: 1 }],
        'uses-rel-preconnect': ['warn', { minScore: 0.8 }],

        // Warnings (won't fail the build)
        'uses-webp-images': ['warn', { minScore: 0.8 }],
        'offscreen-images': ['warn', { minScore: 0.8 }],
        'unminified-css': ['warn', { minScore: 1 }],
        'unminified-javascript': ['warn', { minScore: 1 }],
      },
    },

    upload: {
      // Upload results to temporary public storage
      target: 'temporary-public-storage',
    },

    // Server configuration
    server: {
      // Storage directory for reports
      storage: {
        storageMethod: 'filesystem',
        storagePath: './.lighthouseci',
      },
    },
  },
};
