import { useCallback, useEffect, useRef, useState } from 'react';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function validateImage(file) {
  if (!ALLOWED_TYPES.has(file.type)) return 'La imagen debe ser JPEG, PNG o WebP.';
  if (file.size > MAX_FILE_SIZE) return 'La imagen supera el máximo de 10 MB.';
  return '';
}

export function useChanchitosImages() {
  const [items, setItems] = useState([null, null, null]);
  const [error, setError] = useState('');
  const itemsRef = useRef(items);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => () => {
    itemsRef.current.forEach((item) => {
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
    });
  }, []);

  const replace = useCallback((index, file) => {
    if (!file) return false;

    const validationError = validateImage(file);
    if (validationError) {
      setError(validationError);
      return false;
    }

    setError('');
    const nextItem = { file, previewUrl: URL.createObjectURL(file) };
    setItems((current) => {
      if (current[index]?.previewUrl) URL.revokeObjectURL(current[index].previewUrl);
      const next = [...current];
      next[index] = nextItem;
      return next;
    });
    return true;
  }, []);

  const remove = useCallback((index) => {
    setError('');
    setItems((current) => {
      if (current[index]?.previewUrl) URL.revokeObjectURL(current[index].previewUrl);
      const next = [...current];
      next[index] = null;
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setError('');
    setItems((current) => {
      current.forEach((item) => {
        if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
      return [null, null, null];
    });
  }, []);

  return {
    items,
    error,
    files: items.filter(Boolean).map((item) => item.file),
    replace,
    remove,
    clear,
  };
}
