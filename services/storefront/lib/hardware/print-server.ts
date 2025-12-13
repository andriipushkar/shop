/**
 * Print Server Client
 * Клієнт для локального принт-сервера
 * Для друку без діалогових вікон браузера
 */

'use client';

export interface PrintServerConfig {
  serverUrl: string; // http://localhost:9100
  apiKey?: string;
  timeout?: number; // Request timeout in ms
}

export interface PrinterInfo {
  name: string;
  id: string;
  type: 'thermal' | 'receipt' | 'label' | 'document';
  status: 'ready' | 'busy' | 'offline' | 'error';
  model?: string;
  connection?: 'usb' | 'network' | 'bluetooth';
  capabilities?: string[];
}

export interface PrintJob {
  id: string;
  printer: string;
  type: 'label' | 'receipt' | 'document';
  content: string | Uint8Array;
  copies: number;
  status: 'pending' | 'printing' | 'completed' | 'error';
  createdAt: string;
  completedAt?: string;
  error?: string;
}

export interface PrintRequest {
  printer: string;
  content: string | Uint8Array;
  copies?: number;
  type?: 'zpl' | 'tspl' | 'escpos' | 'pdf';
}

export class PrintServerClient {
  private config: PrintServerConfig;
  private baseUrl: string;

  constructor(config: PrintServerConfig) {
    this.config = {
      timeout: 30000,
      ...config,
    };
    this.baseUrl = config.serverUrl.replace(/\/$/, '');
  }

  /**
   * Get available printers
   */
  async getPrinters(): Promise<PrinterInfo[]> {
    try {
      const response = await this.request('/printers', {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error(`Failed to get printers: ${response.statusText}`);
      }

      const data = await response.json();
      return data.printers || [];
    } catch (error) {
      console.error('Failed to get printers:', error);
      throw error;
    }
  }

  /**
   * Get printer by name or ID
   */
  async getPrinter(nameOrId: string): Promise<PrinterInfo | null> {
    try {
      const printers = await this.getPrinters();
      return printers.find((p) => p.name === nameOrId || p.id === nameOrId) || null;
    } catch (error) {
      console.error('Failed to get printer:', error);
      return null;
    }
  }

  /**
   * Print to specific printer
   */
  async print(
    printerName: string,
    content: string | Uint8Array,
    copies: number = 1
  ): Promise<PrintJob> {
    try {
      const body: any = {
        printer: printerName,
        copies,
      };

      if (typeof content === 'string') {
        body.content = content;
        body.type = this.detectContentType(content);
      } else {
        body.content = Array.from(content);
        body.type = 'raw';
      }

      const response = await this.request('/print', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Print failed: ${error}`);
      }

      const data = await response.json();
      return data.job;
    } catch (error) {
      console.error('Failed to print:', error);
      throw error;
    }
  }

  /**
   * Print label directly (ZPL/TSPL)
   */
  async printLabel(printerName: string, zpl: string, copies: number = 1): Promise<PrintJob> {
    try {
      const response = await this.request('/print/label', {
        method: 'POST',
        body: JSON.stringify({
          printer: printerName,
          zpl,
          copies,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Label print failed: ${error}`);
      }

      const data = await response.json();
      return data.job;
    } catch (error) {
      console.error('Failed to print label:', error);
      throw error;
    }
  }

  /**
   * Print receipt (ESC/POS)
   */
  async printReceipt(printerName: string, escpos: Uint8Array): Promise<PrintJob> {
    try {
      const response = await this.request('/print/receipt', {
        method: 'POST',
        body: JSON.stringify({
          printer: printerName,
          data: Array.from(escpos),
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Receipt print failed: ${error}`);
      }

      const data = await response.json();
      return data.job;
    } catch (error) {
      console.error('Failed to print receipt:', error);
      throw error;
    }
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<PrintJob> {
    try {
      const response = await this.request(`/jobs/${jobId}`, {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error(`Failed to get job status: ${response.statusText}`);
      }

      const data = await response.json();
      return data.job;
    } catch (error) {
      console.error('Failed to get job status:', error);
      throw error;
    }
  }

  /**
   * Get all jobs
   */
  async getJobs(status?: PrintJob['status']): Promise<PrintJob[]> {
    try {
      const url = status ? `/jobs?status=${status}` : '/jobs';
      const response = await this.request(url, {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error(`Failed to get jobs: ${response.statusText}`);
      }

      const data = await response.json();
      return data.jobs || [];
    } catch (error) {
      console.error('Failed to get jobs:', error);
      throw error;
    }
  }

  /**
   * Cancel job
   */
  async cancelJob(jobId: string): Promise<void> {
    try {
      const response = await this.request(`/jobs/${jobId}/cancel`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(`Failed to cancel job: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Failed to cancel job:', error);
      throw error;
    }
  }

  /**
   * Delete job
   */
  async deleteJob(jobId: string): Promise<void> {
    try {
      const response = await this.request(`/jobs/${jobId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`Failed to delete job: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Failed to delete job:', error);
      throw error;
    }
  }

  /**
   * Test printer connection
   */
  async testPrint(printerName: string): Promise<boolean> {
    try {
      const response = await this.request(`/printers/${printerName}/test`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(`Test print failed: ${response.statusText}`);
      }

      const data = await response.json();
      return data.success === true;
    } catch (error) {
      console.error('Test print failed:', error);
      return false;
    }
  }

  /**
   * Check server health
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await this.request('/health', {
        method: 'GET',
      });

      return response.ok;
    } catch (error) {
      console.error('Health check failed:', error);
      return false;
    }
  }

  /**
   * Get server info
   */
  async getServerInfo(): Promise<{
    version: string;
    platform: string;
    printerCount: number;
  } | null> {
    try {
      const response = await this.request('/info', {
        method: 'GET',
      });

      if (!response.ok) {
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to get server info:', error);
      return null;
    }
  }

  /**
   * Make HTTP request to print server
   */
  private async request(path: string, options: RequestInit = {}): Promise<Response> {
    const url = `${this.baseUrl}${path}`;

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Detect content type from string content
   */
  private detectContentType(content: string): string {
    // Check for ZPL (Zebra Programming Language)
    if (content.includes('^XA') && content.includes('^XZ')) {
      return 'zpl';
    }

    // Check for TSPL (TSC Printer Language)
    if (content.includes('SIZE') && content.includes('PRINT')) {
      return 'tspl';
    }

    // Default to raw
    return 'raw';
  }

  /**
   * Poll job status until completion
   */
  async waitForCompletion(
    jobId: string,
    options: {
      pollInterval?: number;
      timeout?: number;
      onProgress?: (job: PrintJob) => void;
    } = {}
  ): Promise<PrintJob> {
    const pollInterval = options.pollInterval || 1000;
    const timeout = options.timeout || 60000;
    const startTime = Date.now();

    while (true) {
      const job = await this.getJobStatus(jobId);

      if (options.onProgress) {
        options.onProgress(job);
      }

      if (job.status === 'completed') {
        return job;
      }

      if (job.status === 'error') {
        throw new Error(`Print job failed: ${job.error || 'Unknown error'}`);
      }

      if (Date.now() - startTime > timeout) {
        throw new Error('Print job timeout');
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }
  }
}

/**
 * Print server discovery
 */
export class PrintServerDiscovery {
  /**
   * Try to find print server on common ports
   */
  static async discover(
    options: {
      ports?: number[];
      timeout?: number;
    } = {}
  ): Promise<string | null> {
    const ports = options.ports || [9100, 9101, 9102, 3000, 8080];
    const timeout = options.timeout || 3000;

    for (const port of ports) {
      const url = `http://localhost:${port}`;
      try {
        const client = new PrintServerClient({ serverUrl: url, timeout });
        const isHealthy = await client.checkHealth();

        if (isHealthy) {
          console.log(`Print server found at ${url}`);
          return url;
        }
      } catch (error) {
        // Continue to next port
      }
    }

    return null;
  }

  /**
   * Check if print server is available at URL
   */
  static async check(url: string, timeout: number = 3000): Promise<boolean> {
    try {
      const client = new PrintServerClient({ serverUrl: url, timeout });
      return await client.checkHealth();
    } catch (error) {
      return false;
    }
  }
}

/**
 * Local storage for print server settings
 */
export class PrintServerSettings {
  private static STORAGE_KEY = 'print_server_settings';

  static save(config: PrintServerConfig): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(config));
    } catch (error) {
      console.error('Failed to save print server settings:', error);
    }
  }

  static load(): PrintServerConfig | null {
    try {
      const json = localStorage.getItem(this.STORAGE_KEY);
      if (!json) return null;

      return JSON.parse(json);
    } catch (error) {
      console.error('Failed to load print server settings:', error);
      return null;
    }
  }

  static clear(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear print server settings:', error);
    }
  }
}
