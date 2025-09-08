

import { Sun, Moon } from "./LucideIcons";

interface NavigationProps {
  dark?: boolean;
  onToggleDark?: () => void;
}

const Navigation: React.FC<NavigationProps> = ({ dark, onToggleDark }) => (
  <nav
    className={`w-full sticky top-0 z-20 border-b transition-colors duration-300
      ${dark ? "bg-zinc-950/80 border-zinc-800" : "bg-white/80 border-zinc-200 backdrop-blur-md"}
    `}
  >
    <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-2 px-4 py-3">
      <span className={`text-2xl font-extrabold tracking-tight select-none
        ${dark ? "text-yellow-400" : "text-zinc-900"}
      `}>
        zappoint
      </span>
      <div className="flex gap-2 md:gap-6 items-center justify-center">

        <button
          onClick={onToggleDark}
          aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
          className={`ml-2 p-2 rounded-full border transition-colors flex items-center justify-center
            ${dark ? "bg-zinc-900 border-zinc-700 text-yellow-400 hover:bg-zinc-800" : "bg-white border-zinc-200 text-zinc-900 hover:bg-zinc-100"}
          `}
        >
          {dark ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </div>
    </div>
  </nav>
);

export default Navigation;
