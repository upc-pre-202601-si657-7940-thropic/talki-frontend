# talki-frontend

Frontend web de **Talki** (práctica de voz y oratoria con coaching en vivo).
Construido con **Next.js 16 (App Router) + TypeScript + Tailwind 4 + shadcn/ui**.

Conecta con los 8 microservicios Spring Boot del backend a través de una capa
**BFF** (Backend-for-Frontend) implementada con Route Handlers de Next, que:

- Resuelve el **CORS** (los servicios backend no lo configuran).
- Guarda el **JWT en una cookie httpOnly** (`talki_session`), nunca expuesta al JS del navegador.
- Adjunta `Authorization: Bearer <token>` a las llamadas salientes.

## Arquitectura de conexión

```
Navegador ──> /api/auth/*            (login / register / logout / me)  ──> identity-service
          └─> /api/gateway/<svc>/... (proxy con JWT desde la cookie)   ──> microservicio <svc>
```

### Servicios y endpoints consumidos

| Servicio (`<svc>`) | Puerto | Endpoints usados |
|--------------------|--------|------------------|
| `identity`         | 8081   | `POST /v1/auth/register`, `POST /v1/auth/login` |
| `session`          | 8082   | `GET/POST /v1/sessions`, `/{id}`, `/{id}/finalize`, `/{id}/feedbacks` |
| `coach`            | 8083   | `GET /v1/coach/modes`, `POST /v1/coach/{id}/finalize` |
| `progress`         | 8089   | `GET /v1/progress/dashboard?userId` |
| `gamification`     | 8090   | `GET /v1/gamification/streaks/{userId}`, `GET /v1/gamification/leaderboard` |
| `filler`           | 8087   | `GET /health` (estado) |
| `scoring`          | 8088   | `GET /v1/scores/health` (estado) |
| `notification`     | 8091   | event-driven (sin REST) |

## Puesta en marcha

1. Copia las variables de entorno:

   ```bash
   cp .env.example .env.local
   ```

   Ajusta las URLs si tus servicios no corren en `localhost`. Las URLs solo se usan
   en el servidor (BFF); el navegador siempre habla con `/api/*`.

2. Levanta los backends (desde cada repo `talki-*-services`):

   ```bash
   docker compose -f docker-compose.dev.yml up
   ```

3. Instala dependencias y arranca el frontend:

   ```bash
   pnpm install
   pnpm dev
   ```

   Abre [http://localhost:3000](http://localhost:3000).

## Páginas

- `/login`, `/register` — autenticación contra identity-service.
- `/dashboard` — métricas de progreso, racha, XP y estado de servicios.
- `/sessions` — lista y creación de sesiones; `/sessions/[id]` detalle, finalizar y feedback.
- `/coach` — modos de Gemini Live y finalización de sesión en vivo (dispara el análisis).
- `/leaderboard` — ranking por XP.

## Estructura

```
src/
  app/
    (auth)/          login, register
    (app)/           dashboard, sessions, coach, leaderboard (shell protegido)
    api/
      auth/          login, register, logout, me  (setean/leen la cookie JWT)
      gateway/       proxy genérico hacia los microservicios
  lib/
    config.ts        mapa servicio -> URL (solo servidor)
    auth.ts          lectura de sesión desde la cookie (servidor)
    jwt.ts           decodificación del JWT (userId, email)
    api/             client BFF + tipos DTO + funciones tipadas por servicio
  components/        nav, contexto de usuario, ui (shadcn)
  proxy.ts           protección de rutas (middleware/proxy de Next)
```
