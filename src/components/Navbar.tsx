import React from 'react';
import { Shield, Sparkles, Calendar, Search, Ticket, Lock } from 'lucide-react';

interface NavbarProps {
  onOpenLookup: () => void;
  onOpenAdmin: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenLookup,
  onOpenAdmin,
  searchQuery,
  onSearchChange,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 text-slate-800 shadow-xs">
      {/* Top micro-bar */}
      <div className="bg-slate-100 border-b border-slate-200 text-xs py-1.5 px-4 sm:px-8 text-slate-600 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="font-medium text-[11px] sm:text-xs">
            Instituto Politécnico Max Henríquez Ureña • Club de Liderazgo Estudiantil y Desarrollo (CLED)
          </span>
        </div>
        <div className="hidden sm:flex items-center gap-4 text-xs font-semibold text-slate-500">
          <span className="text-blue-700">Inscripciones Abiertas</span>
          <span>•</span>
          <span>Acreditación Oficial</span>
        </div>
      </div>

      {/* Main Navbar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Brand & Crest */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-center p-0.5 overflow-hidden">
              <img
                src="/LOGO_CLED_CF.jpg"
                alt="Logo CLED"
                className="w-full h-full object-contain"
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = 'none';
                  const fb = e.currentTarget.parentElement?.querySelector('.nav-logo-fallback') as HTMLElement;
                  if (fb) fb.style.display = 'flex';
                }}
              />
              <div className="nav-logo-fallback hidden w-full h-full bg-blue-800 text-white rounded-lg items-center justify-center">
                <Shield className="w-5 h-5 text-blue-100" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-extrabold tracking-tight text-slate-900 font-sans">
                  Eventos<span className="text-blue-700">CLED</span>
                </span>
                <span className="text-[10px] uppercase font-extrabold tracking-widest bg-blue-50 text-blue-800 border border-blue-200 px-2 py-0.5 rounded-full">
                  Oficial
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium tracking-tight">
                Club de Liderazgo Estudiantil y Desarrollo • IPMHU
              </p>
            </div>
          </div>

          {/* Mobile Lookup Button */}
          <div className="flex md:hidden items-center gap-2">
            <button
              onClick={onOpenLookup}
              className="p-2 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 hover:text-blue-900 hover:bg-slate-200 transition-colors"
              title="Consultar mi Boleta"
            >
              <Ticket className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Center Search Input */}
        <div className="flex-1 max-w-md mx-auto md:mx-4 w-full">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por título, temática, ponente o modalidad..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-slate-100/90 hover:bg-slate-100 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white focus:border-transparent transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="hidden md:flex items-center gap-3">
          <button
            onClick={onOpenLookup}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 hover:text-blue-900 border border-slate-300 text-xs font-bold tracking-wide transition-all shadow-xs"
          >
            <Ticket className="w-4 h-4 text-blue-700" />
            <span>Consultar mi Boleta</span>
          </button>

          <a
            href="#eventos"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-800 hover:bg-blue-700 text-white text-xs font-bold tracking-wide shadow-xs transition-all"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Ver Eventos</span>
          </a>
        </div>
      </div>
    </header>
  );
};
