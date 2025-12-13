#!/usr/bin/env node

/**
 * Lighthouse Performance Audit Script
 *
 * Runs Lighthouse CI audits and generates performance reports.
 * Compares against baselines and fails on regressions.
 *
 * Usage:
 * - npm run lighthouse-audit
 * - npm run lighthouse-audit -- --url=https://example.com
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

interface LighthouseScore {
  performance: number;
  accessibility: number;
  bestPractices: number;
  seo: number;
  pwa: number;
}

interface LighthouseMetrics {
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  totalBlockingTime: number;
  cumulativeLayoutShift: number;
  speedIndex: number;
  timeToInteractive: number;
}

interface LighthouseResult {
  url: string;
  timestamp: string;
  scores: LighthouseScore;
  metrics: LighthouseMetrics;
  passed: boolean;
  issues: string[];
}

interface PerformanceBaseline {
  scores: {
    performance: number;
    accessibility: number;
    bestPractices: number;
    seo: number;
  };
  metrics: {
    fcp: number; // First Contentful Paint
    lcp: number; // Largest Contentful Paint
    tbt: number; // Total Blocking Time
    cls: number; // Cumulative Layout Shift
    si: number; // Speed Index
    tti: number; // Time to Interactive
  };
}

class LighthouseAuditor {
  private reportsDir: string;
  private baselineFile: string;
  private lighthouseDir: string;

  constructor() {
    this.reportsDir = path.join(process.cwd(), 'reports', 'lighthouse');
    this.baselineFile = path.join(this.reportsDir, 'baseline.json');
    this.lighthouseDir = path.join(process.cwd(), '.lighthouseci');

    // Ensure directories exist
    [this.reportsDir, this.lighthouseDir].forEach((dir) => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  /**
   * Get baseline scores
   */
  getBaseline(): PerformanceBaseline {
    const defaultBaseline: PerformanceBaseline = {
      scores: {
        performance: 90,
        accessibility: 90,
        bestPractices: 90,
        seo: 90,
      },
      metrics: {
        fcp: 1800, // 1.8s
        lcp: 2500, // 2.5s
        tbt: 200, // 200ms
        cls: 0.1, // 0.1
        si: 3400, // 3.4s
        tti: 3800, // 3.8s
      },
    };

    if (fs.existsSync(this.baselineFile)) {
      try {
        const baseline = JSON.parse(fs.readFileSync(this.baselineFile, 'utf-8'));
        return { ...defaultBaseline, ...baseline };
      } catch (error) {
        console.warn('Could not read baseline file, using defaults');
        return defaultBaseline;
      }
    }

    return defaultBaseline;
  }

  /**
   * Save baseline
   */
  saveBaseline(baseline: PerformanceBaseline): void {
    fs.writeFileSync(this.baselineFile, JSON.stringify(baseline, null, 2));
    console.log(`Baseline saved to ${this.baselineFile}`);
  }

  /**
   * Run Lighthouse audit
   */
  async runAudit(url: string): Promise<LighthouseResult> {
    console.log(`Running Lighthouse audit for ${url}...\n`);

    const timestamp = new Date().toISOString();
    const reportPath = path.join(
      this.reportsDir,
      `lighthouse-${Date.now()}.json`
    );

    try {
      // Run Lighthouse
      const command = `npx lighthouse ${url} \
        --output=json \
        --output-path=${reportPath} \
        --chrome-flags="--headless --no-sandbox --disable-gpu" \
        --only-categories=performance,accessibility,best-practices,seo,pwa \
        --preset=desktop`;

      execSync(command, { stdio: 'inherit' });

      // Read and parse report
      const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));

      // Extract scores
      const scores: LighthouseScore = {
        performance: Math.round(report.categories.performance.score * 100),
        accessibility: Math.round(report.categories.accessibility.score * 100),
        bestPractices: Math.round(
          report.categories['best-practices'].score * 100
        ),
        seo: Math.round(report.categories.seo.score * 100),
        pwa: report.categories.pwa
          ? Math.round(report.categories.pwa.score * 100)
          : 0,
      };

      // Extract metrics
      const audits = report.audits;
      const metrics: LighthouseMetrics = {
        firstContentfulPaint: audits['first-contentful-paint'].numericValue,
        largestContentfulPaint:
          audits['largest-contentful-paint'].numericValue,
        totalBlockingTime: audits['total-blocking-time'].numericValue,
        cumulativeLayoutShift: audits['cumulative-layout-shift'].numericValue,
        speedIndex: audits['speed-index'].numericValue,
        timeToInteractive: audits['interactive'].numericValue,
      };

      // Compare with baseline
      const baseline = this.getBaseline();
      const { passed, issues } = this.compareWithBaseline(
        scores,
        metrics,
        baseline
      );

      return {
        url,
        timestamp,
        scores,
        metrics,
        passed,
        issues,
      };
    } catch (error) {
      console.error('Lighthouse audit failed:', error);
      throw error;
    }
  }

  /**
   * Compare results with baseline
   */
  compareWithBaseline(
    scores: LighthouseScore,
    metrics: LighthouseMetrics,
    baseline: PerformanceBaseline
  ): { passed: boolean; issues: string[] } {
    const issues: string[] = [];

    // Check scores
    if (scores.performance < baseline.scores.performance) {
      issues.push(
        `Performance score (${scores.performance}) below baseline (${baseline.scores.performance})`
      );
    }

    if (scores.accessibility < baseline.scores.accessibility) {
      issues.push(
        `Accessibility score (${scores.accessibility}) below baseline (${baseline.scores.accessibility})`
      );
    }

    if (scores.bestPractices < baseline.scores.bestPractices) {
      issues.push(
        `Best Practices score (${scores.bestPractices}) below baseline (${baseline.scores.bestPractices})`
      );
    }

    if (scores.seo < baseline.scores.seo) {
      issues.push(
        `SEO score (${scores.seo}) below baseline (${baseline.scores.seo})`
      );
    }

    // Check metrics
    if (metrics.firstContentfulPaint > baseline.metrics.fcp) {
      issues.push(
        `FCP (${Math.round(metrics.firstContentfulPaint)}ms) exceeds baseline (${baseline.metrics.fcp}ms)`
      );
    }

    if (metrics.largestContentfulPaint > baseline.metrics.lcp) {
      issues.push(
        `LCP (${Math.round(metrics.largestContentfulPaint)}ms) exceeds baseline (${baseline.metrics.lcp}ms)`
      );
    }

    if (metrics.totalBlockingTime > baseline.metrics.tbt) {
      issues.push(
        `TBT (${Math.round(metrics.totalBlockingTime)}ms) exceeds baseline (${baseline.metrics.tbt}ms)`
      );
    }

    if (metrics.cumulativeLayoutShift > baseline.metrics.cls) {
      issues.push(
        `CLS (${metrics.cumulativeLayoutShift.toFixed(3)}) exceeds baseline (${baseline.metrics.cls})`
      );
    }

    return {
      passed: issues.length === 0,
      issues,
    };
  }

  /**
   * Generate report
   */
  generateReport(results: LighthouseResult[]): void {
    const reportPath = path.join(this.reportsDir, 'audit-summary.md');

    let markdown = `# Lighthouse Audit Summary\n\n`;
    markdown += `Generated: ${new Date().toISOString()}\n\n`;

    results.forEach((result, index) => {
      markdown += `## Audit ${index + 1}: ${result.url}\n\n`;
      markdown += `**Timestamp:** ${result.timestamp}\n\n`;
      markdown += `**Status:** ${result.passed ? '✅ PASSED' : '❌ FAILED'}\n\n`;

      markdown += `### Scores\n\n`;
      markdown += `| Category | Score |\n`;
      markdown += `|----------|-------|\n`;
      markdown += `| Performance | ${result.scores.performance}/100 ${this.getScoreEmoji(result.scores.performance)} |\n`;
      markdown += `| Accessibility | ${result.scores.accessibility}/100 ${this.getScoreEmoji(result.scores.accessibility)} |\n`;
      markdown += `| Best Practices | ${result.scores.bestPractices}/100 ${this.getScoreEmoji(result.scores.bestPractices)} |\n`;
      markdown += `| SEO | ${result.scores.seo}/100 ${this.getScoreEmoji(result.scores.seo)} |\n`;
      markdown += `| PWA | ${result.scores.pwa}/100 ${this.getScoreEmoji(result.scores.pwa)} |\n\n`;

      markdown += `### Core Web Vitals\n\n`;
      markdown += `| Metric | Value | Status |\n`;
      markdown += `|--------|-------|--------|\n`;
      markdown += `| FCP (First Contentful Paint) | ${Math.round(result.metrics.firstContentfulPaint)}ms | ${result.metrics.firstContentfulPaint < 1800 ? '✅' : '❌'} |\n`;
      markdown += `| LCP (Largest Contentful Paint) | ${Math.round(result.metrics.largestContentfulPaint)}ms | ${result.metrics.largestContentfulPaint < 2500 ? '✅' : '❌'} |\n`;
      markdown += `| TBT (Total Blocking Time) | ${Math.round(result.metrics.totalBlockingTime)}ms | ${result.metrics.totalBlockingTime < 200 ? '✅' : '❌'} |\n`;
      markdown += `| CLS (Cumulative Layout Shift) | ${result.metrics.cumulativeLayoutShift.toFixed(3)} | ${result.metrics.cumulativeLayoutShift < 0.1 ? '✅' : '❌'} |\n`;
      markdown += `| SI (Speed Index) | ${Math.round(result.metrics.speedIndex)}ms | ${result.metrics.speedIndex < 3400 ? '✅' : '❌'} |\n`;
      markdown += `| TTI (Time to Interactive) | ${Math.round(result.metrics.timeToInteractive)}ms | ${result.metrics.timeToInteractive < 3800 ? '✅' : '❌'} |\n\n`;

      if (result.issues.length > 0) {
        markdown += `### Issues\n\n`;
        result.issues.forEach((issue) => {
          markdown += `- ⚠️ ${issue}\n`;
        });
        markdown += `\n`;
      }
    });

    markdown += `## Recommendations\n\n`;
    markdown += `1. Keep performance score above 90\n`;
    markdown += `2. Optimize images and use modern formats (WebP/AVIF)\n`;
    markdown += `3. Minimize JavaScript bundle size\n`;
    markdown += `4. Use code splitting and lazy loading\n`;
    markdown += `5. Implement proper caching strategies\n`;
    markdown += `6. Reduce server response times\n`;
    markdown += `7. Eliminate render-blocking resources\n`;
    markdown += `8. Minimize layout shifts\n\n`;

    fs.writeFileSync(reportPath, markdown);
    console.log(`\nReport generated: ${reportPath}`);
  }

  /**
   * Get score emoji
   */
  private getScoreEmoji(score: number): string {
    if (score >= 90) return '✅';
    if (score >= 50) return '⚠️';
    return '❌';
  }

  /**
   * Run complete audit workflow
   */
  async run(urls: string[]): Promise<void> {
    console.log('=== Lighthouse Performance Audit ===\n');

    const results: LighthouseResult[] = [];

    for (const url of urls) {
      try {
        const result = await this.runAudit(url);
        results.push(result);

        console.log(`\n✅ Audit completed for ${url}`);
        console.log(`Performance: ${result.scores.performance}/100`);
        console.log(`Passed: ${result.passed ? 'Yes' : 'No'}`);

        if (result.issues.length > 0) {
          console.log(`\nIssues found:`);
          result.issues.forEach((issue) => console.log(`  - ${issue}`));
        }
      } catch (error) {
        console.error(`\n❌ Audit failed for ${url}:`, error);
      }
    }

    // Generate summary report
    this.generateReport(results);

    // Exit with error if any audit failed
    const allPassed = results.every((r) => r.passed);
    if (!allPassed) {
      console.error(
        '\n❌ Some audits failed. Check the report for details.\n'
      );
      process.exit(1);
    }

    console.log('\n✅ All audits passed!\n');
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const urlArg = args.find((arg) => arg.startsWith('--url='));
const urls = urlArg
  ? [urlArg.split('=')[1]]
  : ['http://localhost:3000']; // Default to localhost

// Run auditor
const auditor = new LighthouseAuditor();
auditor.run(urls).catch((error) => {
  console.error('Audit failed:', error);
  process.exit(1);
});
