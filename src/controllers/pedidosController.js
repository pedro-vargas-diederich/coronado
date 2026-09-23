const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');
const {
  sequelize,
  Pedido,
  DetallePedido,
  Producto,
  Usuario,
  Contacto,
  Vehiculo,
  Comision
} = require('../models');

const pedidosController = {
  // Listar cotizaciones y ventas
  listar: async (req, res) => {
    try {
      const usuario = req.session.usuario;
      const filtroTipo = req.query.tipo || 'TODOS';

      const whereConditions = {};

      // Si es vendedor, solo ve sus propias cotizaciones y ventas
      if (usuario.rol === 'VENDEDOR') {
        whereConditions.vendedor_id = usuario.id;
      }

      if (filtroTipo && filtroTipo !== 'TODOS') {
        whereConditions.tipo_documento = filtroTipo;
      }

      const pedidosList = await Pedido.findAll({
        where: whereConditions,
        include: [
          { model: Contacto, as: 'cliente', attributes: ['razon_social', 'identificacion_fiscal'] },
          { model: Usuario, as: 'vendedor', attributes: ['nombre'] },
          { model: Vehiculo, as: 'vehiculo', attributes: ['placa'] }
        ],
        order: [['creado_en', 'DESC']]
      });

      // Mapear propiedades para mantener compatibilidad total con vistas EJS
      const pedidos = pedidosList.map(p => {
        const item = p.get({ plain: true });
        return {
          ...item,
          cliente_nombre: item.cliente ? item.cliente.razon_social : '',
          cliente_nit: item.cliente ? item.cliente.identificacion_fiscal : '',
          vendedor_nombre: item.vendedor ? item.vendedor.nombre : '',
          vehiculo_placa: item.vehiculo ? item.vehiculo.placa : null
        };
      });

      res.render('pedidos/index', {
        title: usuario.rol === 'VENDEDOR' ? 'Mis Cotizaciones' : 'Cotizaciones & Ventas',
        pedidos,
        filtroTipo,
        userRole: usuario.rol
      });
    } catch (error) {
      console.error('[Error al listar pedidos con Sequelize]:', error);
      req.flash('error', 'No se pudieron consultar los pedidos.');
      res.redirect('/dashboard');
    }
  },

  // Mostrar formulario de nueva cotización
  mostrarCrear: async (req, res) => {
    try {
      const usuario = req.session.usuario;

      // Clientes disponibles
      const clientes = await Contacto.findAll({
        where: { tipo: { [Op.in]: ['CLIENTE', 'AMBOS'] } },
        attributes: ['id', 'razon_social', 'identificacion_fiscal'],
        order: [['razon_social', 'ASC']]
      });

      // Productos con stock mayor a cero
      const productos = await Producto.findAll({
        where: { existencia: { [Op.gt]: 0 } },
        attributes: ['id', 'codigo_sku', 'nombre', 'unidad_medida', 'precio_venta', 'existencia'],
        order: [['nombre', 'ASC']]
      });

      // Vendedores activos
      const vendedores = await Usuario.findAll({
        where: { rol: 'VENDEDOR', activo: true },
        attributes: ['id', 'nombre'],
        order: [['nombre', 'ASC']]
      });

      res.render('pedidos/nuevo', {
        title: 'Nueva Cotización',
        clientes,
        productos,
        vendedores,
        currentUser: usuario
      });
    } catch (error) {
      console.error('[Error al preparar formulario de cotización]:', error);
      req.flash('error', 'Error al preparar el formulario de cotización.');
      res.redirect('/pedidos');
    }
  },

  // Guardar nueva cotización
  crear: async (req, res) => {
    const t = await sequelize.transaction();
    try {
      const usuario = req.session.usuario;
      const { cliente_id, metodo_pago, fecha_vencimiento, observaciones, items } = req.body;

      if (!cliente_id) {
        throw new Error('Debe seleccionar un cliente.');
      }

      let vendedorId = usuario.id;
      if (usuario.rol !== 'VENDEDOR' && req.body.vendedor_id) {
        vendedorId = req.body.vendedor_id;
      }

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
      const ultimas = await Pedido.findAll({
        where: {
          codigo_orden: { [Op.like]: `COT-${anio}-%` }
        },
        order: [
          [sequelize.literal(`CAST(SUBSTRING_INDEX(codigo_orden, '-', -1) AS UNSIGNED)`), 'DESC']
        ],
        limit: 1,
        transaction: t,
        lock: true
      });

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

      const impuesto = 0.00;
      const total = subtotal + impuesto;
      const pedidoId = uuidv4();

      // Insertar encabezado de cotización
      await Pedido.create({
        id: pedidoId,
        tipo_documento: 'COTIZACION',
        codigo_orden: codigoOrden,
        cliente_id,
        vendedor_id: vendedorId,
        subtotal,
        impuesto,
        total,
        metodo_pago: metodo_pago || 'EFECTIVO',
        estado: 'PENDIENTE',
        fecha_vencimiento: fecha_vencimiento || null,
        observaciones: observaciones || null
      }, { transaction: t });

      // Insertar detalles de la cotización
      const detallesAInsertar = lineas.map(item => {
        const cant = parseFloat(item.cantidad);
        const precio = parseFloat(item.precio_unitario);
        return {
          id: uuidv4(),
          pedido_id: pedidoId,
          producto_id: item.producto_id,
          cantidad: cant,
          precio_unitario: precio,
          costo_unitario: 0.00,
          precio_total: cant * precio
        };
      });

      await DetallePedido.bulkCreate(detallesAInsertar, { transaction: t });

      await t.commit();
      req.flash('success', `Cotización ${codigoOrden} registrada con éxito.`);
      res.redirect(`/pedidos/ver/${pedidoId}`);

    } catch (error) {
      if (t) {
        try { await t.rollback(); } catch (e) {}
      }
      console.error('[Error al crear cotización con Sequelize]:', error.message);
      req.flash('error', error.message || 'Error al guardar la cotización.');
      res.redirect('/pedidos/nuevo');
    }
  },

  // Ver detalle e impresión de cotización / venta
  ver: async (req, res) => {
    try {
      const { id } = req.params;
      const usuario = req.session.usuario;

      const pedidoInstancia = await Pedido.findByPk(id, {
        include: [
          { model: Contacto, as: 'cliente' },
          { model: Usuario, as: 'vendedor', attributes: ['id', 'nombre', 'porcentaje_comision'] },
          { model: Vehiculo, as: 'vehiculo', attributes: ['id', 'placa', 'modelo', 'conductor_asignado'] }
        ]
      });

      if (!pedidoInstancia) {
        req.flash('error', 'El documento solicitado no existe.');
        return res.redirect('/pedidos');
      }

      const pedidoRaw = pedidoInstancia.get({ plain: true });

      // Seguridad por rol: VENDEDOR solo puede ver sus cotizaciones/ventas
      if (usuario.rol === 'VENDEDOR' && pedidoRaw.vendedor_id !== usuario.id) {
        req.flash('error', 'No tienes autorización para ver cotizaciones de otros vendedores.');
        return res.redirect('/pedidos');
      }

      // Estructurar atributos esperados por la vista EJS
      const pedido = {
        ...pedidoRaw,
        cliente_nombre: pedidoRaw.cliente ? pedidoRaw.cliente.razon_social : '',
        cliente_nit: pedidoRaw.cliente ? pedidoRaw.cliente.identificacion_fiscal : '',
        cliente_telefono: pedidoRaw.cliente ? pedidoRaw.cliente.telefono : '',
        cliente_correo: pedidoRaw.cliente ? pedidoRaw.cliente.correo : '',
        cliente_direccion: pedidoRaw.cliente ? pedidoRaw.cliente.direccion : '',
        vendedor_nombre: pedidoRaw.vendedor ? pedidoRaw.vendedor.nombre : '',
        vendedor_comision: pedidoRaw.vendedor ? pedidoRaw.vendedor.porcentaje_comision : 0,
        vehiculo_placa: pedidoRaw.vehiculo ? pedidoRaw.vehiculo.placa : null,
        vehiculo_modelo: pedidoRaw.vehiculo ? pedidoRaw.vehiculo.modelo : null,
        conductor_asignado: pedidoRaw.vehiculo ? pedidoRaw.vehiculo.conductor_asignado : null
      };

      // Consultar líneas de detalle con su producto asociado
      const detallesList = await DetallePedido.findAll({
        where: { pedido_id: id },
        include: [
          { model: Producto, as: 'producto', attributes: ['nombre', 'codigo_sku', 'unidad_medida', 'existencia'] }
        ]
      });

      const detalles = detallesList.map(d => {
        const item = d.get({ plain: true });
        return {
          ...item,
          producto_nombre: item.producto ? item.producto.nombre : 'Producto no disponible',
          codigo_sku: item.producto ? item.producto.codigo_sku : '',
          unidad_medida: item.producto ? item.producto.unidad_medida : '',
          stock_actual: item.producto ? item.producto.existencia : 0
        };
      });

      // Consultar flota de vehículos activos
      const vehiculos = await Vehiculo.findAll({
        where: { activo: true },
        attributes: ['id', 'placa', 'modelo', 'conductor_asignado'],
        order: [['placa', 'ASC']]
      });

      // Consultar comisión asociada si ya existe
      const comisionInstancia = await Comision.findOne({
        where: { pedido_id: id }
      });
      const comision = comisionInstancia ? comisionInstancia.get({ plain: true }) : null;

      res.render('pedidos/detalle', {
        title: `${pedido.tipo_documento} ${pedido.codigo_orden}`,
        pedido,
        detalles,
        vehiculos,
        comision,
        userRole: usuario.rol
      });

    } catch (error) {
      console.error('[Error al ver pedido]:', error);
      req.flash('error', 'Error al cargar el documento.');
      res.redirect('/pedidos');
    }
  },

  // Conversión Transaccional: Cotización -> Venta con Sequelize Transaction
  convertirAVenta: async (req, res) => {
    const t = await sequelize.transaction();
    try {
      const { id } = req.params;
      const { vehiculo_id, metodo_pago } = req.body;

      // 1. Obtener datos de la cotización y del vendedor con bloqueo
      const pedido = await Pedido.findByPk(id, {
        include: [{ model: Usuario, as: 'vendedor' }],
        transaction: t,
        lock: true
      });

      if (!pedido) {
        throw new Error('Error: La cotización solicitada no existe.');
      }

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
      const detalles = await DetallePedido.findAll({
        where: { pedido_id: id },
        include: [{ model: Producto, as: 'producto' }],
        transaction: t,
        lock: true
      });

      if (!detalles || detalles.length === 0) {
        throw new Error('Error: La cotización no contiene productos asociados para procesar la venta.');
      }

      // 3. Validar exhaustivamente stock suficiente de cada ítem ANTES de modificar inventario
      for (const item of detalles) {
        if (!item.producto) {
          throw new Error(`Error: El producto con ID ${item.producto_id} ya no existe en el catálogo.`);
        }

        const cantidadRequerida = parseFloat(item.cantidad) || 0;
        const stockDisponible = parseFloat(item.producto.existencia) || 0;

        if (cantidadRequerida <= 0) {
          throw new Error(`Error: La cantidad para "${item.producto.nombre}" debe ser mayor a cero.`);
        }

        if (stockDisponible < cantidadRequerida) {
          throw new Error(
            `Error: Uno de los productos no tiene stock suficiente en almacén. "${item.producto.nombre}" requiere ${cantidadRequerida.toFixed(2)}, pero solo hay ${stockDisponible.toFixed(2)} disponibles.`
          );
        }
      }

      // 4. Reducir existencias en bucle o decremento y fijar costo_unitario en DetallePedido
      for (const item of detalles) {
        const cantidadRequerida = parseFloat(item.cantidad) || 0;
        const costoCompra = parseFloat(item.producto.precio_compra) || 0;

        // Reducción atómica de existencia
        await Producto.decrement('existencia', {
          by: cantidadRequerida,
          where: { id: item.producto_id },
          transaction: t
        });

        // Fijar costo histórico de compra en DetallePedido
        await DetallePedido.update(
          { costo_unitario: costoCompra },
          { where: { id: item.id }, transaction: t }
        );
      }

      // 5. Generar código consecutivo de Venta: VTA-YYYY-XXXX ordenado numéricamente
      const anio = new Date().getFullYear();
      const ultimasVentas = await Pedido.findAll({
        where: {
          codigo_orden: { [Op.like]: `VTA-${anio}-%` }
        },
        order: [
          [sequelize.literal(`CAST(SUBSTRING_INDEX(codigo_orden, '-', -1) AS UNSIGNED)`), 'DESC']
        ],
        limit: 1,
        transaction: t,
        lock: true
      });

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
      const nuevoEstado = metodoFinal === 'CREDITO' ? 'PENDIENTE' : 'PAGADO';

      let vehiculoIdFinal = vehiculo_id !== undefined && vehiculo_id !== '' ? vehiculo_id : pedido.vehiculo_id;
      if (vehiculoIdFinal) {
        const vExiste = await Vehiculo.findByPk(vehiculoIdFinal, { transaction: t });
        if (!vExiste) vehiculoIdFinal = null;
      }

      // Actualizar el pedido en la transacción
      await Pedido.update(
        {
          tipo_documento: 'VENTA',
          codigo_orden: nuevoCodigoVenta,
          vehiculo_id: vehiculoIdFinal,
          metodo_pago: metodoFinal,
          estado: nuevoEstado
        },
        { where: { id }, transaction: t }
      );

      // 7. Generar registro de comisión al vendedor en estado PENDIENTE si aplica
      const comisionExistente = await Comision.findOne({
        where: { pedido_id: id },
        transaction: t
      });

      const pctComision = parseFloat(pedido.vendedor ? pedido.vendedor.porcentaje_comision : 0) || 0;
      if (!comisionExistente && pctComision > 0) {
        const montoComision = (parseFloat(pedido.total) * pctComision) / 100;
        await Comision.create(
          {
            id: uuidv4(),
            vendedor_id: pedido.vendedor_id,
            pedido_id: id,
            monto: montoComision,
            estado: 'PENDIENTE'
          },
          { transaction: t }
        );
      }

      await t.commit();
      const estadoMsg = nuevoEstado === 'PAGADO' ? 'Cobrada / Pagada' : 'Pendiente de Cobro (Crédito)';
      req.flash('success', `¡Conversión exitosa! La cotización ahora es la Venta ${nuevoCodigoVenta} (${estadoMsg}) y el inventario fue actualizado.`);
      return res.redirect(`/pedidos/ver/${id}`);

    } catch (error) {
      if (t) {
        try {
          await t.rollback();
        } catch (rbErr) {
          console.error('[Error durante rollback de conversión]:', rbErr);
        }
      }
      console.error('[Error en conversión a venta]:', error.message || error);
      const mensaje = error.message || 'Error inesperado al procesar la conversión a venta.';
      req.flash('error', mensaje.startsWith('Error:') ? mensaje : `Error: ${mensaje}`);
      return res.redirect(`/pedidos/ver/${req.params.id}`);
    }
  },

  // Acción Manual de Regularización / Cobro de Venta: Marcar como PAGADO
  marcarComoCobrado: async (req, res) => {
    const t = await sequelize.transaction();
    try {
      const { id } = req.params;
      const usuario = req.session.usuario;
      const { metodo_pago } = req.body;

      // 1. Consultar pedido con bloqueo
      const pedido = await Pedido.findByPk(id, {
        include: [{ model: Usuario, as: 'vendedor' }],
        transaction: t,
        lock: true
      });

      if (!pedido) {
        throw new Error('Error: La orden de venta no fue encontrada.');
      }

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

      let metodoFinal = pedido.metodo_pago;
      if (metodo_pago && ['EFECTIVO', 'TRANSFERENCIA', 'CREDITO'].includes(metodo_pago.toString().trim().toUpperCase())) {
        metodoFinal = metodo_pago.toString().trim().toUpperCase();
      }

      // Actualizar estado del pedido a PAGADO
      await Pedido.update(
        { estado: 'PAGADO', metodo_pago: metodoFinal },
        { where: { id }, transaction: t }
      );

      // Verificar y actualizar la comisión vinculada
      const comisionActual = await Comision.findOne({
        where: { pedido_id: id },
        transaction: t,
        lock: true
      });

      const pctComision = parseFloat(pedido.vendedor ? pedido.vendedor.porcentaje_comision : 0) || 0;
      const montoEsperado = (parseFloat(pedido.total) * pctComision) / 100;

      if (comisionActual) {
        if (montoEsperado > 0 && Math.abs(parseFloat(comisionActual.monto) - montoEsperado) > 0.01) {
          await Comision.update(
            { monto: montoEsperado },
            { where: { id: comisionActual.id }, transaction: t }
          );
        }
      } else if (pctComision > 0) {
        await Comision.create(
          {
            id: uuidv4(),
            vendedor_id: pedido.vendedor_id,
            pedido_id: id,
            monto: montoEsperado,
            estado: 'PENDIENTE'
          },
          { transaction: t }
        );
      }

      await t.commit();
      req.flash('success', `¡Cobro registrado con éxito! La orden ${pedido.codigo_orden} ahora está marcada como PAGADA e impacta en los ingresos cobrados.`);
      return res.redirect(`/pedidos/ver/${id}`);

    } catch (error) {
      if (t) {
        try {
          await t.rollback();
        } catch (rbErr) {
          console.error('[Error durante rollback de cobro]:', rbErr);
        }
      }
      console.error('[Error al marcar venta como cobrada]:', error.message || error);
      const mensaje = error.message || 'Error al procesar el cobro de la venta.';
      req.flash('error', mensaje.startsWith('Error:') || mensaje.startsWith('Aviso:') ? mensaje : `Error: ${mensaje}`);
      return res.redirect(`/pedidos/ver/${req.params.id}`);
    }
  },

  // Alias para compatibilidad de nomenclatura
  marcarComoVendida: (req, res) => pedidosController.convertirAVenta(req, res),
  cobrar: (req, res) => pedidosController.marcarComoCobrado(req, res),

  // Vista de comisiones
  listarComisiones: async (req, res) => {
    try {
      const usuario = req.session.usuario;
      const whereConditions = {};

      if (usuario.rol === 'VENDEDOR') {
        whereConditions.vendedor_id = usuario.id;
      }

      const comisionesList = await Comision.findAll({
        where: whereConditions,
        include: [
          { model: Pedido, attributes: ['codigo_orden', 'total', 'creado_en'] },
          { model: Usuario, attributes: ['nombre'] }
        ],
        order: [['creado_en', 'DESC']]
      });

      const comisiones = comisionesList.map(c => {
        const item = c.get({ plain: true });
        return {
          ...item,
          codigo_orden: item.Pedido ? item.Pedido.codigo_orden : '',
          total_venta: item.Pedido ? item.Pedido.total : 0,
          fecha_venta: item.Pedido ? item.Pedido.creado_en : null,
          vendedor_nombre: item.Usuario ? item.Usuario.nombre : ''
        };
      });

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
      await Comision.update(
        { estado: 'PAGADO', fecha_pago: new Date() },
        { where: { id } }
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
