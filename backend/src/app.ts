/*
 * BillKit — Every bill, in your pocket.
 * © 2026 Shaik Gouse Kareem. All rights reserved.
 *
 * Fastify application factory (used by server.ts and by integration tests).
 */
import fs from 'node:fs';
import path from 'node:path';
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import { ZodError } from 'zod';
import { createVlmProvider, MAX_PAGES, MAX_UPLOAD_BYTES, PipelineError, type VlmProvider } from '@billkit/ai';
import type { AppConfig } from './config.ts';
import { openDatabase, type DB } from './db.ts';
import { HttpError, unauthorized, forbidden } from './errors.ts';
import { lookupSession, SESSION_COOKIE, type SessionUser } from './auth/sessions.ts';
import { createMailer, type Mailer } from './services/email.ts';
import { ProcessingQueue } from './services/processing.ts';
import { Storage } from './storage.ts';
import { authRoutes } from './routes/auth.ts';
import { scanRoutes } from './routes/scans.ts';
import { billRoutes } from './routes/bills.ts';
import { miscRoutes } from './routes/misc.ts';

declare module 'fastify' {
  interface FastifyRequest {
    user: SessionUser | null;
  }
  interface FastifyInstance {
    ctx: AppContext;
  }
}

export interface AppContext {
  config: AppConfig;
  db: DB;
  storage: Storage;
  queue: ProcessingQueue;
  mailer: Mailer;
  vlm: VlmProvider | null;
  version: string;
}

export const APP_VERSION = '1.0.0';

export function requireUser(req: FastifyRequest): SessionUser {
  if (!req.user) throw unauthorized();
  return req.user;
}

export function requireAdmin(req: FastifyRequest): SessionUser {
  const u = requireUser(req);
  if (u.role !== 'admin') throw forbidden();
  return u;
}

export interface BuildOptions {
  config: AppConfig;
  db?: DB;
  vlm?: VlmProvider | null;
  logger?: boolean;
}

export async function buildApp(opts: BuildOptions): Promise<FastifyInstance> {
  const { config } = opts;
  const app = Fastify({
    logger: opts.logger === false ? false : {
      level: config.env === 'production' ? 'info' : 'debug',
      // Privacy-aware logs: never log cookies, auth headers or request bodies (bills).
      redact: { paths: ['req.headers.cookie', 'req.headers.authorization', 'req.headers["x-api-key"]'], remove: true },
    },
    trustProxy: config.trustProxy,
    bodyLimit: 1_048_576,
    genReqId: () => crypto.randomUUID(),
  });

  const db = opts.db ?? openDatabase(config.dataDir, config.migrationsDir);
  const storage = new Storage(path.join(config.dataDir, 'uploads'));
  const vlm = opts.vlm !== undefined ? opts.vlm : createVlmProvider(config.vlm);
  const queue = new ProcessingQueue(db, storage, vlm, config.processingConcurrency, app.log);
  const mailer = createMailer(config);
  app.decorate('ctx', { config, db, storage, queue, mailer, vlm, version: APP_VERSION } satisfies AppContext);
  app.decorateRequest('user', null);

  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        mediaSrc: ["'self'", 'blob:'],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'"],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    hsts: config.env === 'production',
  });
  await app.register(cookie);
  // Rate limits apply to the API only (static website assets are exempt).
  await app.register(rateLimit, { global: true, max: 300 * config.rateLimitScale, timeWindow: '1 minute', allowList: (req) => !req.url.startsWith('/api/') });
  await app.register(multipart, { limits: { fileSize: MAX_UPLOAD_BYTES, files: MAX_PAGES, fields: 10, fieldSize: 2048, parts: MAX_PAGES + 10 } });

  // Authentication: resolve the session cookie on every API request.
  app.addHook('onRequest', async (req) => {
    if (!req.url.startsWith('/api/')) return;
    req.user = lookupSession(db, req.cookies[SESSION_COOKIE]);
  });

  // CSRF protection for state-changing requests: SameSite=Lax cookies + a custom header that
  // cross-site forms cannot send + an Origin allow-list check.
  app.addHook('onRequest', async (req) => {
    if (!req.url.startsWith('/api/') || ['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return;
    if (req.headers['x-billkit-csrf'] !== '1') throw new HttpError(403, 'csrf', 'Request blocked by CSRF protection.');
    const origin = req.headers.origin;
    if (origin) {
      const selfOrigin = `${req.protocol}://${req.headers.host}`;
      if (origin !== selfOrigin && !config.allowedOrigins.includes(origin)) throw new HttpError(403, 'csrf', 'Request origin is not allowed.');
    }
  });

  app.addHook('onSend', async (req, reply) => {
    if (req.url.startsWith('/api/') && !reply.getHeader('Cache-Control')) reply.header('Cache-Control', 'no-store');
  });

  app.setErrorHandler((err: unknown, req: FastifyRequest, reply: FastifyReply) => {
    if (err instanceof ZodError) {
      return reply.status(400).send({ error: { code: 'invalid_input', message: 'Some fields are invalid.', fields: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) } });
    }
    if (err instanceof HttpError) return reply.status(err.statusCode).send({ error: { code: err.code, message: err.message, details: err.details } });
    if (err instanceof PipelineError) return reply.status(422).send({ error: { code: err.code, message: err.message } });
    const e = err as { statusCode?: number; code?: string; message?: string };
    if (e.code === 'FST_REQ_FILE_TOO_LARGE') return reply.status(413).send({ error: { code: 'file_too_large', message: `Each file must be ${MAX_UPLOAD_BYTES / 1048576} MB or smaller.` } });
    if (e.code === 'FST_FILES_LIMIT' || e.code === 'FST_PARTS_LIMIT') return reply.status(413).send({ error: { code: 'too_many_files', message: `Upload at most ${MAX_PAGES} pages at once.` } });
    if (e.statusCode === 429) return reply.status(429).send({ error: { code: 'rate_limited', message: 'Too many requests. Please wait a moment and try again.' } });
    if (e.statusCode && e.statusCode >= 400 && e.statusCode < 500) return reply.status(e.statusCode).send({ error: { code: 'bad_request', message: e.message ?? 'Bad request.' } });
    req.log.error({ err }, 'unhandled error');
    return reply.status(500).send({ error: { code: 'internal', message: 'Something went wrong on our side. Please try again.', requestId: req.id } });
  });

  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(scanRoutes, { prefix: '/api/scans' });
  await app.register(billRoutes, { prefix: '/api/bills' });
  await app.register(miscRoutes, { prefix: '/api' });

  // Production: serve the built website + PWA from the same origin.
  if (config.staticDir && fs.existsSync(config.staticDir)) {
    await app.register(fastifyStatic, { root: config.staticDir, wildcard: false, index: ['index.html'] });
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith('/api/') || req.method !== 'GET') return reply.status(404).send({ error: { code: 'not_found', message: 'Not found.' } });
      const clean = req.url.split('?')[0]!.replace(/\/+$/, '');
      const prerendered = path.join(config.staticDir!, clean, 'index.html');
      if (clean && !clean.includes('..') && fs.existsSync(prerendered)) return reply.type('text/html').send(fs.readFileSync(prerendered));
      return reply.type('text/html').send(fs.readFileSync(path.join(config.staticDir!, 'index.html')));
    });
  } else {
    app.setNotFoundHandler((_req, reply) => reply.status(404).send({ error: { code: 'not_found', message: 'Not found.' } }));
  }

  app.addHook('onClose', async () => {
    await queue.idle();
    if (!opts.db) db.close();
  });
  queue.recover();
  return app;
}
