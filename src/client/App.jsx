import React from 'react';

export default function App() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <header
        role="note"
        aria-label="Simulated money notice"
        className="w-full bg-amber-50 border-b border-amber-200 px-4 py-3 text-center text-sm text-amber-950"
      >
        <p className="font-medium">
          Simulated Money Notice: All balances, cash top-ups, merchant payouts, and cash refunds on{' '}
          <span className="font-semibold">Blendinar</span> are 100% fake / simulated DZD for
          educational demonstration — not real banking or payment processing.
        </p>
      </header>

      <main className="flex-1 flex items-center justify-center p-6">
        <section className="max-w-lg w-full rounded-xl bg-white p-8 shadow-sm border border-slate-200 text-center">
          <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
            Simulated DZD Prototype
          </span>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900">
            Blendinar
          </h1>
          <h2 className="mt-2 text-lg font-medium text-slate-800">
            Simulated Digital Wallet and Online Merchant Payment Platform
          </h2>
          <p className="mt-3 text-sm text-slate-600 leading-relaxed">
            Algerian Dinar (DZD) cash-to-digital wallet and hosted online-merchant checkout
            demonstration shell ahead of full Customer, Agent, Merchant, and Admin portals.
          </p>
        </section>
      </main>

      <footer className="w-full border-t border-slate-200 bg-white px-4 py-3 text-center text-xs text-slate-600">
        Essential session storage only — no tracking cookies. Simulated DZD educational prototype.
      </footer>
    </div>
  );
}
