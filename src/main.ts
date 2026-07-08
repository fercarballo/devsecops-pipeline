import { createServer } from './server';

// Punto de entrada para correr la app (usado por `npm start` y por el escaneo DAST).
const port = Number(process.env.PORT ?? 3000);
createServer().listen(port, () => console.log(`App segura escuchando en http://localhost:${port}`));
