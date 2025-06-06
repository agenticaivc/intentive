import { createHash } from 'crypto';

export interface NetworkInfo {
  originalIp: string;
  processedIp: string;
  isIpv6: boolean;
  isTrustedProxy: boolean;
  bucketKey: string;
}

export interface IpProcessorConfig {
  trustedProxies: string[];
  ipv6CidrBits: number; // e.g., 64 for /64 bucketing
  maxXForwardedForEntries: number; // Prevent huge headers
  enableIpv6Bucketing: boolean;
}

export class IpProcessor {
  private config: IpProcessorConfig;

  constructor(config: IpProcessorConfig) {
    this.config = config;
  }

  processRequest(clientIp: string, xForwardedFor?: string): NetworkInfo {
    // Extract real IP from X-Forwarded-For header
    const extractedIp = this.extractRealIp(clientIp, xForwardedFor);
    
    // Determine if this is IPv6
    const isIpv6 = this.isIpv6Address(extractedIp);
    
    // Create bucket key for rate limiting
    const bucketKey = this.createBucketKey(extractedIp, isIpv6);
    
    return {
      originalIp: clientIp,
      processedIp: extractedIp,
      isIpv6,
      isTrustedProxy: this.isTrustedProxy(clientIp),
      bucketKey,
    };
  }

  private extractRealIp(clientIp: string, xForwardedFor?: string): string {
    // If no X-Forwarded-For header, use client IP
    if (!xForwardedFor) {
      return clientIp;
    }

    // Parse X-Forwarded-For header (format: "client, proxy1, proxy2")
    const forwardedIps = xForwardedFor
      .split(',')
      .map(ip => ip.trim())
      .filter(ip => ip.length > 0)
      .slice(0, this.config.maxXForwardedForEntries); // Prevent huge headers

    if (forwardedIps.length === 0) {
      return clientIp;
    }

    // If we trust the immediate proxy, use the first IP in the chain
    if (this.isTrustedProxy(clientIp)) {
      return forwardedIps[0];
    }

    // Otherwise, use the client IP directly
    return clientIp;
  }

  private isTrustedProxy(ip: string): boolean {
    return this.config.trustedProxies.includes(ip);
  }

  private isIpv6Address(ip: string): boolean {
    // Simple IPv6 detection - contains colons
    return ip.includes(':');
  }

  private createBucketKey(ip: string, isIpv6: boolean): string {
    if (!isIpv6 || !this.config.enableIpv6Bucketing) {
      // For IPv4 or when IPv6 bucketing is disabled, use full IP
      return this.hashIpForBucketing(ip);
    }

    // For IPv6, bucket by CIDR prefix
    const bucketedIp = this.bucketIpv6ByCidr(ip, this.config.ipv6CidrBits);
    return this.hashIpForBucketing(bucketedIp);
  }

  private bucketIpv6ByCidr(ipv6: string, cidrBits: number): string {
    try {
      // Parse IPv6 address and zero out host bits
      const expanded = this.expandIpv6(ipv6);
      const bytes = this.ipv6ToBytes(expanded);
      
      // Zero out bits beyond CIDR prefix
      const prefixBytes = Math.floor(cidrBits / 8);
      const remainingBits = cidrBits % 8;
      
      // Zero out full bytes beyond prefix
      for (let i = prefixBytes + (remainingBits > 0 ? 1 : 0); i < bytes.length; i++) {
        bytes[i] = 0;
      }
      
      // Zero out remaining bits in the last partial byte
      if (remainingBits > 0 && prefixBytes < bytes.length) {
        const mask = (0xFF << (8 - remainingBits)) & 0xFF;
        bytes[prefixBytes] &= mask;
      }
      
      return this.bytesToIpv6(bytes);
    } catch (error) {
      // If IPv6 parsing fails, fall back to hashing the original IP
      return ipv6;
    }
  }

  private expandIpv6(ipv6: string): string {
    // Remove any port number
    const cleanIp = ipv6.replace(/\[|\]/g, '').split('%')[0];
    
    // Handle :: compression
    if (cleanIp.includes('::')) {
      const parts = cleanIp.split('::');
      const leftParts = parts[0] ? parts[0].split(':') : [];
      const rightParts = parts[1] ? parts[1].split(':') : [];
      const missingParts = 8 - leftParts.length - rightParts.length;
      
      const expanded = [
        ...leftParts,
        ...Array(missingParts).fill('0'),
        ...rightParts
      ];
      
      return expanded.map(part => part.padStart(4, '0')).join(':');
    }
    
    // Already expanded or simple form
    return cleanIp.split(':').map(part => part.padStart(4, '0')).join(':');
  }

  private ipv6ToBytes(ipv6: string): number[] {
    const parts = ipv6.split(':');
    const bytes: number[] = [];
    
    for (const part of parts) {
      const value = parseInt(part, 16);
      bytes.push((value >> 8) & 0xFF);
      bytes.push(value & 0xFF);
    }
    
    return bytes;
  }

  private bytesToIpv6(bytes: number[]): string {
    const parts: string[] = [];
    
    for (let i = 0; i < bytes.length; i += 2) {
      const value = (bytes[i] << 8) | bytes[i + 1];
      parts.push(value.toString(16));
    }
    
    return parts.join(':');
  }

  private hashIpForBucketing(ip: string): string {
    // Use crypto-secure hashing for IP addresses
    return createHash('sha256').update(ip).digest('hex').substring(0, 16);
  }

  // Utility method for testing
  static createDefaultConfig(): IpProcessorConfig {
    return {
      trustedProxies: ['127.0.0.1', '::1'],
      ipv6CidrBits: 64,
      maxXForwardedForEntries: 10,
      enableIpv6Bucketing: true,
    };
  }
} 