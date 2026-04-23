const { poolPromise, sql } = require('../config/db');

class AuthRepository {
  async findByCorreo(correo) {
    const pool = await poolPromise;

    const result = await pool
      .request()
      .input('correo', sql.NVarChar(255), correo)
      .query(`
        SELECT TOP 1
          id,
          nombre,
          correo,
          rol,
          sede,
          contrasena,
          activo
        FROM usuarios_sistema
        WHERE correo = @correo
      `);

    return result.recordset[0] || null;
  }
}

module.exports = AuthRepository;
