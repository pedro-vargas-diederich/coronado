const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

const contactosController = {
  // Listar contactos (Clientes / Proveedores)
  listar: async (req, res) => {
    try {
      const userRole = req.session.usuario.rol;
      const filtroTipo = req.query.tipo || 'TODOS';

      let query = 'SELECT * FROM contactos WHERE 1=1';
      const params = [];

      // Si es vendedor, solo puede ver Clientes
      if (userRole === 'VENDEDOR') {
        query += " AND tipo IN ('CLIENTE', 'AMBOS')";
      } else if (filtroTipo && filtroTipo !== 'TODOS') {
        query += ' AND (tipo = ? OR tipo = "AMBOS")';
        params.push(filtroTipo);
      }

      query += ' ORDER BY razon_social ASC';

      const [contactos] = await db.query(query, params);

      res.render('contactos/index', {
        title: userRole === 'VENDEDOR' ? 'Directorio de Clientes' : 'Clientes & Proveedores',
        contactos,
        filtroTipo,
        userRole
      });
    } catch (error) {
      console.error('[Error al listar contactos]:', error);
      req.flash('error', 'Error al consultar los contactos.');
      res.redirect('/dashboard');
    }
  },

  // Mostrar formulario de nuevo contacto
  mostrarCrear: (req, res) => {
    const userRole = req.session.usuario.rol;
    res.render('contactos/formulario', {
      title: 'Nuevo Contacto',
      contacto: null,
      accion: '/contactos/nuevo',
      userRole
    });
  },

  // Crear contacto
  crear: async (req, res) => {
    try {
      const userRole = req.session.usuario.rol;
      const { razon_social, identificacion_fiscal, telefono, correo, direccion, limite_credito } = req.body;
      
      // Si el rol es vendedor, solo puede crear CLIENTES
      let tipo = req.body.tipo;
      if (userRole === 'VENDEDOR') {
        tipo = 'CLIENTE';
      }

      if (!razon_social || !identificacion_fiscal) {
        req.flash('error', 'Razón Social e Identificación Fiscal (NIT/RUC) son obligatorios.');
        return res.redirect('/contactos/nuevo');
      }

      const id = uuidv4();
      await db.query(
        `INSERT INTO contactos (id, tipo, razon_social, identificacion_fiscal, telefono, correo, direccion, limite_credito)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          tipo || 'CLIENTE',
          razon_social.trim(),
          identificacion_fiscal.trim().toUpperCase(),
          telefono ? telefono.trim() : null,
          correo ? correo.trim().toLowerCase() : null,
          direccion ? direccion.trim() : null,
          parseFloat(limite_credito) || 0
        ]
      );

      req.flash('success', `Contacto "${razon_social}" registrado exitosamente.`);
      res.redirect('/contactos');
    } catch (error) {
      console.error('[Error al crear contacto]:', error);
      req.flash('error', 'No se pudo guardar el contacto.');
      res.redirect('/contactos/nuevo');
    }
  },

  // Formulario de edición
  mostrarEditar: async (req, res) => {
    try {
      const userRole = req.session.usuario.rol;
      const { id } = req.params;
      const [rows] = await db.query('SELECT * FROM contactos WHERE id = ? LIMIT 1', [id]);

      if (rows.length === 0) {
        req.flash('error', 'Contacto no encontrado.');
        return res.redirect('/contactos');
      }

      res.render('contactos/formulario', {
        title: 'Editar Contacto',
        contacto: rows[0],
        accion: `/contactos/editar/${id}`,
        userRole
      });
    } catch (error) {
      console.error('[Error al cargar contacto]:', error);
      req.flash('error', 'Error al cargar los datos del contacto.');
      res.redirect('/contactos');
    }
  },

  // Actualizar contacto
  actualizar: async (req, res) => {
    try {
      const userRole = req.session.usuario.rol;
      const { id } = req.params;
      const { razon_social, identificacion_fiscal, telefono, correo, direccion, limite_credito } = req.body;

      let tipo = req.body.tipo;
      if (userRole === 'VENDEDOR') {
        tipo = 'CLIENTE';
      }

      await db.query(
        `UPDATE contactos 
         SET tipo = ?, razon_social = ?, identificacion_fiscal = ?, telefono = ?, correo = ?, direccion = ?, limite_credito = ?
         WHERE id = ?`,
        [
          tipo || 'CLIENTE',
          razon_social.trim(),
          identificacion_fiscal.trim().toUpperCase(),
          telefono ? telefono.trim() : null,
          correo ? correo.trim().toLowerCase() : null,
          direccion ? direccion.trim() : null,
          parseFloat(limite_credito) || 0,
          id
        ]
      );

      req.flash('success', 'Información de contacto actualizada.');
      res.redirect('/contactos');
    } catch (error) {
      console.error('[Error al actualizar contacto]:', error);
      req.flash('error', 'No se pudo actualizar el contacto.');
      res.redirect('/contactos');
    }
  }
};

module.exports = contactosController;
