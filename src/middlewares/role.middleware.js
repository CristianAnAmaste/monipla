function ensureAdmin(req, res, next) {
  if (req.session && req.session.usuario && req.session.usuario.rol === 'admin') {
    return next();
  }

  return res.redirect('/home');
}

module.exports = {
  ensureAdmin,
};
