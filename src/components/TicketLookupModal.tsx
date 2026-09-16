import React, { useState } from 'react';
import { X, Search, Ticket, CheckCircle2, AlertCircle, Shield, Calendar, MapPin, Loader2, AlertTriangle, GraduationCap, FileDown, Image } from 'lucide-react';
import { downloadTicketPDF, downloadTicketPNG } from '../utils/ticketGenerator';

interface TicketLookupModalProps {
  onClose: () => void;
}

export const TicketLookupModal: React.FC<TicketLookupModalProps> = ({ onClose }) => {
  const [query, setQuery] = useState('');
  const [verifyValue, setVerifyValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setResult(null);

    if (!query.trim()) {
      setErrorMessage('Por favor introduce tu ID de boleta (5 dígitos), nombre o apellido.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch(`/api/attendees/lookup?query=${encodeURIComponent(query.trim())}&verify=${encodeURIComponent(verifyValue.trim())}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'No se encontró ninguna inscripción con estos datos.');
      }

      setResult(data.attendee);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al consultar la inscripción.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8">
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-blue-900/40">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white">
              <Ticket className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Consultar Boleta / Inscripción</h3>
              <p className="text-xs text-blue-200/80">Instituto Politécnico Max Henríquez Ureña • CLED</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notice */}
        <div className="bg-amber-50 px-5 py-3 border-b border-amber-200 flex items-start gap-2.5 text-xs text-amber-900">
          <AlertTriangle className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
          <span>
            <strong>Recuerda:</strong> En el IPMHU está prohibido el uso de celulares. Anota tu ID de boleta (5 dígitos) o presenta tu nombre y apellido en la entrada.
          </span>
        </div>

        <div className="p-6">
          <form onSubmit={handleLookup} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                ID de Boleta (5 Dígitos), Nombre o Apellido *
              </label>
              <input
                type="text"
                required
                placeholder="Ej: 48291 o Marcos o Henríquez"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Correo Electrónico Registrado O Teléfono *
              </label>
              <input
                type="text"
                required
                placeholder="nombreusuarios@dominio.com o +1 (809)..."
                value={verifyValue}
                onChange={(e) => setVerifyValue(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Por seguridad estudiantil, se requiere verificar tu correo o teléfono.
              </p>
            </div>

            {errorMessage && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 bg-blue-900 hover:bg-blue-800 text-white rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors disabled:bg-slate-300"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Consultando en Base de Datos...</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>Buscar Mi Boleta</span>
                </>
              )}
            </button>
          </form>

          {/* Search Result */}
          {result && (
            <div className="mt-6 pt-6 border-t border-slate-200 animate-in fade-in duration-300">
              <div className="bg-slate-900 text-white rounded-xl p-5 border border-blue-900/50 space-y-3">
                <div className="flex items-center justify-between border-b border-blue-800/40 pb-2.5">
                  <span className="text-xs font-bold text-blue-300 uppercase tracking-wider">
                    Boleta Oficial Encontrada
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    result.attended ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                  }`}>
                    {result.attended ? '✓ ASISTENCIA MARCADA' : 'PENDIENTE DE ASISTENCIA'}
                  </span>
                </div>

                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-base text-white">{result.fullName}</h4>
                    <p className="text-xs text-blue-200">{result.email}</p>
                    <p className="text-xs text-slate-300">{result.phone}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase tracking-widest text-slate-400 block">ID Boleta:</span>
                    <span className="text-2xl font-mono font-black text-amber-400">#{result.ticketCode}</span>
                  </div>
                </div>

                <div className="bg-slate-800/80 rounded-lg p-3 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Grado y Sección:</span>
                    <span className="font-bold text-slate-200">
                      {result.grade || 'Secundaria'} - Sección {result.section || 'A'}
                    </span>
                  </div>
                  {result.technicalMajor && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Técnico:</span>
                      <span className="text-blue-300 font-medium">{result.technicalMajor}</span>
                    </div>
                  )}
                  {result.event && (
                    <div className="pt-2 border-t border-slate-700/80">
                      <span className="text-[11px] text-slate-400 block">Evento:</span>
                      <span className="font-bold text-white block">{result.event.title}</span>
                      <span className="text-[11px] text-slate-300 block">
                        📅 {result.event.date} • ⏰ {result.event.time} hrs • 📍 {result.event.location}
                      </span>
                    </div>
                  )}
                </div>

                {/* Download Actions */}
                <div className="pt-2 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      if (!result.event) return;
                      downloadTicketPDF({
                        ticketCode: result.ticketCode,
                        fullName: result.fullName,
                        grade: result.grade,
                        section: result.section,
                        technicalMajor: result.technicalMajor,
                        email: result.email,
                        phone: result.phone,
                        eventTitle: result.event.title,
                        date: result.event.date,
                        time: result.event.time,
                        location: result.event.location
                      });
                    }}
                    className="py-2.5 px-3 rounded-lg bg-blue-700 hover:bg-blue-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <span>Descargar PDF</span>
                  </button>

                  <button
                    onClick={async () => {
                      if (!result.event) return;
                      await downloadTicketPNG({
                        ticketCode: result.ticketCode,
                        fullName: result.fullName,
                        grade: result.grade,
                        section: result.section,
                        technicalMajor: result.technicalMajor,
                        email: result.email,
                        phone: result.phone,
                        eventTitle: result.event.title,
                        date: result.event.date,
                        time: result.event.time,
                        location: result.event.location
                      });
                    }}
                    className="py-2.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border border-slate-700"
                  >
                    <span>Descargar Imagen</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
