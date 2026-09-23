const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

const vehiculosController = {
  // Listar flota de vehículos con resumen de gastos acumulados
  listar: async (req, res) => {
    try {
      const [vehiculos] = await db.query(`
        SELECT v.id, v.placa, v.modelo, v.conductor_asignado, v.activo, v.creado_en,
               COALESCE(SUM(g.monto), 0) AS total_gastos_acumulados,
               COUNT(g.id) AS total_registros_gastos
        FROM vehiculos v
        LEFT JOIN gastos g ON v.id = g.vehiculo_id
        GROUP BY v.id, v.placa, v.modelo, v.conductor_asignado, v.activo, v.creado_en
        ORDER BY v.activo DESC, v.placa ASC
      `);

      // Total general de egresos asignados a la flota
      const totalGastosFlota = vehiculos.reduce((acc, curr) => acc + parseFloat(curr.total_gastos_acumulados), 0);
      const totalUnidadesActivas = vehiculos.filter(v => v.activo).length;

      res.render('vehiculos/index', {
        title: 'Gestión de Flota Vehicular',
        vehiculos,
        totalGastosFlota,
        totalUnidadesActivas,
        userRole: req.session.usuario.rol
      });
    } catch (error) {
      console.error('[Error al listar vehículos]:', error);
      req.flash('error', 'No se pudo cargar la flota de vehículos.');
      res.redirect('/dashboard');
    }
  },

  // Mostrar formulario para nuevo vehículo
  mostrarCrear: (req, res) => {
    res.render('vehiculos/formulario', {
      title: 'Registrar Vehículo en Flota',
      vehiculo: null,
      accion: '/vehiculos/nuevo'
    });
  },

  // Registrar vehículo en base de datos
  crear: async (req, res) => {
    try {
      const { placa, modelo, conductor_asignado } = req.body;

      if (!placa || !modelo || !conductor_asignado) {
        req.flash('error', 'Todos los campos son obligatorios.');
        return res.redirect('/vehiculos/nuevo');
      }

      // Validar si la placa ya existe
      const [existente] = await db.query(
        'SELECT id FROM vehiculos WHERE placa = ? LIMIT 1',
        [placa.trim().toUpperCase()]
      );

      if (existente.length > 0) {
        req.flash('error', `La placa "${placa.toUpperCase()}" ya se encuentra registrada en la flota.`);
        return res.redirect('/vehiculos/nuevo');
      }

      const id = uuidv4();
      await db.query(
        `INSERT INTO vehiculos (id, placa, modelo, conductor_asignado, activo)
         VALUES (?, ?, ?, ?, 1)`,
        [
          id,
          placa.trim().toUpperCase(),
          modelo.trim(),
          conductor_asignado.trim()
        ]
      );

      req.flash('success', `Vehículo con placa ${placa.toUpperCase()} registrado con éxito.`);
      res.redirect('/vehiculos');
    } catch (error) {
      console.error('[Error al registrar vehículo]:', error);
      req.flash('error', 'Ocurrió un error al registrar el vehículo.');
      res.redirect('/vehiculos/nuevo');
    }
  },

  // Mostrar formulario de edición
  mostrarEditar: async (req, res) => {
    try {
      const { id } = req.params;
      const [rows] = await db.query('SELECT * FROM vehiculos WHERE id = ? LIMIT 1', [id]);

      if (rows.length === 0) {
        req.flash('error', 'Vehículo no encontrado.');
        return res.redirect('/vehiculos');
      }

      res.render('vehiculos/formulario', {
        title: `Editar Vehículo ${rows[0].placa}`,
        vehiculo: rows[0],
        accion: `/vehiculos/editar/${id}`
      });
    } catch (error) {
      console.error('[Error al cargar vehículo]:', error);
      req.flash('error', 'No se pudieron consultar los datos del vehículo.');
      res.redirect('/vehiculos');
    }
  },

  // Actualizar datos y estado (activo/inactivo sin borrado físico)
  actualizar: async (req, res) => {
    try {
      const { id } = req.params;
      const { placa, modelo, conductor_asignado, activo } = req.body;

      if (!placa || !modelo || !conductor_asignado) {
        req.flash('error', 'Todos los campos son obligatorios.');
        return res.redirect(`/vehiculos/editar/${id}`);
      }

      // Validar placa única excluyendo la actual
      const [existente] = await db.query(
        'SELECT id FROM vehiculos WHERE placa = ? AND id != ? LIMIT 1',
        [placa.trim().toUpperCase(), id]
      );

      if (existente.length > 0) {
        req.flash('error', `La placa "${placa.toUpperCase()}" ya pertenece a otro vehículo.`);
        return res.redirect(`/vehiculos/editar/${id}`);
      }

      const estadoActivo = activo === '1' || activo === 1 || activo === 'on' ? 1 : 0;

      await db.query(
        `UPDATE vehiculos 
         SET placa = ?, modelo = ?, conductor_asignado = ?, activo = ?
         WHERE id = ?`,
        [
          placa.trim().toUpperCase(),
          modelo.trim(),
          conductor_asignado.trim(),
          estadoActivo,
          id
        ]
      );

      req.flash('success', `Información de la unidad ${placa.toUpperCase()} actualizada.`);
      res.redirect('/vehiculos');
    } catch (error) {
      console.error('[Error al actualizar vehículo]:', error);
      req.flash('error', 'Error al actualizar el vehículo.');
      res.redirect('/vehiculos');
    }
  },

  // Vista de Monitoreo / Mapa en Vivo (Leaflet + OpenStreetMap)
  mostrarMapa: async (req, res) => {
    try {
      const [vehiculos] = await db.query(`
        SELECT v.id AS vehiculo_id, v.placa, v.modelo, v.conductor_asignado, v.activo,
               u.latitud, u.longitud, u.velocidad_kmh, u.actualizado_en,
               TIMESTAMPDIFF(SECOND, u.actualizado_en, NOW()) AS segundos_desde_actualizacion
        FROM vehiculos v
        LEFT JOIN ubicaciones_vehiculo u ON v.id = u.vehiculo_id
        WHERE v.activo = 1
        ORDER BY v.placa ASC
      `);

      res.render('vehiculos/mapa', {
        title: 'Monitoreo GPS en Vivo - Flota Vehicular',
        vehiculos,
        userRole: req.session.usuario ? req.session.usuario.rol : 'ADMINISTRADOR'
      });
    } catch (error) {
      console.error('[Error al cargar mapa de vehículos]:', error);
      req.flash('error', 'No se pudo cargar el mapa de monitoreo vehicular.');
      res.redirect('/vehiculos');
    }
  },

  // Vista de Transmisión para Tablet a bordo de cada camión
  mostrarEmisorGps: async (req, res) => {
    try {
      const { id } = req.params;
      const [vehiculos] = await db.query(`
        SELECT v.*, u.latitud, u.longitud, u.velocidad_kmh, u.actualizado_en,
               TIMESTAMPDIFF(SECOND, u.actualizado_en, NOW()) AS segundos_desde_actualizacion
        FROM vehiculos v
        LEFT JOIN ubicaciones_vehiculo u ON v.id = u.vehiculo_id
        WHERE v.id = ? LIMIT 1
      `, [id]);

      if (vehiculos.length === 0) {
        req.flash('error', 'El vehículo especificado no existe.');
        return res.redirect('/vehiculos');
      }

      // Consultar otras unidades activas para permitir cambio rápido en la tablet
      const [otrosVehiculos] = await db.query(
        'SELECT id, placa, modelo, conductor_asignado FROM vehiculos WHERE activo = 1 ORDER BY placa ASC'
      );

      res.render('vehiculos/emisor-gps', {
        title: `Rastreador GPS - ${vehiculos[0].placa}`,
        vehiculo: vehiculos[0],
        otrosVehiculos,
        userRole: req.session.usuario ? req.session.usuario.rol : 'CONDUCTOR'
      });
    } catch (error) {
      console.error('[Error al cargar emisor GPS]:', error);
      req.flash('error', 'Error al abrir la interfaz de rastreo GPS.');
      res.redirect('/vehiculos');
    }
  },

  // API Receptor: Recibir coordenadas desde la tablet y actualizar ubicación
  guardarUbicacion: async (req, res) => {
    try {
      const { id } = req.params;
      let { latitud, longitud, velocidad, velocidad_kmh } = req.body;

      const lat = parseFloat(latitud);
      const lng = parseFloat(longitud);
      let vel = parseFloat(velocidad_kmh !== undefined ? velocidad_kmh : (velocidad !== undefined ? velocidad : 0));

      if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return res.status(400).json({
          success: false,
          error: 'Coordenadas geográficas inválidas. Latitud [-90, 90] y Longitud [-180, 180].'
        });
      }

      if (isNaN(vel) || vel < 0) vel = 0.00;

      // Verificar existencia del vehículo
      const [veh] = await db.query('SELECT id, placa, activo FROM vehiculos WHERE id = ? LIMIT 1', [id]);
      if (veh.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'El vehículo especificado no existe en la base de datos.'
        });
      }

      const ubicacionId = uuidv4();
      await db.query(
        `INSERT INTO ubicaciones_vehiculo (id, vehiculo_id, latitud, longitud, velocidad_kmh, actualizado_en)
         VALUES (?, ?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE
           latitud = VALUES(latitud),
           longitud = VALUES(longitud),
           velocidad_kmh = VALUES(velocidad_kmh),
           actualizado_en = NOW()`,
        [ubicacionId, id, lat, lng, vel]
      );

      return res.status(200).json({
        success: true,
        mensaje: 'Ubicación actualizada con éxito.',
        datos: {
          vehiculo_id: id,
          placa: veh[0].placa,
          latitud: lat,
          longitud: lng,
          velocidad_kmh: vel,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('[Error al guardar ubicación GPS]:', error);
      return res.status(500).json({
        success: false,
        error: 'Error interno del servidor al registrar la posición GPS.'
      });
    }
  },

  // API Consulta: Obtener coordenadas de toda la flota activa
  obtenerUbicaciones: async (req, res) => {
    try {
      const [vehiculos] = await db.query(`
        SELECT v.id AS vehiculo_id, v.placa, v.modelo, v.conductor_asignado, v.activo,
               u.latitud, u.longitud, u.velocidad_kmh, u.actualizado_en,
               TIMESTAMPDIFF(SECOND, u.actualizado_en, NOW()) AS segundos_desde_actualizacion
        FROM vehiculos v
        LEFT JOIN ubicaciones_vehiculo u ON v.id = u.vehiculo_id
        WHERE v.activo = 1
        ORDER BY v.placa ASC
      `);

      const lista = vehiculos.map(v => {
        let estadoGps = 'SIN_DATOS';
        let textoTiempo = 'Sin señal registrada';

        if (v.latitud !== null && v.longitud !== null) {
          const segs = v.segundos_desde_actualizacion !== null ? v.segundos_desde_actualizacion : 999999;
          if (segs <= 120) {
            estadoGps = 'EN_LINEA';
            textoTiempo = segs < 10 ? 'Ahora mismo' : `Hace ${segs} seg`;
          } else if (segs <= 600) {
            estadoGps = 'SENAL_RECIENTE';
            const mins = Math.floor(segs / 60);
            textoTiempo = `Hace ${mins} min`;
          } else if (segs < 86400) {
            estadoGps = 'DESCONECTADO';
            const horas = Math.floor(segs / 3600);
            textoTiempo = `Hace ${horas} hora(s)`;
          } else {
            estadoGps = 'DESCONECTADO';
            textoTiempo = 'Hace más de 1 día';
          }
        }

        return {
          vehiculo_id: v.vehiculo_id,
          placa: v.placa,
          modelo: v.modelo,
          conductor_asignado: v.conductor_asignado,
          activo: v.activo,
          latitud: v.latitud ? parseFloat(v.latitud) : null,
          longitud: v.longitud ? parseFloat(v.longitud) : null,
          velocidad_kmh: v.velocidad_kmh ? parseFloat(v.velocidad_kmh) : 0.00,
          actualizado_en: v.actualizado_en,
          segundos_desde_actualizacion: v.segundos_desde_actualizacion,
          estado_gps: estadoGps,
          tiempo_relativo: textoTiempo
        };
      });

      return res.status(200).json({
        success: true,
        total: lista.length,
        timestamp: new Date().toISOString(),
        vehiculos: lista
      });
    } catch (error) {
      console.error('[Error al consultar ubicaciones de flota]:', error);
      return res.status(500).json({
        success: false,
        error: 'No se pudieron consultar las ubicaciones de la flota.'
      });
    }
  }
};

module.exports = vehiculosController;
