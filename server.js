const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ Solo una vez: habilitar CORS
app.use(cors({
  origin: 'https://vicent310.github.io'
}));

// ✅ Solo una vez: body-parser
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ✅ Solo una vez: archivos públicos
app.use(express.static(path.join(__dirname, 'public')));

// ✅ Base de datos
const db = new sqlite3.Database('./db/asistencia.db', (err) => {
  if (err) {
    console.error('❌ Error al conectar con la base de datos:', err.message);
  } else {
    console.log('✅ Conectado a la base de datos asistencia.db');
  }
});

// Ruta para registrar asistencia
app.post('/registrar', (req, res) => {
  const { matricula } = req.body;
  if (!matricula) return res.status(400).json({ mensaje: 'Matrícula vacía' });

  function getFechaLocal() {
    const ahora = new Date();
    ahora.setMinutes(ahora.getMinutes() - ahora.getTimezoneOffset());
    return ahora.toISOString().split('T')[0];
  }
  const fecha = getFechaLocal();  
  const hora = new Date().toTimeString().split(':').slice(0, 2).join(':');

  db.get("SELECT * FROM tabla_usuarios WHERE matricula = ?", [matricula], (err, usuario) => {
    if (err) return res.status(500).json({ mensaje: 'Error al buscar usuario' });
    console.log("🧪 Usuario encontrado:", usuario);  // <-- Agrega esta línea
    if (!usuario) return res.status(404).json({ mensaje: 'Usuario no encontrado' });  

    db.get("SELECT * FROM tabla_registro WHERE matricula = ? AND fecha = ?", [matricula, fecha], (err, registroHoy) => {
      console.log("🔍 Registro encontrado hoy:", registroHoy);
      if (err) return res.status(500).json({ mensaje: 'Error al buscar registro' });

      if (!registroHoy) {
        // Registrar entrada
        db.run(
          "INSERT INTO tabla_registro (matricula, nombres, apellido_paterno, apellido_materno, grado, grupo, ciclo_escolar, tipo, foto, fecha, hora_entrada, hora_salida) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [
            usuario.matricula,
            usuario.nombres,
            usuario.apellido_paterno,
            usuario.apellido_materno,
            usuario.grado,
            usuario.grupo,
            usuario.ciclo_escolar,
            usuario.tipo,
            usuario.foto,
            fecha,
            hora,
            ''
          ],
          function (err) {
            if (err) return res.status(500).json({ mensaje: 'Error al registrar entrada' });
            console.log("✅ Registrando ENTRADA en BD");
            return res.json({
              mensaje: 'Entrada registrada',
              tipo: 'entrada',
              nombre: `${usuario.nombres} ${usuario.apellido_paterno} ${usuario.apellido_materno}`,
              foto: usuario.foto,
              hora
            });
          }
        );

      } else if (registroHoy.hora_entrada && (!registroHoy.hora_salida || registroHoy.hora_salida.trim() === '')) {

        // Registrar salida
        db.run(
          "UPDATE tabla_registro SET hora_salida = ? WHERE id = ?",
          [hora, registroHoy.id],
          function (err) {
            if (err) return res.status(500).json({ mensaje: 'Error al registrar salida' });
            console.log("✅ Registrando SALIDA en BD");
            return res.json({
              mensaje: 'Salida registrada',
              tipo: 'salida',
              nombre: `${usuario.nombres} ${usuario.apellido_paterno} ${usuario.apellido_materno}`,
              foto: usuario.foto,
              hora
            });
          }
        );

      } else {
        // Ya tiene entrada y salida
        return res.json({
          mensaje: 'Ya tiene entrada y salida registradas para hoy',
          tipo: 'ya_registrado',
          nombre: `${usuario.nombres} ${usuario.apellido_paterno} ${usuario.apellido_materno}`,
          foto: usuario.foto,
          hora
        });
      }
    });
  });
});


// Ruta login
app.post('/login', (req, res) => {
  const { usuario, password } = req.body;
  if (usuario === 'admin' && password === '1234') {
    return res.json({ success: true });
  }
  res.json({ success: false, mensaje: 'Usuario o contraseña incorrectos' });
});

// Ruta para obtener registros
app.get('/registros', (req, res) => {
  db.all("SELECT * FROM tabla_registro ORDER BY id DESC", [], (err, rows) => {
    if (err) return res.status(500).json([]);
    res.json(rows);
  });
});

// Ruta para actualizar horarios
app.post('/actualizar-horarios', (req, res) => {
  const { id, entrada, salida } = req.body;
  db.run(
    "UPDATE tabla_registro SET hora_entrada = ?, hora_salida = ? WHERE id = ?",
    [entrada, salida, id],
    function (err) {
      if (err) return res.status(500).json({ success: false, mensaje: 'Error al actualizar horarios' });
      res.json({ success: true, mensaje: 'Horarios actualizados correctamente' });
    }
  );
});

// Ruta para eliminar registro
app.post('/eliminar-registro', (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ success: false, mensaje: 'ID inválido' });

  db.run("DELETE FROM tabla_registro WHERE id = ?", [id], function (err) {
    if (err) return res.status(500).json({ success: false, mensaje: 'Error al eliminar registro' });
    res.json({ success: true, mensaje: 'Registro eliminado correctamente' });
  });
});
app.post('/registrar-usuario', (req, res) => {
  const { matricula, nombres, apellido_paterno, apellido_materno, grado, grupo, ciclo_escolar, tipo, foto } = req.body;

  db.run(
    `INSERT INTO tabla_usuarios (matricula, nombres, apellido_paterno, apellido_materno, grado, grupo, ciclo_escolar, tipo, foto)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [matricula, nombres, apellido_paterno, apellido_materno, grado, grupo, ciclo_escolar, tipo, foto],
    function (err) {
      if (err) return res.status(500).json({ success: false, mensaje: 'Error al registrar usuario' });
      res.json({ success: true, mensaje: '✅ Usuario registrado correctamente' });
    }
  );
});
app.get('/usuarios', (req, res) => {
  db.all("SELECT * FROM tabla_usuarios ORDER BY tipo, grado, grupo", [], (err, rows) => {
    if (err) return res.status(500).json([]);
    res.json(rows);
  });
});
// Ruta para eliminar un usuario y todos sus registros
app.post('/eliminar-usuario', (req, res) => {
  const { matricula } = req.body;
  if (!matricula) return res.status(400).json({ success: false, mensaje: "Matrícula no proporcionada" });

  db.serialize(() => {
    // 1. Borrar asistencias
    db.run("DELETE FROM tabla_registro WHERE matricula = ?", [matricula], function (err) {
      if (err) return res.status(500).json({ success: false, mensaje: 'Error al eliminar asistencias del usuario' });

      // 2. Borrar usuario
      db.run("DELETE FROM tabla_usuarios WHERE matricula = ?", [matricula], function (err) {
        if (err) return res.status(500).json({ success: false, mensaje: 'Error al eliminar usuario' });

        return res.json({ success: true, mensaje: '🗑️ Usuario y registros eliminados correctamente' });
      });
    });
  });
});
app.post('/login-docente', (req, res) => {
  console.log("🔐 Petición recibida a /login-docente:", req.body);

  const { usuario, password } = req.body;

  db.get('SELECT * FROM tabla_admon WHERE usuario = ? AND contrasena = ?', [usuario, password], (err, row) => {
    if (err) {
      console.error("❌ Error en la consulta SQL:", err.message);  // 👈 esto ayudará a saber qué está fallando
      return res.status(500).json({ success: false, mensaje: 'Error del servidor (consulta)' });
    }

    if (!row) {
      console.warn("⚠️ Usuario no encontrado o contraseña incorrecta");
      return res.status(401).json({ success: false, mensaje: 'Usuario o contraseña incorrectos' });
    }

    if (row.tipo === 'administrativo') {
      return res.json({ success: true, redireccion: 'panel_admon.html' });
    } else if (row.tipo === 'docente') {
      return res.json({ success: true, redireccion: 'panel_docente.html' });
    } else {
      console.warn("⚠️ Tipo de usuario no reconocido:", row.tipo);
      return res.status(400).json({ success: false, mensaje: 'Tipo de usuario no reconocido' });
    }
  });
});

// Ruta raíz para mostrar que el backend está activo
app.get('/', (req, res) => {
  res.send('✅ Backend de asistencia funcionando correctamente');
});
// 🔍 Ruta temporal para ver los últimos 20 registros guardados
app.get('/debug-registros', (req, res) => {
  db.all("SELECT * FROM tabla_registro ORDER BY id DESC LIMIT 20", [], (err, rows) => {
    if (err) {
      console.error("❌ Error al obtener registros:", err.message);
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});
// Última modificación para activación en Render
