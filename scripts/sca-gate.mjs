/**
 * Gate de SCA (Software Composition Analysis).
 *
 * Corre `npm audit` y FALLA (exit 1) si hay vulnerabilidades de severidad
 * high o critical en las dependencias. Es el gate que, en un pipeline, bloquea
 * un merge que introduce una dependencia con un CVE grave.
 */
import { execSync } from 'node:child_process';

let report;
try {
  const out = execSync('npm audit --json', { encoding: 'utf-8' });
  report = JSON.parse(out);
} catch (e) {
  // npm audit sale con código != 0 si hay vulnerabilidades; igual imprime el JSON.
  try {
    report = JSON.parse(e.stdout ?? '{}');
  } catch {
    console.error('No se pudo parsear el reporte de npm audit');
    process.exit(1);
  }
}

const v = report.metadata?.vulnerabilities ?? {};
const high = v.high ?? 0;
const critical = v.critical ?? 0;
console.log(`SCA — vulnerabilidades: critical=${critical} high=${high} moderate=${v.moderate ?? 0} low=${v.low ?? 0}`);

if (critical > 0 || high > 0) {
  console.error(`❌ Gate SCA FALLA: ${critical} critical / ${high} high. Merge bloqueado.`);
  process.exit(1);
}
console.log('✅ Gate SCA OK: sin vulnerabilidades high/critical.');
