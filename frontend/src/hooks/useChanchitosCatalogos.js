import { useCallback, useEffect, useRef, useState } from 'react';
import { obtenerCampos, obtenerCuarteles, obtenerVariedades } from '../api/chanchitosApi';

const emptyCatalogs = {
  campos: [],
  variedades: [],
  cuarteles: [],
};

function isAbort(error) {
  return error?.name === 'AbortError';
}

export function useChanchitosCatalogos() {
  const [catalogs, setCatalogs] = useState(emptyCatalogs);
  const [loading, setLoading] = useState({ campos: false, variedades: false, cuarteles: false });
  const controllersRef = useRef({});

  const abortRequest = useCallback((name) => {
    controllersRef.current[name]?.abort();
    delete controllersRef.current[name];
  }, []);

  const resetFromFundo = useCallback(() => {
    abortRequest('campos');
    abortRequest('variedades');
    abortRequest('cuarteles');
    setCatalogs(emptyCatalogs);
    setLoading({ campos: false, variedades: false, cuarteles: false });
  }, [abortRequest]);

  const resetFromCampo = useCallback(() => {
    abortRequest('variedades');
    abortRequest('cuarteles');
    setCatalogs((current) => ({ ...current, variedades: [], cuarteles: [] }));
    setLoading((current) => ({ ...current, variedades: false, cuarteles: false }));
  }, [abortRequest]);

  const resetFromVariedad = useCallback(() => {
    abortRequest('cuarteles');
    setCatalogs((current) => ({ ...current, cuarteles: [] }));
    setLoading((current) => ({ ...current, cuarteles: false }));
  }, [abortRequest]);

  const load = useCallback(async (name, request) => {
    abortRequest(name);
    const controller = new AbortController();
    controllersRef.current[name] = controller;
    setLoading((current) => ({ ...current, [name]: true }));

    try {
      const response = await request(controller.signal);
      if (controllersRef.current[name] !== controller) {
        return [];
      }

      const items = response.data || [];
      setCatalogs((current) => ({ ...current, [name]: items }));
      return items;
    } catch (error) {
      if (isAbort(error)) {
        return [];
      }
      throw error;
    } finally {
      if (controllersRef.current[name] === controller) {
        delete controllersRef.current[name];
        setLoading((current) => ({ ...current, [name]: false }));
      }
    }
  }, [abortRequest]);

  const loadCampos = useCallback((genFundo) => load('campos', (signal) => obtenerCampos(genFundo, signal)), [load]);
  const loadVariedades = useCallback(
    (genFundo, genCampo) => load('variedades', (signal) => obtenerVariedades(genFundo, genCampo, signal)),
    [load]
  );
  const loadCuarteles = useCallback(
    (genFundo, genCampo, genVariedad) => load(
      'cuarteles',
      (signal) => obtenerCuarteles(genFundo, genCampo, genVariedad, signal)
    ),
    [load]
  );

  useEffect(() => () => {
    Object.values(controllersRef.current).forEach((controller) => controller.abort());
  }, []);

  return {
    catalogs,
    loading,
    resetFromFundo,
    resetFromCampo,
    resetFromVariedad,
    loadCampos,
    loadVariedades,
    loadCuarteles,
  };
}
