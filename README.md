# SYNAP — by VERSA.JS

> **S**istema **Y** **N**inja **A**utomated **P**latform

Plataforma de kiosco digital para registro y facturación en sedes Ninja Park.
Captura datos, fotos y acompañantes en segundos. Facturación sincronizada, panel master y control total desde cualquier sede.

---

## 🏗️ Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| **Frontend** | React 19 + Vite 8 + TailwindCSS 4.3.3 |
| **Backend** | Node.js + Express 5 + Sequelize 6 |
| **Base de Datos** | SQLite (vía Sequelize) |
| **Autenticación** | JWT (jsonwebtoken + bcryptjs) |
| **Archivos** | Multer (carga de fotos) |
| **Exportación** | xlsx (reportes Excel) |

---

## 📋 Requisitos Previos

- **Node.js** v20 o superior
- **npm** v9 o superior
- Navegador moderno (Chrome, Edge, Firefox)

---

## 🚀 Instalación y Ejecución

### 1. Clonar el repositorio

```bash
git clone https://github.com/4GeeksAcademy/NinjaPark-JeanF.git
cd NinjaPark-JeanF
```

### 2. Iniciar el Backend (puerto 3001)

```bash
cd backend
npm install
node server.js
```

El backend iniciará automáticamente:
- Sincronización de base de datos SQLite
- Creación de usuarios seed por defecto
- Servidor listo en `http://localhost:3001`

### 3. Iniciar el Frontend (puerto 5173)

**Abre otra terminal** y ejecuta:

```bash
cd frontend
npm install
npm run dev
```

El frontend estará disponible en `http://localhost:5173`

### 4. Abrir en el navegador

Visita **[http://localhost:5173](http://localhost:5173)**

---

## 👥 Usuarios Seed (Predefinidos)

| Usuario | Contraseña | Rol | Sede |
|---------|-----------|-----|------|
| `jeanf9839@gmail.com` | `The.poison123` | **master** | Todas |
| `admin.candelaria` | `AdminCandelaria2026!` | admin | Ninja Park Candelaria |
| `cajero.candelaria` | `CajeroCandelaria2026!` | cajero | Ninja Park Candelaria |
| `admin.chacao` | `AdminChacao2026!` | admin | Ninja Park Chacao |
| `cajero.chacao` | `CajeroChacao2026!` | cajero | Ninja Park Chacao |

> **Rol master**: acceso total a todas las sedes y panel de administración completo.
> **Rol admin**: acceso limitado a su sede asignada.
> **Rol cajero**: acceso de solo lectura a su sede.

---

## 📡 Endpoints de la API

### Autenticación
| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/auth/login` | Iniciar sesión (body: `{ username, password }`) |
| `GET` | `/api/auth/me` | Obtener datos del usuario autenticado |

### Sedes
| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/sedes` | Listar sedes disponibles |

### Kiosco (Registro)
| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/kiosk/register-start` | Iniciar registro (buscar/crear representante) |
| `POST` | `/api/kiosk/register-complete` | Completar registro con acompañantes |
| `POST` | `/api/kiosk/upload-photo` | Subir foto desde el kiosco |

### Administración
| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/admin/records` | Listar registros (filtrable por sede/fecha) |
| `PATCH` | `/api/admin/records/:id` | Editar un registro |
| `GET` | `/api/admin/export` | Exportar registros como JSON |
| `GET` | `/api/admin/export.xlsx` | Exportar registros como Excel |

### POS y Facturación
| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/pos/autocomplete/:cedula` | Buscar cliente por cédula |
| `GET` | `/api/billing/lookup/:cedula` | Consultar facturación |
| `GET` | `/api/billing/notifications` | Listar notificaciones de billing |
| `POST` | `/api/billing/webhook` | Webhook de billing |

---

## 📁 Estructura del Proyecto

```
NinjaPark-JeanF/
├── backend/
│   └── server.js          # API Express + Sequelize + rutas
├── frontend/
│   ├── src/
│   │   ├── App.jsx        # Componente principal (React)
│   │   ├── main.jsx       # Punto de entrada
│   │   └── index.css      # Estilos Tailwind + animaciones
│   ├── index.html         # HTML de entrada
│   └── package.json
├── README.md
├── README.es.md
└── README.cn.md
```

---

## 🧪 Build de Producción

```bash
cd frontend
npm run build
```

Genera la carpeta `dist/` con los archivos optimizados para producción.

---

## 🎨 Animaciones

SYNAP incluye animaciones fluidas premium:
- Partículas flotantes decorativas en Hero y CTA
- Shimmer y twinkle effects en backgrounds
- Stagger reveals con Intersection Observer
- Timeline interactiva con 4 pasos
- Glass cards con hover 3D
- Toast con slide-up + scale bounce

Todas las transiciones usan `cubic-bezier(0.16, 1, 0.3, 1)` para movimiento buttery smooth.

---

## 📄 Licencia

Proyecto académico — 4Geeks Academy Coding Bootcamp.

---

## 👨‍💻 Autor

**Jean Franco** — Proyecto final del curso Full Stack Developer.

---

*Powered by VERSA.JS — Plataforma SYNAP v1.0.0*
