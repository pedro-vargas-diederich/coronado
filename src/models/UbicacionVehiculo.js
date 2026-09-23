const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const UbicacionVehiculo = sequelize.define('UbicacionVehiculo', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  vehiculo_id: {
    type: DataTypes.UUID,
    allowNull: false,
    unique: true
  },
  latitud: {
    type: DataTypes.DECIMAL(10, 8),
    allowNull: false
  },
  longitud: {
    type: DataTypes.DECIMAL(11, 8),
    allowNull: false
  },
  velocidad_kmh: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
    defaultValue: 0.00
  },
  actualizado_en: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'ubicaciones_vehiculo',
  timestamps: false
});

module.exports = UbicacionVehiculo;
