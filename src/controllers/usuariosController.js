const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const db = require('../config/database');

const usuariosController = {
  // Listar usuarios internos agrupados
  listar: async (req, res) => {
    try {
      const [usuarios] = await db.query(`
        SELECT id, nombre, correo, rol, porcentaje_comision, activo, creado_en
        FROM usuarios
        ORDER BY FIELD(rol, 'SOCIO', 'ADMINISTRADOR', 'VENDEDOR'), nombre ASC
      `);

      // Agrupación por roles para facilitar la visualización en pestañas o bloques
      const socios = usuarios.filter(u => u.rol === 'SOCIO');
      const administradores = usuarios.filter(u => u.rol === 'ADMINISTRADOR');
      const vendedores = usuarios.filter(u => u.rol === 'VENDEDOR');

      res.render('usuarios/index', {
        title: 'Gestión de Usuarios y Personal',
        usuarios,
        socios,
        administradores,
        vendedores,
        currentUserId: req.session.usuario.id
      });
    } catch (error) {
      console.error('[Error al listar usuarios]:', error);
      req.flash('error', 'No se pudo cargar la lista de usuarios.');
      res.redirect('/dashboard');
    }
  },

  // Mostrar formulario de creación de usuario
  mostrarCrear: (req, res) => {
    res.render('usuarios/formulario', {
      title: 'Registrar Usuario del Sistema',
      usuario: null,
      accion: '/usuarios/nuevo'
    });
  },

  // Registrar nuevo usuario con hash de contraseña
  crear: async (req, res) => {
    try {
      const { nombre, correo, clave, rol, porcentaje_comision } = req.body;

      if (!nombre || !correo || !clave || !rol) {
        req.flash('error', 'Todos los campos marcados con asterisco son obligatorios.');
        return res.redirect('/usuarios/nuevo');
      }

      // Validar si el correo ya existe
      const correoLimpio = correo.trim().toLowerCase();
      const [existente] = await db.query(
        'SELECT id FROM usuarios WHERE correo = ? LIMIT 1',
        [correoLimpio]
      );

      if (existente.length > 0) {
        req.flash('error', `El correo electrónico "${correoLimpio}" ya está registrado.`);
        return res.redirect('/usuarios/nuevo');
      }

      // Validación condicional del porcentaje de comisión para VENDEDOR
      let comisionFinal = 0.00;
      if (rol === 'VENDEDOR') {
        const comisionNum = parseFloat(porcentaje_comision);
        if (isNaN(comisionNum) || comisionNum < 0) {
          req.flash('error', 'Para el rol VENDEDOR es obligatorio especificar un porcentaje de comisión válido (ej. 3.50%).');
          return res.redirect('/usuarios/nuevo');
        }
        comisionFinal = comisionNum;
      }

      // Cifrado de contraseña con bcryptjs
      const salt = await bcrypt.genSalt(10);
      const claveHash = await bcrypt.hash(clave, salt);

      const id = uuidv4();
      await db.query(
        `INSERT INTO usuarios (id, nombre, correo, clave_hash, rol, porcentaje_comision, activo)
         VALUES (?, ?, ?, ?, ?, ?, 1)`,
        [
          id,
          nombre.trim(),
          correoLimpio,
          claveHash,
          rol,
          comisionFinal
        ]
      );

      req.flash('success', `Usuario ${nombre.trim()} (${rol}) creado exitosamente.`);
      res.redirect('/usuarios');

    } catch (error) {
      console.error('[Error al crear usuario]:', error);
      req.flash('error', 'Ocurrió un error al registrar el usuario.');
      res.redirect('/usuarios/nuevo');
    }
  },

  // Alternar estado activo / inactivo (bloqueo de acceso)
  alternarEstado: async (req, res) => {
    try {
      const { id } = req.params;
      const currentUserId = req.session.usuario.id;

      // Medida de seguridad: El socio no puede desactivarse a sí mismo
      if (id === currentUserId) {
        req.flash('error', 'Por seguridad, no puedes desactivar tu propia cuenta en uso.');
        return res.redirect('/usuarios');
      }

      const [rows] = await db.query('SELECT id, nombre, activo FROM usuarios WHERE id = ? LIMIT 1', [id]);
      if (rows.length === 0) {
        req.flash('error', 'El usuario especificado no existe.');
        return res.redirect('/usuarios');
      }

      const usuario = rows[0];
      const nuevoEstado = usuario.activo ? 0 : 1;

      await db.query('UPDATE usuarios SET activo = ? WHERE id = ?', [nuevoEstado, id]);

      const accionTexto = nuevoEstado ? 'reactivada' : 'desactivada (acceso revocado)';
      req.flash('success', `La cuenta de ${usuario.nombre} ha sido ${accionTexto}.`);
      res.redirect('/usuarios');

    } catch (error) {
      console.error('[Error al alternar estado de usuario]:', error);
      req.flash('error', 'No se pudo modificar el estado de la cuenta.');
      res.redirect('/usuarios');
    }
  },

  // Mostrar formulario de edición de usuario
  mostrarFormularioEditar: async (req, res) => {
    try {
      const { id } = req.params;
      const [rows] = await db.query(
        'SELECT id, nombre, correo, rol, porcentaje_comision, activo FROM usuarios WHERE id = ? LIMIT 1',
        [id]
      );

      if (rows.length === 0) {
        req.flash('error', 'El usuario solicitado no fue encontrado.');
        return res.redirect('/usuarios');
      }

      res.render('usuarios/editar', {
        title: `Editar Usuario: ${rows[0].nombre}`,
        usuario: rows[0],
        accion: `/usuarios/${id}/editar`,
        currentUserId: req.session.usuario.id
      });
    } catch (error) {
      console.error('[Error al cargar usuario para editar]:', error);
      req.flash('error', 'Error al cargar los datos del usuario.');
      res.redirect('/usuarios');
    }
  },

  // Procesar actualización completa del usuario
  actualizarUsuario: async (req, res) => {
    try {
      const { id } = req.params;
      const currentUserId = req.session.usuario.id;
      const { nombre, correo, nueva_clave, rol, porcentaje_comision, activo } = req.body;

      if (!nombre || !correo || !rol) {
        req.flash('error', 'Los campos nombre, correo y rol son obligatorios.');
        return res.redirect(`/usuarios/${id}/editar`);
      }

      const correoLimpio = correo.trim().toLowerCase();

      // Validar correo único para otros usuarios
      const [existente] = await db.query(
        'SELECT id FROM usuarios WHERE correo = ? AND id != ? LIMIT 1',
        [correoLimpio, id]
      );

      if (existente.length > 0) {
        req.flash('error', `El correo "${correoLimpio}" ya está en uso por otro usuario.`);
        return res.redirect(`/usuarios/${id}/editar`);
      }

      // Validar datos si es el usuario actual en sesión
      let rolFinal = rol;
      let estadoActivo = (activo === '1' || activo === 1 || activo === 'on') ? 1 : 0;
      if (id === currentUserId) {
        // Un socio no puede quitarse su propio rol de SOCIO ni desactivarse a sí mismo
        rolFinal = 'SOCIO';
        estadoActivo = 1;
      }

      // Validar porcentaje de comisión
      let comisionFinal = 0.00;
      if (rolFinal === 'VENDEDOR') {
        const comisionNum = parseFloat(porcentaje_comision);
        if (isNaN(comisionNum) || comisionNum < 0) {
          req.flash('error', 'Para el rol VENDEDOR es obligatorio especificar un porcentaje de comisión válido.');
          return res.redirect(`/usuarios/${id}/editar`);
        }
        comisionFinal = comisionNum;
      }

      // Manejo seguro de contraseña: si viene vacía se conserva la actual
      if (nueva_clave && nueva_clave.trim().length > 0) {
        const salt = await bcrypt.genSalt(10);
        const claveHash = await bcrypt.hash(nueva_clave.trim(), salt);

        await db.query(
          `UPDATE usuarios 
           SET nombre = ?, correo = ?, clave_hash = ?, rol = ?, porcentaje_comision = ?, activo = ?
           WHERE id = ?`,
          [nombre.trim(), correoLimpio, claveHash, rolFinal, comisionFinal, estadoActivo, id]
        );
      } else {
        // Mantener la contraseña actual sin sobreescribir clave_hash
        await db.query(
          `UPDATE usuarios 
           SET nombre = ?, correo = ?, rol = ?, porcentaje_comision = ?, activo = ?
           WHERE id = ?`,
          [nombre.trim(), correoLimpio, rolFinal, comisionFinal, estadoActivo, id]
        );
      }

      // Si el socio editó sus propios datos, actualizar la sesión activa
      if (id === currentUserId) {
        req.session.usuario.nombre = nombre.trim();
        req.session.usuario.correo = correoLimpio;
      }

      req.flash('success', `Usuario ${nombre.trim()} actualizado correctamente.`);
      res.redirect('/usuarios');

    } catch (error) {
      console.error('[Error al actualizar usuario]:', error);
      req.flash('error', 'No se pudo actualizar la información del usuario.');
      res.redirect(`/usuarios/${req.params.id}/editar`);
    }
  }
};

module.exports = usuariosController;
