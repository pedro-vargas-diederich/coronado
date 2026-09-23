const db = require('../config/database');

/**
 * Helper para obtener rango de fechas y presets
 */
function obtenerRangoFechas(query) {
  const hoy = new Date();
  const formatYMD = (d) => d.toISOString().split('T')[0];

  let { desde, hasta, preset } = query;

  if (preset) {
    if (preset === 'hoy') {
      desde = formatYMD(hoy);
      hasta = formatYMD(hoy);
    } else if (preset === 'semana') {
      const primerDiaSemana = new Date(hoy);
      const diaSemana = hoy.getDay() === 0 ? 6 : hoy.getDay() - 1; // Ajuste lunes=0
      primerDiaSemana.setDate(hoy.getDate() - diaSemana);
      desde = formatYMD(primerDiaSemana);
      hasta = formatYMD(hoy);
    } else if (preset === 'mes') {
      const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      desde = formatYMD(primerDiaMes);
      hasta = formatYMD(hoy);
    } else if (preset === 'anio') {
      const primerDiaAnio = new Date(hoy.getFullYear(), 0, 1);
      desde = formatYMD(primerDiaAnio);
      hasta = formatYMD(hoy);
    }
  }

  // Valores predeterminados (mes actual)
  if (!desde) {
    const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    desde = formatYMD(primerDiaMes);
  }
  if (!hasta) {
    hasta = formatYMD(hoy);
  }

  return { desde, hasta, preset: preset || 'mes' };
}

const reportesController = {
  /**
   * Vista Principal de Reportes
   * GET /reportes
   */
  index: async (req, res) => {
    try {
      const usuario = req.session.usuario;
      const { desde, hasta, preset } = obtenerRangoFechas(req.query);

      // Determinación de tipo de reporte activo según rol y parámetro
      let tipo = req.query.tipo;
      if (!tipo) {
        tipo = usuario.rol === 'SOCIO' ? 'financiero' : 'ventas';
      }

      // Restricciones de seguridad por rol
      if (usuario.rol === 'VENDEDOR') {
        if (tipo !== 'ventas' && tipo !== 'comisiones') {
          req.flash('info', 'Como asesor comercial solo tienes acceso a tus reportes de ventas y comisiones.');
          tipo = 'ventas';
        }
      } else if (usuario.rol === 'ADMINISTRADOR') {
        if (tipo === 'financiero') {
          req.flash('error', 'El balance de utilidad neta directiva es de acceso exclusivo para Socios.');
          tipo = 'ventas';
        }
      }

      let datosReporte = {};

      // =========================================================================
      // REPORTE 1: ESTADO FINANCIERO Y UTILIDAD NETA (EXCLUSIVO SOCIO)
      // =========================================================================
      if (tipo === 'financiero' && usuario.rol === 'SOCIO') {
        // Ventas Cobradas (PAGADO)
        const [ventasCobradas] = await db.query(
          `SELECT COALESCE(SUM(total), 0) AS total, COUNT(id) AS cantidad
           FROM pedidos
           WHERE tipo_documento = 'VENTA' AND estado = 'PAGADO' AND DATE(creado_en) BETWEEN ? AND ?`,
          [desde, hasta]
        );

        // Ventas a Crédito Pendientes de Cobro
        const [ventasPendientes] = await db.query(
          `SELECT COALESCE(SUM(total), 0) AS total, COUNT(id) AS cantidad
           FROM pedidos
           WHERE tipo_documento = 'VENTA' AND estado = 'PENDIENTE' AND DATE(creado_en) BETWEEN ? AND ?`,
          [desde, hasta]
        );

        // Costo de la Mercancía Vendida (COGS) en ventas cobradas
        const [costoMercancia] = await db.query(
          `SELECT COALESCE(SUM(d.cantidad * d.costo_unitario), 0) AS total
           FROM detalles_pedido d
           INNER JOIN pedidos p ON d.pedido_id = p.id
           WHERE p.tipo_documento = 'VENTA' AND p.estado = 'PAGADO' AND DATE(p.creado_en) BETWEEN ? AND ?`,
          [desde, hasta]
        );

        // Comisiones generadas en el período
        const [comisionesPeriodo] = await db.query(
          `SELECT COALESCE(SUM(monto), 0) AS total
           FROM comisiones
           WHERE DATE(creado_en) BETWEEN ? AND ?`,
          [desde, hasta]
        );

        // Gastos Operativos totales y desglosados por categoría
        const [gastosTotales] = await db.query(
          `SELECT COALESCE(SUM(monto), 0) AS total
           FROM gastos
           WHERE fecha_gasto BETWEEN ? AND ?`,
          [desde, hasta]
        );

        const [gastosPorCategoria] = await db.query(
          `SELECT categoria, COALESCE(SUM(monto), 0) AS total, COUNT(id) AS cantidad
           FROM gastos
           WHERE fecha_gasto BETWEEN ? AND ?
           GROUP BY categoria
           ORDER BY total DESC`,
          [desde, hasta]
        );

        const totalCobradas = parseFloat(ventasCobradas[0].total);
        const totalCostos = parseFloat(costoMercancia[0].total);
        const totalComis = parseFloat(comisionesPeriodo[0].total);
        const totalGastos = parseFloat(gastosTotales[0].total);
        const utilidadNeta = totalCobradas - (totalCostos + totalComis + totalGastos);
        const margenPorcentaje = totalCobradas > 0 ? ((utilidadNeta / totalCobradas) * 100).toFixed(2) : '0.00';

        datosReporte = {
          ventasCobradas: totalCobradas,
          ventasPendientes: parseFloat(ventasPendientes[0].total),
          costoMercancia: totalCostos,
          comisiones: totalComis,
          gastosOperativos: totalGastos,
          utilidadNeta,
          margenPorcentaje,
          gastosPorCategoria
        };
      }

      // =========================================================================
      // REPORTE 2: VENTAS Y FACTURACIÓN
      // =========================================================================
      if (tipo === 'ventas') {
        const esVendedor = usuario.rol === 'VENDEDOR';
        const filtroVendedor = esVendedor ? ' AND p.vendedor_id = ?' : '';
        const paramsBase = esVendedor ? [desde, hasta, usuario.id] : [desde, hasta];

        // Totales generales
        const [resumenVentas] = await db.query(
          `SELECT 
             COUNT(p.id) AS total_pedidos,
             COALESCE(SUM(p.total), 0) AS monto_total,
             COALESCE(SUM(CASE WHEN p.metodo_pago = 'EFECTIVO' THEN p.total ELSE 0 END), 0) AS total_efectivo,
             COALESCE(SUM(CASE WHEN p.metodo_pago = 'TRANSFERENCIA' THEN p.total ELSE 0 END), 0) AS total_transferencia,
             COALESCE(SUM(CASE WHEN p.metodo_pago = 'CREDITO' THEN p.total ELSE 0 END), 0) AS total_credito,
             COALESCE(SUM(CASE WHEN p.estado = 'PAGADO' THEN p.total ELSE 0 END), 0) AS total_cobrado,
             COALESCE(SUM(CASE WHEN p.estado = 'PENDIENTE' THEN p.total ELSE 0 END), 0) AS total_pendiente
           FROM pedidos p
           WHERE p.tipo_documento = 'VENTA' AND DATE(p.creado_en) BETWEEN ? AND ? ${filtroVendedor}`,
          paramsBase
        );

        // Desglose por Producto
        const [productosVendidos] = await db.query(
          `SELECT pr.id, pr.nombre, pr.codigo_sku, pr.unidad_medida,
                  COALESCE(SUM(d.cantidad), 0) AS cantidad_total,
                  COALESCE(SUM(d.precio_total), 0) AS monto_total
           FROM detalles_pedido d
           INNER JOIN pedidos p ON d.pedido_id = p.id
           INNER JOIN productos pr ON d.producto_id = pr.id
           WHERE p.tipo_documento = 'VENTA' AND DATE(p.creado_en) BETWEEN ? AND ? ${filtroVendedor}
           GROUP BY pr.id, pr.nombre, pr.codigo_sku, pr.unidad_medida
           ORDER BY monto_total DESC`,
          paramsBase
        );

        // Lista de ventas detallada
        const [listaVentas] = await db.query(
          `SELECT p.id, p.codigo_orden, p.creado_en, p.metodo_pago, p.estado, p.total,
                  c.razon_social AS cliente_nombre,
                  u.nombre AS vendedor_nombre
           FROM pedidos p
           INNER JOIN contactos c ON p.cliente_id = c.id
           INNER JOIN usuarios u ON p.vendedor_id = u.id
           WHERE p.tipo_documento = 'VENTA' AND DATE(p.creado_en) BETWEEN ? AND ? ${filtroVendedor}
           ORDER BY p.creado_en DESC`,
          paramsBase
        );

        datosReporte = {
          resumen: resumenVentas[0],
          productosVendidos,
          listaVentas
        };
      }

      // =========================================================================
      // REPORTE 3: COMISIONES A VENDEDORES
      // =========================================================================
      if (tipo === 'comisiones') {
        const esVendedor = usuario.rol === 'VENDEDOR';

        if (esVendedor) {
          // Vista individual para el vendedor
          const [comisionesVendedor] = await db.query(
            `SELECT c.*, p.codigo_orden, p.total AS total_venta, c.creado_en AS fecha_comision
             FROM comisiones c
             INNER JOIN pedidos p ON c.pedido_id = p.id
             WHERE c.vendedor_id = ? AND DATE(c.creado_en) BETWEEN ? AND ?
             ORDER BY c.creado_en DESC`,
            [usuario.id, desde, hasta]
          );

          const [totalesVendedor] = await db.query(
            `SELECT 
               COUNT(id) AS total_comisiones,
               COALESCE(SUM(monto), 0) AS total_devengado,
               COALESCE(SUM(CASE WHEN estado = 'PAGADO' THEN monto ELSE 0 END), 0) AS total_liquidado,
               COALESCE(SUM(CASE WHEN estado = 'PENDIENTE' THEN monto ELSE 0 END), 0) AS total_pendiente
             FROM comisiones
             WHERE vendedor_id = ? AND DATE(creado_en) BETWEEN ? AND ?`,
            [usuario.id, desde, hasta]
          );

          datosReporte = {
            esIndividual: true,
            resumen: totalesVendedor[0],
            detalle: comisionesVendedor
          };
        } else {
          // Vista general consolidada para Socio y Administrador
          const [resumenVendedores] = await db.query(
            `SELECT u.id AS vendedor_id, u.nombre AS vendedor_nombre, u.porcentaje_comision,
                    COUNT(c.id) AS total_operaciones,
                    COALESCE(SUM(c.monto), 0) AS total_comisiones,
                    COALESCE(SUM(CASE WHEN c.estado = 'PAGADO' THEN c.monto ELSE 0 END), 0) AS total_liquidado,
                    COALESCE(SUM(CASE WHEN c.estado = 'PENDIENTE' THEN c.monto ELSE 0 END), 0) AS total_pendiente
             FROM usuarios u
             LEFT JOIN comisiones c ON u.id = c.vendedor_id AND DATE(c.creado_en) BETWEEN ? AND ?
             WHERE u.rol = 'VENDEDOR' AND u.activo = 1
             GROUP BY u.id, u.nombre, u.porcentaje_comision
             ORDER BY total_comisiones DESC`,
            [desde, hasta]
          );

          const [totalesGenerales] = await db.query(
            `SELECT 
               COUNT(id) AS total_operaciones,
               COALESCE(SUM(monto), 0) AS total_devengado,
               COALESCE(SUM(CASE WHEN estado = 'PAGADO' THEN monto ELSE 0 END), 0) AS total_liquidado,
               COALESCE(SUM(CASE WHEN estado = 'PENDIENTE' THEN monto ELSE 0 END), 0) AS total_pendiente
             FROM comisiones
             WHERE DATE(creado_en) BETWEEN ? AND ?`,
            [desde, hasta]
          );

          datosReporte = {
            esIndividual: false,
            resumen: totalesGenerales[0],
            porVendedor: resumenVendedores
          };
        }
      }

      // =========================================================================
      // REPORTE 4: COSTOS DE TRANSPORTE Y FLOTA (SOCIO Y ADMINISTRADOR)
      // =========================================================================
      if (tipo === 'flota' && (usuario.rol === 'SOCIO' || usuario.rol === 'ADMINISTRADOR')) {
        const [gastosPorVehiculo] = await db.query(
          `SELECT v.id, v.placa, v.modelo, v.conductor_asignado,
                  COUNT(g.id) AS cantidad_gastos,
                  COALESCE(SUM(g.monto), 0) AS total_gastos,
                  COALESCE(SUM(CASE WHEN g.categoria = 'COMBUSTIBLE' THEN g.monto ELSE 0 END), 0) AS gasto_combustible,
                  COALESCE(SUM(CASE WHEN g.categoria = 'MANTENIMIENTO_VEHICULO' THEN g.monto ELSE 0 END), 0) AS gasto_mantenimiento,
                  COALESCE(SUM(CASE WHEN g.categoria NOT IN ('COMBUSTIBLE', 'MANTENIMIENTO_VEHICULO') THEN g.monto ELSE 0 END), 0) AS otros_gastos
           FROM vehiculos v
           LEFT JOIN gastos g ON v.id = g.vehiculo_id AND g.fecha_gasto BETWEEN ? AND ?
           GROUP BY v.id, v.placa, v.modelo, v.conductor_asignado
           ORDER BY total_gastos DESC`,
          [desde, hasta]
        );

        const [totalesFlota] = await db.query(
          `SELECT 
             COUNT(id) AS cantidad_registros,
             COALESCE(SUM(monto), 0) AS total_gastos,
             COALESCE(SUM(CASE WHEN categoria = 'COMBUSTIBLE' THEN monto ELSE 0 END), 0) AS total_combustible,
             COALESCE(SUM(CASE WHEN categoria = 'MANTENIMIENTO_VEHICULO' THEN monto ELSE 0 END), 0) AS total_mantenimiento
           FROM gastos
           WHERE vehiculo_id IS NOT NULL AND fecha_gasto BETWEEN ? AND ?`,
          [desde, hasta]
        );

        const [gastosRecientes] = await db.query(
          `SELECT g.*, v.placa, v.modelo
           FROM gastos g
           INNER JOIN vehiculos v ON g.vehiculo_id = v.id
           WHERE g.fecha_gasto BETWEEN ? AND ?
           ORDER BY g.fecha_gasto DESC LIMIT 50`,
          [desde, hasta]
        );

        datosReporte = {
          resumen: totalesFlota[0],
          porVehiculo: gastosPorVehiculo,
          gastosRecientes
        };
      }

      // =========================================================================
      // REPORTE 5: CUENTAS POR COBRAR (CARTERA DE CLIENTES)
      // =========================================================================
      if (tipo === 'cobrar' && (usuario.rol === 'SOCIO' || usuario.rol === 'ADMINISTRADOR')) {
        const [cuentasPendientes] = await db.query(
          `SELECT p.id, p.codigo_orden, p.creado_en, p.fecha_vencimiento, p.total,
                  c.razon_social AS cliente_nombre, c.identificacion_fiscal AS cliente_nit,
                  c.telefono AS cliente_telefono, c.limite_credito,
                  u.nombre AS vendedor_nombre,
                  DATEDIFF(CURRENT_DATE, COALESCE(p.fecha_vencimiento, DATE(p.creado_en))) AS dias_retraso
           FROM pedidos p
           INNER JOIN contactos c ON p.cliente_id = c.id
           INNER JOIN usuarios u ON p.vendedor_id = u.id
           WHERE p.tipo_documento = 'VENTA' AND p.estado = 'PENDIENTE'
           ORDER BY dias_retraso DESC, p.creado_en ASC`
        );

        const [totalesCartera] = await db.query(
          `SELECT 
             COUNT(p.id) AS total_facturas,
             COALESCE(SUM(p.total), 0) AS monto_total_pendiente,
             COALESCE(SUM(CASE WHEN DATEDIFF(CURRENT_DATE, COALESCE(p.fecha_vencimiento, DATE(p.creado_en))) > 0 THEN p.total ELSE 0 END), 0) AS cartera_vencida,
             COALESCE(SUM(CASE WHEN DATEDIFF(CURRENT_DATE, COALESCE(p.fecha_vencimiento, DATE(p.creado_en))) <= 0 THEN p.total ELSE 0 END), 0) AS cartera_al_dia
           FROM pedidos p
           WHERE p.tipo_documento = 'VENTA' AND p.estado = 'PENDIENTE'`
        );

        datosReporte = {
          resumen: totalesCartera[0],
          cuentas: cuentasPendientes
        };
      }

      res.render('reportes/index', {
        title: 'Módulo Integral de Reportes',
        tipo,
        desde,
        hasta,
        preset,
        datos: datosReporte,
        userRole: usuario.rol
      });

    } catch (error) {
      console.error('[Error en módulo de reportes]:', error);
      req.flash('error', 'Ocurrió un error al procesar los datos del reporte.');
      res.redirect('/dashboard');
    }
  },

  /**
   * Exportación de Reportes a CSV (Excel compatible con UTF-8 BOM)
   * GET /reportes/exportar-csv
   */
  exportarCsv: async (req, res) => {
    try {
      const usuario = req.session.usuario;
      const { desde, hasta } = obtenerRangoFechas(req.query);
      const tipo = req.query.tipo || 'ventas';

      // Control de roles en exportación
      if (usuario.rol === 'VENDEDOR' && tipo !== 'ventas' && tipo !== 'comisiones') {
        return res.status(403).send('No autorizado');
      }
      if (usuario.rol === 'ADMINISTRADOR' && tipo === 'financiero') {
        return res.status(403).send('No autorizado');
      }

      let csvContenido = '\uFEFF'; // BOM para que Microsoft Excel abra acentos y ñ sin problemas

      if (tipo === 'ventas') {
        const esVendedor = usuario.rol === 'VENDEDOR';
        const filtroVendedor = esVendedor ? ' AND p.vendedor_id = ?' : '';
        const params = esVendedor ? [desde, hasta, usuario.id] : [desde, hasta];

        const [ventas] = await db.query(
          `SELECT p.codigo_orden, DATE(p.creado_en) AS fecha, c.razon_social AS cliente,
                  u.nombre AS vendedor, p.metodo_pago, p.estado, p.total
           FROM pedidos p
           INNER JOIN contactos c ON p.cliente_id = c.id
           INNER JOIN usuarios u ON p.vendedor_id = u.id
           WHERE p.tipo_documento = 'VENTA' AND DATE(p.creado_en) BETWEEN ? AND ? ${filtroVendedor}
           ORDER BY p.creado_en DESC`,
          params
        );

        csvContenido += 'Código;Fecha;Cliente;Asesor;Método de Pago;Estado;Monto Total (Bs)\n';
        ventas.forEach(v => {
          csvContenido += `"${v.codigo_orden}";"${v.fecha}";"${v.cliente}";"${v.vendedor}";"${v.metodo_pago}";"${v.estado}";"${Number(v.total).toFixed(2)}"\n`;
        });

      } else if (tipo === 'comisiones') {
        const esVendedor = usuario.rol === 'VENDEDOR';
        const filtroVendedor = esVendedor ? ' WHERE c.vendedor_id = ?' : '';
        const params = esVendedor ? [usuario.id, desde, hasta] : [desde, hasta];

        const [comisiones] = await db.query(
          `SELECT p.codigo_orden, DATE(c.creado_en) AS fecha, u.nombre AS vendedor,
                  c.monto AS monto_comision, c.estado
           FROM comisiones c
           INNER JOIN pedidos p ON c.pedido_id = p.id
           INNER JOIN usuarios u ON c.vendedor_id = u.id
           ${filtroVendedor ? filtroVendedor + ' AND' : 'WHERE'} DATE(c.creado_en) BETWEEN ? AND ?
           ORDER BY c.creado_en DESC`,
          params
        );

        csvContenido += 'Código Venta;Fecha;Vendedor;Monto Comisión (Bs);Estado\n';
        comisiones.forEach(c => {
          csvContenido += `"${c.codigo_orden}";"${c.fecha}";"${c.vendedor}";"${Number(c.monto_comision).toFixed(2)}";"${c.estado}"\n`;
        });

      } else if (tipo === 'flota') {
        const [flota] = await db.query(
          `SELECT v.placa, v.modelo, v.conductor_asignado,
                  COALESCE(SUM(g.monto), 0) AS total_gastos,
                  COALESCE(SUM(CASE WHEN g.categoria = 'COMBUSTIBLE' THEN g.monto ELSE 0 END), 0) AS combustible,
                  COALESCE(SUM(CASE WHEN g.categoria = 'MANTENIMIENTO_VEHICULO' THEN g.monto ELSE 0 END), 0) AS mantenimiento
           FROM vehiculos v
           LEFT JOIN gastos g ON v.id = g.vehiculo_id AND g.fecha_gasto BETWEEN ? AND ?
           GROUP BY v.id, v.placa, v.modelo, v.conductor_asignado
           ORDER BY total_gastos DESC`,
          [desde, hasta]
        );

        csvContenido += 'Placa;Modelo;Conductor Asignado;Gasto Combustible (Bs);Mantenimiento (Bs);Total Acumulado (Bs)\n';
        flota.forEach(f => {
          csvContenido += `"${f.placa}";"${f.modelo}";"${f.conductor_asignado}";"${Number(f.combustible).toFixed(2)}";"${Number(f.mantenimiento).toFixed(2)}";"${Number(f.total_gastos).toFixed(2)}"\n`;
        });

      } else if (tipo === 'cobrar') {
        const [cuentas] = await db.query(
          `SELECT p.codigo_orden, DATE(p.creado_en) AS fecha_emision, p.fecha_vencimiento,
                  c.razon_social AS cliente, c.telefono, p.total,
                  DATEDIFF(CURRENT_DATE, COALESCE(p.fecha_vencimiento, DATE(p.creado_en))) AS dias_retraso
           FROM pedidos p
           INNER JOIN contactos c ON p.cliente_id = c.id
           WHERE p.tipo_documento = 'VENTA' AND p.estado = 'PENDIENTE'
           ORDER BY dias_retraso DESC`
        );

        csvContenido += 'Código Venta;Fecha Emisión;Vencimiento;Cliente;Teléfono;Días Retraso;Saldo Pendiente (Bs)\n';
        cuentas.forEach(c => {
          csvContenido += `"${c.codigo_orden}";"${c.fecha_emision}";"${c.fecha_vencimiento || '-'}";"${c.cliente}";"${c.telefono || '-'}";"${c.dias_retraso}";"${Number(c.total).toFixed(2)}"\n`;
        });

      } else if (tipo === 'financiero' && usuario.rol === 'SOCIO') {
        // Resumen financiero ejecutivo
        const [ventas] = await db.query(
          `SELECT COALESCE(SUM(total), 0) AS total FROM pedidos WHERE tipo_documento = 'VENTA' AND estado = 'PAGADO' AND DATE(creado_en) BETWEEN ? AND ?`,
          [desde, hasta]
        );
        const [costos] = await db.query(
          `SELECT COALESCE(SUM(d.cantidad * d.costo_unitario), 0) AS total FROM detalles_pedido d INNER JOIN pedidos p ON d.pedido_id = p.id WHERE p.tipo_documento = 'VENTA' AND p.estado = 'PAGADO' AND DATE(p.creado_en) BETWEEN ? AND ?`,
          [desde, hasta]
        );
        const [comisiones] = await db.query(
          `SELECT COALESCE(SUM(monto), 0) AS total FROM comisiones WHERE DATE(creado_en) BETWEEN ? AND ?`,
          [desde, hasta]
        );
        const [gastos] = await db.query(
          `SELECT COALESCE(SUM(monto), 0) AS total FROM gastos WHERE fecha_gasto BETWEEN ? AND ?`,
          [desde, hasta]
        );

        const vTotal = parseFloat(ventas[0].total);
        const cTotal = parseFloat(costos[0].total);
        const comTotal = parseFloat(comisiones[0].total);
        const gTotal = parseFloat(gastos[0].total);
        const uNeta = vTotal - (cTotal + comTotal + gTotal);

        csvContenido += 'Rubro Financiero;Monto (Bs)\n';
        csvContenido += `"Ventas Cobradas (Efectivo/Transferencia)";"${vTotal.toFixed(2)}"\n`;
        csvContenido += `"Costo de Mercancía Vendida (COGS)";"${cTotal.toFixed(2)}"\n`;
        csvContenido += `"Comisiones Comerciales Devengadas";"${comTotal.toFixed(2)}"\n`;
        csvContenido += `"Gastos Operativos Totales";"${gTotal.toFixed(2)}"\n`;
        csvContenido += `"UTILIDAD NETA DIRECTIVA";"${uNeta.toFixed(2)}"\n`;
      }

      const filename = `reporte_${tipo}_${desde}_al_${hasta}.csv`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.status(200).send(csvContenido);

    } catch (error) {
      console.error('[Error al exportar CSV]:', error);
      res.status(500).send('Error al generar archivo CSV');
    }
  }
};

module.exports = reportesController;
