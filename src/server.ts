import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';

/**
 * Aplicación SEGURA bajo prueba.
 *
 * Implementa deliberadamente buenas prácticas de seguridad, de modo que pase los
 * gates del pipeline (SAST, SCA, pruebas dinámicas). Los anti-patrones que los
 * escáneres deben detectar viven, a propósito, en security/examples-insecure/.
 */

const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? 'dev-only-value-change-me';

// Usuarios de demo. La búsqueda es por coincidencia EXACTA (no hay concatenación
// en una query), por lo que un payload de inyección no puede alterar la lógica.
const USERS: Record<string, string> = { admin: 'correct-horse-battery' };

/** Escapa HTML para prevenir XSS reflejado al devolver contenido en una página. */
function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Comparación en tiempo constante para evitar timing attacks sobre el token. */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function setSecurityHeaders(res: http.ServerResponse): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Referrer-Policy', 'no-referrer');
  // No revelar la tecnología del servidor.
  res.removeHeader('X-Powered-By');
}

function send(res: http.ServerResponse, status: number, body: unknown, contentType = 'application/json'): void {
  setSecurityHeaders(res);
  res.writeHead(status, { 'Content-Type': contentType });
  res.end(contentType === 'application/json' ? JSON.stringify(body) : String(body));
}

export function createServer(): http.Server {
  return http.createServer((req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');

      // Búsqueda: devuelve HTML con el término ESCAPADO (previene XSS reflejado).
      if (req.method === 'GET' && url.pathname === '/search') {
        const q = url.searchParams.get('q') ?? '';
        const html = `<!doctype html><html><body><p>Resultados para: ${escapeHtml(q)}</p></body></html>`;
        return send(res, 200, html, 'text/html');
      }

      // Login: coincidencia exacta + comparación segura; sin filtración de detalle.
      if (req.method === 'POST' && url.pathname === '/login') {
        let raw = '';
        req.on('data', (chunk) => (raw += chunk));
        req.on('end', () => {
          let creds: { username?: unknown; password?: unknown };
          try {
            creds = JSON.parse(raw || '{}');
          } catch {
            return send(res, 400, { error: 'Solicitud inválida' });
          }
          const username = typeof creds.username === 'string' ? creds.username : '';
          const password = typeof creds.password === 'string' ? creds.password : '';
          const expected = USERS[username];
          if (expected && safeEqual(password, expected)) {
            return send(res, 200, { ok: true });
          }
          // Mismo mensaje para usuario inexistente o password incorrecta (no filtra cuál).
          return send(res, 401, { error: 'Credenciales inválidas' });
        });
        return;
      }

      // Recurso protegido: requiere Bearer token válido.
      if (req.method === 'GET' && url.pathname === '/admin') {
        const auth = req.headers.authorization ?? '';
        const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
        if (!token) return send(res, 401, { error: 'No autenticado' });
        if (!safeEqual(token, ADMIN_TOKEN)) return send(res, 403, { error: 'Prohibido' });
        return send(res, 200, { secret: 'panel de administración' });
      }

      return send(res, 404, { error: 'No encontrado' });
    } catch {
      // No se filtran stack traces ni detalles internos.
      return send(res, 500, { error: 'Error interno' });
    }
  });
}
