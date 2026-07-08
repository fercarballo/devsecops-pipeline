import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'node:http';
import { createServer } from '../src/server';

/**
 * Pruebas dinámicas de seguridad (DAST propio).
 *
 * Levantan la app real y la "atacan" con requests HTTP, verificando propiedades
 * de seguridad sobre las respuestas: headers, resistencia a XSS reflejado y a
 * inyección en login, y control de acceso al recurso protegido. Es testing
 * dinámico: se prueba el comportamiento del sistema corriendo, no el código.
 */
let server: Server;
let baseUrl: string;

beforeAll(async () => {
  server = createServer();
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  baseUrl = `http://localhost:${port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe('Headers de seguridad', () => {
  it('incluye los headers de seguridad esperados', async () => {
    const res = await fetch(`${baseUrl}/search?q=hola`);
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-frame-options')).toBe('DENY');
    expect(res.headers.get('content-security-policy')).toBeTruthy();
    expect(res.headers.get('strict-transport-security')).toBeTruthy();
  });

  it('no revela la tecnología del servidor (X-Powered-By)', async () => {
    const res = await fetch(`${baseUrl}/search?q=hola`);
    expect(res.headers.get('x-powered-by')).toBeNull();
  });
});

describe('Resistencia a XSS reflejado', () => {
  it('escapa el payload en lugar de reflejarlo crudo', async () => {
    const res = await fetch(`${baseUrl}/search?q=${encodeURIComponent('<script>alert(1)</script>')}`);
    const body = await res.text();
    expect(body).not.toContain('<script>alert(1)</script>'); // no crudo
    expect(body).toContain('&lt;script&gt;'); // escapado
  });
});

describe('Resistencia a inyección en login', () => {
  it('un payload de inyección no autentica', async () => {
    const res = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: "admin' OR '1'='1", password: "' OR '1'='1" }),
    });
    expect(res.status).toBe(401);
  });

  it('no filtra si el usuario existe o no (mismo mensaje)', async () => {
    const [r1, r2] = await Promise.all([
      fetch(`${baseUrl}/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: 'mala' }) }),
      fetch(`${baseUrl}/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'fantasma', password: 'mala' }) }),
    ]);
    expect(r1.status).toBe(401);
    expect(r2.status).toBe(401);
    expect(await r1.json()).toEqual(await r2.json());
  });
});

describe('Control de acceso al recurso protegido', () => {
  it('sin token devuelve 401', async () => {
    const res = await fetch(`${baseUrl}/admin`);
    expect(res.status).toBe(401);
  });

  it('con token inválido devuelve 403', async () => {
    const res = await fetch(`${baseUrl}/admin`, { headers: { Authorization: 'Bearer token-falso' } });
    expect(res.status).toBe(403);
  });

  it('con token válido devuelve 200', async () => {
    const res = await fetch(`${baseUrl}/admin`, {
      headers: { Authorization: `Bearer ${process.env.ADMIN_TOKEN ?? 'dev-only-value-change-me'}` },
    });
    expect(res.status).toBe(200);
  });
});
