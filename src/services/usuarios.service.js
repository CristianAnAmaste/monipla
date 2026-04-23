const bcrypt = require('bcrypt');
const UsuariosRepository = require('../repositories/usuarios.repository');

const ROLES_VALIDOS = ['admin', 'usuario'];
const SEDES_VALIDAS = ['Copiapo', 'Vicuna'];
const BCRYPT_SALT_ROUNDS = 12;

class UsuariosService {
  constructor(usuariosRepository = new UsuariosRepository()) {
    this.usuariosRepository = usuariosRepository;
  }

  async listarUsuarios() {
    return this.usuariosRepository.findAll();
  }

  async obtenerUsuario(id) {
    const usuarioId = this.normalizarId(id);

    if (!usuarioId) {
      return null;
    }

    return this.usuariosRepository.findById(usuarioId);
  }

  async crearUsuario(data) {
    const values = this.normalizarEntrada(data);
    const errors = await this.validarCreacion(values);

    if (errors.length > 0) {
      return {
        success: false,
        errors,
        values: this.limpiarValoresSensibles(values),
      };
    }

    const contrasenaHash = await bcrypt.hash(values.contrasena, BCRYPT_SALT_ROUNDS);

    await this.usuariosRepository.create({
      nombre: values.nombre,
      correo: values.correo,
      contrasena: contrasenaHash,
      rol: values.rol,
      sede: values.sede,
      activo: values.activo,
    });

    return {
      success: true,
    };
  }

  async actualizarUsuario(id, data, usuarioSesion) {
    const usuarioId = this.normalizarId(id);
    const values = this.normalizarEntrada(data);
    const usuarioActual = usuarioId ? await this.usuariosRepository.findById(usuarioId) : null;

    if (!usuarioActual) {
      return {
        success: false,
        notFound: true,
        errors: ['El usuario solicitado no existe.'],
        values: this.limpiarValoresSensibles(values),
      };
    }

    const errors = await this.validarEdicion(usuarioId, values, usuarioSesion);

    if (errors.length > 0) {
      return {
        success: false,
        errors,
        values: this.limpiarValoresSensibles(values),
      };
    }

    const usuarioActualizado = await this.usuariosRepository.update(usuarioId, {
      nombre: values.nombre,
      correo: values.correo,
      rol: values.rol,
      sede: values.sede,
      activo: values.activo,
    });

    return {
      success: true,
      usuario: usuarioActualizado,
    };
  }

  async cambiarPassword(id, data) {
    const usuarioId = this.normalizarId(id);
    const usuario = usuarioId ? await this.usuariosRepository.findById(usuarioId) : null;

    if (!usuario) {
      return {
        success: false,
        notFound: true,
        errors: ['El usuario solicitado no existe.'],
      };
    }

    const values = {
      contrasena: data.contrasena || '',
      confirmarContrasena: data.confirmarContrasena || '',
    };
    const errors = this.validarCambioPassword(values);

    if (errors.length > 0) {
      return {
        success: false,
        errors,
      };
    }

    const contrasenaHash = await bcrypt.hash(values.contrasena, BCRYPT_SALT_ROUNDS);
    await this.usuariosRepository.updatePassword(usuarioId, contrasenaHash);

    return {
      success: true,
    };
  }

  async alternarActivo(id, usuarioSesion) {
    const usuarioId = this.normalizarId(id);
    const usuario = usuarioId ? await this.usuariosRepository.findById(usuarioId) : null;

    if (!usuario) {
      return {
        success: false,
        message: 'El usuario solicitado no existe.',
      };
    }

    if (this.esUsuarioSesion(usuarioId, usuarioSesion)) {
      return {
        success: false,
        message: 'No puede activar o desactivar su propio usuario.',
      };
    }

    const actualizado = await this.usuariosRepository.toggleActivo(usuarioId);

    return {
      success: true,
      activo: actualizado.activo,
    };
  }

  normalizarEntrada(data) {
    return {
      nombre: (data.nombre || '').trim(),
      correo: (data.correo || '').trim().toLowerCase(),
      contrasena: data.contrasena || '',
      confirmarContrasena: data.confirmarContrasena || '',
      rol: data.rol || '',
      sede: data.sede || '',
      activo: data.activo === '1' || data.activo === 'true' || data.activo === true,
    };
  }

  async validarCreacion(values) {
    const errors = [];

    if (!values.nombre) {
      errors.push('El nombre es obligatorio.');
    }

    if (!values.correo) {
      errors.push('El correo es obligatorio.');
    }

    if (!values.contrasena) {
      errors.push('La contrasena es obligatoria.');
    }

    if (!values.confirmarContrasena) {
      errors.push('Debe confirmar la contrasena.');
    }

    if (values.contrasena && values.confirmarContrasena && values.contrasena !== values.confirmarContrasena) {
      errors.push('La contrasena y su confirmacion no coinciden.');
    }

    if (!ROLES_VALIDOS.includes(values.rol)) {
      errors.push('El rol seleccionado no es valido.');
    }

    if (!SEDES_VALIDAS.includes(values.sede)) {
      errors.push('La sede seleccionada no es valida.');
    }

    if (values.correo) {
      const usuarioExistente = await this.usuariosRepository.findByCorreo(values.correo);

      if (usuarioExistente) {
        errors.push('Ya existe un usuario registrado con ese correo.');
      }
    }

    return errors;
  }

  async validarEdicion(id, values, usuarioSesion) {
    const errors = [];

    if (!values.nombre) {
      errors.push('El nombre es obligatorio.');
    }

    if (!values.correo) {
      errors.push('El correo es obligatorio.');
    }

    if (!ROLES_VALIDOS.includes(values.rol)) {
      errors.push('El rol seleccionado no es valido.');
    }

    if (!SEDES_VALIDAS.includes(values.sede)) {
      errors.push('La sede seleccionada no es valida.');
    }

    if (values.correo) {
      const usuarioExistente = await this.usuariosRepository.findByCorreoExcludingId(values.correo, id);

      if (usuarioExistente) {
        errors.push('Ya existe otro usuario registrado con ese correo.');
      }
    }

    if (this.esUsuarioSesion(id, usuarioSesion)) {
      if (values.rol !== 'admin') {
        errors.push('No puede quitarse a si mismo el rol admin.');
      }

      if (!values.activo) {
        errors.push('No puede desactivar su propio usuario.');
      }
    }

    return errors;
  }

  validarCambioPassword(values) {
    const errors = [];

    if (!values.contrasena) {
      errors.push('La nueva contrasena es obligatoria.');
    }

    if (!values.confirmarContrasena) {
      errors.push('Debe confirmar la nueva contrasena.');
    }

    if (values.contrasena && values.confirmarContrasena && values.contrasena !== values.confirmarContrasena) {
      errors.push('La nueva contrasena y su confirmacion no coinciden.');
    }

    return errors;
  }

  limpiarValoresSensibles(values) {
    return {
      nombre: values.nombre,
      correo: values.correo,
      rol: values.rol,
      sede: values.sede,
      activo: values.activo,
    };
  }

  getOpcionesFormulario() {
    return {
      roles: ROLES_VALIDOS,
      sedes: SEDES_VALIDAS,
    };
  }

  normalizarId(id) {
    const usuarioId = Number.parseInt(id, 10);
    return Number.isInteger(usuarioId) && usuarioId > 0 ? usuarioId : null;
  }

  esUsuarioSesion(id, usuarioSesion) {
    return Boolean(usuarioSesion && Number(usuarioSesion.id) === Number(id));
  }
}

module.exports = UsuariosService;
