require('dotenv').config();
const session = require('express-session');

const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'distribuidora_materiales_clave_secreta_2026',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 12, // 12 horas de duración de sesión activa
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
  }
};

module.exports = session(sessionConfig);
