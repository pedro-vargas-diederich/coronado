const db = require('../config/database');

const dashboardController = {
  index: async (req, res) => {
    try {
      const usuario = req.session.usuario;

      // 1. Métricas de Ventas
      const [ventasData] = await db.query(`
        SELECT 
          COALESCE(SUM(CASE WHEN tipo_documento = 'VENTA' AND estado = 'PAGADO' THEN total ELSE 0 END), 0) AS ventas_cobradas,
          COALESCE(SUM(CASE WHEN tipo_documento = 'VENTA' AND estado = 'PENDIENTE' THEN total ELSE 0 END), 0) AS ventas_por_cobrar,
          COUNT(CASE WHEN tipo_documento = 'COTIZACION' AND estado = 'PENDIENTE' THEN 1 END) AS cotizaciones_activas,
          COUNT(CASE WHEN tipo_documento = 'VENTA' THEN 1 END) AS total_ventas_realizadas
        FROM pedidos
      `);

      const ventasCobradas = parseFloat(ventasData[0].ventas_cobradas) || 0;
      const ventasPorCobrar = parseFloat(ventasData[0].ventas_por_cobrar) || 0;
      const cotizacionesActivas = parseInt(ventasData[0].cotizaciones_activas, 10) || 0;
      const totalVentasRealizadas = parseInt(ventasData[0].total_ventas_realizadas, 10) || 0;

      // 2. Costo Histórico de Mercancía Vendida (COGS) de las ventas cobradas
      const [cogsData] = await db.query(`
        SELECT COALESCE(SUM(d.cantidad * d.costo_unitario), 0) AS costo_mercancia
        FROM detalles_pedido d
        INNER JOIN pedidos p ON d.pedido_id = p.id
        WHERE p.tipo_documento = 'VENTA' AND p.estado = 'PAGADO'
      `);
      const costoMercancia = parseFloat(cogsData[0].costo_mercancia) || 0;

      // 3. Comisiones Vinculadas a Ventas Cobradas
      const [comisionesData] = await db.query(`
        SELECT 
          COALESCE(SUM(c.monto), 0) AS comisiones_totales,
          COALESCE(SUM(CASE WHEN c.estado = 'PAGADO' THEN c.monto ELSE 0 END), 0) AS comisiones_pagadas,
          COALESCE(SUM(CASE WHEN c.estado = 'PENDIENTE' THEN c.monto ELSE 0 END), 0) AS comisiones_pendientes
        FROM comisiones c
        INNER JOIN pedidos p ON c.pedido_id = p.id
        WHERE p.estado = 'PAGADO'
      `);
      const comisionesTotales = parseFloat(comisionesData[0].comisiones_totales) || 0;
      const comisionesPendientes = parseFloat(comisionesData[0].comisiones_pendientes) || 0;

      // 4. Gastos Operativos Totales y por Categoría
      const [gastosData] = await db.query(`
        SELECT 
          COALESCE(SUM(monto), 0) AS total_gastos
        FROM gastos
      `);
      const gastosTotales = parseFloat(gastosData[0].total_gastos) || 0;

      const [gastosPorCategoria] = await db.query(`
        SELECT categoria, COALESCE(SUM(monto), 0) AS subtotal
        FROM gastos
        GROUP BY categoria
        ORDER BY subtotal DESC
      `);

      // 5. Gastos Imputados a Flota de Vehículos
      const [gastosFlota] = await db.query(`
        SELECT v.placa, v.modelo, COALESCE(SUM(g.monto), 0) AS total_gasto_vehiculo
        FROM vehiculos v
        LEFT JOIN gastos g ON v.id = g.vehiculo_id
        GROUP BY v.id, v.placa, v.modelo
        ORDER BY total_gasto_vehiculo DESC
      `);

      // 6. Cálculo Directivo de Utilidad Neta (Fórmula Solicitada)
      // Utilidad Neta = Ventas Cobradas - (Costo Mercancía + Comisiones + Gastos Operativos)
      const utilidadBruta = ventasCobradas - costoMercancia;
      const egresosTotales = costoMercancia + comisionesTotales + gastosTotales;
      const utilidadNeta = ventasCobradas - egresosTotales;
      const margenNeto = ventasCobradas > 0 ? (utilidadNeta / ventasCobradas) * 100 : 0;

      // 7. Alertas de Inventario Crítico
      const [alertasStock] = await db.query(`
        SELECT codigo_sku, nombre, unidad_medida, existencia, alerta_existencia_minima
        FROM productos
        WHERE existencia <= alerta_existencia_minima
        ORDER BY existencia ASC
        LIMIT 5
      `);

      // 8. Actividad Comercial Reciente
      const [ultimosPedidos] = await db.query(`
        SELECT p.id, p.tipo_documento, p.codigo_orden, p.total, p.estado, p.creado_en,
               c.razon_social AS cliente_nombre, u.nombre AS vendedor_nombre
        FROM pedidos p
        INNER JOIN contactos c ON p.cliente_id = c.id
        INNER JOIN usuarios u ON p.vendedor_id = u.id
        ORDER BY p.creado_en DESC
        LIMIT 6
      `);

      res.render('dashboard/index', {
        title: usuario.rol === 'SOCIO' ? 'Dashboard Financiero Directivo' : 'Panel de Control Operativo',
        userRole: usuario.rol,
        ventasCobradas,
        ventasPorCobrar,
        costoMercancia,
        comisionesTotales,
        comisionesPendientes,
        gastosTotales,
        utilidadBruta,
        utilidadNeta,
        margenNeto,
        cotizacionesActivas,
        totalVentasRealizadas,
        gastosPorCategoria,
        gastosFlota,
        alertasStock,
        ultimosPedidos
      });

    } catch (error) {
      console.error('[Error en Dashboard]:', error);
      req.flash('error', 'Error al calcular los indicadores del panel.');
      res.redirect('/pedidos');
    }
  }
};

module.exports = dashboardController;
