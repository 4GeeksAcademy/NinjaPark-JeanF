require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const XLSX = require('xlsx');
const {
  sequelize,
  Representante,
  Representado,
  BillingNotification,
  User,
} = require('./database');

const app = express();
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error('FATAL: falta JWT_SECRET o tiene menos de 32 caracteres. El servidor no arranca.');
  process.exit(1);
}
const KIOSK_DEFAULT_SEDE = process.env.KIOSK_DEFAULT_SEDE || 'Ninja Park Candelaria';
const SEDES = [
  'Ninja Park Candelaria',
  'Ninja Park Chacao',
];

// ─── Configuración de Multer para subida de fotos ───
const storage = multer.diskStorage({
  destination: path.join(__dirname, 'uploads'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    const uniqueName = `foto_${Date.now()}_${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, uniqueName);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Formato de imagen no soportado. Usa JPG, PNG o WebP.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB máximo
});

// Middleware
app.use(cors({
  origin: FRONTEND_URL,
  methods: ['GET', 'POST', 'PATCH'],
}));
app.use(express.json({ limit: '10mb' }));

const signUserToken = (user) => jwt.sign({
  id: user.id,
  username: user.username,
  role: user.role,
  sede: user.sede,
}, JWT_SECRET, { expiresIn: '12h' });

const authRequired = (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Token requerido' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    return next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
};

const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'No autorizado para esta acción' });
  }
  return next();
};

const isValidSede = (sede) => !sede || SEDES.includes(sede);

const normalizeRepresentados = (representados = []) => (
  Array.isArray(representados)
    ? representados
      .filter((r) => r?.nombre && r?.fecha_nacimiento)
      .map((r) => ({
        nombre: String(r.nombre).trim(),
        fecha_nacimiento: r.fecha_nacimiento,
      }))
      .filter((r) => r.nombre && r.fecha_nacimiento)
    : []
);

const savePhotoByCedula = async (cedulaValue, fileName) => {
  const trimmedCedula = String(cedulaValue || '').trim();
  if (!trimmedCedula) return null;

  const representante = await Representante.findOne({ where: { cedula: trimmedCedula } });
  if (!representante) return null;

  const fotoUrl = `/uploads/${fileName}`;
  representante.foto_url = fotoUrl;
  await representante.save();
  return fotoUrl;
};

// Servir archivos estáticos de uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Ruta raíz informativa para evitar confusión al abrir el puerto del backend
app.get('/', (req, res) => {
  return res.status(200).json({
    message: 'API de VERSA activa',
    frontend: FRONTEND_URL,
    health: '/api/health',
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/sedes', (req, res) => {
  return res.status(200).json({ sedes: SEDES });
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const username = (req.body.username || '').trim();
    const password = req.body.password || '';

    if (!username || !password) {
      return res.status(400).json({ error: 'username y password son obligatorios' });
    }

    const user = await User.findOne({ where: { username } });
    if (!user || !user.activo) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const token = signUserToken(user);
    return res.status(200).json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        sede: user.sede,
        nombre: user.nombre,
      },
    });
  } catch (error) {
    console.error('Error en login:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.get('/api/auth/me', authRequired, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user || !user.activo) {
      return res.status(401).json({ error: 'Usuario no disponible' });
    }

    return res.status(200).json({
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        sede: user.sede,
        nombre: user.nombre,
      },
    });
  } catch (error) {
    console.error('Error en auth me:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// === KIOSKO PÚBLICO (cliente) ===
app.post('/api/kiosk/register-start', async (req, res) => {
  try {
    const cedula = String(req.body.cedula || '').trim();
    const sede = String(req.body.sede || KIOSK_DEFAULT_SEDE).trim();

    if (!cedula) {
      return res.status(400).json({ error: 'La cédula no puede estar vacía' });
    }
    if (!isValidSede(sede)) {
      return res.status(400).json({ error: 'Sede inválida' });
    }

    const existing = await Representante.findOne({ where: { cedula } });
    if (existing) {
      return res.status(200).json({
        message: 'Cliente encontrado. Continúa para completar/actualizar datos.',
        data: {
          cedula: existing.cedula,
          nombre: existing.nombre,
          apellido: existing.apellido,
          fecha_nacimiento: existing.fecha_nacimiento,
          email: existing.email,
          celular: existing.celular,
          sede: existing.sede,
        },
      });
    }

    const representante = await Representante.create({ cedula, sede });
    return res.status(201).json({
      message: 'Inicio de registro creado',
      data: {
        cedula: representante.cedula,
        sede: representante.sede,
      },
    });
  } catch (error) {
    console.error('Error en kiosk/register-start:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.post('/api/kiosk/register-complete', async (req, res) => {
  try {
    const {
      cedula,
      nombre,
      apellido,
      fecha_nacimiento,
      email,
      celular,
      representados,
      sede,
    } = req.body;

    const trimmedCedula = String(cedula || '').trim();
    const trimmedNombre = String(nombre || '').trim();
    const trimmedApellido = String(apellido || '').trim();
    const assignedSede = String(sede || KIOSK_DEFAULT_SEDE).trim();

    if (!trimmedCedula || !trimmedNombre || !trimmedApellido || !fecha_nacimiento) {
      return res.status(400).json({
        error: 'Faltan campos obligatorios: cedula, nombre, apellido, fecha_nacimiento',
      });
    }
    if (!isValidSede(assignedSede)) {
      return res.status(400).json({ error: 'Sede inválida' });
    }

    // Validaciones de coherencia
    const NAME_RE = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]+$/;
    if (!NAME_RE.test(trimmedNombre) || trimmedNombre.length < 2) {
      return res.status(400).json({ error: 'El nombre solo debe contener letras (mín. 2 caracteres).' });
    }
    if (!NAME_RE.test(trimmedApellido) || trimmedApellido.length < 2) {
      return res.status(400).json({ error: 'El apellido solo debe contener letras (mín. 2 caracteres).' });
    }

    // Validar fecha de nacimiento
    const birthDate = new Date(fecha_nacimiento);
    if (Number.isNaN(birthDate.getTime())) {
      return res.status(400).json({ error: 'Fecha de nacimiento inválida.' });
    }
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const birthDay = new Date(birthDate.getFullYear(), birthDate.getMonth(), birthDate.getDate());
    if (birthDay >= today) {
      return res.status(400).json({ error: 'La fecha de nacimiento no puede ser hoy ni futura.' });
    }
    const age = now.getFullYear() - birthDate.getFullYear();
    if (age < 1 || age > 120) {
      return res.status(400).json({ error: 'Edad no válida. Debes tener entre 1 y 120 años.' });
    }

    // Validar representados
    const reps = normalizeRepresentados(representados);
    for (const rep of reps) {
      if (!NAME_RE.test(rep.nombre) || rep.nombre.length < 2) {
        return res.status(400).json({ error: `Nombre del acompañante "${rep.nombre}" no es válido.` });
      }
      const repBirth = new Date(rep.fecha_nacimiento);
      if (Number.isNaN(repBirth.getTime()) || repBirth >= today) {
        return res.status(400).json({ error: `Fecha de nacimiento del acompañante "${rep.nombre}" no es válida.` });
      }
    }

    let representante = await Representante.findOne({ where: { cedula: trimmedCedula } });

    // Sanitizar email y celular
    const sanitizedEmail = email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())
      ? String(email).trim()
      : null;
    const sanitizedCelular = celular && /^\d{7,15}$/.test(String(celular).trim())
      ? String(celular).trim()
      : null;

    if (representante) {
      representante.nombre = trimmedNombre;
      representante.apellido = trimmedApellido;
      representante.fecha_nacimiento = fecha_nacimiento;
      representante.email = sanitizedEmail;
      representante.celular = sanitizedCelular;
      representante.sede = representante.sede || assignedSede;
      await representante.save();
    } else {
      representante = await Representante.create({
        cedula: trimmedCedula,
        nombre: trimmedNombre,
        apellido: trimmedApellido,
        fecha_nacimiento,
        email: sanitizedEmail,
        celular: sanitizedCelular,
        sede: assignedSede,
      });
    }

    await Representado.destroy({ where: { representante_id: representante.id } });
    if (reps.length > 0) {
      await Representado.bulkCreate(
        reps.map((r) => ({
          representante_id: representante.id,
          nombre: r.nombre,
          fecha_nacimiento: r.fecha_nacimiento,
        }))
      );
    }

    await BillingNotification.create({
      event_type: 'kiosk.registration.completed',
      cedula: trimmedCedula,
      sede: representante.sede,
      status: 'ready_for_pos',
      amount: null,
      currency: 'USD',
      provider: 'kiosk',
      reference: `SYNC-${trimmedCedula}-${Date.now()}`,
      payload: {
        representados_count: reps.length,
        sede: representante.sede,
      },
    });

    const resultado = await Representante.findByPk(representante.id, {
      include: [{ model: Representado, as: 'representados' }],
    });

    return res.status(201).json({
      message: 'Registro completado exitosamente',
      sync_status: 'queued_for_billing',
      data: resultado,
    });
  } catch (error) {
    console.error('Error en kiosk/register-complete:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.post('/api/kiosk/upload-photo', (req, res) => {
  upload.single('foto')(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'La imagen excede el tamaño máximo de 5MB' });
      }
      return res.status(400).json({ error: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No se recibió ninguna imagen' });
    }

    const { cedula } = req.body;
    if (!cedula) {
      return res.status(400).json({ error: 'Cédula requerida' });
    }

    try {
      const fotoUrl = await savePhotoByCedula(cedula, req.file.filename);
      if (!fotoUrl) {
        return res.status(404).json({ error: 'Representante no encontrado' });
      }

      return res.status(200).json({
        message: 'Foto subida correctamente',
        foto_url: fotoUrl,
      });
    } catch (error) {
      console.error('Error en kiosk/upload-photo:', error);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  });
});

// === PASO 1: Registro solo con cédula (rápido, para validar unicidad) ===
app.post('/api/register', authRequired, async (req, res) => {
  try {
    const { cedula, sede } = req.body;

    if (!cedula || typeof cedula !== 'string' || cedula.trim() === '') {
      return res.status(400).json({ error: 'La cédula no puede estar vacía' });
    }

    const trimmedCedula = cedula.trim();
    const assignedSede = req.user.role === 'master' ? (sede || null) : req.user.sede;

    if (!assignedSede || !isValidSede(assignedSede)) {
      return res.status(400).json({ error: 'Sede inválida para este registro' });
    }

    const existing = await Representante.findOne({ where: { cedula: trimmedCedula } });
    if (existing) {
      return res.status(400).json({ error: 'Cédula ya registrada' });
    }

    const representante = await Representante.create({
      cedula: trimmedCedula,
      sede: assignedSede,
    });

    return res.status(201).json({
      id: representante.id,
      cedula: representante.cedula,
      sede: representante.sede,
      message: 'Registro exitoso',
    });
  } catch (error) {
    console.error('Error en registro:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// === PASO 2: Registro completo con todos los datos del representante y representados ===
app.post('/api/register-complete', authRequired, async (req, res) => {
  try {
    const {
      cedula,
      nombre,
      apellido,
      fecha_nacimiento,
      email,
      celular,
      representados,
      sede,
    } = req.body;

    // Validaciones básicas
    if (!cedula || !nombre || !apellido || !fecha_nacimiento) {
      return res.status(400).json({
        error: 'Faltan campos obligatorios: cedula, nombre, apellido, fecha_nacimiento',
      });
    }

    const trimmedCedula = cedula.trim();
    const assignedSede = req.user.role === 'master' ? (sede || null) : req.user.sede;

    if (!assignedSede || !isValidSede(assignedSede)) {
      return res.status(400).json({ error: 'Sede inválida para este registro' });
    }

    // Buscar o crear el representante
    let representante = await Representante.findOne({ where: { cedula: trimmedCedula } });

    if (
      representante
      && req.user.role !== 'master'
      && representante.sede
      && representante.sede !== req.user.sede
    ) {
      return res.status(403).json({ error: 'No puedes editar registros de otra sede' });
    }

    if (representante) {
      // Actualizar datos del representante existente
      representante.nombre = nombre.trim();
      representante.apellido = apellido.trim();
      representante.fecha_nacimiento = fecha_nacimiento;
      representante.email = email ? email.trim() : null;
      representante.celular = celular ? celular.trim() : null;
      representante.sede = assignedSede;
      await representante.save();
    } else {
      // Crear nuevo representante
      representante = await Representante.create({
        cedula: trimmedCedula,
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        fecha_nacimiento,
        email: email ? email.trim() : null,
        celular: celular ? celular.trim() : null,
        sede: assignedSede,
      });
    }

    // Eliminar representados anteriores y crear los nuevos
    if (representados && Array.isArray(representados) && representados.length > 0) {
      await Representado.destroy({ where: { representante_id: representante.id } });

      const nuevosRepresentados = representados.map((r) => ({
        representante_id: representante.id,
        nombre: r.nombre.trim(),
        fecha_nacimiento: r.fecha_nacimiento,
      }));

      await Representado.bulkCreate(nuevosRepresentados);
    }

    // Devolver el representante con sus representados
    const resultado = await Representante.findByPk(representante.id, {
      include: [{ model: Representado, as: 'representados' }],
    });

    return res.status(201).json({
      message: 'Registro completado exitosamente',
      data: resultado,
    });
  } catch (error) {
    console.error('Error en registro completo:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// === PASO 3: Subida de foto de perfil ===
app.post('/api/upload-photo', authRequired, (req, res) => {
  upload.single('foto')(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'La imagen excede el tamaño máximo de 5MB' });
        }
        return res.status(400).json({ error: err.message });
      }
      return res.status(400).json({ error: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No se recibió ninguna imagen' });
    }

    const { cedula } = req.body;
    if (!cedula) {
      // Si no hay cédula, borramos el archivo subido
      return res.status(400).json({ error: 'Cédula requerida' });
    }

    try {
      const where = { cedula: cedula.trim() };
      if (req.user.role !== 'master') {
        where.sede = req.user.sede;
      }

      const representante = await Representante.findOne({ where });
      if (!representante) {
        return res.status(404).json({ error: 'Representante no encontrado' });
      }

      // Construir URL de la foto
      const fotoUrl = `/uploads/${req.file.filename}`;
      representante.foto_url = fotoUrl;
      await representante.save();

      return res.status(200).json({
        message: 'Foto subida correctamente',
        foto_url: fotoUrl,
      });
    } catch (error) {
      console.error('Error al guardar foto:', error);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  });
});

// === PASO 4: Panel de administración ===
const getSedeScope = (req, querySede) => {
  if (req.user.role === 'master') {
    if (!querySede) return null;
    return querySede;
  }
  return req.user.sede;
};

const buildAdminWhere = (query) => {
  const q = (query.q || '').trim();
  const photo = (query.photo || 'all').trim(); // all | with | without
  const from = (query.from || '').trim(); // YYYY-MM-DD
  const to = (query.to || '').trim(); // YYYY-MM-DD

  const andConditions = [];

  if (q) {
    andConditions.push({
      [Op.or]: [
        { cedula: { [Op.like]: `%${q}%` } },
        { nombre: { [Op.like]: `%${q}%` } },
        { apellido: { [Op.like]: `%${q}%` } },
      ],
    });
  }

  if (photo === 'with') {
    andConditions.push({
      foto_url: { [Op.not]: null },
    });
    andConditions.push({
      foto_url: { [Op.ne]: '' },
    });
  }

  if (photo === 'without') {
    andConditions.push({
      [Op.or]: [
        { foto_url: null },
        { foto_url: '' },
      ],
    });
  }

  if (from || to) {
    const dateFilter = {};
    if (from) dateFilter[Op.gte] = new Date(`${from}T00:00:00.000Z`);
    if (to) dateFilter[Op.lte] = new Date(`${to}T23:59:59.999Z`);
    andConditions.push({ updatedAt: dateFilter });
  }

  return andConditions.length > 0 ? { [Op.and]: andConditions } : {};
};

const toAdminRow = (r) => ({
  id: r.id,
  cedula: r.cedula,
  sede: r.sede,
  nombre: r.nombre,
  apellido: r.apellido,
  fecha_nacimiento: r.fecha_nacimiento,
  email: r.email,
  celular: r.celular,
  foto_url: r.foto_url,
  representados_count: r.representados?.length || 0,
  created_at: r.createdAt,
  updated_at: r.updatedAt,
});

const getAdminOrder = (query) => {
  const sortBy = (query.sortBy || 'updated_at').trim();
  const sortDir = (query.sortDir || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  const fieldMap = {
    cedula: 'cedula',
    nombre: 'nombre',
    apellido: 'apellido',
    email: 'email',
    celular: 'celular',
    created_at: 'created_at',
    updated_at: 'updated_at',
  };

  const orderField = fieldMap[sortBy] || 'updated_at';
  return [[orderField, sortDir]];
};

const getPagination = (query) => {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || 10));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
};

app.get('/api/admin/records', authRequired, requireRole('admin', 'master'), async (req, res) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const where = buildAdminWhere(req.query);
    const order = getAdminOrder(req.query);
    const requestedSede = (req.query.sede || '').trim();
    const scopedSede = getSedeScope(req, requestedSede);
    if (scopedSede) where.sede = scopedSede;

    const { count, rows } = await Representante.findAndCountAll({
      where,
      include: [{ model: Representado, as: 'representados' }],
      order,
      limit,
      offset,
      distinct: true,
    });

    const totalPages = Math.max(1, Math.ceil(count / limit));
    const records = rows.map(toAdminRow);

    return res.status(200).json({
      total: count,
      page,
      limit,
      totalPages,
      hasPrev: page > 1,
      hasNext: page < totalPages,
      records,
    });
  } catch (error) {
    console.error('Error al listar registros admin:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.patch('/api/admin/records/:id', authRequired, requireRole('admin', 'master'), async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'Id inválido' });
    }

    const record = await Representante.findByPk(id);
    if (!record) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }

    if (req.user.role !== 'master' && record.sede !== req.user.sede) {
      return res.status(403).json({ error: 'No puedes editar registros de otra sede' });
    }

    const editable = ['nombre', 'apellido', 'email', 'celular', 'fecha_nacimiento', 'sede'];
    for (const field of editable) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        if (field === 'sede' && !isValidSede(req.body[field])) {
          return res.status(400).json({ error: 'Sede inválida' });
        }
        record[field] = req.body[field] || null;
      }
    }

    if (req.user.role !== 'master') {
      record.sede = req.user.sede;
    }

    await record.save();
    return res.status(200).json({ message: 'Registro actualizado', data: record });
  } catch (error) {
    console.error('Error actualizando registro admin:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ─── ELIMINAR registro (solo master, requiere contraseña y motivo) ───
app.delete('/api/admin/records/:id', authRequired, requireRole('master'), async (req, res) => {
  try {
    const { id } = req.params;
    const { password, motivo } = req.body;

    if (!password || !motivo || motivo.trim().length < 5) {
      return res.status(400).json({ error: 'Se requiere contraseña del master y un motivo (mín. 5 caracteres).' });
    }

    // Verificar contraseña del master autenticado
    const masterUser = await User.findByPk(req.user.id);
    if (!masterUser) {
      return res.status(401).json({ error: 'Usuario no encontrado.' });
    }

    const validPassword = await bcrypt.compare(password, masterUser.password_hash);
    if (!validPassword) {
      return res.status(403).json({ error: 'Contraseña incorrecta.' });
    }

    const record = await Representante.findByPk(id);
    if (!record) {
      return res.status(404).json({ error: 'Registro no encontrado.' });
    }

    // Registrar en billing notifications como evento de eliminación
    await BillingNotification.create({
      event_type: 'kiosk.registration.deleted',
      cedula: record.cedula,
      sede: record.sede,
      status: 'deleted',
      amount: null,
      currency: 'USD',
      provider: 'admin',
      reference: `DEL-${record.cedula}-${Date.now()}`,
      payload: {
        deleted_by: req.user.username,
        motivo: motivo.trim(),
        record_id: record.id,
        record_nombre: `${record.nombre} ${record.apellido}`,
      },
    });

    // Eliminar representados (CASCADE) y representante
    await Representado.destroy({ where: { representante_id: record.id } });
    await record.destroy();

    return res.status(200).json({ message: 'Registro eliminado correctamente.' });
  } catch (error) {
    console.error('Error eliminando registro admin:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.get('/api/admin/export', authRequired, requireRole('admin', 'master'), async (req, res) => {
  try {
    const where = buildAdminWhere(req.query);
    const order = getAdminOrder(req.query);
    const requestedSede = (req.query.sede || '').trim();
    const scopedSede = getSedeScope(req, requestedSede);
    if (scopedSede) where.sede = scopedSede;
    const scope = (req.query.scope || 'all').trim(); // all | page
    const { limit, offset } = getPagination(req.query);

    const exportQuery = {
      where,
      include: [{ model: Representado, as: 'representados' }],
      order,
    };

    if (scope === 'page') {
      exportQuery.limit = limit;
      exportQuery.offset = offset;
    }

    const representantes = await Representante.findAll(exportQuery);

    const headers = [
      'id',
      'cedula',
      'nombre',
      'apellido',
      'fecha_nacimiento',
      'email',
      'celular',
      'foto_url',
      'cantidad_representados',
      'creado_en',
      'actualizado_en',
    ];

    const toCsv = (value) => {
      if (value === null || value === undefined) return '';
      const text = String(value);
      if (text.includes(',') || text.includes('"') || text.includes('\n')) {
        return `"${text.replace(/"/g, '""')}"`;
      }
      return text;
    };

    const rows = representantes.map((r) => {
      const row = toAdminRow(r);
      return [
        row.id,
        row.cedula,
        row.nombre,
        row.apellido,
        row.fecha_nacimiento,
        row.email,
        row.celular,
        row.foto_url,
        row.representados_count,
        row.created_at,
        row.updated_at,
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map(toCsv).join(',')),
    ].join('\n');

    const hasFilters = Boolean(req.query.q || req.query.photo || req.query.from || req.query.to);
    const suffix = scope === 'page' ? 'pagina' : 'todos';
    const fileName = hasFilters
      ? `registros_filtrados_${suffix}_${Date.now()}.csv`
      : `registros_${suffix}_${Date.now()}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);

    return res.status(200).send(`\uFEFF${csvContent}`);
  } catch (error) {
    console.error('Error al exportar registros admin:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.get('/api/admin/export.xlsx', authRequired, requireRole('admin', 'master'), async (req, res) => {
  try {
    const where = buildAdminWhere(req.query);
    const order = getAdminOrder(req.query);
    const requestedSede = (req.query.sede || '').trim();
    const scopedSede = getSedeScope(req, requestedSede);
    if (scopedSede) where.sede = scopedSede;
    const scope = (req.query.scope || 'all').trim(); // all | page
    const { limit, offset } = getPagination(req.query);

    const exportQuery = {
      where,
      include: [{ model: Representado, as: 'representados' }],
      order,
    };

    if (scope === 'page') {
      exportQuery.limit = limit;
      exportQuery.offset = offset;
    }

    const representantes = await Representante.findAll(exportQuery);

    const data = representantes.map((r) => {
      const row = toAdminRow(r);
      return {
        id: row.id,
        cedula: row.cedula,
        nombre: row.nombre,
        apellido: row.apellido,
        fecha_nacimiento: row.fecha_nacimiento,
        email: row.email,
        celular: row.celular,
        foto_url: row.foto_url,
        cantidad_representados: row.representados_count,
        creado_en: row.created_at,
        actualizado_en: row.updated_at,
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Registros');
    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

    const hasFilters = Boolean(req.query.q || req.query.photo || req.query.from || req.query.to);
    const suffix = scope === 'page' ? 'pagina' : 'todos';
    const fileName = hasFilters
      ? `registros_filtrados_${suffix}_${Date.now()}.xlsx`
      : `registros_${suffix}_${Date.now()}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
    return res.status(200).send(buffer);
  } catch (error) {
    console.error('Error al exportar XLSX admin:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// === PASO 5: Integración de facturación + webhooks ===
app.get('/api/billing/lookup/:cedula', authRequired, async (req, res) => {
  try {
    const cedula = (req.params.cedula || '').trim();
    if (!cedula) {
      return res.status(400).json({ error: 'La cédula es requerida' });
    }

    const whereRep = { cedula };
    if (req.user.role !== 'master') {
      whereRep.sede = req.user.sede;
    }

    const representante = await Representante.findOne({
      where: whereRep,
      include: [{ model: Representado, as: 'representados' }],
    });

    if (!representante) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    const acompanantes = representante.representados?.length || 0;
    const baseAmount = 25;
    const amount = baseAmount + acompanantes * 7.5;

    const lastNotifications = await BillingNotification.findAll({
      where: {
        cedula,
        ...(req.user.role !== 'master' ? { sede: req.user.sede } : {}),
      },
      order: [['created_at', 'DESC']],
      limit: 5,
    });

    return res.status(200).json({
      message: 'Cliente encontrado para facturación',
      data: {
        cedula: representante.cedula,
        nombre: representante.nombre,
        apellido: representante.apellido,
        email: representante.email,
        celular: representante.celular,
        sede: representante.sede,
        representados_count: acompanantes,
        amount_suggested: Number(amount.toFixed(2)),
        currency: 'USD',
        can_bill: Boolean(representante.nombre && representante.apellido),
        billing_reference: `BILL-${representante.cedula}-${Date.now()}`,
        last_notifications: lastNotifications,
      },
    });
  } catch (error) {
    console.error('Error en billing lookup:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.post('/api/billing/webhook', authRequired, async (req, res) => {
  try {
    const {
      event_type,
      cedula,
      status,
      amount,
      currency,
      provider,
      reference,
      payload,
    } = req.body;

    if (!event_type || !cedula) {
      return res.status(400).json({ error: 'event_type y cedula son obligatorios' });
    }

    let resolvedSede = req.user.role === 'master' ? null : req.user.sede;
    const rep = await Representante.findOne({ where: { cedula: String(cedula).trim() } });
    if (rep && req.user.role !== 'master' && rep.sede !== req.user.sede) {
      return res.status(403).json({ error: 'No autorizado para registrar webhook de otra sede' });
    }
    if (rep?.sede) {
      resolvedSede = rep.sede;
    }

    const notification = await BillingNotification.create({
      event_type: String(event_type).trim(),
      cedula: String(cedula).trim(),
      sede: resolvedSede,
      status: status ? String(status).trim() : 'received',
      amount: Number.isFinite(Number(amount)) ? Number(amount) : null,
      currency: currency ? String(currency).trim() : 'USD',
      provider: provider ? String(provider).trim() : 'manual',
      reference: reference ? String(reference).trim() : null,
      payload: payload || req.body,
    });

    return res.status(201).json({
      message: 'Webhook recibido y almacenado',
      data: notification,
    });
  } catch (error) {
    console.error('Error en webhook billing:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.get('/api/billing/notifications', authRequired, requireRole('admin', 'master'), async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 10));
    const offset = (page - 1) * limit;

    const cedula = (req.query.cedula || '').trim();
    const status = (req.query.status || '').trim();
    const sede = (req.query.sede || '').trim();
    const where = {};
    if (cedula) where.cedula = cedula;
    if (status) where.status = status;
    if (req.user.role !== 'master') {
      where.sede = req.user.sede;
    } else if (sede) {
      where.sede = sede;
    }

    const { count, rows } = await BillingNotification.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit,
      offset,
    });

    return res.status(200).json({
      total: count,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(count / limit)),
      notifications: rows,
    });
  } catch (error) {
    console.error('Error listando notificaciones billing:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.get('/api/pos/autocomplete/:cedula', authRequired, requireRole('cajero', 'admin', 'master'), async (req, res) => {
  try {
    const cedula = String(req.params.cedula || '').trim();
    if (!cedula) {
      return res.status(400).json({ error: 'Cédula requerida' });
    }

    const where = { cedula };
    if (req.user.role !== 'master') {
      where.sede = req.user.sede;
    }

    const representante = await Representante.findOne({
      where,
      include: [{ model: Representado, as: 'representados' }],
    });

    if (!representante) {
      return res.status(404).json({ error: 'Cliente no encontrado para esta sede' });
    }

    return res.status(200).json({
      message: 'Datos de cliente listos para caja',
      data: {
        cedula: representante.cedula,
        nombre: representante.nombre,
        apellido: representante.apellido,
        email: representante.email,
        celular: representante.celular,
        sede: representante.sede,
        representados_count: representante.representados?.length || 0,
      },
    });
  } catch (error) {
    console.error('Error en pos autocomplete:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

const ensureDefaultUsers = async () => {
  if (process.env.SEED_DEFAULT_USERS !== 'true') return;

  const username = process.env.MASTER_USERNAME;
  const password = process.env.MASTER_PASSWORD;
  if (!username || !password) {
    throw new Error('SEED_DEFAULT_USERS=true requiere MASTER_USERNAME y MASTER_PASSWORD');
  }
  if (password.length < 12) {
    throw new Error('MASTER_PASSWORD debe tener al menos 12 caracteres');
  }

  const existing = await User.findOne({ where: { username } });
  if (existing) return;

  const password_hash = await bcrypt.hash(password, 12);
  await User.create({
    username,
    password_hash,
    role: 'master',
    sede: null,
    nombre: process.env.MASTER_NOMBRE || 'Master',
    activo: true,
  });
  console.log('Usuario master inicial creado: ' + username);
};

// Iniciar servidor
async function startServer() {
  try {
    await sequelize.sync({ alter: true });
    await ensureDefaultUsers();
    console.log('Base de datos sincronizada correctamente.');

    app.listen(PORT, () => {
      console.log(`Servidor corriendo en http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Error al iniciar el servidor:', error);
    process.exit(1);
  }
}

startServer();