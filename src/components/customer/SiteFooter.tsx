interface SiteFooterProps {
  showLocations?: boolean;
}

const SiteFooter: React.FC<SiteFooterProps> = ({ showLocations = true }) => (
  <footer className="bg-gradient-to-b from-blue-900 to-blue-950 text-white py-14 md:py-20">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className={`grid grid-cols-1 gap-8 md:gap-10 mb-10 md:mb-12 ${showLocations ? 'md:grid-cols-2 lg:grid-cols-4' : 'md:grid-cols-2'}`}>
        <div className="lg:col-span-1 text-center md:text-left">
          <a href="https://bestingames.com/ypsilanti/" target="_blank" rel="noopener noreferrer" className="inline-block">
            <img src="/Zap-Zone.png" alt="Zap Zone Logo" className="w-40 md:w-48 mb-4 md:mb-5 hover:opacity-80 transition"/>
          </a>
          <p className="text-sm md:text-base text-blue-200 leading-relaxed mb-4">
            The Longest Laser Tag Marathon and The Largest Laser Tag Winner Stays on Tournament
          </p>
          <div className="flex space-x-4 mb-6 justify-center md:justify-start">
            <a href="https://www.facebook.com/ZapZoneOffices" target="_blank" rel="noopener noreferrer"
               aria-label="Zap Zone on Facebook"
               className="w-10 h-10 bg-blue-800 rounded-full flex items-center justify-center hover:bg-blue-700 transition">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
            </a>
            <a href="https://www.instagram.com/zap__zone/" target="_blank" rel="noopener noreferrer"
               aria-label="Zap Zone on Instagram"
               className="w-10 h-10 bg-blue-800 rounded-full flex items-center justify-center hover:bg-blue-700 transition">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
              </svg>
            </a>
          </div>
        </div>

        {showLocations && (
          <div className="md:col-span-2 lg:ps-20 text-center md:text-left">
            <p className="font-bold mb-4 md:mb-5 text-white text-base md:text-lg uppercase tracking-wider">Locations</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm md:text-base text-blue-200">
              <a href="https://bowlerolanesbc.com/" target="_blank" rel="noopener noreferrer" className="block hover:text-white transition-colors duration-200">Battle Creek</a>
              <a href="https://brighton.zap-zone.com/" target="_blank" rel="noopener noreferrer" className="block hover:text-white transition-colors duration-200">Brighton</a>
              <a href="https://canton.zap-zone.com/" target="_blank" rel="noopener noreferrer" className="block hover:text-white transition-colors duration-200">Canton</a>
              <a href="https://farmington.zap-zone.com/" target="_blank" rel="noopener noreferrer" className="block hover:text-white transition-colors duration-200">Farmington</a>
              <a href="https://zapzonexl.com/" target="_blank" rel="noopener noreferrer" className="block hover:text-white transition-colors duration-200">Lansing</a>
              <a href="https://bestingames.com/sterlingheights/" target="_blank" rel="noopener noreferrer" className="block hover:text-white transition-colors duration-200">Sterling Heights</a>
              <a href="https://taylor.zap-zone.com/" target="_blank" rel="noopener noreferrer" className="block hover:text-white transition-colors duration-200">Taylor</a>
              <a href="https://bestingames.com/warren/" target="_blank" rel="noopener noreferrer" className="block hover:text-white transition-colors duration-200">Warren</a>
              <a href="https://waterford.zap-zone.com/" target="_blank" rel="noopener noreferrer" className="block hover:text-white transition-colors duration-200">Waterford</a>
              <a href="https://bestingames.com/ypsilanti/" target="_blank" rel="noopener noreferrer" className="block hover:text-white transition-colors duration-200">Ypsilanti</a>
            </div>
          </div>
        )}

        <div className="text-center md:text-left">
          <p className="font-bold mb-4 md:mb-5 text-white text-base md:text-lg uppercase tracking-wider">Support</p>
          <div className="space-y-2.5 text-sm md:text-base text-blue-200 mb-6">
            <a href="https://zap-zone.com/contact-us/" target="_blank" rel="noopener noreferrer" className="block hover:text-white transition-colors duration-200">Contact Us</a>
            <a href="https://zap-zone.com/eventcoordinator/" target="_blank" rel="noopener noreferrer" className="block hover:text-white transition-colors duration-200">Event Coordinator</a>
            <a href="https://zap-zone.com/corporate/" target="_blank" rel="noopener noreferrer" className="block hover:text-white transition-colors duration-200">Corporate</a>
            <a href="https://zap-zone.com/#" target="_blank" rel="noopener noreferrer" className="block hover:text-white transition-colors duration-200">Careers</a>
            <a href="https://zap-zone.com/#" target="_blank" rel="noopener noreferrer" className="block hover:text-white transition-colors duration-200">Donations</a>
            <a href="https://zap-zone.com/gift-cards/" target="_blank" rel="noopener noreferrer" className="block hover:text-white transition-colors duration-200">Gift Cards</a>
            <a href="https://zap-zone.com/#" target="_blank" rel="noopener noreferrer" className="block hover:text-white transition-colors duration-200">Invitations</a>
          </div>
        </div>
      </div>

      <div className="border-t border-blue-800 pt-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-blue-200 text-sm text-center md:text-left">
            &copy; {new Date().getFullYear()} Zone Entertainment LLC. All Rights Reserved.
          </p>
          <div className="flex flex-wrap justify-center md:justify-end text-sm text-blue-200">
            <a href="https://zap-zone.com/terms-conditions/" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">Terms &amp; Conditions</a>
          </div>
        </div>
      </div>
    </div>
  </footer>
);

export default SiteFooter;
