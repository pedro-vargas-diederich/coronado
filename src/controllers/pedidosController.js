const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

const pedidosController = {
  // Listar cotizaciones y ventas
  listar: async (req, res) => {
    try {
      const usuario = req.session.usuario;
      const filtroTipo = req.query.tipo || 'TODOS';

      let query = `
        SELECT p.id, p.tipo_documento, p.codigo_orden, p.subtotal, p.impuesto, p.total,
               p.metodo_pago, p.estado, p.fecha_vencimiento, p.observaciones, p.creado_en,
               c.razon_social AS cliente_nombre, c.identificacion_fiscal AS cliente_nit,
               u.nombre AS vendedor_nombre,
               v.placa AS vehiculo_placa
        FROM pedidos p
        INNER JOIN contactos c ON p.cliente_id = c.id
        INNER JOIN usuarios u ON p.vendedor_id = u.id
        LEFT JOIN vehiculos v ON p.vehiculo_id = v.id
        WHERE 1=1
      `;
      const params = [];

      // Si es vendedor, solo ve sus propias cotizaciones y ventas
      if (usuario.rol === 'VENDEDOR') {
        query += ' AND p.vendedor_id = ?';
        params.push(usuario.id);
      }

      if (filtroTipo && filtroTipo !== 'TODOS') {
        query += ' AND p.tipo_documento = ?';
        params.push(filtroTipo);
      }

      query += ' ORDER BY p.creado_en DESC';

      const [pedidos] = await db.query(query, params);

      res.render('pedidos/index', {
        title: usuario.rol === 'VENDEDOR' ? 'Mis Cotizaciones' : 'Cotizaciones & Ventas',
        pedidos,
        filtroTipo,
        userRole: usuario.rol
      });
    } catch (error) {
      console.error('[Error al listar pedidos]:', error);
      req.flash('error', 'No se pudieron consultar los pedidos.');
      res.redirect('/dashboard');
    }
  },

  // Mostrar formulario de nueva cotización
  mostrarCrear: async (req, res) => {
    try {
      const usuario = req.session.usuario;

      // Consultar clientes
      const [clientes] = await db.query(
        "SELECT id, razon_social, identificacion_fiscal FROM contactos WHERE tipo IN ('CLIENTE', 'AMBOS') ORDER BY razon_social ASC"
      );

      // Consultar productos disponibles con stock
      const [productos] = await db.query(
        'SELECT id, codigo_sku, nombre, unidad_medida, precio_venta, existencia FROM productos WHERE existencia > 0 ORDER BY nombre ASC'
      );

      // Si es Admin o Socio, también puede asignar vendedor; si es vendedor, es él mismo
      const [vendedores] = await db.query(
        "SELECT id, nombre FROM usuarios WHERE rol = 'VENDEDOR' AND activo = 1 ORDER BY nombre ASC"
      );

      res.render('pedidos/nuevo', {
        title: 'Nueva Cotización',
        clientes,
        productos,
        vendedores,
        currentUser: usuario
      });
    } catch (error) {
      console.error('[Error al cargar formulario de cotización]:', error);
      req.flash('error', 'Error al preparar el formulario de cotización.');
      res.redirect('/pedidos');
    }
  },

  // Guardar nueva cotización
  crear: async (req, res) => {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const usuario = req.session.usuario;
      const { cliente_id, metodo_pago, fecha_vencimiento, observaciones, items } = req.body;

      if (!cliente_id) {
        throw new Error('Debe seleccionar un cliente.');
      }

      // Vendedor asignado
      let vendedorId = usuario.id;
      if (usuario.rol !== 'VENDEDOR' && req.body.vendedor_id) {
        vendedorId = req.body.vendedor_id;
      }

      // Parsear líneas de productos recibidas
      let lineas = [];
      if (typeof items === 'string') {
        lineas = JSON.parse(items);
      } else if (Array.isArray(items)) {
        lineas = items;
      }

      if (!lineas || lineas.length === 0) {
        throw new Error('Debe agregar al menos un material a la cotización.');
      }

      // Generar consecutivo único COT-YYYY-XXXX
      const anio = new Date().getFullYear();
      const [ultimas] = await connection.query(
        "SELECT codigo_orden FROM pedidos WHERE codigo_orden LIKE ? ORDER BY CAST(SUBSTRING_INDEX(codigo_orden, '-', -1) AS UNSIGNED) DESC LIMIT 1 FOR UPDATE",
        [`COT-${anio}-%`]
      );

      let consecutivo = 1;
      if (ultimas.length > 0) {
        const partes = ultimas[0].codigo_orden.split('-');
        const num = parseInt(partes[2], 10);
        if (!isNaN(num)) consecutivo = num + 1;
      }
      const codigoOrden = `COT-${anio}-${String(consecutivo).padStart(4, '0')}`;

      // Calcular totales
      let subtotal = 0;
      for (const item of lineas) {
        const cant = parseFloat(item.cantidad) || 0;
        const precio = parseFloat(item.precio_unitario) || 0;
        if (cant <= 0 || precio <= 0) {
          throw new Error('Las cantidades y precios deben ser mayores a cero.');
        }
        subtotal += cant * precio;
      }

      const impuesto = 0.00; // Si aplica IVA se puede calcular aquí
      const total = subtotal + impuesto;
      const pedidoId = uuidv4();

      // Insertar encabezado de pedido
      await connection.query(
        `INSERT INTO pedidos (id, tipo_documento, codigo_orden, cliente_id, vendedor_id, subtotal, impuesto, total, metodo_pago, estado, fecha_vencimiento, observaciones)
         VALUES (?, 'COTIZACION', ?, ?, ?, ?, ?, ?, ?, 'PENDIENTE', ?, ?)`,
        [
          pedidoId,
          codigoOrden,
          cliente_id,
          vendedorId,
          subtotal,
          impuesto,
          total,
          metodo_pago || 'EFECTIVO',
          fecha_vencimiento || null,
          observaciones || null
        ]
      );

      // Insertar detalles de la cotización
      for (const item of lineas) {
        const detalleId = uuidv4();
        const cant = parseFloat(item.cantidad);
        const precio = parseFloat(item.precio_unitario);
        const precioTotal = cant * precio;

        await connection.query(
          `INSERT INTO detalles_pedido (id, pedido_id, producto_id, cantidad, precio_unitario, costo_unitario, precio_total)
           VALUES (?, ?, ?, ?, ?, 0.00, ?)`,
          [
            detalleId,
            pedidoId,
            item.producto_id,
            cant,
            precio,
            precioTotal
          ]
        );
      }

      await connection.commit();
      req.flash('success', `Cotización ${codigoOrden} registrada con éxito.`);
      res.redirect(`/pedidos/ver/${pedidoId}`);

    } catch (error) {
      await connection.rollback();
      console.error('[Error al crear cotización]:', error.message);
      req.flash('error', error.message || 'Error al guardar la cotización.');
      res.redirect('/pedidos/nuevo');
    } finally {
      connection.release();
    }
  },

  // Ver detalle e impresión de cotización / venta
  ver: async (req, res) => {
    try {
      const { id } = req.params;
      const usuario = req.session.usuario;

      // Consultar pedido
      const [pedidos] = await db.query(
        `SELECT p.*,
                c.razon_social AS cliente_nombre, c.identificacion_fiscal AS cliente_nit,
                c.telefono AS cliente_telefono, c.correo AS cliente_correo, c.direccion AS cliente_direccion,
                u.nombre AS vendedor_nombre, u.porcentaje_comision AS vendedor_comision,
                v.placa AS vehiculo_placa, v.modelo AS vehiculo_modelo, v.conductor_asignado
         FROM pedidos p
         INNER JOIN contactos c ON p.cliente_id = c.id
         INNER JOIN usuarios u ON p.vendedor_id = u.id
         LEFT JOIN vehiculos v ON p.vehiculo_id = v.id
         WHERE p.id = ? LIMIT 1`,
        [id]
      );

      if (pedidos.length === 0) {
        req.flash('error', 'El documento solicitado no existe.');
        return res.redirect('/pedidos');
      }

      const pedido = pedidos[0];

      // Verificación de seguridad para rol VENDEDOR
      if (usuario.rol === 'VENDEDOR' && pedido.vendedor_id !== usuario.id) {
        req.flash('error', 'No tienes autorización para ver cotizaciones de otros vendedores.');
        return res.redirect('/pedidos');
      }

      // Consultar líneas de detalle
      const [detalles] = await db.query(
        `SELECT d.*, pr.nombre AS producto_nombre, pr.codigo_sku, pr.unidad_medida, pr.existencia AS stock_actual
         FROM detalles_pedido d
         INNER JOIN productos pr ON d.producto_id = pr.id
         WHERE d.pedido_id = ?`,
        [id]
      );

      // Consultar vehículos disponibles para cuando se convierta a venta
      const [vehiculos] = await db.query(
        'SELECT id, placa, modelo, conductor_asignado FROM vehiculos WHERE activo = 1 ORDER BY placa ASC'
      );

      // Consultar si ya tiene comisión
      const [comisiones] = await db.query(
        'SELECT * FROM comisiones WHERE pedido_id = ? LIMIT 1',
        [id]
      );

      res.render('pedidos/detalle', {
        title: `${pedido.tipo_documento} ${pedido.codigo_orden}`,
        pedido,
        detalles,
        vehiculos,
        comision: comisiones.length > 0 ? comisiones[0] : null,
        userRole: usuario.rol
      });

    } catch (error) {
      console.error('[Error al ver pedido]:', error);
      req.flash('error', 'Error al cargar el documento.');
      res.redirect('/pedidos');
    }
  },

  // Conversión Transaccional: Cotización -> Venta
  convertirAVenta: async (req, res) => {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const { id } = req.params;
      const { vehiculo_id, metodo_pago } = req.body;

      // 1. Obtener datos de la cotización y del vendedor
      const [pedidos] = await connection.query(
        `SELECT p.*, u.id AS vendedor_id, u.nombre AS vendedor_nombre, u.porcentaje_comision, u.activo AS vendedor_activo
         FROM pedidos p
         LEFT JOIN usuarios u ON p.vendedor_id = u.id
         WHERE p.id = ? FOR UPDATE`,
        [id]
      );

      if (pedidos.length === 0) {
        throw new Error('Error: La cotización solicitada no existe.');
      }

      const pedido = pedidos[0];

      if (pedido.tipo_documento === 'VENTA') {
        throw new Error(`Error: Este documento ya es una venta formal (${pedido.codigo_orden}) y no puede convertirse nuevamente.`);
      }

      if (pedido.estado === 'CANCELADO') {
        throw new Error('Error: No es posible convertir una cotización que se encuentra cancelada.');
      }

      if (!pedido.vendedor_id) {
        throw new Error('Error: Vendedor no válido o no asignado a esta cotización.');
      }

      // 2. Obtener los detalles de la cotización con información de inventario
      const [detalles] = await connection.query(
        `SELECT d.*, pr.nombre AS producto_nombre, pr.existencia, pr.precio_compra 
         FROM detalles_pedido d
         LEFT JOIN productos pr ON d.producto_id = pr.id
         WHERE d.pedido_id = ? FOR UPDATE`,
        [id]
      );

      if (detalles.length === 0) {
        throw new Error('Error: La cotización no contiene productos asociados para procesar la venta.');
      }

      // 3. Validar exhaustivamente stock suficiente de cada ítem ANTES de modificar inventario
      for (const item of detalles) {
        if (!item.producto_nombre) {
          throw new Error(`Error: El producto con ID ${item.producto_id} ya no existe en el catálogo.`);
        }

        const cantidadRequerida = parseFloat(item.cantidad) || 0;
        const stockDisponible = parseFloat(item.existencia) || 0;

        if (cantidadRequerida <= 0) {
          throw new Error(`Error: La cantidad para "${item.producto_nombre}" debe ser mayor a cero.`);
        }

        if (stockDisponible < cantidadRequerida) {
          throw new Error(
            `Error: Uno de los productos no tiene stock suficiente en almacén. "${item.producto_nombre}" requiere ${cantidadRequerida.toFixed(2)}, pero solo hay ${stockDisponible.toFixed(2)} disponibles.`
          );
        }
      }

      // 4. Descontar inventario y congelar el costo histórico de compra en detalles_pedido
      for (const item of detalles) {
        const cantidadRequerida = parseFloat(item.cantidad) || 0;
        const costoCompra = parseFloat(item.precio_compra) || 0;

        await connection.query(
          'UPDATE productos SET existencia = existencia - ? WHERE id = ?',
          [cantidadRequerida, item.producto_id]
        );

        await connection.query(
          'UPDATE detalles_pedido SET costo_unitario = ? WHERE id = ?',
          [costoCompra, item.id]
        );
      }

      // 5. Generar código consecutivo de Venta: VTA-YYYY-XXXX ordenado numéricamente
      const anio = new Date().getFullYear();
      const [ultimasVentas] = await connection.query(
        "SELECT codigo_orden FROM pedidos WHERE codigo_orden LIKE ? ORDER BY CAST(SUBSTRING_INDEX(codigo_orden, '-', -1) AS UNSIGNED) DESC LIMIT 1 FOR UPDATE",
        [`VTA-${anio}-%`]
      );

      let consecutivo = 1;
      if (ultimasVentas.length > 0) {
        const partes = ultimasVentas[0].codigo_orden.split('-');
        const num = parseInt(partes[2], 10);
        if (!isNaN(num)) consecutivo = num + 1;
      }
      const nuevoCodigoVenta = `VTA-${anio}-${String(consecutivo).padStart(4, '0')}`;

      // 6. Verificación estricta de tipos de pago:
      // EFECTIVO o TRANSFERENCIA fuerzan siempre estado = 'PAGADO'. Solo CREDITO queda 'PENDIENTE'.
      const metodoRecibido = (metodo_pago || pedido.metodo_pago || 'EFECTIVO').toString().trim().toUpperCase();
      const metodoFinal = ['EFECTIVO', 'TRANSFERENCIA', 'CREDITO'].includes(metodoRecibido) ? metodoRecibido : 'EFECTIVO';

      let nuevoEstado = 'PAGADO';
      if (metodoFinal === 'CREDITO') {
        nuevoEstado = 'PENDIENTE';
      } else {
        nuevoEstado = 'PAGADO'; // EFECTIVO o TRANSFERENCIA fuerzan inequívocamente PAGADO
      }

      let vehiculoIdFinal = vehiculo_id !== undefined && vehiculo_id !== '' ? vehiculo_id : pedido.vehiculo_id;
      if (vehiculoIdFinal) {
        const [vExiste] = await connection.query('SELECT id FROM vehiculos WHERE id = ?', [vehiculoIdFinal]);
        if (vExiste.length === 0) vehiculoIdFinal = null;
      }

      await connection.query(
        `UPDATE pedidos 
         SET tipo_documento = 'VENTA',
             codigo_orden = ?,
             vehiculo_id = ?,
             metodo_pago = ?,
             estado = ?
         WHERE id = ?`,
        [
          nuevoCodigoVenta,
          vehiculoIdFinal,
          metodoFinal,
          nuevoEstado,
          id
        ]
      );

      // 7. Generar registro de comisión al vendedor en estado PENDIENTE si aplica
      const [comisionExistente] = await connection.query(
        'SELECT id FROM comisiones WHERE pedido_id = ? LIMIT 1',
        [id]
      );

      const pctComision = parseFloat(pedido.porcentaje_comision) || 0;
      if (comisionExistente.length === 0 && pctComision > 0) {
        const montoComision = (parseFloat(pedido.total) * pctComision) / 100;
        const comisionId = uuidv4();

        await connection.query(
          `INSERT INTO comisiones (id, vendedor_id, pedido_id, monto, estado)
           VALUES (?, ?, ?, ?, 'PENDIENTE')`,
          [comisionId, pedido.vendedor_id, id, montoComision]
        );
      }

      await connection.commit();
      const estadoMsg = nuevoEstado === 'PAGADO' ? 'Cobrada / Pagada' : 'Pendiente de Cobro (Crédito)';
      req.flash('success', `¡Conversión exitosa! La cotización ahora es la Venta ${nuevoCodigoVenta} (${estadoMsg}) y el inventario fue actualizado.`);
      return res.redirect(`/pedidos/ver/${id}`);

    } catch (error) {
      if (connection) {
        try {
          await connection.rollback();
        } catch (rbErr) {
          console.error('[Error durante rollback de conversión]:', rbErr);
        }
      }
      console.error('[Error en conversión a venta]:', error.message || error);
      const mensaje = error.message || 'Error inesperado al procesar la conversión a venta.';
      req.flash('error', mensaje.startsWith('Error:') ? mensaje : `Error: ${mensaje}`);
      return res.redirect(`/pedidos/ver/${req.params.id}`);
    } finally {
      if (connection) connection.release();
    }
  },

  // Acción Manual de Regularización / Cobro de Venta: Marcar como PAGADO
  marcarComoCobrado: async (req, res) => {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const { id } = req.params;
      const usuario = req.session.usuario;
      const { metodo_pago } = req.body;

      // 1. Consultar pedido con bloqueo
      const [pedidos] = await connection.query(
        `SELECT p.*, u.porcentaje_comision, u.nombre AS vendedor_nombre 
         FROM pedidos p
         INNER JOIN usuarios u ON p.vendedor_id = u.id
         WHERE p.id = ? FOR UPDATE`,
        [id]
      );

      if (pedidos.length === 0) {
        throw new Error('Error: La orden de venta no fue encontrada.');
      }

      const pedido = pedidos[0];

      // Verificación de seguridad por rol: VENDEDOR solo puede operar sobre su propia venta
      if (usuario.rol === 'VENDEDOR' && pedido.vendedor_id !== usuario.id) {
        throw new Error('Error: No tienes autorización para regularizar cobros de otros vendedores.');
      }

      if (pedido.tipo_documento !== 'VENTA') {
        throw new Error('Error: Solo se pueden cobrar documentos de tipo VENTA. Las cotizaciones deben convertirse primero.');
      }

      if (pedido.estado === 'PAGADO') {
        throw new Error('Aviso: Esta venta ya figura como PAGADA en el sistema.');
      }

      if (pedido.estado === 'CANCELADO') {
        throw new Error('Error: No es posible registrar cobros sobre una orden CANCELADA.');
      }

      // 2. Determinar método de cobro: si se envió 'EFECTIVO' o 'TRANSFERENCIA', actualizarlo
      let metodoFinal = pedido.metodo_pago;
      if (metodo_pago && ['EFECTIVO', 'TRANSFERENCIA', 'CREDITO'].includes(metodo_pago.toString().trim().toUpperCase())) {
        metodoFinal = metodo_pago.toString().trim().toUpperCase();
      }

      // 3. Actualizar estado del pedido a PAGADO
      await connection.query(
        `UPDATE pedidos 
         SET estado = 'PAGADO',
             metodo_pago = ?
         WHERE id = ?`,
        [metodoFinal, id]
      );

      // 4. Verificar y actualizar la comisión vinculada en comisiones
      const [comisiones] = await connection.query(
        'SELECT * FROM comisiones WHERE pedido_id = ? FOR UPDATE',
        [id]
      );

      const pctComision = parseFloat(pedido.porcentaje_comision) || 0;
      const montoEsperado = (parseFloat(pedido.total) * pctComision) / 100;

      if (comisiones.length > 0) {
        const comisionActual = comisiones[0];
        if (montoEsperado > 0 && Math.abs(parseFloat(comisionActual.monto) - montoEsperado) > 0.01) {
          await connection.query(
            'UPDATE comisiones SET monto = ? WHERE id = ?',
            [montoEsperado, comisionActual.id]
          );
        }
      } else if (pctComision > 0) {
        // Si no existía comisión creada, generarla ahora
        const comisionId = uuidv4();
        await connection.query(
          `INSERT INTO comisiones (id, vendedor_id, pedido_id, monto, estado)
           VALUES (?, ?, ?, ?, 'PENDIENTE')`,
          [comisionId, pedido.vendedor_id, id, montoEsperado]
        );
      }

      await connection.commit();
      req.flash('success', `¡Cobro registrado con éxito! La orden ${pedido.codigo_orden} ahora está marcada como PAGADA e impacta en los ingresos cobrados.`);
      return res.redirect(`/pedidos/ver/${id}`);

    } catch (error) {
      if (connection) {
        try {
          await connection.rollback();
        } catch (rbErr) {
          console.error('[Error durante rollback de cobro]:', rbErr);
        }
      }
      console.error('[Error al marcar venta como cobrada]:', error.message || error);
      const mensaje = error.message || 'Error al procesar el cobro de la venta.';
      req.flash('error', mensaje.startsWith('Error:') || mensaje.startsWith('Aviso:') ? mensaje : `Error: ${mensaje}`);
      return res.redirect(`/pedidos/ver/${req.params.id}`);
    } finally {
      if (connection) connection.release();
    }
  },

  // Alias para compatibilidad de nomenclatura
  marcarComoVendida: (req, res) => pedidosController.convertirAVenta(req, res),
  cobrar: (req, res) => pedidosController.marcarComoCobrado(req, res),

  // Vista de comisiones
  listarComisiones: async (req, res) => {
    try {
      const usuario = req.session.usuario;
      
      let query = `
        SELECT c.*, p.codigo_orden, p.total AS total_venta, p.creado_en AS fecha_venta,
               u.nombre AS vendedor_nombre
        FROM comisiones c
        INNER JOIN pedidos p ON c.pedido_id = p.id
        INNER JOIN usuarios u ON c.vendedor_id = u.id
        WHERE 1=1
      `;
      const params = [];

      if (usuario.rol === 'VENDEDOR') {
        query += ' AND c.vendedor_id = ?';
        params.push(usuario.id);
      }

      query += ' ORDER BY c.creado_en DESC';

      const [comisiones] = await db.query(query, params);

      // Totales
      const totalPendiente = comisiones
        .filter(c => c.estado === 'PENDIENTE')
        .reduce((sum, c) => sum + parseFloat(c.monto), 0);

      const totalPagado = comisiones
        .filter(c => c.estado === 'PAGADO')
        .reduce((sum, c) => sum + parseFloat(c.monto), 0);

      res.render('pedidos/comisiones', {
        title: usuario.rol === 'VENDEDOR' ? 'Mis Comisiones' : 'Control de Comisiones',
        comisiones,
        totalPendiente,
        totalPagado,
        userRole: usuario.rol
      });

    } catch (error) {
      console.error('[Error al listar comisiones]:', error);
      req.flash('error', 'Error al cargar el módulo de comisiones.');
      res.redirect('/pedidos');
    }
  },

  // Pagar comisión (Solo Socio o Admin)
  marcarComisionPagada: async (req, res) => {
    try {
      const { id } = req.params;
      await db.query(
        "UPDATE comisiones SET estado = 'PAGADO', fecha_pago = NOW() WHERE id = ?",
        [id]
      );
      req.flash('success', 'Comisión marcada como PAGADA.');
      res.redirect('/pedidos/comisiones');
    } catch (error) {
      console.error('[Error al pagar comisión]:', error);
      req.flash('error', 'No se pudo actualizar el estado de la comisión.');
      res.redirect('/pedidos/comisiones');
    }
  }
};

module.exports = pedidosController;
