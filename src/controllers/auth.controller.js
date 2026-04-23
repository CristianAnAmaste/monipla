const AuthService = require('../services/auth.service');

class AuthController {
  constructor(authService = new AuthService()) {
    this.authService = authService;

    this.showLogin = this.showLogin.bind(this);
    this.login = this.login.bind(this);
    this.logout = this.logout.bind(this);
  }

  showLogin(req, res) {
    if (req.session.usuario) {
      return res.redirect('/home');
    }

    return res.render('layouts/auth', {
      title: 'Iniciar sesion',
      error: null,
      values: {
        correo: '',
      },
    });
  }

  async login(req, res) {
    const { correo, contrasena } = req.body;

    try {
      const result = await this.authService.login(correo, contrasena);

      if (!result.success) {
        return res.status(401).render('layouts/auth', {
          title: 'Iniciar sesion',
          error: result.message,
          values: {
            correo: correo || '',
          },
        });
      }

      req.session.regenerate((regenerateError) => {
        if (regenerateError) {
          console.error('No se pudo regenerar la sesion', regenerateError);

          return res.status(500).render('layouts/auth', {
            title: 'Iniciar sesion',
            error: 'No fue posible iniciar sesion. Intente nuevamente.',
            values: {
              correo: correo || '',
            },
          });
        }

        req.session.usuario = result.usuario;
        return res.redirect('/home');
      });
    } catch (error) {
      console.error('Error durante autenticacion', error);

      return res.status(500).render('layouts/auth', {
        title: 'Iniciar sesion',
        error: 'No fue posible iniciar sesion. Intente nuevamente.',
        values: {
          correo: correo || '',
        },
      });
    }
  }

  logout(req, res) {
    req.session.destroy((error) => {
      if (error) {
        console.error('No se pudo cerrar la sesion', error);
      }

      res.clearCookie('monitoreo.sid');
      return res.redirect('/login');
    });
  }
}

module.exports = AuthController;
