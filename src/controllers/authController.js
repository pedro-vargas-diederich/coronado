const bcrypt = require('bcryptjs');
const db = require('../config/database');

const authController = {
  // Mostrar formulario de login
  showLogin: (req, res) => {
    if (req.session && req.session.usuario) {
      if (req.session.usuario.rol === 'VENDEDOR') {
        return res.redirect('/pedidos');
      }
      return res.redirect('/dashboard');
    }
    res.render('auth/login', {
      title: 'Iniciar Sesión',
      layout: 'layouts/main'
    });
  },

  // Procesar autenticación
  login: async (req, res) => {
    try {
      const { correo, clave } = req.body;

      if (!correo || !clave) {
        req.flash('error', 'Por favor ingresa tu correo y contraseña.');
        return res.redirect('/login');
      }

      const [rows] = await db.query(
        'SELECT * FROM usuarios WHERE correo = ? LIMIT 1',
        [correo.trim().toLowerCase()]
      );

      if (rows.length === 0) {
        req.flash('error', 'Credenciales incorrectas o usuario no registrado.');
        return res.redirect('/login');
      }

      const usuario = rows[0];

      if (!usuario.activo) {
        req.flash('error', 'Tu cuenta de usuario se encuentra inactiva. Contacta a un administrador.');
        return res.redirect('/login');
      }

      const match = await bcrypt.compare(clave, usuario.clave_hash);
      if (!match) {
        req.flash('error', 'Credenciales incorrectas o usuario no registrado.');
        return res.redirect('/login');
      }

      // Guardar información en sesión (excluyendo hash)
      req.session.usuario = {
        id: usuario.id,
        nombre: usuario.nombre,
        correo: usuario.correo,
        rol: usuario.rol,
        porcentaje_comision: Number(usuario.porcentaje_comision) || 0
      };

      req.flash('success', `¡Bienvenido al sistema, ${usuario.nombre}!`);

      // Redirección contextual por rol
      if (usuario.rol === 'VENDEDOR') {
        return res.redirect('/pedidos');
      }
      return res.redirect('/dashboard');

    } catch (error) {
      console.error('[Error en Login]:', error);
      req.flash('error', 'Ocurrió un error inesperado al procesar el ingreso.');
      return res.redirect('/login');
    }
  },

  // Cerrar sesión
  logout: (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error('[Error al destruir sesión]:', err);
      }
      res.redirect('/login');
    });
  }
};

module.exports = authController;
