(function() {
  // Create a unique namespace
  window.ZapZoneBooking = window.ZapZoneBooking || {};
  
  // Function to initialize the widget
  window.ZapZoneBooking.init = function(options) {
    const { elementId, packageId, apiUrl, onBookingComplete } = options;
    
    // Find the target element
    const targetElement = document.getElementById(elementId);
    if (!targetElement) {
      console.error(`Element with ID ${elementId} not found`);
      return;
    }
    
    // Create a div for React to render into
    const reactRoot = document.createElement('div');
    targetElement.appendChild(reactRoot);
    
    // Load React and ReactDOM from CDN (if not already loaded)
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
    
    // Load Tailwind CSS (or your preferred styling)
    loadStylesheet('https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css');
    
    // Check if React is already loaded
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
      // Create the BookingWidget component
      const BookingWidget = React.lazy(() => import('../components/embed/BookingWidget'));
      
      // Render with ReactDOM
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