/**
 * Transport Layer Proxy Types & Configuration Contracts
 * Supports HTTP, HTTPS, and SOCKS5 (RFC 1928 / RFC 1929) proxies for all Convey providers.
 */

export type ProxyType = 'http' | 'https' | 'socks5' | 'socks5h';

export interface ProviderProxyAuth {
  username?: string;
  password?: string;
}

export interface ProviderProxyTls {
  /** Reject unauthorized certificates (defaults to true) */
  rejectUnauthorized?: boolean;
  /** Custom CA certificate (PEM format) for internal enterprise PKI */
  ca?: string;
  /** Client certificate (PEM format) for mutual TLS (mTLS) */
  cert?: string;
  /** Client private key (PEM format) for mutual TLS (mTLS) */
  key?: string;
  /** Override SNI servername for TLS handshake */
  servername?: string;
}

export interface ProviderProxyConfig {
  /** Whether the outbound proxy is active */
  enabled: boolean;
  /** Proxy protocol type: http, https, socks5, socks5h */
  type: ProxyType;
  /** Proxy server hostname or IP address */
  host: string;
  /** Proxy server listening port (e.g. 8080 for HTTP, 8443 for HTTPS, 1080 for SOCKS5) */
  port: number;
  /** Optional protocol scheme override */
  protocol?: 'http:' | 'https:' | 'socks5:' | 'socks5h:';
  /** Optional proxy authentication credentials */
  auth?: ProviderProxyAuth;
  /** Custom headers to inject into proxy requests (e.g. Proxy-Authorization, X-Tenant-Id) */
  headers?: Record<string, string>;
  /** TLS configuration for HTTPS proxy server or target destination */
  tls?: ProviderProxyTls;
  /** Timeout in milliseconds for proxy socket connection and handshake (default: 10,000ms) */
  timeoutMs?: number;
  /** List of domains, IPs, or CIDRs that should bypass the proxy */
  noProxy?: string[];
  /** Optional single-string raw proxy URL (e.g. 'socks5://user:pass@proxy.corp.net:1080') */
  rawUrl?: string;
}

export interface ProxyDiagnosticResult {
  success: boolean;
  proxyType: ProxyType;
  proxyHost: string;
  proxyPort: number;
  resolvedIp?: string;
  dnsLatencyMs?: number;
  handshakeLatencyMs: number;
  tlsLatencyMs?: number;
  e2eLatencyMs: number;
  statusCode?: number;
  message?: string;
  error?: string;
  timestamp: string;
}
