const DashboardService = require('../services/dashboard.service');

class HomeController {
  constructor(dashboardService = new DashboardService()) {
    this.dashboardService = dashboardService;

    this.index = this.index.bind(this);
  }

  index(req, res) {
    return res.render('layouts/main', {
      title: 'Inicio',
      contentView: '../home/index',
      dashboardCards: this.dashboardService.buildCards(req.session.usuario),
    });
  }
}

module.exports = HomeController;
