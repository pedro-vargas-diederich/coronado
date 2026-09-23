const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

const gastosController = {
  // Listar gastos operativos
  listar: async (req, res) => {
    try {
      const filtroCategoria = req.query.categoria || 'TODAS';

      let query = `
        SELECT g.*, 
               u.nombre AS registrado_por_nombre,
               v.placa AS vehiculo_placa, v.modelo AS vehiculo_modelo,
               c.razon_social AS proveedor_nombre
        FROM gastos g
        INNER JOIN usuarios u ON g.registrado_por = u.id
        LEFT JOIN vehiculos v ON g.vehiculo_id = v.id
        LEFT JOIN contactos c ON g.proveedor_id = c.id
        WHERE 1=1
      `;
      const params = [];

      if (filtroCategoria && filtroCategoria !== 'TODAS') {
        query += ' AND g.categoria = ?';
        params.push(filtroCategoria);
      }

      query += ' ORDER BY g.fecha_gasto DESC, g.creado_en DESC';

      const [gastos] = await db.query(query, params);

      // Calcular total acumulado de gastos en el listado
      const totalGastos = gastos.reduce((acc, curr) => acc + parseFloat(curr.monto), 0);

      res.render('gastos/index', {
        title: 'Centro de Gastos Operativos',
        gastos,
        filtroCategoria,
        totalGastos
      });
    } catch (error) {
      console.error('[Error al listar gastos]:', error);
      req.flash('error', 'Error al consultar los gastos.');
      res.redirect('/dashboard');
    }
  },

  // Mostrar formulario de nuevo gasto
  mostrarCrear: async (req, res) => {
    try {
      // Consultar vehículos activos
      const [vehiculos] = await db.query(
        'SELECT id, placa, modelo, conductor_asignado FROM vehiculos WHERE activo = 1 ORDER BY placa ASC'
      );

      // Consultar proveedores
      const [proveedores] = await db.query(
        "SELECT id, razon_social, identificacion_fiscal FROM contactos WHERE tipo IN ('PROVEEDOR', 'AMBOS') ORDER BY razon_social ASC"
      );

      res.render('gastos/nuevo', {
        title: 'Registrar Gasto Operativo',
        vehiculos,
        proveedores
      });
    } catch (error) {
      console.error('[Error al cargar formulario de gastos]:', error);
      req.flash('error', 'Error al preparar el formulario de gastos.');
      res.redirect('/gastos');
    }
  },

  // Registrar gasto con validación estricta de vehículos
  crear: async (req, res) => {
    try {
      const usuario = req.session.usuario;
      const { categoria, vehiculo_id, proveedor_id, monto, metodo_pago, numero_comprobante, descripcion, fecha_gasto } = req.body;

      if (!categoria || !monto || !descripcion || !fecha_gasto) {
        req.flash('error', 'Por favor diligencie todos los campos obligatorios.');
        return res.redirect('/gastos/nuevo');
      }

      // Regla de Negocio: Todo gasto de combustible o mantenimiento exige vehículo
      const categoriasVehiculo = ['COMBUSTIBLE', 'MANTENIMIENTO_VEHICULO'];
      if (categoriasVehiculo.includes(categoria) && (!vehiculo_id || vehiculo_id.trim() === '')) {
        req.flash('error', `Para la categoría "${categoria}" es OBLIGATORIO seleccionar un vehículo de la flota.`);
        return res.redirect('/gastos/nuevo');
      }

      const id = uuidv4();
      await db.query(
        `INSERT INTO gastos (id, categoria, vehiculo_id, proveedor_id, monto, metodo_pago, numero_comprobante, descripcion, registrado_por, fecha_gasto)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          categoria,
          vehiculo_id && vehiculo_id !== '' ? vehiculo_id : null,
          proveedor_id && proveedor_id !== '' ? proveedor_id : null,
          parseFloat(monto) || 0,
          metodo_pago || 'EFECTIVO',
          numero_comprobante ? numero_comprobante.trim() : null,
          descripcion.trim(),
          usuario.id,
          fecha_gasto
        ]
      );

      req.flash('success', 'Gasto operativo registrado exitosamente.');
      res.redirect('/gastos');

    } catch (error) {
      console.error('[Error al guardar gasto]:', error);
      req.flash('error', 'No se pudo guardar el registro de gasto.');
      res.redirect('/gastos/nuevo');
    }
  }
};

module.exports = gastosController;
