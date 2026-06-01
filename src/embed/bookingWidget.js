(function() {
  window.ZapZoneBooking = window.ZapZoneBooking || {};
  
  window.ZapZoneBooking.init = function(options) {
    const { elementId, packageId, apiUrl, onBookingComplete } = options;
    
    const targetElement = document.getElementById(elementId);
    if (!targetElement) {
      console.error(`Element with ID ${elementId} not found`);
      return;
    }
    
    const reactRoot = document.createElement('div');
    targetElement.appendChild(reactRoot);
    
    function loadScript(src, onLoad) {
      const script = document.createElement('script');
      script.src = src;
      script.onload = onLoad;
      document.head.appendChild(script);
    }
    
    function loadStylesheet(href) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      document.head.appendChild(link);
    }
    
    loadStylesheet('https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css');
    
    if (typeof React === 'undefined' || typeof ReactDOM === 'undefined') {
      loadScript('https://unpkg.com/react@18/umd/react.production.min.js', function() {
        loadScript('https://unpkg.com/react-dom@18/umd/react-dom.production.min.js', function() {
          renderWidget();
        });
      });
    } else {
      renderWidget();
    }
    
    function renderWidget() {
      const BookingWidget = React.lazy(() => import('../components/embed/BookingWidget'));
      
      const root = ReactDOM.createRoot(reactRoot);
      root.render(
        React.createElement(React.Suspense, { fallback: React.createElement('div', null, 'Loading...') },
          React.createElement(BookingWidget, { 
            packageId, 
            apiUrl, 
            onBookingComplete 
          })
        )
      );
    }
  };
})();
