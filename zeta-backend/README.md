# Zeta Backend — API REST + WebSockets

Backend de Zeta, la app multiplataforma para conectar el mundo académico y social de los estudiantes universitarios. Construido con **NestJS** sobre Node.js, con arquitectura modular y base de datos dual.

> Desarrollado por **Sergio Casamayor** (backend) y **Felipe Crespo** (frontend).

---

## Stack Tecnológico

| Tecnología | Versión | Uso |
|---|---|---|
| NestJS | 11.x | Framework backend modular |
| Node.js | 18+ | Runtime |
| TypeScript | 5.x | Tipado estático |
| TypeORM | 0.3.x | ORM para PostgreSQL |
| PostgreSQL | 16 | Base de datos relacional (usuarios, grupos, eventos, tareas) |
| Mongoose | 9.x | ODM para MongoDB |
| MongoDB | 7.x | Base de datos documental (mensajes, typing indicators) |
| Socket.IO | 4.x | WebSockets para chat en tiempo real |
| Passport + JWT | — | Autenticación con tokens |
| bcrypt | 6.x | Hash de contraseñas |
| class-validator | 0.14.x | Validación automática de DTOs |
| Docker Compose | — | Orquestación de DBs en desarrollo |

---

## Arquitectura de Datos

Zeta usa una **arquitectura dual de bases de datos** por diseño:

**PostgreSQL** almacena todos los datos relacionales: usuarios, universidades, carreras, ofertas académicas, intereses, grupos, miembros de grupo, eventos, tareas y metadatos de conversaciones. El modelo relacional está diseñado con el Usuario como entidad central, conectando matching IA, grupos, chats, tareas y eventos.

**MongoDB** almacena exclusivamente los datos de mensajería en tiempo real: contenido de mensajes, estado de lectura por usuario (read receipts) y typing indicators con TTL de auto-expiración (5 segundos). Esta separación evita que las queries de alta escritura de chat impacten el rendimiento del modelo relacional.

La coordinación entre ambas bases funciona así: cuando se envía un mensaje, el WebSocket Gateway lo guarda en MongoDB y actualiza `last_message_at` en la tabla `conversations` de PostgreSQL para mantener el orden en la lista de chats.

---

## Requisitos Previos

1. **Node.js** >= 18.x — [https://nodejs.org](https://nodejs.org)
2. **npm** >= 9.x
3. **Docker Desktop** — [https://docker.com](https://docker.com) (para PostgreSQL + MongoDB en local)
4. **Git**

---

## Instalación desde Cero

```bash
# 1. Clonar el repositorio
git clone <url-del-repo>
cd zeta-backend

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env
# Editar .env con los valores correctos (ver sección siguiente)

# 4. Levantar bases de datos con Docker
docker-compose up -d

# 5. Verificar que los contenedores están corriendo
docker ps
# Deberías ver: zeta_postgres, zeta_mongo, zeta_pgadmin

# 6. Arrancar el backend
npm run start:dev
```

El seed se ejecuta automáticamente en modo `development` y crea universidades, carreras, ofertas académicas e intereses.

---

## Variables de Entorno

Crear un archivo `.env` en la raíz del proyecto (mismo nivel que `package.json`):

```env
PORT=3000
NODE_ENV=development

# PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=zeta_admin
DB_PASSWORD=zeta_dev_2025
DB_NAME=zeta_db

# MongoDB
MONGO_URI=mongodb://localhost:27017/zeta_chat

# JWT
JWT_SECRET=zeta_secret_key_super_larga_2025_mvp
JWT_EXPIRATION=7d

# n8n Webhooks (Gemini IA)
N8N_WEBHOOK_MATCHING=https://<tunnel>.trycloudflare.com/webhook/matching
N8N_WEBHOOK_TASK_PRIORITY=https://<tunnel>.trycloudflare.com/webhook/task-priority
N8N_WEBHOOK_CALENDAR_CONFLICTS=https://<tunnel>.trycloudflare.com/webhook/calendar-conflict
```

> **Importante**: No subir `.env` a Git. Está incluido en `.gitignore`. Para referencia, usar `.env.example`.

---

## Docker Compose

El archivo `docker-compose.yml` levanta tres servicios:

| Servicio | Puerto | Descripción |
|---|---|---|
| `zeta_postgres` | 5432 | PostgreSQL 16 Alpine |
| `zeta_mongo` | 27017 | MongoDB 7 |
| `zeta_pgadmin` | 5050 | GUI web para PostgreSQL (opcional) |

```bash
# Levantar todo
docker-compose up -d

# Parar todo
docker-compose down

# Reset completo (borra datos)
docker-compose down
docker volume rm zeta-backend_zeta_pg_data zeta-backend_zeta_mongo_data
docker-compose up -d
```

### pgAdmin (opcional)
Accesible en `http://localhost:5050` con las credenciales `admin@zeta.dev` / `admin`. Para conectar a PostgreSQL desde pgAdmin, usar host `postgres` (nombre del servicio Docker, no `localhost`).

---

## Estructura de Carpetas

```
zeta-backend/
├── src/
│   ├── app.module.ts                         # Módulo raíz — importa todo
│   ├── main.ts                               # Bootstrap, CORS, validación global, seed
│   │
│   ├── common/
│   │   ├── decorators/
│   │   │   └── current-user.decorator.ts     # @CurrentUser() extrae user del JWT
│   │   └── guards/
│   │       └── jwt-auth.guard.ts             # Guard de autenticación
│   │
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.module.ts
│   │   │   ├── auth.controller.ts            # POST /auth/register, /auth/login
│   │   │   ├── auth.service.ts               # Registro con validación de dominio + login
│   │   │   ├── strategies/
│   │   │   │   ├── jwt.strategy.ts           # Passport JWT strategy
│   │   │   │   └── local.strategy.ts         # Passport Local strategy
│   │   │   └── dto/
│   │   │       ├── register.dto.ts
│   │   │       └── login.dto.ts
│   │   │
│   │   ├── users/
│   │   │   ├── users.module.ts
│   │   │   ├── users.controller.ts           # GET /users/me, PATCH /users/me
│   │   │   ├── users.service.ts
│   │   │   └── entities/
│   │   │       └── user.entity.ts            # Entidad central del sistema
│   │   │
│   │   ├── universities/
│   │   │   ├── universities.module.ts
│   │   │   ├── universities.controller.ts    # GET /universities, GET /:id/offers
│   │   │   ├── universities.service.ts
│   │   │   └── entities/
│   │   │       ├── university.entity.ts      # Dominio email para validación
│   │   │       ├── career.entity.ts          # Carreras (DAM, DAW, etc.)
│   │   │       └── academic-offer.entity.ts  # Relación Universidad ↔ Carrera
│   │   │
│   │   ├── interests/
│   │   │   ├── interests.module.ts
│   │   │   ├── interests.controller.ts       # GET /interests/grouped
│   │   │   ├── interests.service.ts
│   │   │   └── entities/
│   │   │       └── interest.entity.ts        # Intereses con categoría + emoji
│   │   │
│   │   ├── groups/
│   │   │   ├── groups.module.ts
│   │   │   ├── groups.controller.ts          # CRUD grupos + join/leave
│   │   │   ├── groups.service.ts
│   │   │   └── entities/
│   │   │       ├── group.entity.ts
│   │   │       └── group-member.entity.ts    # Tabla N:M con rol (admin/member)
│   │   │
│   │   ├── events/
│   │   │   ├── events.module.ts
│   │   │   ├── events.controller.ts          # CRUD eventos + RSVP + conflictos IA
│   │   │   ├── events.service.ts             # Integración n8n calendar-conflict
│   │   │   ├── dto/
│   │   │   │   ├── create-event.dto.ts       # group_id opcional (eventos universitarios)
│   │   │   │   └── update-event.dto.ts
│   │   │   └── entities/
│   │   │       ├── event.entity.ts           # group_id nullable
│   │   │       └── event-rsvp.entity.ts      # Confirmación asistencia
│   │   │
│   │   ├── tasks/
│   │   │   ├── tasks.module.ts
│   │   │   ├── tasks.controller.ts           # CRUD tareas + callback IA
│   │   │   ├── tasks.service.ts              # Integración n8n task-priority
│   │   │   ├── dto/
│   │   │   │   ├── create-task.dto.ts
│   │   │   │   ├── update-task.dto.ts
│   │   │   │   └── ai-callback.dto.ts        # DTO para callback n8n
│   │   │   └── entities/
│   │   │       └── task.entity.ts            # Prioridad y estimación por IA
│   │   │
│   │   ├── notifications/
│   │   │   ├── notifications.module.ts
│   │   │   ├── notifications.controller.ts   # CRUD notificaciones + unread count
│   │   │   ├── notifications.service.ts      # Crear, leer, borrar, push Expo
│   │   │   └── entities/
│   │   │       └── notification.entity.ts    # Tipo, título, body, data JSONB
│   │   │
│   │   ├── conversations/
│   │   │   ├── conversations.module.ts
│   │   │   ├── conversations.controller.ts   # GET /conversations, POST /direct/:userId
│   │   │   ├── conversations.service.ts
│   │   │   └── entities/
│   │   │       └── conversation.entity.ts    # Metadatos en PostgreSQL
│   │   │
│   │   ├── chat/
│   │   │   ├── chat.module.ts
│   │   │   ├── chat.gateway.ts               # WebSocket Gateway (Socket.IO)
│   │   │   ├── chat.service.ts               # Lógica mensajes → MongoDB
│   │   │   ├── schemas/
│   │   │   │   ├── message.schema.ts         # Mongoose: mensajes con read_by
│   │   │   │   ├── typing-indicator.schema.ts # TTL 5s auto-expiración
│   │   │   │   └── conversation-cache.schema.ts
│   │   │   └── dto/
│   │   │       └── send-message.dto.ts
│   │   │
│   │   └── matching/
│   │       ├── matching.module.ts
│   │       ├── matching.controller.ts        # Matches: accept/reject + connections
│   │       ├── matching.service.ts           # Integración n8n matching + mutual check
│   │       └── entities/
│   │           └── match.entity.ts           # user_id, matched_user_id, status, affinity
│   │
│   └── seeds/
│       ├── seed.module.ts
│       └── seed.service.ts                   # Pobla universidades, carreras, intereses
│
├── .env                                      # Variables de entorno (NO subir a git)
├── .env.example                              # Plantilla de referencia
├── docker-compose.yml                        # PostgreSQL + MongoDB + pgAdmin
├── nest-cli.json
├── tsconfig.json
└── package.json
```

---

## Módulos y Endpoints

Todas las rutas llevan el prefijo `/api`. Las rutas protegidas requieren header `Authorization: Bearer <JWT>`.

### Auth (`/api/auth`)

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| POST | `/auth/register` | No | Registro con email institucional. Valida dominio contra tabla `universities`. |
| POST | `/auth/login` | No | Login, devuelve usuario + JWT (expira en 7 días). |

El registro extrae el dominio del email (ej: `a28602@svalero.com` → `svalero.com`), lo busca en la tabla `universities` y rechaza dominios no registrados con un 400.

### Users (`/api/users`)

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/users/me` | Sí | Perfil del usuario autenticado con carrera e intereses. |
| PATCH | `/users/me` | Sí | Actualizar perfil: `academic_offer_id`, `year`, `interest_ids`, `privacy`. |

### Universities (`/api/universities`)

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/universities` | No | Lista todas las universidades registradas. |
| GET | `/universities/:id/offers` | No | Ofertas académicas (carrera + modalidad) de una universidad. |

### Interests (`/api/interests`)

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/interests/grouped` | No | Catálogo de intereses agrupados por categoría (Deportes, Ocio, Cultura, etc.) |

### Groups (`/api/groups`)

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/groups` | Sí | Grupos del usuario autenticado. |
| POST | `/groups` | Sí | Crear grupo (el creador queda como admin). |
| GET | `/groups/:id` | Sí | Detalle de grupo con miembros y eventos. |
| POST | `/groups/:id/join` | Sí | Unirse a un grupo. |
| DELETE | `/groups/:id/leave` | Sí | Salir de un grupo. |

### Events (`/api/events`)

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/events/upcoming` | Sí | Próximos eventos del usuario: de sus grupos + universitarios (sin grupo). Máx. 30. |
| GET | `/events/group/:groupId` | Sí | Eventos de un grupo específico. |
| GET | `/events/:id` | Sí | Detalle de un evento. |
| POST | `/events` | Sí | Crear evento. Body: `name`, `event_date`, `description?`, `location?`, `group_id?`. Si no se pasa `group_id`, se crea como evento universitario visible para todos. Devuelve análisis de conflictos IA si los hay. |
| PATCH | `/events/:id` | Sí | Actualizar evento (solo creador o admin del grupo). |
| DELETE | `/events/:id` | Sí | Eliminar evento (solo creador o admin del grupo). |
| POST | `/events/:id/rsvp` | Sí | Confirmar o declinar asistencia. Body: `{ status: 'going' \| 'not_going' }`. Devuelve conflictos IA al confirmar. |
| GET | `/events/:id/rsvp` | Sí | Resumen de asistencia: going/not_going counts, lista de usuarios, estado propio. |
| GET | `/events/:id/conflicts` | Sí | Analizar conflictos IA de un evento existente (n8n + Gemini). |
| POST | `/events/check-conflicts` | Sí | Analizar conflictos IA en lote. Body: `{ event_ids: string[] }`. |

### Tasks (`/api/tasks`)

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/tasks/me` | Sí | Tareas del usuario (personales + de sus grupos). |
| POST | `/tasks` | Sí | Crear tarea. Body: `title`, `subject?`, `due_date?`, `group_id?`. La IA (n8n + Gemini) asigna prioridad y horas estimadas automáticamente via callback. |
| PATCH | `/tasks/:id` | Sí | Actualizar tarea (estado, prioridad, etc.). |
| DELETE | `/tasks/:id` | Sí | Eliminar tarea. |
| POST | `/tasks/ai-callback` | No | Callback interno de n8n para actualizar prioridad y horas estimadas por IA. |

### Notifications (`/api/notifications`)

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/notifications` | Sí | Notificaciones del usuario (últimas 50, ordenadas por fecha). |
| GET | `/notifications/unread-count` | Sí | Contador de notificaciones no leídas. |
| POST | `/notifications/read-all` | Sí | Marcar todas las notificaciones como leídas. |
| POST | `/notifications/:id/read` | Sí | Marcar una notificación como leída. |
| DELETE | `/notifications/all` | Sí | Eliminar todas las notificaciones del usuario. |
| DELETE | `/notifications/:id` | Sí | Eliminar una notificación específica. |

### Matching (`/api/matches`)

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/matches/me` | Sí | Obtener todos los matches del usuario (pending, accepted, rejected). |
| POST | `/matches/:id/accept` | Sí | Aceptar un match sugerido. Devuelve `{ mutual: true }` si ambos se han aceptado. |
| POST | `/matches/:id/reject` | Sí | Rechazar un match sugerido. |
| GET | `/matches/connections` | Sí | Conexiones mutuas (ambos se han aceptado). Solo devuelve matches recíprocos. |

### Conversations (`/api/conversations`)

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/conversations` | Sí | Lista de conversaciones del usuario, ordenadas por último mensaje. |
| POST | `/conversations/direct/:userId` | Sí | Crear/obtener conversación directa con otro usuario. |

### Chat (WebSocket)

Conexión WebSocket en `ws://localhost:3000` con Socket.IO. Requiere token JWT en el handshake.

| Evento | Dirección | Payload | Descripción |
|---|---|---|---|
| `join_conversation` | Cliente → Server | `{ conversation_id }` | Unirse a sala de chat |
| `send_message` | Cliente → Server | `{ conversation_id, content }` | Enviar mensaje |
| `new_message` | Server → Cliente | Objeto Message completo | Mensaje nuevo recibido |
| `typing` | Cliente → Server | `{ conversation_id }` | Indicador "está escribiendo..." |
| `user_typing` | Server → Cliente | `{ user_id, user_name }` | Notificar a otros participantes |
| `message_read` | Cliente → Server | `{ message_id }` | Marcar mensaje como leído |

---

## Seed Automático

Al arrancar en `NODE_ENV=development`, el `SeedService` crea automáticamente:

**Universidades:**
- Centro San Valero — dominio `svalero.com` (desarrollo)
- Universidad Demo Zeta — dominio `zetapp.es` (demo tribunal)

**Carreras:**
- Desarrollo de Aplicaciones Multiplataforma (DAM)
- Desarrollo de Aplicaciones Web (DAW)
- Ingeniería Informática
- Administración y Dirección de Empresas (ADE)

**Ofertas Académicas:**
- Cruces universidad × carrera con modalidad y estado

**Intereses (20):**
- Deportes: Fútbol, Baloncesto, Gimnasio, Running, Pádel
- Ocio: Gaming, Música, Cine, Series, Viajes
- Cultura: Lectura, Fotografía, Arte
- Tecnología: Programación, Inteligencia Artificial, Diseño UI/UX
- Social: Voluntariado, Networking, Cocina
- Académico: Mates

El seed es idempotente — no duplica datos si ya existen.

---

## Entidades PostgreSQL (TypeORM)

| Entidad | Tabla | Descripción |
|---|---|---|
| University | `universities` | Nombre, dominio email, acrónimo, logo |
| Career | `careers` | Nombre, área de conocimiento |
| AcademicOffer | `academic_offers` | Cruce universidad × carrera (modalidad, estado) |
| User | `users` | Entidad central: nombre, email, foto, año, privacidad, push_token |
| Interest | `interests` | Nombre, categoría, icono emoji |
| — | `user_interests` | Tabla puente N:M (User ↔ Interest) |
| Group | `groups` | Nombre, tipo, privacidad, creador |
| GroupMember | `group_members` | Tabla N:M con rol (admin/member) + fecha |
| Event | `events` | Nombre, fecha, ubicación, grupo (nullable), creador |
| EventRsvp | `event_rsvps` | Confirmación de asistencia (going/not_going) por usuario |
| Task | `tasks` | Título, asignatura, fecha, prioridad IA, horas estimadas, estado |
| Match | `matches` | Sugerencias IA de conexión: user_id, matched_user_id, status, affinity_score |
| Notification | `notifications` | Tipo, título, body, data (JSONB), read, user_id |
| Conversation | `conversations` | Tipo (direct/group), participantes, último mensaje |

## Schemas MongoDB (Mongoose)

| Schema | Colección | Descripción |
|---|---|---|
| Message | `messages` | Contenido, sender, conversation_id, tipo, read_by (Map) |
| TypingIndicator | `typing_indicators` | TTL 5s, auto-expiración. Índice por conversation_id |

---

## Primeros Pasos — Poblar Base de Datos y Crear Datos de Prueba

Una vez el backend arranca con `npm run start:dev`, el seed crea automáticamente universidades, carreras, ofertas académicas e intereses. Pero para que la app funcione necesitas **usuarios registrados con onboarding completo, grupos, eventos y conversaciones**. Sigue estos pasos en orden:

### Paso 1 — Registrar usuarios

```bash
# Usuario 1: Sergio
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Sergio Casamayor","email":"a28602@svalero.com","password":"ZetaTest2025"}'

# Usuario 2: Felipe
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Felipe Crespo","email":"a12345@svalero.com","password":"ZetaTest2025"}'
```

Guarda los `access_token` de cada respuesta:
```bash
TOKEN_SERGIO="<pegar access_token de Sergio>"
TOKEN_FELIPE="<pegar access_token de Felipe>"
```

### Paso 2 — Verificar que dominios no autorizados se rechazan

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@gmail.com","password":"12345678"}'
# → 400: "El dominio @gmail.com no está asociado a ninguna universidad registrada"
```

### Paso 3 — Consultar catálogo (universidades, ofertas, intereses)

Necesitas los IDs de ofertas académicas e intereses para completar el onboarding:

```bash
# Universidades
curl http://localhost:3000/api/universities

# Ofertas académicas de San Valero (usar el ID de universidad de la respuesta anterior)
curl http://localhost:3000/api/universities/<university_id>/offers

# Intereses agrupados por categoría
curl http://localhost:3000/api/interests/grouped
```

Anota los IDs que necesites: `academic_offer_id` de DAM, y los `interest_id` de los intereses que quieras asignar.

### Paso 4 — Completar onboarding (PATCH /users/me)

Este paso es **imprescindible**. Sin él los usuarios quedan sin carrera ni intereses y muchas funcionalidades (matching, grupos por carrera) no funcionan correctamente:

```bash
# Onboarding Sergio: DAM 2º curso, intereses Fútbol + Gaming + Programación
curl -X PATCH http://localhost:3000/api/users/me \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_SERGIO" \
  -d '{
    "academic_offer_id": "<id_oferta_DAM>",
    "year": 2,
    "interest_ids": ["<id_futbol>", "<id_gaming>", "<id_programacion>"],
    "privacy": "university"
  }'

# Onboarding Felipe: DAM 1er curso, intereses que quieras
curl -X PATCH http://localhost:3000/api/users/me \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_FELIPE" \
  -d '{
    "academic_offer_id": "<id_oferta_DAM>",
    "year": 1,
    "interest_ids": ["<id_programacion>", "<id_musica>", "<id_lectura>"],
    "privacy": "public"
  }'
```

### Paso 5 — Crear grupo

```bash
curl -X POST http://localhost:3000/api/groups \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_SERGIO" \
  -d '{"name":"DAM 2 San Valero","description":"Grupo de clase DAM 2o curso","type":"carrera","privacy":"public"}'
```

Guarda el `id` del grupo de la respuesta como `GROUP_ID`.

### Paso 6 — Crear evento dentro del grupo

```bash
curl -X POST http://localhost:3000/api/events \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_SERGIO" \
  -d '{
    "name": "Cafe networking",
    "description": "Primera quedada del curso",
    "event_date": "2026-03-01T18:00:00Z",
    "location": "Cafeteria Campus",
    "group_id": "'$GROUP_ID'"
  }'
```

### Paso 7 — Verificar eventos próximos

```bash
curl http://localhost:3000/api/events/upcoming \
  -H "Authorization: Bearer $TOKEN_SERGIO"
```

### Paso 8 — Crear conversación directa entre usuarios

```bash
# Sergio crea conversación directa con Felipe (usar el user ID de Felipe)
curl -X POST http://localhost:3000/api/conversations/direct/<felipe_user_id> \
  -H "Authorization: Bearer $TOKEN_SERGIO"
```

### Paso 9 — Test de chat en tiempo real (opcional)

Hay un script `test-chat.js` en la raíz del proyecto que simula una conversación completa entre Sergio y Felipe con typing indicators y read receipts:

```bash
node test-chat.js
```

Salida esperada:
```
✅ Sergio conectado
✅ Felipe conectado
--- SIMULACIÓN DE CHAT ---
📤 Sergio envía: "Ey Felipe, has visto el proyecto de BD?"
📥 Felipe recibe: [Sergio Casamayor]: Ey Felipe, has visto el proyecto de BD?
✍️  Sergio ve: alguien está escribiendo...
📤 Felipe envía: "Sí tío, lo tengo casi listo"
📥 Sergio recibe: [Felipe Crespo]: Sí tío, lo tengo casi listo
✅ Chat en tiempo real funcionando correctamente
```

### Paso 10 — Verificar conversaciones y mensajes

```bash
# Lista de conversaciones de Sergio
curl http://localhost:3000/api/conversations \
  -H "Authorization: Bearer $TOKEN_SERGIO"

# Mensajes de una conversación específica
curl http://localhost:3000/api/conversations/<conversation_id>/messages \
  -H "Authorization: Bearer $TOKEN_SERGIO"
```

---

## Cuentas de Prueba

### Desarrollo (@svalero.com)
Cualquier email `@svalero.com` puede registrarse. Se asocia automáticamente a "Centro San Valero".

### Demo Tribunal (@zetapp.es)
Dominio `zetapp.es` registrado como "Universidad Demo Zeta" para la presentación ante el tribunal. Se pueden crear hasta 5 cuentas de prueba con este dominio.

---

## Scripts Disponibles

```bash
# Desarrollo con hot-reload
npm run start:dev

# Build de producción
npm run build

# Arrancar build de producción
npm run start:prod

# Linting
npm run lint

# Tests
npm run test
npm run test:watch
npm run test:cov
```

---

## Configuración de Producción

Para producción, cambiar las siguientes variables:

```env
NODE_ENV=production
DB_HOST=<endpoint-aws-rds>          # Instancia db.t4g.micro
DB_PASSWORD=<password-seguro>
MONGO_URI=mongodb+srv://<usuario>:<password>@<cluster>.mongodb.net/zeta_chat
JWT_SECRET=<clave-aleatoria-min-64-chars>
```

Consideraciones para producción:
- Desactivar `synchronize: true` en TypeORM y usar migraciones
- Restringir CORS a dominios específicos (actualmente `origin: '*'`)
- Configurar rate limiting en endpoints públicos
- Habilitar SSL/TLS en las conexiones a base de datos

---

## Troubleshooting

### Error de autenticación con PostgreSQL
Si `npm run start:dev` falla con `password authentication failed`:
```bash
docker-compose down
docker volume rm zeta-backend_zeta_pg_data zeta-backend_zeta_mongo_data
docker-compose up -d
# Esperar 5 segundos
npm run start:dev
```

### El `.env` no se lee correctamente
Verificar que NestJS lo carga:
```bash
node -e "require('dotenv').config(); console.log('USER:', process.env.DB_USERNAME);"
```
Asegurarse de que el archivo `.env` no tiene comentarios ni líneas vacías al principio, y está en la raíz del proyecto (mismo nivel que `package.json`).

### CLI de NestJS no reconoce `nest start`
```bash
rm -rf node_modules package-lock.json
npm install
npm install -D @nestjs/cli@latest
npx nest --version   # Debe mostrar 11.x
npm run start:dev
```

### Docker no arranca (Windows)
Verificar que Docker Desktop está corriendo y tiene WSL 2 activado (Settings > General > "Use the WSL 2 based engine").

### WebSocket no conecta desde Expo Go
Asegurarse de que el frontend usa la IP local de la máquina (no `localhost`) y que el firewall no bloquea el puerto 3000.

---

## Inteligencia Artificial (n8n + Gemini)

Los flujos de IA se ejecutan fuera del backend, en una instancia de **n8n** que conecta con **Google Gemini** para análisis inteligente:

| Workflow | Webhook | Descripción |
|---|---|---|
| Matching | `/webhook/matching` | Compara intereses, carrera y universidad para sugerir conexiones con puntuación de afinidad |
| Task Priority | `/webhook/task-priority` | Asigna prioridad (low/medium/high/urgent) y tiempo estimado en horas a tareas nuevas |
| Calendar Conflict | `/webhook/calendar-conflict` | Detecta conflictos evento-evento, evento-tarea y tarea-tarea, con recomendaciones y horarios alternativos |

Las URLs se configuran en `.env`:

```env
N8N_WEBHOOK_MATCHING=https://<tunnel>.trycloudflare.com/webhook/matching
N8N_WEBHOOK_TASK_PRIORITY=https://<tunnel>.trycloudflare.com/webhook/task-priority
N8N_WEBHOOK_CALENDAR_CONFLICTS=https://<tunnel>.trycloudflare.com/webhook/calendar-conflict
```

> **Nota**: Los túneles de Cloudflare (`trycloudflare.com`) cambian cada vez que se reinicia n8n. Actualizar `.env` con la nueva URL tras cada reinicio. Para desarrollo local sin túnel, el fallback apunta a `http://localhost:5678/webhook/...`.

---

## Licencia

Proyecto académico — Centro San Valero, DAM 2º curso, 2025-2026.