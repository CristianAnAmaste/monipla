const bcrypt = require('bcrypt');
const AuthRepository = require('../repositories/auth.repository');

class AuthService {
  constructor(authRepository = new AuthRepository()) {
    this.authRepository = authRepository;
  }

  async login(correo, contrasena) {
    if (!correo || !contrasena) {
      return {
        success: false,
        message: 'Debe ingresar correo y contrasena.',
      };
    }

    const correoNormalizado = correo.trim().toLowerCase();
    const usuario = await this.authRepository.findByCorreo(correoNormalizado);

    if (!usuario || usuario.activo !== true && usuario.activo !== 1) {
      return {
        success: false,
        message: 'Credenciales invalidas.',
      };
    }

    const contrasenaValida = await bcrypt.compare(contrasena, usuario.contrasena);

    if (!contrasenaValida) {
      return {
        success: false,
        message: 'Credenciales invalidas.',
      };
    }

    return {
      success: true,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        correo: usuario.correo,
        rol: usuario.rol,
        sede: usuario.sede,
      },
    };
  }
}

module.exports = AuthService;
