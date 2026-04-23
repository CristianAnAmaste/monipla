const { poolPromise, sql } = require('../config/db');

class UsuariosRepository {
  async findAll() {
    const pool = await poolPromise;

    const result = await pool.request().query(`
      SELECT
        id,
        nombre,
        correo,
        rol,
        sede,
        activo,
        fecha_creacion
      FROM usuarios_sistema
      ORDER BY fecha_creacion DESC, nombre ASC
    `);

    return result.recordset;
  }

  async findById(id) {
    const pool = await poolPromise;

    const result = await pool
      .request()
      .input('id', sql.Int, id)
      .query(`
        SELECT TOP 1
          id,
          nombre,
          correo,
          rol,
          sede,
          activo,
          fecha_creacion
        FROM usuarios_sistema
        WHERE id = @id
      `);

    return result.recordset[0] || null;
  }

  async findByCorreo(correo) {
    const pool = await poolPromise;

    const result = await pool
      .request()
      .input('correo', sql.NVarChar(255), correo)
      .query(`
        SELECT TOP 1
          id,
          correo
        FROM usuarios_sistema
        WHERE correo = @correo
      `);

    return result.recordset[0] || null;
  }

  async findByCorreoExcludingId(correo, id) {
    const pool = await poolPromise;

    const result = await pool
      .request()
      .input('correo', sql.NVarChar(255), correo)
      .input('id', sql.Int, id)
      .query(`
        SELECT TOP 1
          id,
          correo
        FROM usuarios_sistema
        WHERE correo = @correo
          AND id <> @id
      `);

    return result.recordset[0] || null;
  }

  async create(usuario) {
    const pool = await poolPromise;

    const result = await pool
      .request()
      .input('nombre', sql.NVarChar(120), usuario.nombre)
      .input('correo', sql.NVarChar(255), usuario.correo)
      .input('contrasena', sql.NVarChar(255), usuario.contrasena)
      .input('rol', sql.NVarChar(20), usuario.rol)
      .input('sede', sql.NVarChar(50), usuario.sede)
      .input('activo', sql.Bit, usuario.activo)
      .query(`
        INSERT INTO usuarios_sistema (
          nombre,
          correo,
          contrasena,
          rol,
          sede,
          activo
        )
        OUTPUT INSERTED.id
        VALUES (
          @nombre,
          @correo,
          @contrasena,
          @rol,
          @sede,
          @activo
        )
      `);

    return result.recordset[0];
  }

  async update(id, usuario) {
    const pool = await poolPromise;

    const result = await pool
      .request()
      .input('id', sql.Int, id)
      .input('nombre', sql.NVarChar(120), usuario.nombre)
      .input('correo', sql.NVarChar(255), usuario.correo)
      .input('rol', sql.NVarChar(20), usuario.rol)
      .input('sede', sql.NVarChar(50), usuario.sede)
      .input('activo', sql.Bit, usuario.activo)
      .query(`
        UPDATE usuarios_sistema
        SET
          nombre = @nombre,
          correo = @correo,
          rol = @rol,
          sede = @sede,
          activo = @activo
        OUTPUT
          INSERTED.id,
          INSERTED.nombre,
          INSERTED.correo,
          INSERTED.rol,
          INSERTED.sede,
          INSERTED.activo,
          INSERTED.fecha_creacion
        WHERE id = @id
      `);

    return result.recordset[0] || null;
  }

  async updatePassword(id, contrasenaHash) {
    const pool = await poolPromise;

    const result = await pool
      .request()
      .input('id', sql.Int, id)
      .input('contrasena', sql.NVarChar(255), contrasenaHash)
      .query(`
        UPDATE usuarios_sistema
        SET contrasena = @contrasena
        OUTPUT INSERTED.id
        WHERE id = @id
      `);

    return result.recordset[0] || null;
  }

  async toggleActivo(id) {
    const pool = await poolPromise;

    const result = await pool
      .request()
      .input('id', sql.Int, id)
      .query(`
        UPDATE usuarios_sistema
        SET activo = CASE WHEN activo = 1 THEN 0 ELSE 1 END
        OUTPUT
          INSERTED.id,
          INSERTED.activo
        WHERE id = @id
      `);

    return result.recordset[0] || null;
  }
}

module.exports = UsuariosRepository;
