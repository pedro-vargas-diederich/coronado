const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

const productosController = {
  // Listar catálogo de productos
  listar: async (req, res) => {
    try {
      const userRole = req.session.usuario.rol;
      
      // Consulta para traer productos y calcular estados de inventario
      const [productos] = await db.query(
        `SELECT id, codigo_sku, nombre, categoria, unidad_medida, 
                ${userRole === 'VENDEDOR' ? 'NULL AS precio_compra,' : 'precio_compra,'}
                precio_venta, existencia, alerta_existencia_minima,
                (existencia <= alerta_existencia_minima) AS alerta_stock,
                creado_en
         FROM productos 
         ORDER BY categoria ASC, nombre ASC`
      );

      res.render('productos/index', {
        title: 'Inventario & Catálogo',
        productos,
        userRole
      });
    } catch (error) {
      console.error('[Error al listar productos]:', error);
      req.flash('error', 'No se pudo cargar el inventario.');
      res.redirect('/dashboard');
    }
  },

  // Formulario de nuevo producto
  mostrarCrear: (req, res) => {
    res.render('productos/formulario', {
      title: 'Nuevo Producto',
      producto: null,
      accion: '/productos/nuevo'
    });
  },

  // Guardar nuevo producto
  crear: async (req, res) => {
    try {
      const { codigo_sku, nombre, categoria, unidad_medida, precio_compra, precio_venta, existencia, alerta_existencia_minima } = req.body;

      if (!codigo_sku || !nombre || !categoria || !unidad_medida || !precio_venta) {
        req.flash('error', 'Todos los campos marcados con asterisco son obligatorios.');
        return res.redirect('/productos/nuevo');
      }

      // Validar si el SKU ya existe
      const [existente] = await db.query('SELECT id FROM productos WHERE codigo_sku = ? LIMIT 1', [codigo_sku.trim()]);
      if (existente.length > 0) {
        req.flash('error', `El código SKU "${codigo_sku}" ya está registrado.`);
        return res.redirect('/productos/nuevo');
      }

      const id = uuidv4();
      await db.query(
        `INSERT INTO productos (id, codigo_sku, nombre, categoria, unidad_medida, precio_compra, precio_venta, existencia, alerta_existencia_minima)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          codigo_sku.trim().toUpperCase(),
          nombre.trim(),
          categoria.trim(),
          unidad_medida,
          parseFloat(precio_compra) || 0,
          parseFloat(precio_venta) || 0,
          parseFloat(existencia) || 0,
          parseFloat(alerta_existencia_minima) || 10
        ]
      );

      req.flash('success', `Producto "${nombre}" registrado con éxito.`);
      res.redirect('/productos');
    } catch (error) {
      console.error('[Error al crear producto]:', error);
      req.flash('error', 'Error al guardar el producto en el catálogo.');
      res.redirect('/productos/nuevo');
    }
  },

  // Formulario de edición
  mostrarEditar: async (req, res) => {
    try {
      const { id } = req.params;
      const [rows] = await db.query('SELECT * FROM productos WHERE id = ? LIMIT 1', [id]);

      if (rows.length === 0) {
        req.flash('error', 'El producto no fue encontrado.');
        return res.redirect('/productos');
      }

      res.render('productos/formulario', {
        title: 'Editar Producto',
        producto: rows[0],
        accion: `/productos/editar/${id}`
      });
    } catch (error) {
      console.error('[Error al cargar producto]:', error);
      req.flash('error', 'Error al cargar los datos del producto.');
      res.redirect('/productos');
    }
  },

  // Actualizar producto
  actualizar: async (req, res) => {
    try {
      const { id } = req.params;
      const { codigo_sku, nombre, categoria, unidad_medida, precio_compra, precio_venta, existencia, alerta_existencia_minima } = req.body;

      // Verificar SKU único excluyendo el actual
      const [existente] = await db.query('SELECT id FROM productos WHERE codigo_sku = ? AND id != ? LIMIT 1', [codigo_sku.trim(), id]);
      if (existente.length > 0) {
        req.flash('error', `El SKU "${codigo_sku}" ya está en uso por otro producto.`);
        return res.redirect(`/productos/editar/${id}`);
      }

      await db.query(
        `UPDATE productos 
         SET codigo_sku = ?, nombre = ?, categoria = ?, unidad_medida = ?, precio_compra = ?, precio_venta = ?, existencia = ?, alerta_existencia_minima = ?
         WHERE id = ?`,
        [
          codigo_sku.trim().toUpperCase(),
          nombre.trim(),
          categoria.trim(),
          unidad_medida,
          parseFloat(precio_compra) || 0,
          parseFloat(precio_venta) || 0,
          parseFloat(existencia) || 0,
          parseFloat(alerta_existencia_minima) || 10,
          id
        ]
      );

      req.flash('success', 'Producto actualizado correctamente.');
      res.redirect('/productos');
    } catch (error) {
      console.error('[Error al actualizar producto]:', error);
      req.flash('error', 'No se pudo actualizar el producto.');
      res.redirect('/productos');
    }
  }
};

module.exports = productosController;
