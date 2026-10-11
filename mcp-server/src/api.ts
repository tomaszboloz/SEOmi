#!/usr/bin/env node
import { startLocalApi } from './localApi.js';

const token = process.env.SEOMI_LOCAL_API_TOKEN || '';
const port = process.env.SEOMI_LOCAL_API_PORT ? Number(process.env.SEOMI_LOCAL_API_PORT) : 0;

if (!token) {
  process.stderr.write('Set SEOMI_LOCAL_API_TOKEN to a random token of at least 16 characters.\n');
  process.exit(1);
}

try {
  const api = await startLocalApi({ token, port });
  const shutdown = () => { void api.close().finally(() => process.exit(0)); };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  process.stdout.write(`${JSON.stringify({ ok: true, url: `http://${api.host}:${api.port}`, health: '/health', audit: '/v1/audit' })}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
