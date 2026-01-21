import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { BrowserRouter } from 'react-router-dom'
import { debugAuthorizeNetCredentials } from './services/SettingsService'

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
