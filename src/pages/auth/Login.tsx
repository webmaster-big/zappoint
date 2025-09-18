import { useState } from "react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const demoAccounts = [
    {
      label: "Company Admin",
      email: "zapzone@example.com",
      password: "password"
    },
    {
      label: "Location Manager",
      email: "brighton@example.com",
      password: "password"
    },
    {
      label: "Attendee",
      email: "brighton.attendee@example.com",
      password: "password"
    }
  ];

  const handleDemoSelect = (account: typeof demoAccounts[0]) => {
    setEmail(account.email);
    setPassword(account.password);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6 sm:p-8 border border-zinc-100 m-3">
        {/* Logo container with Zap Zone logo */}
        <div className="flex justify-center mb-8 pt-2">
          <img src="/Zap-Zone.png" alt="Logo" className="w-3/5 mr-2" />
          
        </div>
        {/* Demo account selection */}
        <div className="mb-6">
          <div className="flex justify-center gap-2 mb-2">
            {demoAccounts.map((acc) => (
              <button
                key={acc.label}
                type="button"
                className="px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-semibold hover:bg-blue-200 transition"
                onClick={() => handleDemoSelect(acc)}
              >
                {acc.label}
              </button>
            ))}
          </div>
          {/* <p className="text-center text-xs text-zinc-400">Demo accounts: autofill email & password</p> */}
        </div>
        <div className="mb-8">
          <h1 className="text-center text-2xl sm:text-3xl font-bold text-zinc-900 mb-2 tracking-tight">Sign in to your account</h1>
          <p className="text-center text-zinc-500 text-sm">Enter your email and password to continue</p>
        </div>
        <form
          className="flex flex-col gap-5"
          onSubmit={e => {
            e.preventDefault();
            // Find matching demo account
            const account = demoAccounts.find(acc => acc.email === email && acc.password === password);
            if (account) {
              let role: 'company_admin' | 'location_manager' | 'attendee' = 'attendee';
              let redirect = '/attendee/dashboard';
              if (account.label === 'Company Admin') {
                role = 'company_admin';
                redirect = '/company/dashboard';
              }
              if (account.label === 'Location Manager') {
                role = 'location_manager';
                redirect = '/manager/dashboard';
              }
              localStorage.setItem('zapzone_user', JSON.stringify({
                name: account.label,
                company: account.label === 'Zap Zone' ? 'Brighton' : 'Brighton',
                position: account.label,
                role
              }));
              window.location.href = redirect;
            } else {
              alert('Invalid email or password. Use demo accounts above.');
            }
          }}
        >
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Email</label>
            <input
              type="email"
              className="w-full rounded-md border border-zinc-200 px-3 py-2 text-zinc-900 bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-800 focus:border-blue-800 transition text-base sm:text-base"
              placeholder="you@email.com"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Password</label>
            <input
              type="password"
              className="w-full rounded-md border border-zinc-200 px-3 py-2 text-zinc-900 bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-800 focus:border-blue-800 transition text-base sm:text-base"
              placeholder="••••••••"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>
          <button
            type="submit"
            className="mt-2 w-full py-2 rounded-lg font-semibold text-base sm:text-lg shadow-sm transition-all bg-blue-800 text-white hover:bg-blue-700"
          >
            Sign In
          </button>
        </form>
        <div className="mt-6 text-center text-xs text-zinc-400">
          &copy; {new Date().getFullYear()} zapzone. All rights reserved.
        </div>
      </div>
    </div>
  );
}
