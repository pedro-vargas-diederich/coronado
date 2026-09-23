require('dotenv').config();
const {
  sequelize,
  Usuario,
  Producto,
  Contacto,
  Vehiculo
} = require('../src/models');

async function resetearBaseDatos() {
  console.log('================================================================');
  console.log('[RESET DB] Iniciando limpieza y reinicio a datos esenciales...');
  console.log('================================================================');

  try {
    // 1. Asegurar sincronización previa de modelos
    await sequelize.sync({ alter: true });

    // 2. Desactivar temporalmente restricciones de llaves foráneas
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');

    // 3. Limpiar tablas transaccionales y operativas (ventas, cotizaciones, comisiones, gastos, telemetría)
    const tablasALimpiar = [
      'detalles_pedido',
      'comisiones',
      'gastos',
      'pedidos',
      'ubicaciones_vehiculo',
      'usuarios',
      'productos',
      'contactos',
      'vehiculos'
    ];

    for (const tabla of tablasALimpiar) {
      await sequelize.query(`TRUNCATE TABLE \`${tabla}\``);
      console.log(`  ✓ Tabla vaciada: ${tabla}`);
    }

    // 4. Reactivar restricciones de llaves foráneas
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('----------------------------------------------------------------');
    console.log('[RESET DB] Insertando únicamente datos esenciales y limpios...');

    // 5. USUARIOS ESENCIALES
    // Claves cifradas con bcrypt (rounds=10)
    // Socio: Socio123!
    // Admin: Admin123!
    // Vendedor: Vendedor123!
    const usuariosEsenciales = [
      {
        id: '00000001-0000-0000-0000-000000000001',
        nombre: 'Roberto Coronado (Socio Director)',
        correo: 'socio@distribuidora.com',
        clave_hash: '$2a$10$Q0gYhfn.Ue35iGZz0LQd2eXY8F/nHT0aLIvtypuTOzyediABdChQK',
        rol: 'SOCIO',
        porcentaje_comision: 0.00,
        activo: true
      },
      {
        id: '00000001-0000-0000-0000-000000000002',
        nombre: 'Marcela Gómez (Administradora)',
        correo: 'admin@distribuidora.com',
        clave_hash: '$2a$10$Z3WEy9h7/2lAH1FGLAa8V.rVYVL0l0yRu0J5kRK9vVywsHFckg9C2',
        rol: 'ADMINISTRADOR',
        porcentaje_comision: 0.00,
        activo: true
      },
      {
        id: '00000001-0000-0000-0000-000000000003',
        nombre: 'Andrés Peñaloza (Asesor Comercial)',
        correo: 'vendedor@distribuidora.com',
        clave_hash: '$2a$10$W4UXTz7J3LmjRzucgDFs7O2x7WQTwB4fRFBshAkIc3YlNKhGUVNuW',
        rol: 'VENDEDOR',
        porcentaje_comision: 3.50,
        activo: true
      }
    ];
    await Usuario.bulkCreate(usuariosEsenciales);
    console.log(`  ✓ ${usuariosEsenciales.length} Usuarios esenciales creados (Socio, Admin, Vendedor)`);

    // 6. PRODUCTOS ESENCIALES (Catálogo con stock fresco inicial)
    const productosEsenciales = [
      {
        id: '00000004-0000-0000-0000-000000000001',
        codigo_sku: 'CEM-PORT-01',
        nombre: 'Cemento Gris Tipo I Uso General',
        categoria: 'Cementos',
        unidad_medida: 'BOLSA',
        precio_compra: 26.50,
        precio_venta: 34.00,
        existencia: 500.00,
        alerta_existencia_minima: 60.00
      },
      {
        id: '00000004-0000-0000-0000-000000000002',
        codigo_sku: 'CEM-ESTR-02',
        nombre: 'Cemento Estructural de Alta Resistencia',
        categoria: 'Cementos',
        unidad_medida: 'BOLSA',
        precio_compra: 29.00,
        precio_venta: 38.50,
        existencia: 300.00,
        alerta_existencia_minima: 50.00
      },
      {
        id: '00000004-0000-0000-0000-000000000003',
        codigo_sku: 'ARE-FINA-03',
        nombre: 'Arena Fina Lavada para Mampostería',
        categoria: 'Agregados',
        unidad_medida: 'M3',
        precio_compra: 55.00,
        precio_venta: 78.00,
        existencia: 100.00,
        alerta_existencia_minima: 20.00
      },
      {
        id: '00000004-0000-0000-0000-000000000004',
        codigo_sku: 'GRA-TRIT-04',
        nombre: 'Grava Triturada 3/4 Pulgada Concretos',
        categoria: 'Agregados',
        unidad_medida: 'M3',
        precio_compra: 62.00,
        precio_venta: 88.00,
        existencia: 80.00,
        alerta_existencia_minima: 15.00
      },
      {
        id: '00000004-0000-0000-0000-000000000005',
        codigo_sku: 'YES-CONS-05',
        nombre: 'Yeso de Construcción y Acabados',
        categoria: 'Acabados',
        unidad_medida: 'BOLSA',
        precio_compra: 14.50,
        precio_venta: 22.00,
        existencia: 150.00,
        alerta_existencia_minima: 25.00
      },
      {
        id: '00000004-0000-0000-0000-000000000006',
        codigo_sku: 'VAR-CORR-06',
        nombre: 'Acero de Refuerzo Varilla 1/2 pulgada',
        categoria: 'Acero',
        unidad_medida: 'TONELADA',
        precio_compra: 720.00,
        precio_venta: 930.00,
        existencia: 20.00,
        alerta_existencia_minima: 3.00
      }
    ];
    await Producto.bulkCreate(productosEsenciales);
    console.log(`  ✓ ${productosEsenciales.length} Productos de catálogo inicializados con stock completo`);

    // 7. VEHÍCULOS ESENCIALES (Para poder crear y despachar pedidos)
    const vehiculosEsenciales = [
      {
        id: '00000002-0000-0000-0000-000000000001',
        placa: 'WTR-892',
        modelo: 'Volqueta Kenworth T880 15m3',
        conductor_asignado: 'Carlos Mendoza',
        activo: true
      },
      {
        id: '00000002-0000-0000-0000-000000000002',
        placa: 'SKL-415',
        modelo: 'Camión Isuzu Forward 8 Ton',
        conductor_asignado: 'Jorge Ramírez',
        activo: true
      }
    ];
    await Vehiculo.bulkCreate(vehiculosEsenciales);
    console.log(`  ✓ ${vehiculosEsenciales.length} Unidades de transporte listas para despachos`);

    // 8. CONTACTOS ESENCIALES (Clientes y proveedores base)
    const contactosEsenciales = [
      {
        id: '00000003-0000-0000-0000-000000000001',
        tipo: 'CLIENTE',
        razon_social: 'Constructora del Valle S.A.S.',
        identificacion_fiscal: 'NIT 900.123.456-1',
        telefono: '3104567890',
        correo: 'compras@valleobras.com',
        direccion: 'Carrera 15 # 85-20, Zona Industrial',
        limite_credito: 50000.00
      },
      {
        id: '00000003-0000-0000-0000-000000000002',
        tipo: 'CLIENTE',
        razon_social: 'Obras Civiles y Estructuras Ltda.',
        identificacion_fiscal: 'NIT 800.789.012-3',
        telefono: '3187654321',
        correo: 'gerencia@obrasciviles.com',
        direccion: 'Calle 45 # 12-34, Bodega 4',
        limite_credito: 25000.00
      },
      {
        id: '00000003-0000-0000-0000-000000000003',
        tipo: 'PROVEEDOR',
        razon_social: 'Cementos Nacionales de Occidente',
        identificacion_fiscal: 'NIT 890.345.678-9',
        telefono: '6013456789',
        correo: 'despachos@cementosnal.com',
        direccion: 'Km 12 Vía al Puerto',
        limite_credito: 0.00
      }
    ];
    await Contacto.bulkCreate(contactosEsenciales);
    console.log(`  ✓ ${contactosEsenciales.length} Contactos (Clientes y Proveedores) creados para cotizar`);

    console.log('================================================================');
    console.log('✅ BASE DE DATOS REINICIADA Y LIMPIA AL 100% PARA TESTING');
    console.log('   - Sin cotizaciones, ventas, comisiones, ni gastos.');
    console.log('   - Usuarios activos:');
    console.log('     * socio@distribuidora.com    / Socio123!');
    console.log('     * admin@distribuidora.com    / Admin123!');
    console.log('     * vendedor@distribuidora.com / Vendedor123!');
    console.log('================================================================');

    process.exit(0);
  } catch (error) {
    console.error('❌ [RESET DB ERROR]:', error);
    process.exit(1);
  }
}

resetearBaseDatos();
