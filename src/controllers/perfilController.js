const bcrypt = require('bcryptjs');
const db = require('../config/database');

const perfilController = {
  /**
   * Mostrar perfil del usuario actual y formulario de cambio de clave
   * GET /perfil/cambiar-clave
   */
  mostrarPerfil: async (req, res) => {
    try {
      const userId = req.session.usuario.id;
      const [rows] = await db.query(
        'SELECT id, nombre, correo, rol, porcentaje_comision, activo, creado_en FROM usuarios WHERE id = ? LIMIT 1',
        [userId]
      );

      if (rows.length === 0) {
        req.flash('error', 'La sesión es inválida o el usuario no existe.');
        return res.redirect('/login');
      }

      res.render('perfil/cambiar-clave', {
        title: 'Mi Perfil y Seguridad',
        usuario: rows[0]
      });
    } catch (error) {
      console.error('[Error al cargar perfil]:', error);
      req.flash('error', 'Ocurrió un error al cargar la información de tu perfil.');
      res.redirect('/dashboard');
    }
  },

  /**
   * Actualizar la propia contraseña con validación estricta de seguridad
   * POST /perfil/cambiar-clave
   */
  actualizarClavePropia: async (req, res) => {
    try {
      const userId = req.session.usuario.id;
      const { clave_actual, clave_nueva, confirmar_clave_nueva } = req.body;

      // 1. Validar que ningún campo venga vacío
      if (!clave_actual || !clave_nueva || !confirmar_clave_nueva) {
        req.flash('error', 'Todos los campos de contraseña son obligatorios.');
        return res.redirect('/perfil/cambiar-clave');
      }

      // 2. Validar longitud mínima de la nueva contraseña
      if (clave_nueva.length < 6) {
        req.flash('error', 'La nueva contraseña debe tener al menos 6 caracteres.');
        return res.redirect('/perfil/cambiar-clave');
      }

      // 3. Validar coincidencia entre nueva contraseña y confirmación
      if (clave_nueva !== confirmar_clave_nueva) {
        req.flash('error', 'La nueva contraseña y su confirmación no coinciden.');
        return res.redirect('/perfil/cambiar-clave');
      }

      // 4. Validar que la nueva contraseña no sea idéntica a la contraseña actual
      if (clave_nueva === clave_actual) {
        req.flash('error', 'La nueva contraseña no puede ser idéntica a la contraseña actual.');
        return res.redirect('/perfil/cambiar-clave');
      }

      // 5. Obtener hash actual de la base de datos
      const [rows] = await db.query(
        'SELECT id, clave_hash FROM usuarios WHERE id = ? LIMIT 1',
        [userId]
      );

      if (rows.length === 0) {
        req.flash('error', 'El usuario no fue localizado en la base de datos.');
        return res.redirect('/login');
      }

      // 6. Comparar contraseña actual con bcrypt
      const claveValida = await bcrypt.compare(clave_actual, rows[0].clave_hash);
      if (!claveValida) {
        req.flash('error', 'La contraseña actual ingresada es incorrecta.');
        return res.redirect('/perfil/cambiar-clave');
      }

      // 7. Generar nuevo hash con bcrypt (10 rondas de salt)
      const salt = await bcrypt.genSalt(10);
      const nuevoHash = await bcrypt.hash(clave_nueva, salt);

      // 8. Actualizar en MySQL
      await db.query(
        'UPDATE usuarios SET clave_hash = ? WHERE id = ?',
        [nuevoHash, userId]
      );

      req.flash('success', 'Tu contraseña ha sido actualizada correctamente.');
      return res.redirect('/perfil/cambiar-clave');

    } catch (error) {
      console.error('[Error al actualizar contraseña propia]:', error);
      req.flash('error', 'No se pudo actualizar la contraseña debido a un error interno.');
      return res.redirect('/perfil/cambiar-clave');
    }
  }
};

module.exports = perfilController;
