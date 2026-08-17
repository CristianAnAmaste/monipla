function ensureAuthenticated(req, res, next) {
  if (req.session && req.session.usuario) {
    return next();
  }

  return res.redirect('/login');
}

function ensureApiAuthenticated(req, res, next) {
  if (req.session && req.session.usuario) {
    return next();
  }

  return res.status(401).json({ error: 'NO_AUTENTICADO' });
}

module.exports = {
  ensureAuthenticated,
  ensureApiAuthenticated,
};
