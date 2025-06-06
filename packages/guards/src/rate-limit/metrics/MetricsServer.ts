import * as http from 'http';
import { EventEmitter } from 'events';

export interface MetricData {
  name: string;
  value: number;
  labels: Record<string, string>;
  timestamp: number;
}

export interface MetricsStats {
  totalMetrics: number;
  uniqueMetricNames: number;
  cardinalityLimit: number;
  droppedMetrics: number;
}

export class MetricsServer extends EventEmitter {
  private server: http.Server | null = null;
  private metrics: Map<string, MetricData> = new Map();
  private cardinalityLimit: number;
  private port: number;
  private droppedMetrics: number = 0;

  constructor(port: number = 9090, cardinalityLimit: number = 10000) {
    super();
    this.port = port;
    this.cardinalityLimit = cardinalityLimit;
  }

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res);
      });

      this.server.on('error', (error) => {
        this.emit('metrics.server.error', { error: error.message });
        reject(error);
      });

      this.server.listen(this.port, () => {
        this.emit('metrics.server.started', { port: this.port });
        resolve();
      });
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.emit('metrics.server.stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  recordMetric(name: string, value: number, labels: Record<string, string> = {}): void {
    // Create metric key for cardinality control
    const metricKey = this.createMetricKey(name, labels);
    
    // Check cardinality limit
    if (!this.metrics.has(metricKey) && this.metrics.size >= this.cardinalityLimit) {
      this.droppedMetrics++;
      this.emit('metrics.cardinality.exceeded', { 
        metric: name, 
        labels, 
        currentCardinality: this.metrics.size 
      });
      return;
    }

    // Record metric
    this.metrics.set(metricKey, {
      name,
      value,
      labels,
      timestamp: Date.now(),
    });
  }

  incrementCounter(name: string, labels: Record<string, string> = {}): void {
    const metricKey = this.createMetricKey(name, labels);
    const existing = this.metrics.get(metricKey);
    
    if (existing) {
      this.recordMetric(name, existing.value + 1, labels);
    } else {
      this.recordMetric(name, 1, labels);
    }
  }

  setGauge(name: string, value: number, labels: Record<string, string> = {}): void {
    this.recordMetric(name, value, labels);
  }

  getStats(): MetricsStats {
    const uniqueNames = new Set(Array.from(this.metrics.values()).map(m => m.name));
    
    return {
      totalMetrics: this.metrics.size,
      uniqueMetricNames: uniqueNames.size,
      cardinalityLimit: this.cardinalityLimit,
      droppedMetrics: this.droppedMetrics,
    };
  }

  private createMetricKey(name: string, labels: Record<string, string>): string {
    const sortedLabels = Object.keys(labels)
      .sort()
      .map(key => `${key}="${labels[key]}"`)
      .join(',');
    
    return `${name}{${sortedLabels}}`;
  }

  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    const url = req.url || '';
    
    if (url === '/metrics') {
      this.handleMetricsRequest(res);
    } else if (url === '/metrics/stats') {
      this.handleStatsRequest(res);
    } else if (url === '/health') {
      this.handleHealthRequest(res);
    } else {
      this.handleNotFound(res);
    }
  }

  private handleMetricsRequest(res: http.ServerResponse): void {
    const output: string[] = [];
    
    // Add metadata
    output.push('# HELP ratelimit_requests_total Total number of rate limit checks');
    output.push('# TYPE ratelimit_requests_total counter');
    
    output.push('# HELP ratelimit_blocks_total Total number of blocked requests');
    output.push('# TYPE ratelimit_blocks_total counter');
    
    output.push('# HELP ratelimit_redis_operations_total Total Redis operations');
    output.push('# TYPE ratelimit_redis_operations_total counter');
    
    output.push('# HELP ratelimit_config_reloads_total Configuration reload attempts');
    output.push('# TYPE ratelimit_config_reloads_total counter');
    
    // Export metrics in Prometheus format
    for (const metric of this.metrics.values()) {
      const labelsStr = Object.keys(metric.labels).length > 0 
        ? '{' + Object.keys(metric.labels)
            .map(key => `${key}="${metric.labels[key]}"`)
            .join(',') + '}'
        : '';
      
      output.push(`${metric.name}${labelsStr} ${metric.value} ${metric.timestamp}`);
    }

    res.writeHead(200, { 
      'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
      'Cache-Control': 'no-cache'
    });
    res.end(output.join('\n') + '\n');
  }

  private handleStatsRequest(res: http.ServerResponse): void {
    const stats = this.getStats();
    
    res.writeHead(200, { 
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache'
    });
    res.end(JSON.stringify(stats, null, 2));
  }

  private handleHealthRequest(res: http.ServerResponse): void {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      metrics: {
        total: this.metrics.size,
        limit: this.cardinalityLimit,
        dropped: this.droppedMetrics,
      }
    };

    res.writeHead(200, { 
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache'
    });
    res.end(JSON.stringify(health, null, 2));
  }

  private handleNotFound(res: http.ServerResponse): void {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found\n\nAvailable endpoints:\n- GET /metrics\n- GET /metrics/stats\n- GET /health\n');
  }

  // Cleanup old metrics to prevent unbounded growth
  cleanupOldMetrics(maxAgeMs: number = 24 * 60 * 60 * 1000): void {
    const cutoff = Date.now() - maxAgeMs;
    let cleaned = 0;

    for (const [key, metric] of this.metrics.entries()) {
      if (metric.timestamp < cutoff) {
        this.metrics.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.emit('metrics.cleanup', { cleaned, remaining: this.metrics.size });
    }
  }
} 