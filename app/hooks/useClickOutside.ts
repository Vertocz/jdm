// hooks/useClickOutside.ts
import { useEffect, useRef, RefObject } from 'react';

export function useClickOutside(
  ref: RefObject<HTMLElement | null>,
  handler: () => void
) {
  // Stocker le handler dans un ref pour qu'il soit toujours à jour
  // sans déclencher de re-exécution de l'effect
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(() => {
    const listener = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        handlerRef.current();
      }
    };

    document.addEventListener('mousedown', listener);
    return () => document.removeEventListener('mousedown', listener);
  }, [ref]); // ref uniquement — plus de re-bind à chaque render
}