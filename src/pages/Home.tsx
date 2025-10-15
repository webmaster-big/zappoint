import Navigation from "../components/navigations/Navigation";
import { useState } from "react";

export default function Home() {
    const [dark, setDark] = useState(false);
    return (
        <div className={`
            min-h-screen flex flex-col transition-colors duration-300
            ${dark ? "bg-zinc-950 text-zinc-100" : "bg-white text-zinc-900"}
        `}>
            <Navigation dark={dark} onToggleDark={() => setDark((d) => !d)} />


            {/* Hero Section */}
            <main className="flex-1 flex flex-col items-center justify-center px-4">
                <section className="w-full max-w-3xl text-center py-24">
                    <div className="flex flex-col items-center gap-4">
                        <span className={`inline-block rounded-full px-4 py-1 text-xs font-semibold tracking-widest uppercase mb-2 ${dark ? "bg-zinc-900 text-yellow-400" : "bg-yellow-400 text-zinc-900"}`}>For All Amusement & Entertainment Venues</span>
                        <h1 className={`text-4xl md:text-6xl font-extrabold mb-4 tracking-tight leading-tight ${dark ? "text-white" : "text-zinc-900"}`}>
                            <span className="block">Turn Fun Into Bookings</span>
                            <span className={`block text-transparent bg-clip-text ${dark ? "bg-gradient-to-r from-yellow-400 to-yellow-200" : "bg-gradient-to-r from-zinc-900 to-yellow-400"}`}>with Zappoint</span>
                        </h1>
                        <p className={`text-lg md:text-xl mb-8 max-w-xl mx-auto ${dark ? "text-zinc-300" : "text-zinc-600"}`}> 
                            Effortlessly create irresistible packages, share your branded booking page, or embed a beautiful widget. Let your customers book and pay in seconds—no tech skills needed.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <a href="#book" className="inline-block">
                                <button className={`px-8 py-3 rounded-lg font-semibold text-lg shadow transition-all
                                    ${dark ? "bg-yellow-400 text-zinc-900 hover:bg-yellow-300" : "bg-zinc-900 text-yellow-400 hover:bg-zinc-800"}
                                `}>
                                    Get Started Free
                                </button>
                            </a>
                            <a href="#features" className="inline-block">
                                <button className={`px-8 py-3 rounded-lg font-semibold text-lg border transition-all
                                    ${dark ? "border-zinc-700 bg-zinc-950 text-yellow-400 hover:bg-zinc-900" : "border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-100"}
                                `}>
                                    See Features
                                </button>
                            </a>
                        </div>
                        <div className="mt-8 flex flex-col gap-2 text-sm text-zinc-500 dark:text-zinc-400">
                            <span>🎉 No setup fees. No credit card required.</span>
                            <span>🚀 Go live in minutes. Cancel anytime.</span>
                        </div>
                    </div>
                </section>

                {/* Business Features */}
                <section id="features" className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-3 gap-8 py-8">
                    <div className="col-span-full text-center mb-8">
                        <h2 className={`text-2xl md:text-3xl font-bold mb-2 ${dark ? "text-yellow-400" : "text-zinc-900"}`}>Everything You Need to Grow</h2>
                        <p className={`max-w-2xl mx-auto ${dark ? "text-zinc-400" : "text-zinc-600"}`}>Zappoint is built for amusement businesses who want to boost bookings, save time, and delight customers with a seamless experience.</p>
                    </div>
                    <div className={`rounded-xl p-8 flex flex-col items-center hover:shadow-2xl transition border
                        ${dark ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"}
                    `}>
                        <span className="mb-4 text-yellow-400">
                            {/* Booking Management icon */}
                            <svg width="36" height="36" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h10M7 12h6"/></svg>
                        </span>
                        <h3 className="font-semibold text-lg mb-1">Package Management</h3>
                        <p className="text-gray-500 text-center text-sm">Easily manage your offerings—each package gets a unique booking link or embed code for your website.</p>
                    </div>
                    <div className={`rounded-xl p-8 flex flex-col items-center hover:shadow-2xl transition border
                        ${dark ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"}
                    `}>
                        <span className="mb-4 text-yellow-400">
                            {/* Customer Management icon */}
                            <svg width="36" height="36" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-2.2 3.6-4 8-4s8 1.8 8 4"/></svg>
                        </span>
                        <h3 className="font-semibold text-lg mb-1">Booking Widget & Page</h3>
                        <p className="text-gray-500 text-center text-sm">Embed a booking widget or share a branded booking page for your business.</p>
                    </div>
                    <div className={`rounded-xl p-8 flex flex-col items-center hover:shadow-2xl transition border
                        ${dark ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"}
                    `}>
                        <span className="mb-4 text-yellow-400">
                            {/* Analytics icon */}
                            <svg width="36" height="36" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="12" width="4" height="8"/><rect x="9" y="8" width="4" height="12"/><rect x="15" y="4" width="4" height="16"/></svg>
                        </span>
                        <h3 className="font-semibold text-lg mb-1">Real-Time Bookings</h3>
                        <p className="text-gray-500 text-center text-sm">Let your guests book instantly—no phone calls or emails needed.</p>
                    </div>
                    <div className={`rounded-xl p-8 flex flex-col items-center hover:shadow-2xl transition border
                        ${dark ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"}
                    `}>
                        <span className="mb-4 text-yellow-400">
                            {/* Payment icon */}
                            <svg width="36" height="36" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="10" rx="2"/><path d="M6 11h.01M10 11h.01M14 11h2"/></svg>
                        </span>
                        <h3 className="font-semibold text-lg mb-1">Online Payments</h3>
                        <p className="text-gray-500 text-center text-sm">Accept secure payments and deposits for every reservation.</p>
                    </div>
                    <div className={`rounded-xl p-8 flex flex-col items-center hover:shadow-2xl transition border
                        ${dark ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"}
                    `}>
                        <span className="mb-4 text-yellow-400">
                            {/* Marketing icon */}
                            <svg width="36" height="36" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 10v4a1 1 0 0 0 1 1h2l3 3V6L6 9H4a1 1 0 0 0-1 1z"/><circle cx="18" cy="12" r="3"/></svg>
                        </span>
                        <h3 className="font-semibold text-lg mb-1">Analytics & Insights</h3>
                        <p className="text-gray-500 text-center text-sm">Track sales, reservations, and guest trends with powerful analytics.</p>
                    </div>
                    <div className={`rounded-xl p-8 flex flex-col items-center hover:shadow-2xl transition border
                        ${dark ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"}
                    `}>
                        <span className="mb-4 text-yellow-400">
                            {/* Staff icon */}
                            <svg width="36" height="36" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="8" cy="8" r="3"/><circle cx="16" cy="8" r="3"/><path d="M2 20c0-2.2 3.6-4 8-4s8 1.8 8 4"/></svg>
                        </span>
                        <h3 className="font-semibold text-lg mb-1">Marketing Tools</h3>
                        <p className="text-gray-500 text-center text-sm">Promote your offerings and send reminders to boost reservations.</p>
                    </div>
                </section>

                {/* Why Book With Us */}
                <section className="w-full max-w-3xl text-center py-8">
                    <h2 className={`text-xl font-semibold mb-2 ${dark ? "text-white" : "text-zinc-900"}`}>Why Zappoint?</h2>
                    <div className="flex flex-col md:flex-row gap-6 justify-center mt-4">
                        <div className={`flex-1 rounded-lg p-6 border ${dark ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"}`}>
                            <span className="block text-yellow-400 font-bold mb-1">For Businesses</span>
                            <p className={`text-sm ${dark ? "text-zinc-300" : "text-zinc-500"}`}>Stand out with a beautiful, branded booking experience. Automate your workflow and focus on what you do best—delivering fun.</p>
                        </div>
                        <div className={`flex-1 rounded-lg p-6 border ${dark ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"}`}>
                            <span className="block text-yellow-400 font-bold mb-1">For Customers</span>
                            <p className={`text-sm ${dark ? "text-zinc-300" : "text-zinc-500"}`}>Book your next adventure in seconds—no calls, no waiting. Just pick, pay, and play!</p>
                        </div>
                        <div className={`flex-1 rounded-lg p-6 border ${dark ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"}`}>
                            <span className="block text-yellow-400 font-bold mb-1">For Teams & Events</span>
                            <p className={`text-sm ${dark ? "text-zinc-300" : "text-zinc-500"}`}>Perfect for parties, team building, and group bookings—Zappoint makes it easy for everyone to join the fun.</p>
                        </div>
                    </div>
                </section>
               
                {/* Call to Action */}
                <section id="book" className="w-full max-w-2xl mx-auto text-center py-12">
                    <h2 className={`text-2xl font-bold mb-4 ${dark ? "text-yellow-400" : "text-zinc-900"}`}>Ready to Book?</h2>
                    <a href="#" className="inline-block">
                        <button className={`px-10 py-3 rounded-lg font-semibold text-lg shadow transition-all
                            ${dark ? "bg-yellow-400 text-zinc-900 hover:bg-yellow-300" : "bg-zinc-900 text-yellow-400 hover:bg-zinc-800"}
                        `}>
                            Try It Free
                        </button>
                    </a>
                </section>
            </main>

            {/* Footer */}
            <footer className={`w-full text-center py-6 text-xs border-t mt-8
                ${dark ? "text-zinc-500 border-zinc-800" : "text-zinc-400 border-zinc-200"}
            `}>
                &copy; {new Date().getFullYear()} zappoint. All rights reserved.
            </footer>
        </div>
    );
}