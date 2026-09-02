import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Resets scroll position to the top on every route change.
 * Without this, React Router preserves the DOM's current scroll offset
 * when navigating, so a page can land already scrolled if the previous
 * page was scrolled down.
 */
export function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
