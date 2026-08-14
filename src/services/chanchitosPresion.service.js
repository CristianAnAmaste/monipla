const ESTADOS = Object.freeze({
  1: 'OVISACO',
  2: 'NINFA',
  3: 'ADULTO',
});

const POSICIONES = Object.freeze({
  1: 'BASE_CORTEZA',
  2: 'BASE_BROTE',
  3: 'HOJA',
  4: 'RACIMO',
});

const COLORES = Object.freeze({
  NULA: '#d9f2d9',
  BAJA: '#cfe6ff',
  MEDIA: '#fff59d',
  ALTA: '#ffb3b3',
  NO_APLICA: '#eeeeee',
});

const ETIQUETAS = Object.freeze({
  NULA: 'Nula',
  BAJA: 'Baja',
  MEDIA: 'Media',
  ALTA: 'Alta',
  NO_APLICA: 'No aplica',
});

class ChanchitosPresionService {
  clasificarPresion({ idEstadoMonitoreo, idEstadoPosicion, cantidad, cantPlantas }) {
    const estado = ESTADOS[Number(idEstadoMonitoreo)] || null;
    const posicion = POSICIONES[Number(idEstadoPosicion)] || null;
    const cantidadNormalizada = Number(cantidad);
    const plantasNormalizadas = Number(cantPlantas);

    if (!estado || !posicion || !Number.isFinite(cantidadNormalizada) || cantidadNormalizada < 0
      || !Number.isFinite(plantasNormalizadas) || plantasNormalizadas <= 0) {
      return this.crearResultado('NO_APLICA', null, cantidadNormalizada, plantasNormalizadas);
    }

    const presion = Math.ceil(cantidadNormalizada / plantasNormalizadas);

    if (presion <= 0) {
      return this.crearResultado('NULA', 0, cantidadNormalizada, plantasNormalizadas);
    }

    return this.crearResultado(
      this.resolverNivel(estado, posicion, presion),
      presion,
      cantidadNormalizada,
      plantasNormalizadas
    );
  }

  resolverNivel(estado, posicion, presion) {
    if (estado === 'OVISACO') {
      if (posicion === 'BASE_CORTEZA') return presion <= 5 ? 'BAJA' : presion <= 15 ? 'MEDIA' : 'ALTA';
      if (posicion === 'BASE_BROTE') return presion === 1 ? 'BAJA' : presion <= 5 ? 'MEDIA' : 'ALTA';
      if (posicion === 'HOJA' || posicion === 'RACIMO') return presion === 1 ? 'BAJA' : presion === 2 ? 'MEDIA' : 'ALTA';
    }

    if (estado === 'NINFA') {
      if (posicion === 'BASE_CORTEZA') return presion <= 5 ? 'BAJA' : presion <= 15 ? 'MEDIA' : 'ALTA';
      if (posicion === 'BASE_BROTE' || posicion === 'RACIMO') return presion === 1 ? 'BAJA' : presion === 2 ? 'MEDIA' : 'ALTA';
      if (posicion === 'HOJA') return presion <= 2 ? 'BAJA' : presion <= 5 ? 'MEDIA' : 'ALTA';
    }

    if (estado === 'ADULTO') {
      if (posicion === 'BASE_CORTEZA') return presion <= 10 ? 'BAJA' : presion <= 20 ? 'MEDIA' : 'ALTA';
      if (posicion === 'BASE_BROTE') return presion <= 2 ? 'BAJA' : presion <= 5 ? 'MEDIA' : 'ALTA';
      if (posicion === 'HOJA') return presion <= 2 ? 'BAJA' : presion <= 4 ? 'MEDIA' : 'ALTA';
      if (posicion === 'RACIMO') return presion === 1 ? 'BAJA' : presion === 2 ? 'MEDIA' : 'ALTA';
    }

    return 'NO_APLICA';
  }

  crearResultado(nivel, presion, cantidad, cantPlantas) {
    return {
      nivel,
      etiqueta: ETIQUETAS[nivel],
      color: COLORES[nivel],
      presion,
      cantidad: Number.isFinite(cantidad) ? cantidad : null,
      cantPlantas: Number.isFinite(cantPlantas) ? cantPlantas : null,
    };
  }
}

ChanchitosPresionService.ESTADOS = ESTADOS;
ChanchitosPresionService.POSICIONES = POSICIONES;
ChanchitosPresionService.COLORES = COLORES;

module.exports = ChanchitosPresionService;
