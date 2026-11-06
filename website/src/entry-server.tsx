/* Build-time prerendering of public pages for SEO. © 2026 Shaik Gouse Kareem. */
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router';
import { AppRoutes } from './App';
import { AuthProvider } from './services/auth';
import { ToastProvider } from './services/toast';

export function render(url: string): string {
  return renderToString(
    <StaticRouter location={url}>
      <AuthProvider ssr>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </StaticRouter>,
  );
}
export { PAGES } from './content/seo';
