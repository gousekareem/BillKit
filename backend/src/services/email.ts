/*
 * BillKit — Every bill, in your pocket.
 * © 2026 Shaik Gouse Kareem. All rights reserved.
 *
 * Outbound email via SMTP (nodemailer) when SMTP_* is configured.
 * Without SMTP, nothing is sent. In development only, password-reset links are
 * printed to the server console so the flow can be exercised locally.
 */
import nodemailer from 'nodemailer';
import type { AppConfig } from '../config.ts';

export interface Mailer {
  configured: boolean;
  send(to: string, subject: string, text: string): Promise<boolean>;
}

export function createMailer(config: AppConfig): Mailer {
  if (!config.smtp) {
    return { configured: false, send: async () => false };
  }
  const transport = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
  });
  const from = config.smtp.from;
  return {
    configured: true,
    async send(to, subject, text) {
      try {
        await transport.sendMail({ from, to, subject, text });
        return true;
      } catch {
        return false;
      }
    },
  };
}
