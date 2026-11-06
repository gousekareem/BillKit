/*
 * BillKit — Every bill, in your pocket.
 * © 2026 Shaik Gouse Kareem. All rights reserved.
 *
 * Runtime configuration from environment variables (see .env.example).
 * Secrets are read here only; they are never logged or sent to clients.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { vlmConfigFromEnv, type VlmConfig } from '@billkit/ai';

const here = path.dirname(fileURLToPath(import.meta.url));

export interface AppConfig {
  env: 'development' | 'test' | 'production';
  port: number;
  host: string;
  dataDir: string;
  migrationsDir: string;
  publicOrigin: string;
  allowedOrigins: string[];
  cookieSecure: boolean;
  sessionDays: number;
  processingConcurrency: number;
  unsavedScanRetentionHours: number;
  staticDir: string | null;
  vlm: VlmConfig | null;
  smtp: { host: string; port: number; secure: boolean; user: string; pass: string; from: string } | null;
  contactTo: string | null;
  registrationOpen: boolean;
  trustProxy: boolean;
  /** Multiplies every rate limit (e.g. 10 for automated end-to-end tests). */
  rateLimitScale: number;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env, overrides: Partial<AppConfig> = {}): AppConfig {
  // Registered models (categoriser, calibration) live in ai/models; resolvable from both src/ and dist/.
  process.env.BILLKIT_MODELS_DIR ||= path.join(here, '..', '..', 'ai', 'models');
  const appEnv = (env.APP_ENV || env.NODE_ENV || 'development') as AppConfig['env'];
  const publicOrigin = (env.PUBLIC_ORIGIN || 'http://localhost:5173').replace(/\/$/, '');
  const smtpHost = env.SMTP_HOST?.trim();
  const config: AppConfig = {
    env: ['development', 'test', 'production'].includes(appEnv) ? appEnv : 'development',
    port: Number(env.PORT || 8787),
    host: env.HOST || '127.0.0.1',
    dataDir: path.resolve(env.DATA_DIR || path.join(here, '..', 'data')),
    migrationsDir: path.resolve(env.MIGRATIONS_DIR || path.join(here, '..', '..', 'database', 'migrations')),
    publicOrigin,
    allowedOrigins: [publicOrigin, ...(env.ADDITIONAL_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean)],
    cookieSecure: env.COOKIE_SECURE ? env.COOKIE_SECURE === 'true' : appEnv === 'production',
    sessionDays: Number(env.SESSION_DAYS || 30),
    processingConcurrency: Math.max(1, Math.min(4, Number(env.PROCESSING_CONCURRENCY || 1))),
    unsavedScanRetentionHours: Number(env.UNSAVED_SCAN_RETENTION_HOURS || 24),
    staticDir: env.STATIC_DIR ? path.resolve(env.STATIC_DIR) : null,
    vlm: vlmConfigFromEnv(env),
    smtp:
      smtpHost && env.SMTP_FROM
        ? { host: smtpHost, port: Number(env.SMTP_PORT || 587), secure: env.SMTP_SECURE === 'true', user: env.SMTP_USER ?? '', pass: env.SMTP_PASS ?? '', from: env.SMTP_FROM }
        : null,
    contactTo: env.CONTACT_TO_EMAIL?.trim() || null,
    registrationOpen: env.REGISTRATION_OPEN !== 'false',
    trustProxy: env.TRUST_PROXY === 'true',
    rateLimitScale: Math.max(1, Number(env.RATE_LIMIT_SCALE || 1)),
    ...overrides,
  };
  if (config.env === 'production' && !config.cookieSecure) {
    console.warn('[config] COOKIE_SECURE is false in production. Serve BillKit over HTTPS and set COOKIE_SECURE=true.');
  }
  return config;
}
