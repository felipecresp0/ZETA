# Zeta App — Frontend

App multiplataforma (iOS/Android/Web) para conectar el mundo académico y social de los estudiantes universitarios. Construida con **React Native + Expo**.

> Desarrollado por **Felipe Crespo** (frontend) y **Sergio Casamayor** (backend).

---

## Stack Tecnológico

| Tecnología | Versión | Uso |
|---|---|---|
| React Native | 0.76+ | Framework UI multiplataforma |
| Expo / Expo Go | SDK 52+ | Build tooling + pruebas en dispositivo |
| TypeScript | 5.x | Tipado estático |
| React Navigation | 7.x | Navegación (Stack + Bottom Tabs) |
| Socket.IO Client | 4.x | Chat en tiempo real (WebSockets) |
| Axios | 1.x | Cliente HTTP para la API REST |
| AsyncStorage | 2.x | Persistencia local del JWT |
| react-native-calendars | 1.1314+ | Calendario mensual con multi-dot marking |
| @react-native-community/datetimepicker | — | Selector nativo de fecha/hora |
| react-native-safe-area-context | 5.x | Safe areas (notch, Dynamic Island) |
| Feather + Ionicons (expo/vector-icons) | — | Iconografía |

---

## Requisitos Previos

Antes de clonar y arrancar necesitas tener instalado:

1. **Node.js** >= 18.x — [https://nodejs.org](https://nodejs.org)
2. **npm** >= 9.x (viene con Node)
3. **Expo CLI** (global):
   ```bash
   npm install -g expo-cli
   ```
4. **Expo Go** instalado en tu móvil:
   - [iOS App Store](https://apps.apple.com/app/expo-go/id982107779)
   - [Google Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent)
5. **Git** para clonar el repositorio
6. El **backend de Zeta** debe estar corriendo (ver sección Conexión con el Backend)

---

## Instalación

```bash
# 1. Clonar el repositorio
git clone <url-del-repo>
cd zeta-app

# 2. Instalar dependencias
npm install

# 3. Configurar la IP del backend (ver sección siguiente)

# 4. Arrancar Expo
npx expo start -c
```

El flag `-c` limpia la caché de Metro. Úsalo siempre que cambies dependencias o si algo falla sin motivo aparente.

---

## Configuración de la API (Backend)

La app se conecta al backend de NestJS mediante una instancia de Axios configurada en:

```
src/services/api.ts
```

**Para desarrollo local**, necesitas apuntar la `baseURL` a la IP de tu máquina en la red local (no `localhost`, porque Expo Go corre en tu móvil):

```typescript
// src/services/api.ts
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const api = axios.create({
  baseURL: 'http://TU_IP_LOCAL:3000/api',  // ← Cambiar esto
  timeout: 10000,
});

// Interceptor: añade el JWT a cada request
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
```

### Cómo encontrar tu IP local

| Sistema | Comando |
|---|---|
| macOS | `ifconfig \| grep "inet " \| grep -v 127.0.0.1` |
| Windows | `ipconfig` → busca "IPv4 Address" en tu adaptador WiFi |
| Linux | `hostname -I` |

Ejemplo: si tu IP es `192.168.1.42`, la baseURL sería `http://192.168.1.42:3000/api`.

> **Importante**: Tu móvil y tu PC deben estar en la **misma red WiFi**.

---

## Arrancar el Proyecto

```bash
# Modo desarrollo con caché limpia
npx expo start -c
```

Expo te mostrará un QR en la terminal. Opciones:

- **Móvil (recomendado)**: Escanea el QR con la app Expo Go
- **Web**: Pulsa `w` en la terminal para abrir en navegador
- **Simulador iOS**: Pulsa `i` (requiere Xcode en macOS)
- **Emulador Android**: Pulsa `a` (requiere Android Studio)

---

## Estructura de Carpetas

```
zeta-app/
├── App.tsx                          # Punto de entrada (SafeAreaProvider + AuthProvider)
├── app.json                         # Configuración Expo
├── package.json
│
├── src/
│   ├── context/
│   │   └── AuthContext.tsx           # Contexto global de autenticación (user + token)
│   │
│   ├── navigation/
│   │   ├── RootNavigator.tsx         # Switch entre AuthStack y MainTabs
│   │   ├── AuthStack.tsx             # Stack: Welcome → Login → Register
│   │   └── MainTabs.tsx              # Bottom Tabs: Home, Groups, Chat, Calendar, Profile
│   │
│   ├── screens/
│   │   ├── auth/
│   │   │   ├── WelcomeScreen.tsx     # Pantalla de bienvenida con logo
│   │   │   ├── LoginScreen.tsx       # Login con email institucional
│   │   │   ├── RegisterScreen.tsx    # Registro con validación de dominio
│   │   │   └── OnboardingScreen.tsx  # Selección universidad/carrera/intereses
│   │   │
│   │   ├── home/
│   │   │   └── HomeScreen.tsx        # Dashboard: matches, grupos, eventos, chats
│   │   │
│   │   ├── match/
│   │   │   └── MatchScreen.tsx       # Swipe cards de matching IA + conexiones
│   │   │
│   │   ├── groups/
│   │   │   └── GroupsScreen.tsx      # Lista de grupos del usuario
│   │   │
│   │   ├── chat/
│   │   │   ├── ConversationsScreen.tsx # Lista de chats
│   │   │   └── ChatScreen.tsx        # Chat real-time + eventos + RSVP + conflictos IA
│   │   │
│   │   ├── uni/
│   │   │   └── UniScreen.tsx         # Calendario + Eventos + Tareas (3 tabs)
│   │   │
│   │   ├── notifications/
│   │   │   └── NotificationsScreen.tsx # Notificaciones + solicitudes conexión
│   │   │
│   │   └── profile/
│   │       └── ProfileScreen.tsx     # Perfil del usuario
│   │
│   ├── services/
│   │   ├── api.ts                    # Instancia Axios + interceptor JWT
│   │   ├── authService.ts           # POST /auth/login, /auth/register
│   │   ├── eventsService.ts         # CRUD eventos + RSVP + conflictos IA
│   │   ├── tasksService.ts          # CRUD tareas + callback IA
│   │   ├── groupService.ts          # CRUD grupos + miembros
│   │   └── socketService.ts         # Conexión Socket.IO para chat
│   │
│   ├── components/
│   │   └── ZAvatar.tsx              # Avatar reutilizable con foto o iniciales
│   │
│   ├── hooks/
│   │   └── useEvents.ts             # Hook: carga eventos + agrupa por fecha
│   │
│   └── theme/
│       ├── colors.ts                # Paleta de colores Zeta
│       └── spacing.ts              # Constantes de espaciado
│
└── assets/                          # Imágenes, fuentes, splash screen
```

---

## Paleta de Colores

Definida en `src/theme/colors.ts`:

| Variable | Hex | Uso |
|---|---|---|
| `primary` | `#0298D1` | Color principal, botones, acentos |
| `primaryDark` | `#1976D2` | Variante oscura |
| `primaryDeep` | `#0D47A1` | Headers, fondos oscuros |
| `background` | `#F5F5F5` | Fondo general |
| `surface` | `#FFFFFF` | Cards, modales |
| `text` | `#212121` | Texto principal |
| `textSecondary` | `#757575` | Texto secundario |
| `border` | `#E0E0E0` | Bordes y separadores |

---

## Pantallas Implementadas

### Autenticación
- **WelcomeScreen** — Splash con logo y botones "Iniciar sesión" / "Registrarse"
- **LoginScreen** — Email + contraseña, valida contra `POST /api/auth/login`
- **RegisterScreen** — Nombre + email institucional + contraseña, valida dominio contra `POST /api/auth/register`

### App Principal (Bottom Tabs)
- **HomeScreen** — Dashboard con matches IA, grupos, eventos próximos y chats recientes. Icono de campana con badge rojo condicional (solo si hay notificaciones no leídas)
- **MatchScreen** — Sistema de swipe cards para aceptar/rechazar matches IA. Polling automático para nuevos usuarios. Solo muestra conexiones mutuas
- **GroupsScreen** — Lista de grupos del usuario, crear/unirse a grupos
- **ConversationsScreen** — Lista de conversaciones (1:1 y grupales) ordenadas por último mensaje
- **ChatScreen** — Mensajería en tiempo real vía Socket.IO con typing indicators, read receipts, creación de eventos con análisis de conflictos IA, y gestión de asistencia (RSVP)
- **UniScreen** — Pantalla unificada con 3 tabs:
  - **Calendario** — Calendario mensual con dots multicolor (azul=eventos, naranja=tareas, rojo=conflictos IA). Detalle del día con EventCards y banner de análisis IA
  - **Eventos** — Lista de eventos próximos con conflictos IA inline. FAB para crear eventos universitarios o de grupo con selector de visibilidad
  - **Tareas** — Lista de tareas con prioridad y horas estimadas por IA. Polling para actualización tras análisis IA
- **ProfileScreen** — Datos del usuario, carrera, intereses, cerrar sesión

### Pantallas Adicionales
- **NotificationsScreen** — Solicitudes de conexión + actividad reciente. Botón para borrar todas las notificaciones. Al pulsar una notificación se elimina y navega al contenido
- **OnboardingScreen** — Selección de universidad, carrera, año e intereses tras el registro

---

## Conexión con el Backend

El frontend se comunica con dos sistemas del backend:

### API REST (Axios)
Todas las llamadas HTTP pasan por `src/services/api.ts`. Endpoints principales:

| Método | Endpoint | Descripción |
|---|---|---|
| POST | `/auth/register` | Registro con email institucional |
| POST | `/auth/login` | Login, devuelve JWT |
| GET | `/users/me` | Perfil del usuario autenticado |
| PATCH | `/users/me` | Actualizar perfil (carrera, intereses) |
| GET | `/groups` | Mis grupos |
| POST | `/groups` | Crear grupo |
| POST | `/groups/:id/join` | Unirse a grupo |
| GET | `/events/upcoming` | Mis próximos eventos (grupos + universitarios) |
| POST | `/events` | Crear evento (con o sin grupo) |
| POST | `/events/:id/rsvp` | Confirmar/declinar asistencia |
| GET | `/events/:id/rsvp` | Resumen de asistencia |
| POST | `/events/check-conflicts` | Análisis de conflictos IA en lote |
| GET | `/tasks/me` | Mis tareas |
| POST | `/tasks` | Crear tarea (IA asigna prioridad) |
| PATCH | `/tasks/:id` | Actualizar tarea |
| DELETE | `/tasks/:id` | Eliminar tarea |
| GET | `/matches/me` | Mis matches IA |
| POST | `/matches/:id/accept` | Aceptar match |
| POST | `/matches/:id/reject` | Rechazar match |
| GET | `/matches/connections` | Conexiones mutuas |
| GET | `/notifications` | Mis notificaciones |
| GET | `/notifications/unread-count` | Contador no leídas |
| DELETE | `/notifications/all` | Borrar todas |
| DELETE | `/notifications/:id` | Borrar una notificación |
| GET | `/conversations` | Lista de conversaciones |
| GET | `/interests/grouped` | Catálogo de intereses por categoría |
| GET | `/universities` | Lista de universidades registradas |

### WebSocket (Socket.IO)
Chat en tiempo real mediante `src/services/socketService.ts`:

| Evento | Dirección | Descripción |
|---|---|---|
| `join_conversation` | Cliente → Server | Unirse a sala de chat |
| `send_message` | Cliente → Server | Enviar mensaje |
| `new_message` | Server → Cliente | Recibir mensaje nuevo |
| `typing` | Bidireccional | Indicador "está escribiendo..." |
| `message_read` | Cliente → Server | Marcar mensaje como leído |

---

## Cuentas de Prueba

### Desarrollo (dominio @svalero.com)
Cualquier email con dominio `@svalero.com` puede registrarse. Se asocia automáticamente a "Centro San Valero".

```
Email: a28602@svalero.com
Password: ZetaTest2025
```

### Demo Tribunal (dominio @zetapp.es)
Para la presentación ante el tribunal se usan cuentas con el dominio propio `@zetapp.es`, asociadas a "Universidad Demo Zeta".

---

## Scripts Disponibles

```bash
# Arrancar en modo desarrollo
npx expo start

# Arrancar con caché limpia (recomendado si hay problemas)
npx expo start -c

# Abrir directamente en web
npx expo start --web

# Instalar una dependencia compatible con Expo
npx expo install <paquete>
```

> **Nota**: Usa siempre `npx expo install` en vez de `npm install` para dependencias de React Native. Expo se encarga de instalar la versión compatible con tu SDK.

---

## Troubleshooting

### "MIME type application/json is not executable"
Metro bundler está devolviendo un error en vez del bundle JS. Reinicia con caché limpia:
```bash
npx expo start -c
```

### La app no conecta con el backend desde el móvil
1. Verifica que el backend está corriendo (`npm run start:dev` en `zeta-backend/`)
2. Comprueba que tu IP en `api.ts` es correcta
3. Asegúrate de que móvil y PC están en la misma WiFi
4. Verifica que el firewall no bloquea el puerto 3000

### El calendario no muestra eventos
1. Tu usuario debe pertenecer a al menos un grupo
2. Ese grupo debe tener eventos futuros creados
3. Comprueba que `GET /api/events/upcoming` devuelve datos (prueba con curl)

### "Cannot find module react-native-calendars"
```bash
npx expo install react-native-calendars
npx expo start -c
```

---

## Requisitos del Backend

Para que el frontend funcione completamente, el backend de Sergio debe estar corriendo con:

1. **Docker** con PostgreSQL + MongoDB:
   ```bash
   cd zeta-backend
   docker-compose up -d
   ```

2. **Backend NestJS**:
   ```bash
   cd zeta-backend
   npm install
   npm run start:dev
   ```

El seed automático crea universidades (San Valero + Demo Zeta), carreras, ofertas académicas e intereses al arrancar en modo desarrollo.

---

## Licencia

Proyecto académico — Centro San Valero, DAM 2º curso, 2025-2026.