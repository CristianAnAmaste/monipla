class CatalogoSdpService {
  constructor(catalogoSdpRepository = null) {
    this.catalogoSdpRepository = catalogoSdpRepository
      || new (require('../repositories/catalogoSdp.repository'))();
  }

  async listarFondosDisponibles() {
    return this.catalogoSdpRepository.findFondosDisponibles();
  }

  async listarCamposPorFundo(genFundo) {
    return this.catalogoSdpRepository.findCamposByFundo(genFundo);
  }

  async listarVariedadesPorFundoCampo(genFundo, genCampo) {
    return this.catalogoSdpRepository.findVariedadesByFundoCampo(genFundo, genCampo);
  }

  async listarCuartelesPorFiltros(genFundo, genCampo, genVariedad) {
    return this.catalogoSdpRepository.findCuartelesByFiltros(
      genFundo,
      genCampo,
      genVariedad
    );
  }

  async resolverCanonicoPorId(idCatalogoSdp, seleccion, transaction = null) {
    const filas = await this.catalogoSdpRepository.findByIdActivoConSdp(
      idCatalogoSdp,
      transaction
    );

    return this.resolverFilasCanonicas(filas, seleccion);
  }

  resolverFilasCanonicas(filas, seleccion = {}) {
    if (!Array.isArray(filas) || filas.length === 0) {
      throw new Error('CATALOGO_SDP_MB_NO_DISPONIBLE');
    }

    if (filas.length !== 1) {
      throw new Error('CATALOGO_SDP_MB_NO_CANONICO');
    }

    const [catalogo] = filas;
    const filaNoDisponible = (catalogo.activo !== true && catalogo.activo !== 1)
      || catalogo.sdp === null
      || catalogo.sdp === undefined;

    if (filaNoDisponible) {
      throw new Error('CATALOGO_SDP_MB_NO_DISPONIBLE');
    }

    const seleccionInconsistente = Number(catalogo.gen_fundo) !== seleccion.genFundo
      || Number(catalogo.gen_campo) !== seleccion.genCampo
      || Number(catalogo.gen_variedad) !== seleccion.genVariedad;

    if (seleccionInconsistente) {
      throw new Error('CATALOGO_SDP_MB_SELECCION_INVALIDA');
    }

    return catalogo;
  }
}

module.exports = CatalogoSdpService;
