

export default function Login() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6 sm:p-8 border border-zinc-100 m-3">
        {/* Logo container with Lucide icon */}
        <div className="flex justify-center mb-6">
          <div className="h-12 w-12 rounded-full bg-zinc-100 flex items-center justify-center overflow-hidden">
            {/* Lucide User2 icon for admin/person login */}
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-2.2 3.6-4 8-4s8 1.8 8 4" />
            </svg>
          </div>
        </div>
        <div className="mb-8">
          <h1 className="text-center text-2xl sm:text-3xl font-bold text-zinc-900 mb-2 tracking-tight">Sign in to your account</h1>
          <p className="text-center text-zinc-500 text-sm">Enter your email and password to continue</p>
        </div>
        <form className="flex flex-col gap-5">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Email</label>
            <input
              type="email"
              className="w-full rounded-md border border-zinc-200 px-3 py-2 text-zinc-900 bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 transition text-base sm:text-base"
              placeholder="you@email.com"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Password</label>
            <input
              type="password"
              className="w-full rounded-md border border-zinc-200 px-3 py-2 text-zinc-900 bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 transition text-base sm:text-base"
              placeholder="••••••••"
              required
            />
          </div>
          <button
            type="submit"
            className="mt-2 w-full py-2 rounded-lg font-semibold text-base sm:text-lg shadow-sm transition-all bg-zinc-900 text-yellow-400 hover:bg-zinc-800"
          >
            Sign In
          </button>
        </form>
        <div className="mt-6 text-center text-xs text-zinc-400">
          &copy; {new Date().getFullYear()} zappoint. All rights reserved.
        </div>
      </div>
    </div>
  );
}
