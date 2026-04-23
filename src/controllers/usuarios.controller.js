const UsuariosService = require('../services/usuarios.service');

class UsuariosController {
  constructor(usuariosService = new UsuariosService()) {
    this.usuariosService = usuariosService;

    this.index = this.index.bind(this);
    this.nuevo = this.nuevo.bind(this);
    this.crear = this.crear.bind(this);
    this.editar = this.editar.bind(this);
    this.actualizar = this.actualizar.bind(this);
    this.cambiarPassword = this.cambiarPassword.bind(this);
    this.guardarPassword = this.guardarPassword.bind(this);
    this.toggleActivo = this.toggleActivo.bind(this);
  }

  async index(req, res) {
    try {
      const usuarios = await this.usuariosService.listarUsuarios();

      return res.render('layouts/main', {
        title: 'Usuarios',
        contentView: '../usuarios/index',
        usuarios,
        success: this.getMensajeExito(req.query),
        error: this.getMensajeError(req.query),
      });
    } catch (error) {
      console.error('Error al listar usuarios', error);

      return res.status(500).render('layouts/main', {
        title: 'Usuarios',
        contentView: '../usuarios/index',
        usuarios: [],
        success: null,
        error: 'No fue posible cargar el listado de usuarios.',
      });
    }
  }

  nuevo(req, res) {
    return res.render('layouts/main', {
      title: 'Nuevo usuario',
      contentView: '../usuarios/nuevo',
      errors: [],
      values: this.getValoresIniciales(),
      opciones: this.usuariosService.getOpcionesFormulario(),
    });
  }

  async crear(req, res) {
    try {
      const result = await this.usuariosService.crearUsuario(req.body);

      if (!result.success) {
        return res.status(400).render('layouts/main', {
          title: 'Nuevo usuario',
          contentView: '../usuarios/nuevo',
          errors: result.errors,
          values: result.values,
          opciones: this.usuariosService.getOpcionesFormulario(),
        });
      }

      return res.redirect('/usuarios?creado=1');
    } catch (error) {
      console.error('Error al crear usuario', error);

      return res.status(500).render('layouts/main', {
        title: 'Nuevo usuario',
        contentView: '../usuarios/nuevo',
        errors: ['No fue posible crear el usuario. Intente nuevamente.'],
        values: {
          ...this.getValoresIniciales(),
          ...req.body,
          contrasena: '',
          confirmarContrasena: '',
        },
        opciones: this.usuariosService.getOpcionesFormulario(),
      });
    }
  }

  async editar(req, res) {
    try {
      const usuarioEditar = await this.usuariosService.obtenerUsuario(req.params.id);

      if (!usuarioEditar) {
        return res.redirect('/usuarios?error=no-encontrado');
      }

      return res.render('layouts/main', {
        title: 'Editar usuario',
        contentView: '../usuarios/editar',
        errors: [],
        values: usuarioEditar,
        opciones: this.usuariosService.getOpcionesFormulario(),
      });
    } catch (error) {
      console.error('Error al cargar usuario para edicion', error);
      return res.redirect('/usuarios?error=carga-edicion');
    }
  }

  async actualizar(req, res) {
    try {
      const result = await this.usuariosService.actualizarUsuario(req.params.id, req.body, req.session.usuario);

      if (!result.success) {
        return res.status(result.notFound ? 404 : 400).render('layouts/main', {
          title: 'Editar usuario',
          contentView: '../usuarios/editar',
          errors: result.errors,
          values: {
            id: req.params.id,
            ...result.values,
          },
          opciones: this.usuariosService.getOpcionesFormulario(),
        });
      }

      if (Number(req.session.usuario.id) === Number(result.usuario.id)) {
        req.session.usuario = {
          ...req.session.usuario,
          nombre: result.usuario.nombre,
          correo: result.usuario.correo,
          rol: result.usuario.rol,
          sede: result.usuario.sede,
        };
      }

      return res.redirect('/usuarios?actualizado=1');
    } catch (error) {
      console.error('Error al actualizar usuario', error);

      return res.status(500).render('layouts/main', {
        title: 'Editar usuario',
        contentView: '../usuarios/editar',
        errors: ['No fue posible actualizar el usuario. Intente nuevamente.'],
        values: {
          id: req.params.id,
          ...req.body,
          activo: req.body.activo === '1',
        },
        opciones: this.usuariosService.getOpcionesFormulario(),
      });
    }
  }

  async cambiarPassword(req, res) {
    try {
      const usuarioEditar = await this.usuariosService.obtenerUsuario(req.params.id);

      if (!usuarioEditar) {
        return res.redirect('/usuarios?error=no-encontrado');
      }

      return res.render('layouts/main', {
        title: 'Cambiar contrasena',
        contentView: '../usuarios/cambiar-password',
        errors: [],
        usuarioEditar,
      });
    } catch (error) {
      console.error('Error al cargar cambio de contrasena', error);
      return res.redirect('/usuarios?error=carga-password');
    }
  }

  async guardarPassword(req, res) {
    try {
      const usuarioEditar = await this.usuariosService.obtenerUsuario(req.params.id);

      if (!usuarioEditar) {
        return res.redirect('/usuarios?error=no-encontrado');
      }

      const result = await this.usuariosService.cambiarPassword(req.params.id, req.body);

      if (!result.success) {
        return res.status(result.notFound ? 404 : 400).render('layouts/main', {
          title: 'Cambiar contrasena',
          contentView: '../usuarios/cambiar-password',
          errors: result.errors,
          usuarioEditar,
        });
      }

      return res.redirect('/usuarios?password=1');
    } catch (error) {
      console.error('Error al cambiar contrasena', error);

      return res.status(500).render('layouts/main', {
        title: 'Cambiar contrasena',
        contentView: '../usuarios/cambiar-password',
        errors: ['No fue posible actualizar la contrasena. Intente nuevamente.'],
        usuarioEditar: {
          id: req.params.id,
          nombre: '',
          correo: '',
        },
      });
    }
  }

  async toggleActivo(req, res) {
    try {
      const result = await this.usuariosService.alternarActivo(req.params.id, req.session.usuario);

      if (!result.success) {
        return res.redirect(`/usuarios?error=${encodeURIComponent(result.message)}`);
      }

      return res.redirect('/usuarios?activo=1');
    } catch (error) {
      console.error('Error al alternar estado de usuario', error);
      return res.redirect('/usuarios?error=estado');
    }
  }

  getValoresIniciales() {
    return {
      nombre: '',
      correo: '',
      rol: 'usuario',
      sede: 'Copiapo',
      activo: true,
    };
  }

  getMensajeExito(query) {
    if (query.creado === '1') {
      return 'Usuario creado correctamente.';
    }

    if (query.actualizado === '1') {
      return 'Usuario actualizado correctamente.';
    }

    if (query.password === '1') {
      return 'Contrasena actualizada correctamente.';
    }

    if (query.activo === '1') {
      return 'Estado del usuario actualizado correctamente.';
    }

    return null;
  }

  getMensajeError(query) {
    const errores = {
      'no-encontrado': 'El usuario solicitado no existe.',
      'carga-edicion': 'No fue posible cargar el formulario de edicion.',
      'carga-password': 'No fue posible cargar el formulario de contrasena.',
      estado: 'No fue posible actualizar el estado del usuario.',
    };

    if (!query.error) {
      return null;
    }

    return errores[query.error] || query.error;
  }
}

module.exports = UsuariosController;
