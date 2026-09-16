import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { CheckCircle2, Calendar, X, AlertTriangle, Check, FileDown, Image, Loader2 } from 'lucide-react';
import { downloadTicketPDF, downloadTicketPNG } from '../utils/ticketGenerator';
import { CLED_LOGO } from '../utils/logo';

interface RegistrationSuccessModalProps {
  attendee: {
    id: string;
    ticketCode: string;
    firstName?: string;
    lastName?: string;
    fullName: string;
    grade?: string;
    section?: string;
    technicalMajor?: string;
    studentId?: string;
    email: string;
    phone?: string;
    eventTitle: string;
    date: string;
    time: string;
    location: string;
    isVirtual: boolean;
    virtualLink?: string;
  };
  onClose: () => void;
}

export const RegistrationSuccessModal: React.FC<RegistrationSuccessModalProps> = ({
  attendee,
  onClose,
}) => {
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isDownloadingPng, setIsDownloadingPng] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);

  useEffect(() => {
    try {
      confetti({
        particleCount: 90,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#1E3A8A', '#3B82F6', '#60A5FA', '#F59E0B', '#10B981']
      });
    } catch {
      // safe fallback
    }
  }, []);

  const handleDownloadPDF = () => {
    try {
      setIsDownloadingPdf(true);
      downloadTicketPDF(attendee);
      setDownloadSuccess('PDF descargado con éxito');
      setTimeout(() => setDownloadSuccess(null), 3500);
    } catch (err) {
      console.error('Error al descargar PDF:', err);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleDownloadPNG = async () => {
    try {
      setIsDownloadingPng(true);
      await downloadTicketPNG(attendee);
      setDownloadSuccess('Imagen PNG descargada con éxito');
      setTimeout(() => setDownloadSuccess(null), 3500);
    } catch (err) {
      console.error('Error al descargar PNG:', err);
    } finally {
      setIsDownloadingPng(false);
    }
  };

  const handleAddToCalendar = () => {
    const title = encodeURIComponent(attendee.eventTitle);
    const details = encodeURIComponent(
      `Inscripción confirmada para ${attendee.fullName}. Boleta CLED: #${attendee.ticketCode}. Instituto Politécnico Max Henríquez Ureña.`
    );
    const location = encodeURIComponent(attendee.location);
    const cleanDate = attendee.date.replace(/-/g, '');
    const cleanTime = attendee.time.replace(/:/g, '') + '00';
    const dates = `${cleanDate}T${cleanTime}/${cleanDate}T${cleanTime}`;
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&location=${location}&dates=${dates}`;
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 sm:p-6">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in duration-300">
        
        {/* Top Celebration Ribbon */}
        <div className="bg-gradient-to-r from-emerald-600 via-teal-700 to-blue-900 text-white p-6 text-center relative">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 p-1.5 rounded-full text-emerald-100 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg shadow-emerald-950/20 text-emerald-600">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-white">
            ¡Inscripción Exitosa!
          </h2>
          <p className="text-emerald-100 text-xs mt-1">
            Tu lugar ha sido asegurado en el Instituto Politécnico Max Henríquez Ureña.
          </p>
        </div>

        {/* Digital Ticket Card */}
        <div className="p-6 bg-slate-50">
          <div className="bg-gradient-to-b from-slate-900 via-blue-950 to-slate-900 text-white rounded-xl p-5 shadow-lg border border-blue-900/60 relative overflow-hidden">
            {/* Watermark seal with official CLED logo */}
            <div className="absolute -right-6 -bottom-6 w-32 h-32 rounded-full border-4 border-blue-500/10 pointer-events-none flex items-center justify-center overflow-hidden">
              <img src={CLED_LOGO} alt="" className="w-24 h-24 object-contain opacity-15" />
            </div>

            {/* Credential Header */}
            <div className="flex items-center justify-between border-b border-blue-800/40 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-white p-0.5 flex items-center justify-center overflow-hidden">
                  <img
                    src={CLED_LOGO}
                    alt="Logo CLED"
                    className="w-full h-full object-contain"
                  />
                </div>
                <span className="text-[11px] font-bold tracking-wider uppercase text-blue-300">
                  EventosCLED • IPMHU Boleta Oficial
                </span>
              </div>
              <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                VÁLIDA
              </span>
            </div>

            {/* Event Title in Card */}
            <div className="my-3.5">
              <h4 className="text-sm font-bold text-white line-clamp-2">
                {attendee.eventTitle}
              </h4>
              <p className="text-xs text-blue-200 mt-1">
                📅 {attendee.date} &nbsp;•&nbsp; ⏰ {attendee.time} hrs
              </p>
              <p className="text-xs text-slate-300 mt-0.5 truncate">
                📍 {attendee.location}
              </p>
            </div>

            {/* Student Details */}
            <div className="bg-slate-900/80 rounded-lg p-3 border border-blue-900/50 my-3 text-xs space-y-2">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 block">Estudiante:</span>
                  <span className="font-bold text-white text-sm">
                    {attendee.fullName}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 block">Grado y Sección:</span>
                  <span className="font-bold text-blue-300">
                    {attendee.grade || 'Secundaria'} - Sección {attendee.section || 'A'}
                  </span>
                </div>
              </div>

              {attendee.technicalMajor && (
                <div className="border-t border-slate-800/80 pt-1.5 flex justify-between items-center text-[11px]">
                  <span className="text-slate-400">Especialidad Técnica:</span>
                  <span className="text-slate-200 font-medium">{attendee.technicalMajor}</span>
                </div>
              )}
            </div>

            {/* 5-Digit Ticket Code Callout */}
            <div className="pt-2 flex items-center justify-between gap-4 border-t border-blue-900/40">
              <div>
                <span className="text-[10px] uppercase tracking-widest text-blue-300 font-bold block">
                  ID de Boleta (5 Dígitos):
                </span>
                <span className="text-2xl font-mono font-black tracking-widest text-amber-400">
                  #{attendee.ticketCode}
                </span>
              </div>

              <div className="text-right">
                <span className="text-[10px] text-slate-400 block">Acceso en Puerta:</span>
                <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1 justify-end">
                  <Check className="w-3.5 h-3.5" /> ID, Nombre o Apellido
                </span>
              </div>
            </div>
          </div>

          {/* CRITICAL NOTE: NO CELLPHONES ALLOWED IN IPMHU */}
          <div className="mt-4 p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 text-xs">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-amber-900 uppercase tracking-wide text-[11px]">
                  ¡Anota tu ID de boleta (#{attendee.ticketCode}) en tu libreta!
                </p>
                <p className="text-amber-900 leading-relaxed text-[11px]">
                  Debido a las <strong>reglas internas del Instituto Politécnico Max Henríquez Ureña que prohíbe el uso de celulares en el centro</strong>, no necesitas llevar tu teléfono a la entrada.
                  En la puerta solo se verificará tu <strong>ID de boleta (#{attendee.ticketCode}), tu nombre o tu apellido</strong>.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Download success feedback toast */}
        {downloadSuccess && (
          <div className="mx-6 mb-2 p-2.5 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs flex items-center gap-2 animate-in fade-in">
            <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span className="font-semibold">{downloadSuccess}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="p-6 bg-white space-y-3">
          {/* Primary Download Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              onClick={handleDownloadPDF}
              disabled={isDownloadingPdf}
              className="py-3 px-3 rounded-xl bg-blue-900 hover:bg-blue-800 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-colors disabled:opacity-50"
            >
              {isDownloadingPdf ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileDown className="w-4 h-4 text-amber-400" />
              )}
              <span>Descargar Boleta (PDF)</span>
            </button>

            <button
              onClick={handleDownloadPNG}
              disabled={isDownloadingPng}
              className="py-3 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-colors disabled:opacity-50"
            >
              {isDownloadingPng ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Image className="w-4 h-4 text-blue-400" />
              )}
              <span>Descargar Imagen (PNG)</span>
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5">
            <button
              onClick={handleAddToCalendar}
              className="flex-1 py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center justify-center gap-2 transition-colors border border-slate-200"
            >
              <Calendar className="w-4 h-4 text-slate-600" />
              <span>Guardar en Calendario</span>
            </button>

            <button
              onClick={onClose}
              className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-blue-900 hover:bg-blue-800 text-white text-xs font-bold transition-colors shadow-xs"
            >
              Entendido / Listo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
