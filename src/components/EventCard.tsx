import React from 'react';
import { Calendar, Clock, MapPin, Users, Lock, Unlock, ArrowRight, Video, Award, CheckCircle2 } from 'lucide-react';
import { CLEDEvent } from '../types';

interface EventCardProps {
  event: CLEDEvent;
  attendeesCount: number;
  onRegister: (event: CLEDEvent) => void;
  onUnlockPrivate: (event: CLEDEvent) => void;
  isUnlocked?: boolean;
}

export const EventCard: React.FC<EventCardProps> = ({
  event,
  attendeesCount,
  onRegister,
  onUnlockPrivate,
  isUnlocked = false,
}) => {
  const isFull = event.capacity > 0 && attendeesCount >= event.capacity;

  // Format date to friendly Spanish
  const formatDate = (dateStr: string) => {
    try {
      const [year, month, day] = dateStr.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      return date.toLocaleDateString('es-ES', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  const handleActionClick = () => {
    if (!event.isPublic && !isUnlocked) {
      onUnlockPrivate(event);
    } else {
      onRegister(event);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md transition-all duration-200 flex flex-col group">
      {/* Visual Header / Banner */}
      {event.hasImage && event.imageUrl ? (
        <div className="relative h-48 w-full overflow-hidden bg-slate-100">
          <img
            src={event.imageUrl}
            alt={event.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            referrerPolicy="no-referrer"
            onError={(e) => {
              // fallback if remote image fails
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-slate-900/10 to-transparent" />
          
          {/* Top Badges */}
          <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2">
            <span className="px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wide uppercase bg-slate-900/80 text-white backdrop-blur-sm shadow-xs">
              {event.category}
            </span>
            <div className="flex items-center gap-1.5">
              {!event.isPublic ? (
                <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wide flex items-center gap-1 backdrop-blur-sm ${
                  isUnlocked
                    ? 'bg-emerald-900/90 text-emerald-100 border border-emerald-600/50'
                    : 'bg-amber-900/90 text-amber-100 border border-amber-600/50'
                }`}>
                  {isUnlocked ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                  <span>{isUnlocked ? 'Desbloqueado' : 'Privado'}</span>
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wide bg-blue-900/90 text-blue-100 backdrop-blur-sm">
                  Público
                </span>
              )}
            </div>
          </div>

          {/* Bottom tag over image */}
          <div className="absolute bottom-3 left-3 flex items-center gap-2">
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium flex items-center gap-1 backdrop-blur-sm ${
              event.isVirtual
                ? 'bg-blue-600/95 text-white'
                : 'bg-slate-900/80 text-white'
            }`}>
              {event.isVirtual ? <Video className="w-3 h-3" /> : <MapPin className="w-3 h-3 text-rose-300" />}
              <span>{event.isVirtual ? 'Virtual' : 'Presencial'}</span>
            </span>
          </div>
        </div>
      ) : (
        /* Geometric Institutional Blue Banner when Event has NO image ("opción de si aplica o no") */
        <div className="relative h-28 w-full bg-gradient-to-r from-blue-800 via-blue-700 to-indigo-800 p-4 flex flex-col justify-between border-b border-blue-600/30 text-white">
          <div className="flex items-center justify-between">
            <span className="px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wide uppercase bg-white/20 text-white border border-white/30 backdrop-blur-sm">
              {event.category}
            </span>
            {!event.isPublic ? (
              <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold tracking-wide flex items-center gap-1 ${
                isUnlocked
                  ? 'bg-emerald-950/70 text-emerald-200 border border-emerald-500/50'
                  : 'bg-amber-950/70 text-amber-200 border border-amber-500/50'
              }`}>
                {isUnlocked ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                <span>{isUnlocked ? 'Acceso Autorizado' : 'Exclusivo CLED'}</span>
              </span>
            ) : (
              <span className="text-[11px] font-semibold text-blue-100 bg-white/15 px-2 py-0.5 rounded border border-white/20">
                Público
              </span>
            )}
          </div>
          <div className="flex items-center justify-between text-xs text-blue-100">
            <span className="flex items-center gap-1.5 font-medium">
              {event.isVirtual ? <Video className="w-3.5 h-3.5 text-blue-200" /> : <MapPin className="w-3.5 h-3.5 text-rose-300" />}
              <span>{event.isVirtual ? 'Enlace Virtual CLED' : event.location.split(',')[0]}</span>
            </span>
            <span className="text-[10px] tracking-widest uppercase font-bold text-blue-200">
              IPMHU • CLED
            </span>
          </div>
        </div>
      )}

      {/* Body Card */}
      <div className="p-5 flex-1 flex flex-col justify-between">
        <div>
          {/* Title */}
          <h3 className="font-bold text-slate-900 text-lg leading-snug group-hover:text-blue-700 transition-colors line-clamp-2">
            {event.title}
          </h3>

          {/* Description */}
          <p className="text-slate-600 text-xs mt-2 line-clamp-3 leading-relaxed">
            {event.description}
          </p>

          {/* Speaker info if available */}
          {event.speaker && (
            <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 flex-shrink-0">
                <Award className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-800 truncate">{event.speaker}</p>
                {event.speakerRole && (
                  <p className="text-[11px] text-slate-500 truncate">{event.speakerRole}</p>
                )}
              </div>
            </div>
          )}

          {/* Event Meta Items */}
          <div className="mt-4 space-y-1.5 text-xs text-slate-600 bg-slate-50/80 p-3 rounded-xl border border-slate-200/80">
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-blue-700 flex-shrink-0" />
              <span className="font-semibold text-slate-800">{formatDate(event.date)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-blue-700 flex-shrink-0" />
              <span>{event.time} hrs</span>
            </div>
            <div className="flex items-start gap-2">
              <MapPin className="w-3.5 h-3.5 text-rose-500 flex-shrink-0 mt-0.5" />
              <span className="line-clamp-1">{event.location}</span>
            </div>
          </div>
        </div>

        {/* Card Footer */}
        <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between gap-3">
          {/* Attendees */}
          <div className="flex items-center gap-1.5 text-slate-700 text-xs font-semibold">
            <Users className="w-3.5 h-3.5 text-blue-700" />
            <span>{attendeesCount} {attendeesCount === 1 ? 'inscrito' : 'inscritos'}</span>
          </div>

          {/* Action Button */}
          <button
            onClick={handleActionClick}
            disabled={isFull}
            className={`px-4 py-2 rounded-xl text-xs font-bold tracking-wide flex items-center gap-1.5 transition-all shadow-xs ${
              isFull
                ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                : !event.isPublic && !isUnlocked
                ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-900/10'
                : 'bg-blue-800 hover:bg-blue-700 text-white shadow-blue-900/10'
            }`}
          >
            {!event.isPublic && !isUnlocked ? (
              <>
                <Lock className="w-3.5 h-3.5" />
                <span>Ingresar Clave</span>
              </>
            ) : isFull ? (
              <span>Inscripción Cerrada</span>
            ) : (
              <>
                <span>Inscribirme</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
