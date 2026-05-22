// IMPORTANT: this side-effect import must come first. It monkey-patches
// `axios.create` so every service instance picks up tenant-scope stripping
// and centralised 401/403 handling. See utils/apiInterceptors.ts.
import './utils/apiInterceptors'
// Analytics header injection (X-Visitor-Id / X-Session-Id / X-Analytics-Source
// / X-Tracking-Id). Must be imported AFTER apiInterceptors so both axios.create
// patches stack and every service instance gets both sets of interceptors.
import './utils/analyticsHeaders'
import { setupAnalytics } from './utils/analytics'

import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { BrowserRouter } from 'react-router-dom'
import { debugAuthorizeNetCredentials } from './services/SettingsService'

// Install scroll-depth + pagehide-duration listeners exactly once.
setupAnalytics();

// Make debug function available globally for browser console access
// Usage: debugAuthorizeNet(1) to check credentials for location 1
(window as any).debugAuthorizeNet = async (locationId: number = 1) => {
  try {
    console.log('🔍 Fetching Authorize.Net debug info for location:', locationId);
    const result = await debugAuthorizeNetCredentials(locationId);
    console.table(result);
    return result;
  } catch (error: any) {
    console.error('❌ Debug failed:', error.response?.data || error.message);
    return null;
  }
};
console.log('💡 TIP: Run debugAuthorizeNet(locationId) in console to check Authorize.Net credentials');

createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
)
