require('dotenv').config();
const {
  sequelize,
  Usuario,
  Vehiculo,
  Contacto,
  Producto
} = require('../src/models');

async function seed() {
  try {
    console.log('[Seed] Conectando y sincronizando modelos...');
    await sequelize.sync({ alter: true });

    // 1. Usuarios iniciales
    const usuarios = [
      {
        id: '00000001-0000-0000-0000-000000000001',
        nombre: 'Roberto Coronado (Socio Director)',
        correo: 'socio@distribuidora.com',
        clave_hash: '$2a$10$Q0gYhfn.Ue35iGZz0LQd2eXY8F/nHT0aLIvtypuTOzyediABdChQK', // Socio123!
        rol: 'SOCIO',
        porcentaje_comision: 0.00,
        activo: true
      },
      {
        id: '00000001-0000-0000-0000-000000000002',
        nombre: 'Marcela Gómez (Administradora)',
        correo: 'admin@distribuidora.com',
        clave_hash: '$2a$10$Z3WEy9h7/2lAH1FGLAa8V.rVYVL0l0yRu0J5kRK9vVywsHFckg9C2', // Admin123!
        rol: 'ADMINISTRADOR',
        porcentaje_comision: 0.00,
        activo: true
      },
      {
        id: '00000001-0000-0000-0000-000000000003',
        nombre: 'Andrés Peñaloza (Asesor Comercial)',
        correo: 'vendedor@distribuidora.com',
        clave_hash: '$2a$10$W4UXTz7J3LmjRzucgDFs7O2x7WQTwB4fRFBshAkIc3YlNKhGUVNuW', // Vendedor123!
        rol: 'VENDEDOR',
        porcentaje_comision: 3.50,
        activo: true
      }
    ];

    for (const u of usuarios) {
      const [user, created] = await Usuario.findOrCreate({
        where: { correo: u.correo },
        defaults: u
      });
      if (created) console.log(`✓ Usuario creado: ${u.correo} (${u.rol})`);
    }

    // 2. Vehículos iniciales
    const vehiculos = [
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

    for (const v of vehiculos) {
      const [veh, created] = await Vehiculo.findOrCreate({
        where: { placa: v.placa },
        defaults: v
      });
      if (created) console.log(`✓ Vehículo registrado: ${v.placa} - ${v.modelo}`);
    }

    // 3. Contactos iniciales
    const contactos = [
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

    for (const c of contactos) {
      const [cont, created] = await Contacto.findOrCreate({
        where: { identificacion_fiscal: c.identificacion_fiscal },
        defaults: c
      });
      if (created) console.log(`✓ Contacto creado: ${c.razon_social} (${c.tipo})`);
    }

    // 4. Catálogo de Productos inicial
    const productos = [
      {
        id: '00000004-0000-0000-0000-000000000001',
        codigo_sku: 'CEM-PORT-01',
        nombre: 'Cemento Gris Tipo I Uso General',
        categoria: 'Cementos',
        unidad_medida: 'BOLSA',
        precio_compra: 26.50,
        precio_venta: 34.00,
        existencia: 480.00,
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
        existencia: 310.00,
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
        existencia: 95.00,
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
        existencia: 70.00,
        alerta_existencia_minima: 15.00
      }
    ];

    for (const p of productos) {
      const [prod, created] = await Producto.findOrCreate({
        where: { codigo_sku: p.codigo_sku },
        defaults: p
      });
      if (created) console.log(`✓ Producto creado: ${p.nombre} (${p.codigo_sku})`);
    }

    console.log('[Seed] Datos semilla listos con éxito.');
    process.exit(0);
  } catch (error) {
    console.error('[Seed Error]:', error);
    process.exit(1);
  }
}

seed();
