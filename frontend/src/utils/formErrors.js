export function mapServerErrors(errors = []) {
  const fieldErrors = {};
  const generalErrors = [];

  errors.forEach((error) => {
    const message = String(error || '');
    const match = message.match(/La cantidad (\d)-(\d) debe ser/);

    if (match) {
      fieldErrors[`cantidad_${match[1]}_${match[2]}`] = message;
    } else if (/fundo/i.test(message)) {
      fieldErrors.genFundo = message;
    } else if (/campo/i.test(message)) {
      fieldErrors.genCampo = message;
    } else if (/variedad/i.test(message)) {
      fieldErrors.genVariedad = message;
    } else if (/cuartel|cat[aá]logo|combinaci[oó]n/i.test(message)) {
      fieldErrors.idCatalogoSdp = message;
    } else if (/cantidad de plantas/i.test(message)) {
      fieldErrors.cantPlantas = message;
    } else if (/fecha de monitoreo/i.test(message)) {
      fieldErrors.fechaMonitoreo = message;
    } else if (/estado fenol[oó]gico/i.test(message)) {
      fieldErrors.idEstadoFenologico = message;
    } else if (/monitoreador/i.test(message)) {
      fieldErrors.idMonitoreador = message;
    } else {
      generalErrors.push(message);
    }
  });

  return { fieldErrors, generalErrors };
}
