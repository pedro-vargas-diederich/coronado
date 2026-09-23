const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Pedido = sequelize.define('Pedido', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  tipo_documento: {
    type: DataTypes.ENUM('COTIZACION', 'VENTA'),
    allowNull: false,
    defaultValue: 'COTIZACION'
  },
  codigo_orden: {
    type: DataTypes.STRING(30),
    allowNull: false,
    unique: true
  },
  cliente_id: {
    type: DataTypes.UUID,
    allowNull: false
  },
  vendedor_id: {
    type: DataTypes.UUID,
    allowNull: false
  },
  vehiculo_id: {
    type: DataTypes.UUID,
    allowNull: true
  },
  subtotal: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0.00
  },
  impuesto: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0.00
  },
  total: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0.00
  },
  metodo_pago: {
    type: DataTypes.ENUM('EFECTIVO', 'TRANSFERENCIA', 'CREDITO'),
    allowNull: false,
    defaultValue: 'EFECTIVO'
  },
  estado: {
    type: DataTypes.ENUM('BORRADOR', 'PENDIENTE', 'PAGADO', 'CANCELADO'),
    allowNull: false,
    defaultValue: 'BORRADOR'
  },
  fecha_vencimiento: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  observaciones: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  creado_en: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'pedidos',
  timestamps: false
});

module.exports = Pedido;
