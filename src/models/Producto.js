const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Producto = sequelize.define('Producto', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  codigo_sku: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true
  },
  nombre: {
    type: DataTypes.STRING(150),
    allowNull: false
  },
  categoria: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  unidad_medida: {
    type: DataTypes.ENUM('BOLSA', 'TONELADA', 'M3'),
    allowNull: false
  },
  precio_compra: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false
  },
  precio_venta: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false
  },
  existencia: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00
  },
  alerta_existencia_minima: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 10.00
  },
  creado_en: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'productos',
  timestamps: false
});

module.exports = Producto;
