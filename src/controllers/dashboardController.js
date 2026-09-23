const { Sequelize, Op } = require('sequelize');
const {
  sequelize,
  Pedido,
  DetallePedido,
  Comision,
  Gasto,
  Vehiculo,
  Producto,
  Contacto,
  Usuario
} = require('../models');

const dashboardController = {
  index: async (req, res) => {
    try {
      const usuario = req.session.usuario;

      // 1. Métricas de Ventas agregadas con Sequelize
      const ventasData = await Pedido.findAll({
        attributes: [
          [
            Sequelize.fn(
              'COALESCE',
              Sequelize.fn(
                'SUM',
                Sequelize.literal("CASE WHEN tipo_documento = 'VENTA' AND estado = 'PAGADO' THEN total ELSE 0 END")
              ),
              0
            ),
            'ventas_cobradas'
          ],
          [
            Sequelize.fn(
              'COALESCE',
              Sequelize.fn(
                'SUM',
                Sequelize.literal("CASE WHEN tipo_documento = 'VENTA' AND estado = 'PENDIENTE' THEN total ELSE 0 END")
              ),
              0
            ),
            'ventas_por_cobrar'
          ],
          [
            Sequelize.fn(
              'COUNT',
              Sequelize.literal("CASE WHEN tipo_documento = 'COTIZACION' AND estado = 'PENDIENTE' THEN 1 END")
            ),
            'cotizaciones_activas'
          ],
          [
            Sequelize.fn(
              'COUNT',
              Sequelize.literal("CASE WHEN tipo_documento = 'VENTA' THEN 1 END")
            ),
            'total_ventas_realizadas'
          ]
        ],
        raw: true
      });

      const metrics = ventasData[0] || {};
      const ventasCobradas = parseFloat(metrics.ventas_cobradas) || 0;
      const ventasPorCobrar = parseFloat(metrics.ventas_por_cobrar) || 0;
      const cotizacionesActivas = parseInt(metrics.cotizaciones_activas, 10) || 0;
      const totalVentasRealizadas = parseInt(metrics.total_ventas_realizadas, 10) || 0;

      // 2. Costo Histórico de Mercancía Vendida (COGS) de ventas cobradas con Sequelize Include
      const cogsData = await DetallePedido.findAll({
        attributes: [
          [
            Sequelize.fn(
              'COALESCE',
              Sequelize.fn('SUM', Sequelize.literal('DetallePedido.cantidad * DetallePedido.costo_unitario')),
              0
            ),
            'costo_mercancia'
          ]
        ],
        include: [
          {
            model: Pedido,
            attributes: [],
            where: {
              tipo_documento: 'VENTA',
              estado: 'PAGADO'
            }
          }
        ],
        raw: true
      });
      const costoMercancia = parseFloat(cogsData[0]?.costo_mercancia) || 0;

      // 3. Comisiones Vinculadas a Ventas Cobradas
      const comisionesData = await Comision.findAll({
        attributes: [
          [
            Sequelize.fn('COALESCE', Sequelize.fn('SUM', Sequelize.col('Comision.monto')), 0),
            'comisiones_totales'
          ],
          [
            Sequelize.fn(
              'COALESCE',
              Sequelize.fn('SUM', Sequelize.literal("CASE WHEN Comision.estado = 'PAGADO' THEN Comision.monto ELSE 0 END")),
              0
            ),
            'comisiones_pagadas'
          ],
          [
            Sequelize.fn(
              'COALESCE',
              Sequelize.fn('SUM', Sequelize.literal("CASE WHEN Comision.estado = 'PENDIENTE' THEN Comision.monto ELSE 0 END")),
              0
            ),
            'comisiones_pendientes'
          ]
        ],
        include: [
          {
            model: Pedido,
            attributes: [],
            where: { estado: 'PAGADO' }
          }
        ],
        raw: true
      });
      const comisionesTotales = parseFloat(comisionesData[0]?.comisiones_totales) || 0;
      const comisionesPendientes = parseFloat(comisionesData[0]?.comisiones_pendientes) || 0;

      // 4. Gastos Operativos Totales y por Categoría
      const totalGastosRaw = await Gasto.sum('monto');
      const gastosTotales = parseFloat(totalGastosRaw) || 0;

      const gastosPorCatData = await Gasto.findAll({
        attributes: [
          'categoria',
          [Sequelize.fn('COALESCE', Sequelize.fn('SUM', Sequelize.col('monto')), 0), 'subtotal']
        ],
        group: ['categoria'],
        order: [[Sequelize.literal('subtotal'), 'DESC']],
        raw: true
      });
      const gastosPorCategoria = gastosPorCatData.map(g => ({
        categoria: g.categoria,
        subtotal: parseFloat(g.subtotal) || 0
      }));

      // 5. Gastos Imputados a Flota de Vehículos
      const gastosFlotaData = await Vehiculo.findAll({
        attributes: [
          'id',
          'placa',
          'modelo',
          [Sequelize.fn('COALESCE', Sequelize.fn('SUM', Sequelize.col('Gastos.monto')), 0), 'total_gasto_vehiculo']
        ],
        include: [
          {
            model: Gasto,
            attributes: []
          }
        ],
        group: ['Vehiculo.id', 'Vehiculo.placa', 'Vehiculo.modelo'],
        order: [[Sequelize.literal('total_gasto_vehiculo'), 'DESC']],
        raw: true
      });
      const gastosFlota = gastosFlotaData.map(v => ({
        id: v.id,
        placa: v.placa,
        modelo: v.modelo,
        total_gasto_vehiculo: parseFloat(v.total_gasto_vehiculo) || 0
      }));

      // 6. Cálculo Directivo de Utilidad Neta
      // Utilidad Neta = Ventas Cobradas - (Costo Mercancía + Comisiones + Gastos Operativos)
      const utilidadBruta = ventasCobradas - costoMercancia;
      const egresosTotales = costoMercancia + comisionesTotales + gastosTotales;
      const utilidadNeta = ventasCobradas - egresosTotales;
      const margenNeto = ventasCobradas > 0 ? (utilidadNeta / ventasCobradas) * 100 : 0;

      // 7. Alertas de Inventario Crítico
      const alertasStock = await Producto.findAll({
        attributes: ['codigo_sku', 'nombre', 'unidad_medida', 'existencia', 'alerta_existencia_minima'],
        where: {
          existencia: {
            [Op.lte]: Sequelize.col('alerta_existencia_minima')
          }
        },
        order: [['existencia', 'ASC']],
        limit: 5,
        raw: true
      });

      // 8. Actividad Comercial Reciente con Sequelize Include
      const ultimosPedidosData = await Pedido.findAll({
        attributes: ['id', 'tipo_documento', 'codigo_orden', 'total', 'estado', 'creado_en'],
        include: [
          { model: Contacto, as: 'cliente', attributes: ['razon_social'] },
          { model: Usuario, as: 'vendedor', attributes: ['nombre'] }
        ],
        order: [['creado_en', 'DESC']],
        limit: 6
      });

      const ultimosPedidos = ultimosPedidosData.map(p => {
        const item = p.get({ plain: true });
        return {
          ...item,
          cliente_nombre: item.cliente ? item.cliente.razon_social : '',
          vendedor_nombre: item.vendedor ? item.vendedor.nombre : ''
        };
      });

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
      console.error('[Error en Dashboard con Sequelize]:', error);
      req.flash('error', 'Error al calcular los indicadores del panel.');
      res.redirect('/pedidos');
    }
  }
};

module.exports = dashboardController;
