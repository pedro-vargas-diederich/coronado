const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const DetallePedido = sequelize.define('DetallePedido', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  pedido_id: {
    type: DataTypes.UUID,
    allowNull: false
  },
  producto_id: {
    type: DataTypes.UUID,
    allowNull: false
  },
  cantidad: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false
  },
  precio_unitario: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false
  },
  costo_unitario: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0.00
  },
  precio_total: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false
  }
}, {
  tableName: 'detalles_pedido',
  timestamps: false
});

module.exports = DetallePedido;
