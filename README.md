# 🎮 Salón de Juegos

Portal de juegos web multijugador. Cada juego vive en su propia sección del sitio y en su propio *namespace* de Socket.IO dentro del mismo servidor.

| Juego | Ruta | Descripción |
|---|---|---|
| **Rally de Letras** | `/rally-de-letras` | Carreras de mecanografía: todos escriben el mismo texto y cada uno avanza con su auto según su progreso. |
| **Carrera de Sílabas** | `/carrera-de-silabas` | Carreras de palabras: todos reciben la misma secuencia de sílabas y suman un punto por letra con cada palabra que la contenga, hasta la meta (100 o 200 puntos). |

Monorepo con npm workspaces:

| Paquete | Contenido |
|---|---|
| `shared/` | Tipos de los eventos de Socket.IO, tipos de sala y constantes. Rally de Letras se importa desde `@typeracer/shared` y Carrera de Sílabas desde `@typeracer/shared/carrera-de-silabas` |
| `server/` | Node.js + Express + Socket.IO. Cada juego en `src/games/<id>/`, con su lógica pura separada de Socket.IO; lo común a todos (sesiones, temporizadores, códigos de sala) en `src/common/` |
| `client/` | React + Vite: el portal y cada juego (cargado bajo demanda) |

## Estructura

```
server/src/
├─ index.ts                     # arranque: config + juegos + escuchar puerto
├─ config.ts                    # variables de entorno
├─ app.ts                       # Express + Socket.IO; monta cada juego en su namespace
├─ common/                      # SessionRegistry, KeyedTimers y códigos de sala, compartidos por los juegos
└─ games/
   ├─ rally-de-letras/
   │  ├─ index.ts               # mountRallyDeLetras(io, …) → namespace /rally-de-letras
   │  ├─ domain/                # lógica pura: RoomManager (salas, carrera, listos, chat…), resultados, textos
   │  └─ realtime/              # capa Socket.IO: contexto y handlers
   └─ carrera-de-silabas/
      ├─ index.ts               # mountCarreraDeSilabas(io, …) → namespace /carrera-de-silabas
      ├─ domain/                # RoomManager (salas como Rally + carrera por palabras), diccionario y sílabas
      └─ realtime/              # capa Socket.IO: contexto y handlers

client/src/
├─ main.tsx
├─ shell/                       # App (rutas, cabecera común con migas), tema claro/oscuro, hueco de cabecera
├─ portal/                      # Salón de Juegos: catálogo (games.ts), tarjetas y vistas previas
├─ games/rally-de-letras/       # todo el juego: RallyApp (rutas), features, components, state, lib
├─ games/carrera-de-silabas/    # SilabasApp; reutiliza componentes y estilos de Rally de Letras
└─ styles/global.css            # variables y clases base; cada componente tiene su *.module.css
```

### Agregar un juego nuevo

1. **Servidor:** crea `server/src/games/<id>/` con una función `mount…(io)` que use `io.of('/<id>')`, y llámala en `app.ts`.
2. **Cliente:** crea `client/src/games/<id>/` con su componente raíz, que se conecte a `SERVER_URL + '/<id>'`.
3. Agrega la ruta perezosa en `client/src/shell/App.tsx` y la tarjeta en `client/src/portal/games.ts` (con su vista previa en `portal/previews/`).

## Requisitos

- Node.js 20 o superior
- npm 9 o superior

## Correrlo localmente

```bash
npm install
cp .env.example .env     # opcional: sin .env se usan los valores por defecto
npm run dev
```

`npm run dev` compila `shared/` y levanta a la vez:

- el servidor en `http://localhost:3001`
- el cliente en `http://localhost:5173`

### Probar con dos jugadores

1. Abre `http://localhost:5173`, entra a **Rally de Letras**, escribe un nickname y pulsa **Crear sala**.
2. Copia el enlace de la sala (`/rally-de-letras/sala/ABCDE`; los enlaces antiguos `/sala/ABCDE` redirigen) y ábrelo en otra pestaña (o en una ventana privada). Escribe otro nickname y pulsa **Entrar**.
3. Pulsa **Estoy listo** en ambas pestañas: con todos listos la carrera arranca sola (el host también puede pulsar **Empezar ya**). Ambas muestran la cuenta 3‑2‑1 sincronizada.
4. Escribe en las dos pestañas: los carritos avanzan en ambas.
5. Al terminar todos (o a los 3 minutos) aparece la tabla de resultados; el host puede pulsar **Otra carrera**.
6. Cierra la pestaña del host: el otro jugador pasa a ser host.

> Los navegadores ralentizan los temporizadores de las pestañas en segundo plano, así que el carrito del jugador de la pestaña oculta puede moverse a saltos. Para ver los dos fluidos, pon las ventanas lado a lado.

### Otros scripts

```bash
npm test         # tests del servidor (dominio + reconexión) y del cliente (lógica de tecleo)
npm run build    # compila shared, server (dist/) y client (client/dist/)
npm start        # arranca el servidor compilado
```

## Variables de entorno

Ver `.env.example`. En local se lee un único `.env` en la raíz.

| Variable | Usada por | Descripción |
|---|---|---|
| `PORT` | servidor | Puerto HTTP (por defecto `3001`) |
| `CLIENT_ORIGIN` | servidor | Orígenes permitidos por CORS, separados por comas |
| `VITE_SERVER_URL` | cliente | URL del servidor de Socket.IO (se inyecta en el build) |

## Despliegue

### AWS con Terraform (recomendado)

Frontend en S3 + CloudFront, backend en Lightsail (Docker: Node + Caddy con HTTPS automático) y DNS en Route 53, por unos 6–9 USD/mes.

- **Infraestructura:** en `infra/terraform/`. `infra/bootstrap/` crea, una sola vez, el bucket del estado y los roles de GitHub Actions.
- **Despliegue del código:** con `scripts/deploy-backend.sh` y `scripts/deploy-frontend.sh`.
- **CI/CD con GitHub Actions:**
  - Cada pull request pasa tests, build, imagen Docker y validación de Terraform. Si toca la infraestructura, también `terraform plan`.
  - Cada push a `main` despliega solo lo que cambió: Terraform, backend y/o frontend.

Guía paso a paso: [infra/README.md](infra/README.md).

### Backend en Railway o Render

Configura el servicio con la raíz del repositorio como directorio de trabajo:

- **Build command:** `npm install && npm run build -w shared && npm run build -w server`
- **Start command:** `npm start`
- **Variables:** `CLIENT_ORIGIN=https://tu-front.vercel.app` (Railway y Render inyectan `PORT` solos)

Socket.IO funciona sobre WebSockets en ambos servicios sin configuración extra. Comprueba que responde en `https://tu-backend/health`.

> El estado de las salas vive en memoria: usa una sola instancia del servidor. Con varias instancias haría falta un adaptador (p. ej. Redis) y sesiones fijas.

### Frontend en Vercel

- **Root directory:** `client`
- **Framework preset:** Vite
- **Install command:** `cd .. && npm install`
- **Build command:** `cd .. && npm run build -w shared && npm run build -w client`
- **Output directory:** `dist`
- **Variable:** `VITE_SERVER_URL=https://tu-backend.up.railway.app`

`client/vercel.json` redirige todas las rutas a `index.html` para que funcionen los enlaces `/sala/ABCDE`.

### Frontend en Netlify

- **Base directory:** (vacío, raíz del repo)
- **Build command:** `npm run build -w shared && npm run build -w client`
- **Publish directory:** `client/dist`
- **Variable:** `VITE_SERVER_URL=https://tu-backend.onrender.com`

`client/public/_redirects` hace el mismo trabajo que `vercel.json`.

## Reglas del servidor

- El servidor elige el texto, fija el inicio (`ahora + 3 s`) y decide el orden de llegada; un jugador "termina" solo cuando su progreso validado alcanza la longitud del texto.
- **Listos y salida automática** (`player:ready`): cada piloto se marca listo en el lobby. Con todos listos (aunque sea uno solo practicando) la carrera arranca de inmediato; con más de la mitad (y al menos 2 jugadores) se programa una salida en 15 s (`AUTO_START_MS`, visible para todos como `autoStartAt`), que se cancela si se pierde la mayoría. El host puede empezar en cualquier momento. Los listos se reinician en cada carrera.
- **Chat** (`chat:send` / `chat:message` / `chat:history`): cada sala guarda sus últimos 50 mensajes, que recibe quien entra o vuelve tras recargar. Los mensajes se limpian (una línea, máximo 200 caracteres) y hay un mínimo de 0,5 s entre mensajes de un mismo jugador. El servidor publica avisos cuando alguien entra, sale o abandona la carrera.
- **Salir de la carrera**: el botón "Salir" (o Esc) ofrece tres opciones.
  - **Volver a la sala** (`race:retire`): el jugador deja de correr pero sigue en la sala. Su auto queda parado en la pista ("se retiró") y él ve el lobby con la carrera en vivo y el chat. Si ya había llegado, conserva su puesto.
  - **Salir de la sala** (`room:leave`): queda como "se fue" en la pista.
  - **Cancelar carrera** (`race:cancel`, solo el host): todos vuelven al lobby sin resultados. El host también puede cancelar desde el lobby si volvió a la sala.
- **Cuándo termina la carrera**: cuando los que siguen corriendo han llegado. Si ya nadie corre, hay resultados si alguien llegó; si no, la carrera se cancela y todos vuelven al lobby.
- **Ajustes de sala** (solo el host, fuera de carrera, evento `room:settings`): texto aleatorio del catálogo o un texto pegado (20–1500 caracteres) y límite de tiempo (15 s a 15 min; la interfaz ofrece de 30 s a 10 min). El texto pegado se normaliza en el servidor: comillas y guiones tipográficos pasan a su versión simple y los saltos de línea y espacios repetidos se reducen a un espacio.
- Se ignoran actualizaciones de progreso antes del inicio, que no aumentan, que superan la longitud del texto o que implican más de 250 WPM desde el inicio. El cliente reenvía su progreso si el servidor no lo confirmó.
- La precisión usa los errores que reporta el cliente; es informativa y no afecta las posiciones.
- Cada pestaña guarda en `sessionStorage` un `sessionId` secreto que manda al conectar. Así, al **recargar la página** el servidor reconoce al jugador y le devuelve su lugar (incluido el progreso si estaba en plena carrera).
- Si un jugador pierde la conexión, se muestra como "reconectando…" y el servidor le guarda el lugar 15 s (`RECONNECT_GRACE_MS`). Si no vuelve, sale de la sala: en plena carrera queda como "desconectado", y si era host, el host pasa al siguiente jugador. Las salas sin jugadores se eliminan.
- Abrir la misma sesión en otra pestaña (p. ej. "Duplicar pestaña") reemplaza a la anterior.

## Reglas de Carrera de Sílabas

Salas, listos, chat, salir de la carrera (volver a la sala, salir o cancelar), abandono y reconexión funcionan igual que en Rally de Letras. Lo propio del juego:

- **Meta** (`room:settings`, solo el host): 100 o 200 puntos. Hay además un límite de seguridad de 5 minutos; si se cumple, los que no llegaron se ordenan por puntos.
- **Sílabas**: al empezar, el servidor sortea una secuencia de sílabas (de 2 o 3 letras, con vocal, que aparecen en al menos 3000 palabras del diccionario) que es la misma para todos. Cada jugador avanza por ella a su ritmo: al acertar pasa a la siguiente.
- **Palabras** (`race:word`, con respuesta): se pasan a minúsculas y sin tildes (la ñ se respeta) y deben tener solo letras, entre 3 y 30, contener la sílaba actual, estar en el diccionario y no haberse usado antes en la carrera. Cada palabra aceptada suma un punto por letra. Hay un mínimo de 0,3 s entre intentos.
- **Diccionario**: el paquete [`an-array-of-spanish-words`](https://github.com/words/an-array-of-spanish-words) (MIT, ~636 000 palabras con conjugaciones), cargado una sola vez al arrancar el servidor (unos 50 MB de memoria). No se envía al navegador.
- Todos ven las palabras que aciertan los demás (`race:word`) y el avance en la pista.
