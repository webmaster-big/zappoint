import './utils/apiInterceptors'
import './utils/analyticsHeaders'
import { setupAnalytics } from './utils/analytics'
import { installGlobalErrorReporting } from './utils/errorLogger'

import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import ErrorBoundary from './components/ErrorBoundary'
import { BrowserRouter } from 'react-router-dom'
import { debugAuthorizeNetCredentials } from './services/SettingsService'

setupAnalytics();
installGlobalErrorReporting();

declare global {
  interface Window {
    debugAuthorizeNet?: (locationId: number) => Promise<unknown>;
  }
}

window.debugAuthorizeNet = async (locationId: number) => {
  if (!locationId) {
    console.error('Pass a location id, e.g. debugAuthorizeNet(11)');
    return null;
  }
  try {
    const result = await debugAuthorizeNetCredentials(locationId);
    console.table({
      location_id: locationId,
      merchant_name: result?.merchant_name ?? '(none)',
      gateway_id: result?.gateway_id ?? '(none)',
      environment: result?.environment ?? '(none)',
      message: result?.message ?? '',
    });
    return result;
  } catch (error) {
    const err = error as { response?: { data?: unknown }; message?: string };
    console.error('Authorize.Net check failed:', err.response?.data ?? err.message);
    return null;
  }
};
console.log('TIP: debugAuthorizeNet(locationId) shows which Authorize.Net merchant a location charges through');

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </ErrorBoundary>,
)
