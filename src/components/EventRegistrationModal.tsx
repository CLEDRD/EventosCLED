import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, CheckCircle2, User, Mail, Phone, BookOpen, GraduationCap, Lock, Loader2, AlertCircle, Info } from 'lucide-react';
import { CLEDEvent } from '../types';
import { checkProfanity, VALID_GRADES, VALID_SECTIONS_3RO, VALID_SECTIONS_OTHER, VALID_TECHNICAL_MAJORS } from '../utils/security';

interface EventRegistrationModalProps {
  event: CLEDEvent;
  onClose: () => void;
  onSuccess: (attendeeData: any) => void;
}

export const EventRegistrationModal: React.FC<EventRegistrationModalProps> = ({
  event,
  onClose,
  onSuccess,
}) => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    grade: '4to' as '3ro' | '4to' | '5to' | '6to',
    section: 'A',
    technicalMajor: 'Desarrollo y Adm. Apps. Informáticas',
    phone: '',
    email: '',
    accessCode: event.accessCode || ''
  });

  const [nameWarning, setNameWarning] = useState<string | null>(null);
  const [lastNameWarning, setLastNameWarning] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // When grade changes, update section and technical availability
  const handleGradeChange = (newGrade: '3ro' | '4to' | '5to' | '6to') => {
    if (newGrade === '3ro') {
      setFormData(prev => ({
        ...prev,
        grade: newGrade,
        section: prev.section, // A-E are valid
        technicalMajor: '' // Not enabled for 3ro
      }));
    } else {
      // 4to, 5to, 6to
      setFormData(prev => ({
        ...prev,
        grade: newGrade,
        section: ['A', 'B'].includes(prev.section) ? prev.section : 'A',
        technicalMajor: prev.technicalMajor || VALID_TECHNICAL_MAJORS[0]
      }));
    }
  };

  // Live profanity check on first name
  const handleFirstNameChange = (val: string) => {
    setFormData(prev => ({ ...prev, firstName: val }));
    if (val.trim().length >= 2) {
      const check = checkProfanity(val);
      if (check.hasProfanity) {
        setNameWarning(check.reason || 'Palabra no permitida por el filtro institucional.');
      } else {
        setNameWarning(null);
      }
    } else {
      setNameWarning(null);
    }
  };

  // Live profanity check on last name
  const handleLastNameChange = (val: string) => {
    setFormData(prev => ({ ...prev, lastName: val }));
    if (val.trim().length >= 2) {
      const check = checkProfanity(val);
      if (check.hasProfanity) {
        setLastNameWarning(check.reason || 'Palabra no permitida por el filtro institucional.');
      } else {
        setLastNameWarning(null);
      }
    } else {
      setLastNameWarning(null);
    }
  };

  // Friendly phone formatter for: +1 (000) 000 - 0000
  const handlePhoneChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '');
    let clean = digits;
    if (clean.startsWith('1')) {
      clean = clean.substring(1);
    }
    clean = clean.substring(0, 10);

    let formatted = '+1 ';
    if (clean.length > 0) {
      formatted += `(${clean.substring(0, 3)}`;
    }
    if (clean.length >= 4) {
      formatted += `) ${clean.substring(3, 6)}`;
    }
    if (clean.length >= 7) {
      formatted += ` - ${clean.substring(6, 10)}`;
    }

    setFormData(prev => ({
      ...prev,
      phone: clean.length === 0 ? '' : formatted
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Verify warnings
    const fnCheck = checkProfanity(formData.firstName);
    if (fnCheck.hasProfanity) {
      setErrorMessage(fnCheck.reason || 'Nombre no autorizado por el filtro institucional.');
      return;
    }

    const lnCheck = checkProfanity(formData.lastName);
    if (lnCheck.hasProfanity) {
      setErrorMessage(lnCheck.reason || 'Apellido no autorizado por el filtro institucional.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`/api/events/${event.id}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          grade: formData.grade,
          section: formData.section,
          technicalMajor: formData.grade === '3ro' ? undefined : formData.technicalMajor,
          phone: formData.phone.trim(),
          email: formData.email.trim(),
          accessCode: formData.accessCode,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Error al procesar la inscripción');
      }

      // Success
      onSuccess(data.attendee);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error de conexión con el servidor de inscripciones.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6">
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8">
        
        {/* Institutional Navy Header */}
        <div className="bg-gradient-to-r from-slate-950 via-blue-950 to-slate-900 text-white p-6 relative">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded text-[11px] font-bold tracking-widest uppercase bg-blue-600/90 text-white">
              IPMHU • CLED
            </span>
            <span className="text-[11px] text-blue-200 font-medium">
              Instituto Politécnico Max Henríquez Ureña
            </span>
            {!event.isPublic && (
              <span className="px-2 py-0.5 rounded text-[11px] font-bold tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                <Lock className="w-3 h-3" />
                <span>Privado</span>
              </span>
            )}
          </div>

          <h2 className="text-xl font-bold tracking-tight text-white line-clamp-2">
            Inscripción a Evento: {event.title}
          </h2>
          
          <p className="text-xs text-blue-200/90 mt-1.5 flex items-center gap-3">
            <span>📅 {event.date}</span>
            <span>⏰ {event.time} hrs</span>
            <span>📍 {event.isVirtual ? 'Virtual' : event.location.split(',')[0]}</span>
          </p>
        </div>

        {/* MANDATORY WARNING NOTICE: RULES ON PRESENTING ID & CELLPHONE PROHIBITION */}
        <div className="bg-amber-50 border-b border-amber-200 p-4 sm:p-5 text-amber-950">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-200 text-amber-900 flex items-center justify-center flex-shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5 text-amber-800" />
            </div>
            <div className="space-y-1.5 text-xs">
              <p className="font-extrabold uppercase tracking-wide text-amber-900 flex items-center gap-1.5">
                <span>Aviso Obligatorio para el Ingreso al Evento</span>
              </p>
              <p className="text-amber-900 font-medium leading-relaxed">
                Resulta <strong className="underline">indispensable presentar el ID de la boleta (máximo 5 dígitos), tu nombre o apellido</strong> para ingresar al evento.
              </p>
              <div className="p-2.5 bg-amber-100/90 rounded-lg border border-amber-300/80 text-[11.5px] leading-relaxed text-amber-950">
                <strong>Recomendación CLED:</strong> Te exhortamos enfáticamente a <strong>anotar tu ID de boleta (código de 5 dígitos), tu nombre o tu apellido en tu cuaderno o libreta</strong> debido a las <u>reglas internas del Instituto Politécnico Max Henríquez Ureña que prohíben rotundamente el uso de celulares en el centro</u>. Lo puedes llevar, pero CLED no se hace cargo del retiro del mismo ni exhorta a su uso dentro del plantel.
              </div>
            </div>
          </div>
        </div>

        {/* Registration Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-slate-800">
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">No se pudo completar la inscripción:</p>
                <p className="mt-0.5">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Nombre (s) and Apellido (s) Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-blue-700" />
                <span>Nombre (s) *</span>
              </label>
              <input
                type="text"
                required
                placeholder="Ej: Marcos Antonio"
                value={formData.firstName}
                onChange={(e) => handleFirstNameChange(e.target.value)}
                className={`w-full px-3.5 py-2.5 text-sm rounded-lg border focus:outline-none focus:ring-2 transition-all ${
                  nameWarning
                    ? 'border-rose-300 bg-rose-50/50 focus:ring-rose-500'
                    : 'border-slate-300 bg-white focus:ring-blue-600'
                }`}
              />
              {nameWarning ? (
                <p className="text-[11px] text-rose-600 mt-1 font-medium">{nameWarning}</p>
              ) : (
                <p className="text-[11px] text-slate-500 mt-1">Tu primer y/o segundo nombre.</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-blue-700" />
                <span>Apellido (s) *</span>
              </label>
              <input
                type="text"
                required
                placeholder="Ej: Henríquez Ureña"
                value={formData.lastName}
                onChange={(e) => handleLastNameChange(e.target.value)}
                className={`w-full px-3.5 py-2.5 text-sm rounded-lg border focus:outline-none focus:ring-2 transition-all ${
                  lastNameWarning
                    ? 'border-rose-300 bg-rose-50/50 focus:ring-rose-500'
                    : 'border-slate-300 bg-white focus:ring-blue-600'
                }`}
              />
              {lastNameWarning ? (
                <p className="text-[11px] text-rose-600 mt-1 font-medium">{lastNameWarning}</p>
              ) : (
                <p className="text-[11px] text-slate-500 mt-1">Tus apellidos oficiales.</p>
              )}
            </div>
          </div>

          {/* Grado and Sección Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <GraduationCap className="w-3.5 h-3.5 text-blue-700" />
                <span>Grado *</span>
              </label>
              <select
                value={formData.grade}
                onChange={(e) => handleGradeChange(e.target.value as any)}
                className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 bg-white font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {VALID_GRADES.map(g => (
                  <option key={g} value={g}>{g} de Secundaria</option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500 mt-1">Opciones: 3ro, 4to, 5to, 6to.</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-blue-700" />
                <span>Sección *</span>
              </label>
              <select
                value={formData.section}
                onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 bg-white font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {formData.grade === '3ro' ? (
                  VALID_SECTIONS_3RO.map(sec => (
                    <option key={sec} value={sec}>Sección {sec}</option>
                  ))
                ) : (
                  VALID_SECTIONS_OTHER.map(sec => (
                    <option key={sec} value={sec}>Sección {sec}</option>
                  ))
                )}
              </select>
              <p className="text-[11px] text-slate-500 mt-1">
                {formData.grade === '3ro' ? 'Para 3ro: A, B, C, D o E' : 'Para 4to, 5to y 6to: Solo A o B'}
              </p>
            </div>
          </div>

          {/* Técnico Row */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <GraduationCap className="w-3.5 h-3.5 text-blue-700" />
                <span>Técnico (Especialidad Técnica)</span>
              </span>
              {formData.grade === '3ro' && (
                <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                  Casilla No Habilitada para 3ro
                </span>
              )}
            </label>

            {formData.grade === '3ro' ? (
              <div className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed flex items-center justify-between">
                <span>No habilitada (En 3ro se cursa Ciclo General)</span>
                <span className="text-xs text-slate-400">N/A</span>
              </div>
            ) : (
              <select
                value={formData.technicalMajor}
                onChange={(e) => setFormData({ ...formData, technicalMajor: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {VALID_TECHNICAL_MAJORS.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            )}
            <p className="text-[11px] text-slate-500 mt-1">
              {formData.grade === '3ro'
                ? 'Esta casilla no está habilitada porque la especialización técnica inicia a partir de 4to.'
                : 'Selecciona tu mención técnica en el Instituto Politécnico Max Henríquez Ureña.'}
            </p>
          </div>

          {/* Telefono & Email Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-blue-700" />
                <span>Teléfono *</span>
              </label>
              <input
                type="tel"
                required
                placeholder="+1 (000) 000 - 0000"
                value={formData.phone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 bg-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              <p className="text-[11px] text-slate-500 mt-1">Formato: +1 (000) 000 - 0000</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-blue-700" />
                <span>Email *</span>
              </label>
              <input
                type="email"
                required
                placeholder="nombreusuarios@dominio.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 lowercase"
              />
            </div>
          </div>

          {/* If event is private and code is required */}
          {!event.isPublic && (
            <div className="p-3.5 rounded-xl bg-amber-50/90 border border-amber-200">
              <label className="block text-xs font-bold text-amber-900 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-amber-700" />
                <span>Clave de Invitación / Código Privado CLED *</span>
              </label>
              <input
                type="text"
                required
                placeholder="Código de acceso proporcionado por el club"
                value={formData.accessCode}
                onChange={(e) => setFormData({ ...formData, accessCode: e.target.value })}
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-amber-300 bg-white uppercase font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <p className="text-[11px] text-amber-800 mt-1">Este evento es exclusivo para miembros convocados.</p>
            </div>
          )}

          {/* Modal Buttons */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading || Boolean(nameWarning) || Boolean(lastNameWarning)}
              className="px-6 py-2.5 bg-blue-900 hover:bg-blue-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-bold uppercase tracking-wider rounded-lg shadow-md shadow-blue-950/20 flex items-center gap-2 transition-all"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Procesando Boleta...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Completar Inscripción</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
