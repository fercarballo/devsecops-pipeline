/* eslint-disable */
// ⚠️ EJEMPLOS VULNERABLES A PROPÓSITO ⚠️
// Este archivo NO es parte de la aplicación: existe para demostrar que el SAST
// (Semgrep) detecta los anti-patrones. NO debe importarse ni ejecutarse.
const { exec } = require('child_process');

// 1) Command injection: entrada del usuario interpolada en un comando de shell.
function ping(host) {
  exec(`ping -c 1 ${host}`);
}

// 2) SQL injection: query construida por interpolación de string.
function getUser(db, id) {
  return db.query(`SELECT * FROM users WHERE id = ${id}`);
}

// 3) eval: ejecución de código arbitrario.
function runUserCode(code) {
  return eval(code);
}

// 4) Secreto hardcodeado.
const apiKey = 'sk_live_51H8xExampleFakeKey1234';

module.exports = { ping, getUser, runUserCode, apiKey };
