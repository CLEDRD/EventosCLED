import React, { useState } from 'react';
import { X, Lock, Key, AlertCircle, CheckCircle2, ShieldCheck, Loader2 } from 'lucide-react';
import { CLEDEvent } from '../types';

interface PrivateEventModalProps {
  event: CLEDEvent;
  onClose: () => void;
  onUnlocked: (event: CLEDEvent) => void;
}

export const PrivateEventModal: React.FC<PrivateEventModalProps> = ({
  event,
  onClose,
  onUnlocked,
}) => {
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!code.trim()) {
      setErrorMessage('Por favor introduce el código de invitación.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch(`/api/events/${event.id}/verify-access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Código de acceso o invitación no válido.');
      }

      // Success: notify parent
      onUnlocked(event);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error de verificación');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8">
        
        {/* Header */}
        <div className="bg-slate-950 text-white p-6 text-center relative border-b border-blue-900/40">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center mx-auto mb-3">
            <Lock className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-white">Evento Exclusivo / Privado</h3>
          <p className="text-xs text-amber-200/90 mt-1 line-clamp-1">
            {event.title}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-slate-800">
          <p className="text-xs text-slate-600 leading-relaxed">
            Esta actividad está restringida para miembros de comités, directivos o personas con invitación oficial del <strong>Club de Liderazgo Estudiantil y Desarrollo</strong>.
          </p>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-blue-600" />
              <span>Clave de Acceso o Invitación *</span>
            </label>
            <input
              type="text"
              required
              placeholder="Ej: CLED-LIDER-2026"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 font-mono tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          {errorMessage && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 py-2.5 bg-blue-900 hover:bg-blue-800 text-white text-xs font-bold uppercase tracking-wider rounded-lg shadow-sm flex items-center justify-center gap-2 transition-all"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Validando...</span>
                </>
              ) : (
                <span>Validar Clave</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
