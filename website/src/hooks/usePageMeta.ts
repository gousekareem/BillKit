import { useEffect } from 'react';
import { metaFor } from '../content/seo';

/** Keeps <title> and the meta description in sync on client-side navigation. */
export function usePageMeta(path: string, override?: { title?: string; description?: string }) {
  useEffect(() => {
    const m = metaFor(path);
    document.title = override?.title ?? m.title;
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute('content', override?.description ?? m.description);
  }, [path, override?.title, override?.description]);
}

export function useTitle(title: string) {
  useEffect(() => {
    document.title = `${title} — BillKit`;
  }, [title]);
}
