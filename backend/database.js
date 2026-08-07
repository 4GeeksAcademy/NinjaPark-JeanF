const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

let sequelize;

if (process.env.DATABASE_URL) {
  // Producción: PostgreSQL (Render / Railway, etc.)
  sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    },
    logging: false,
  });
} else {
  // Desarrollo local: SQLite
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: path.join(__dirname, 'database.sqlite'),
    logging: false,
  });
}

// Modelo: Representante (cliente principal)
const Representante = sequelize.define('Representante', {
  cedula: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: { notEmpty: true },
  },
  nombre: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  apellido: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  fecha_nacimiento: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  celular: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  foto_url: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  sede: {
    type: DataTypes.STRING,
    allowNull: true,
  },
}, {
  timestamps: true,
  underscored: true,
});

// Modelo: Usuario del sistema (master/admin/cajero)
const User = sequelize.define('User', {
  username: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: { notEmpty: true },
  },
  password_hash: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: { notEmpty: true },
  },
  role: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'cajero',
  },
  sede: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  nombre: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  activo: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
}, {
  timestamps: true,
  underscored: true,
});

// Modelo: Representado (acompañante / menor de edad)
const Representado = sequelize.define('Representado', {
  nombre: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: { notEmpty: true },
  },
  fecha_nacimiento: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
}, {
  timestamps: true,
  underscored: true,
});

// Modelo: Notificaciones de Facturación (webhooks)
const BillingNotification = sequelize.define('BillingNotification', {
  event_type: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: { notEmpty: true },
  },
  cedula: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: { notEmpty: true },
  },
  sede: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'received',
  },
  amount: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },
  currency: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  provider: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  reference: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  payload: {
    type: DataTypes.JSON,
    allowNull: true,
  },
}, {
  timestamps: true,
  underscored: true,
});

// Relación 1:N: Un Representante tiene muchos Representados
Representante.hasMany(Representado, {
  foreignKey: 'representante_id',
  as: 'representados',
  onDelete: 'CASCADE',
});
Representado.belongsTo(Representante, {
  foreignKey: 'representante_id',
  as: 'representante',
});

module.exports = {
  sequelize,
  Representante,
  Representado,
  BillingNotification,
  User,
};