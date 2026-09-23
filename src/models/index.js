const sequelize = require('../config/database');
const Usuario = require('./Usuario');
const Contacto = require('./Contacto');
const Producto = require('./Producto');
const Vehiculo = require('./Vehiculo');
const Pedido = require('./Pedido');
const DetallePedido = require('./DetallePedido');
const Comision = require('./Comision');
const Gasto = require('./Gasto');
const UbicacionVehiculo = require('./UbicacionVehiculo');

// 1. Contacto <-> Pedido (Cliente)
Contacto.hasMany(Pedido, { foreignKey: 'cliente_id' });
Pedido.belongsTo(Contacto, { foreignKey: 'cliente_id', as: 'cliente' });

// 2. Usuario <-> Pedido (Vendedor)
Usuario.hasMany(Pedido, { foreignKey: 'vendedor_id' });
Pedido.belongsTo(Usuario, { foreignKey: 'vendedor_id', as: 'vendedor' });

// 3. Vehiculo <-> Pedido (Vehículo asignado a entrega)
Vehiculo.hasMany(Pedido, { foreignKey: 'vehiculo_id' });
Pedido.belongsTo(Vehiculo, { foreignKey: 'vehiculo_id', as: 'vehiculo' });

// 4. Pedido <-> DetallePedido
Pedido.hasMany(DetallePedido, { foreignKey: 'pedido_id', as: 'detalles' });
DetallePedido.belongsTo(Pedido, { foreignKey: 'pedido_id' });

// 5. Producto <-> DetallePedido
Producto.hasMany(DetallePedido, { foreignKey: 'producto_id' });
DetallePedido.belongsTo(Producto, { foreignKey: 'producto_id', as: 'producto' });

// 6. Pedido <-> Comision
Pedido.hasOne(Comision, { foreignKey: 'pedido_id' });
Comision.belongsTo(Pedido, { foreignKey: 'pedido_id' });

// 7. Usuario <-> Comision (Vendedor asignado a comisiones)
Usuario.hasMany(Comision, { foreignKey: 'vendedor_id' });
Comision.belongsTo(Usuario, { foreignKey: 'vendedor_id' });

// 8. Vehiculo <-> Gasto (Gastos asociados a vehículos)
Vehiculo.hasMany(Gasto, { foreignKey: 'vehiculo_id' });
Gasto.belongsTo(Vehiculo, { foreignKey: 'vehiculo_id' });

// 9. Vehiculo <-> UbicacionVehiculo (Última telemetría GPS)
Vehiculo.hasOne(UbicacionVehiculo, { foreignKey: 'vehiculo_id' });
UbicacionVehiculo.belongsTo(Vehiculo, { foreignKey: 'vehiculo_id' });

// Asociaciones complementarias útiles
Contacto.hasMany(Gasto, { foreignKey: 'proveedor_id', as: 'gastos' });
Gasto.belongsTo(Contacto, { foreignKey: 'proveedor_id', as: 'proveedor' });

Usuario.hasMany(Gasto, { foreignKey: 'registrado_por', as: 'gastosRegistrados' });
Gasto.belongsTo(Usuario, { foreignKey: 'registrado_por', as: 'usuario' });

module.exports = {
  sequelize,
  Usuario,
  Contacto,
  Producto,
  Vehiculo,
  Pedido,
  DetallePedido,
  Comision,
  Gasto,
  UbicacionVehiculo
};
