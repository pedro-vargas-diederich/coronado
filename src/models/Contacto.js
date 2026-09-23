const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Contacto = sequelize.define('Contacto', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  tipo: {
    type: DataTypes.ENUM('CLIENTE', 'PROVEEDOR', 'AMBOS'),
    allowNull: false,
    defaultValue: 'CLIENTE'
  },
  razon_social: {
    type: DataTypes.STRING(150),
    allowNull: false
  },
  identificacion_fiscal: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  telefono: {
    type: DataTypes.STRING(30),
    allowNull: true
  },
  correo: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  direccion: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  limite_credito: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0.00
  },
  creado_en: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'contactos',
  timestamps: false
});

module.exports = Contacto;
