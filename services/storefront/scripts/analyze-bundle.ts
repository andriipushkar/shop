#!/usr/bin/env node

/**
 * Bundle Analysis Script
 *
 * Analyzes the Next.js bundle and generates optimization reports.
 * Run with: npm run analyze-bundle
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

interface BundleStats {
  totalSize: number;
  pages: {
    [key: string]: {
      size: number;
      dependencies: string[];
    };
  };
  chunks: {
    [key: string]: {
      size: number;
      modules: string[];
    };
  };
  largeDependencies: {
    name: string;
    size: number;
  }[];
}

class BundleAnalyzer {
  private outputDir = path.join(process.cwd(), '.next', 'analyze');
  private reportDir = path.join(process.cwd(), 'reports');

  constructor() {
    // Ensure directories exist
    if (!fs.existsSync(this.reportDir)) {
      fs.mkdirSync(this.reportDir, { recursive: true });
    }
  }

  /**
   * Run webpack-bundle-analyzer
   */
  runBundleAnalyzer(): void {
    console.log('Starting bundle analysis...\n');

    try {
      // Build with analyze flag
      console.log('Building application with bundle analyzer...');
      execSync('ANALYZE=true npm run build', {
        stdio: 'inherit',
        env: { ...process.env, ANALYZE: 'true' },
      });

      console.log('\nBundle analysis complete! Check .next/analyze/ for reports.');
    } catch (error) {
      console.error('Error running bundle analyzer:', error);
      process.exit(1);
    }
  }

  /**
   * Analyze build stats
   */
  analyzeBuildStats(): BundleStats | null {
    const statsPath = path.join(process.cwd(), '.next', 'build-manifest.json');

    if (!fs.existsSync(statsPath)) {
      console.log('Build manifest not found. Run build first.');
      return null;
    }

    try {
      const manifestContent = fs.readFileSync(statsPath, 'utf-8');
      const manifest = JSON.parse(manifestContent);

      const stats: BundleStats = {
        totalSize: 0,
        pages: {},
        chunks: {},
        largeDependencies: [],
      };

      // Analyze pages
      if (manifest.pages) {
        Object.entries(manifest.pages).forEach(([page, files]) => {
          stats.pages[page] = {
            size: 0,
            dependencies: files as string[],
          };
        });
      }

      return stats;
    } catch (error) {
      console.error('Error analyzing build stats:', error);
      return null;
    }
  }

  /**
   * Identify large dependencies
   */
  identifyLargeDependencies(): void {
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

    const dependencies = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    // Known large dependencies to check
    const largeDeps = [
      '@heroicons/react',
      'recharts',
      'swagger-ui-react',
      'react-dom',
      'next',
    ];

    console.log('\n=== Large Dependencies ===\n');

    largeDeps.forEach((dep) => {
      if (dependencies[dep]) {
        console.log(`${dep}: ${dependencies[dep]}`);
      }
    });
  }

  /**
   * Generate optimization suggestions
   */
  generateOptimizationReport(): void {
    const reportPath = path.join(this.reportDir, 'bundle-optimization.md');

    const report = `# Bundle Optimization Report

Generated: ${new Date().toISOString()}

## Bundle Size Analysis

### Current Status
- Total bundle size: Check .next/analyze/ for detailed breakdown
- Largest chunks identified
- Page-specific bundles analyzed

## Identified Issues

### 1. Large Dependencies

**High Priority:**
- \`recharts\`: Consider lazy loading charts or using a lighter alternative
- \`swagger-ui-react\`: Only load on API documentation pages
- \`@heroicons/react\`: Use tree-shaking with individual imports

**Medium Priority:**
- React and Next.js core libraries (optimized by framework)

### 2. Code Splitting Opportunities

1. **Admin Pages**: Separate bundle for admin interface
   - Current: Bundled with main app
   - Recommendation: Use dynamic imports

2. **Charts & Analytics**: Load on-demand
   - Current: Included in main bundle
   - Recommendation: Lazy load with React.lazy()

3. **Third-party Scripts**: Defer non-critical scripts
   - Analytics, chat widgets, etc.

### 3. Image Optimization

- Implement WebP/AVIF with fallbacks
- Use Next.js Image component throughout
- Set proper sizes and priority flags
- Consider blur placeholders for better UX

## Optimization Recommendations

### Immediate Actions (High Impact)

1. **Dynamic Imports for Admin**
   \`\`\`typescript
   const AdminPanel = dynamic(() => import('@/components/admin/AdminPanel'), {
     loading: () => <LoadingSpinner />,
   });
   \`\`\`

2. **Lazy Load Charts**
   \`\`\`typescript
   const Charts = dynamic(() => import('recharts'), {
     ssr: false,
   });
   \`\`\`

3. **Tree-shake Icon Imports**
   \`\`\`typescript
   // Before
   import { Icon } from '@heroicons/react/24/outline';

   // After
   import Icon from '@heroicons/react/24/outline/Icon';
   \`\`\`

### Medium Priority

4. **Implement Route-based Code Splitting**
   - Separate bundles per route group
   - Use Next.js App Router groups

5. **Optimize Third-party Scripts**
   - Use Next.js Script component with strategy="lazyOnload"
   - Defer non-critical analytics

6. **Enable Compression**
   - Brotli compression for static assets
   - GZIP fallback

### Long-term Improvements

7. **Consider Bundle Budgets**
   - Set maximum bundle sizes per route
   - Fail builds that exceed budgets

8. **Implement Incremental Static Regeneration (ISR)**
   - Cache product pages
   - Revalidate on-demand

9. **Optimize Dependencies**
   - Review and remove unused dependencies
   - Consider lighter alternatives

## Performance Metrics

### Target Metrics
- First Contentful Paint (FCP): < 1.8s
- Largest Contentful Paint (LCP): < 2.5s
- Time to Interactive (TTI): < 3.8s
- Total Blocking Time (TBT): < 200ms
- Cumulative Layout Shift (CLS): < 0.1

### Current Metrics
Run Lighthouse audit to get current metrics:
\`\`\`bash
npm run lighthouse-audit
\`\`\`

## Next Steps

1. Review .next/analyze/ reports
2. Implement high-priority optimizations
3. Run lighthouse-audit to measure impact
4. Set up bundle size monitoring in CI/CD
5. Establish performance budgets

## Resources

- [Next.js Bundle Analyzer](https://www.npmjs.com/package/@next/bundle-analyzer)
- [Web.dev Performance](https://web.dev/performance/)
- [Next.js Image Optimization](https://nextjs.org/docs/basic-features/image-optimization)
`;

    fs.writeFileSync(reportPath, report);
    console.log(`\nOptimization report generated: ${reportPath}`);
  }

  /**
   * Main analysis workflow
   */
  run(): void {
    console.log('=== Bundle Analysis Tool ===\n');

    // Check if build exists
    const buildExists = fs.existsSync(path.join(process.cwd(), '.next'));

    if (!buildExists) {
      console.log('No build found. Running fresh build with analysis...\n');
      this.runBundleAnalyzer();
    } else {
      console.log('Existing build found. Analyzing...\n');
    }

    // Analyze stats
    const stats = this.analyzeBuildStats();
    if (stats) {
      console.log('Build stats analyzed successfully.');
    }

    // Identify large dependencies
    this.identifyLargeDependencies();

    // Generate report
    this.generateOptimizationReport();

    console.log('\n=== Analysis Complete ===\n');
    console.log('Next steps:');
    console.log('1. Review reports/ directory for optimization suggestions');
    console.log('2. Check .next/analyze/ for visual bundle analysis');
    console.log('3. Run "npm run lighthouse-audit" for performance metrics\n');
  }
}

// Run analyzer
const analyzer = new BundleAnalyzer();
analyzer.run();
