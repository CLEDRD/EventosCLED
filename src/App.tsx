import React, { useState, useEffect } from 'react';
import {
  Calendar, Users, Award, Search, Sparkles, Filter, Lock,
  CheckCircle2, ArrowRight, Video, MapPin, ChevronRight, BookOpen
} from 'lucide-react';
import { CLEDEvent, Attendee } from './types';
import { Navbar } from './components/Navbar';
import { EventCard } from './components/EventCard';
import { EventRegistrationModal } from './components/EventRegistrationModal';
import { RegistrationSuccessModal } from './components/RegistrationSuccessModal';
import { TicketLookupModal } from './components/TicketLookupModal';
import { PrivateEventModal } from './components/PrivateEventModal';
import { AdminPanel } from './components/AdminPanel';
import { Footer } from './components/Footer';

export default function App() {
  const [events, setEvents] = useState<CLEDEvent[]>([]);
  const [attendeeCounts, setAttendeeCounts] = useState<{ [eventId: string]: number }>({});
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<'all' | 'public' | 'private' | 'virtual' | 'presencial'>('all');

  // Modals
  const [registeringEvent, setRegisteringEvent] = useState<CLEDEvent | null>(null);
  const [privateUnlockEvent, setPrivateUnlockEvent] = useState<CLEDEvent | null>(null);
  const [successAttendee, setSuccessAttendee] = useState<any | null>(null);
  const [isLookupOpen, setIsLookupOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);

  // Unlocked private events during current session
  const [unlockedEventIds, setUnlockedEventIds] = useState<string[]>([]);

  // Fetch events from backend API
  const fetchEvents = async () => {
    setIsLoadingEvents(true);
    try {
      const res = await fetch('/api/events');
      const data = await res.json();
      if (data.success && Array.isArray(data.events)) {
        setEvents(data.events);
      }
    } catch (err) {
      console.error('Error cargando eventos:', err);
    } finally {
      setIsLoadingEvents(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  // Filter logic
  const filteredEvents = events.filter((event) => {
    // Search query match
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = event.title.toLowerCase().includes(q);
      const matchDesc = event.description.toLowerCase().includes(q);
      const matchLoc = event.location.toLowerCase().includes(q);
      const matchSpeaker = (event.speaker || '').toLowerCase().includes(q);
      const matchCat = event.category.toLowerCase().includes(q);
      if (!matchTitle && !matchDesc && !matchLoc && !matchSpeaker && !matchCat) {
        return false;
      }
    }

    // Category filter
    if (selectedCategory !== 'all' && event.category !== selectedCategory) {
      return false;
    }

    // Type filter
    if (selectedType === 'public' && !event.isPublic) return false;
    if (selectedType === 'private' && event.isPublic) return false;
    if (selectedType === 'virtual' && !event.isVirtual) return false;
    if (selectedType === 'presencial' && event.isVirtual) return false;

    return true;
  });

  // Extract unique categories for filter pills
  const categories = ['all', ...Array.from(new Set(events.map(e => e.category)))];

  // Handler when participant completes registration
  const handleRegistrationSuccess = (attendee: any) => {
    setRegisteringEvent(null);
    setSuccessAttendee(attendee);
    fetchEvents(); // update counters
  };

  // Handler when private event key is accepted
  const handlePrivateUnlocked = (unlockedEvent: CLEDEvent) => {
    setUnlockedEventIds(prev => [...prev, unlockedEvent.id]);
    setPrivateUnlockEvent(null);
    // Open registration directly
    setRegisteringEvent(unlockedEvent);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
      {/* Navbar */}
      <Navbar
        onOpenLookup={() => setIsLookupOpen(true)}
        onOpenAdmin={() => setIsAdminOpen(true)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {/* Hero Section: Crisp, Clean Institutional Light */}
      <section className="relative bg-gradient-to-b from-blue-50/70 via-white to-slate-50 border-b border-slate-200 overflow-hidden py-14 sm:py-18">
        {/* Subtle decorative radial gradients */}
        <div className="absolute top-0 right-0 -translate-y-12 translate-x-12 w-96 h-96 bg-blue-100/40 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 translate-y-12 -translate-x-12 w-80 h-80 bg-indigo-100/30 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-3xl">
            {/* Top Institutional Badge */}
            <div className="inline-flex items-center px-3.5 py-1.5 rounded-full bg-blue-100/80 border border-blue-200/80 text-blue-900 text-xs font-bold uppercase tracking-wider mb-5 shadow-xs">
              <span>Instituto Politécnico Max Henríquez Ureña</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-slate-900 leading-tight font-sans">
              Formación de Líderes, Talleres Técnicos y Eventos Estudiantiles
            </h1>

            {/* Subtitle */}
            <p className="mt-4 text-base sm:text-lg text-slate-600 font-normal leading-relaxed">
              Inscríbete en las conferencias formativas, talleres técnicos y jornadas organizadas por el <strong className="text-slate-800 font-semibold">Club de Liderazgo Estudiantil y Desarrollo (CLED)</strong> para estudiantes de 3ro a 6to de secundaria del <strong className="text-slate-800 font-semibold">Instituto Politécnico Max Henríquez Ureña</strong>.
            </p>

            {/* Notice regarding IPMHU cell phone policy & ticket ID */}
            <div className="mt-5 p-4 rounded-xl bg-amber-50/90 border border-amber-200/80 text-amber-900 text-xs leading-relaxed max-w-2xl shadow-xs">
              <span className="font-extrabold text-amber-800 block mb-1">⚠️ Aviso Importante de Asistencia en Puerta:</span>
              En el Instituto Politécnico Max Henríquez Ureña está rotundamente prohibido el uso de celulares. Para ingresar al evento te exhortamos a <strong>anotar tu ID de boleta (código de 5 dígitos), tu nombre o apellido</strong> en tu libreta o cuaderno.
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <main id="eventos" className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
        
        {/* Filters and Controls */}
        <div className="mb-8 space-y-4">
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Eventos Disponibles
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Mostrando {filteredEvents.length} de {events.length} convocatorias
              </p>
            </div>

            {/* Type selector (Público, Privado, Virtual, Presencial) */}
            <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1.5 rounded-xl text-xs font-semibold border border-slate-200">
              <button
                onClick={() => setSelectedType('all')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  selectedType === 'all' ? 'bg-white text-slate-900 shadow-xs font-bold border border-slate-200/80' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setSelectedType('public')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  selectedType === 'public' ? 'bg-white text-blue-900 shadow-xs font-bold border border-slate-200/80' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Públicos
              </button>
              <button
                onClick={() => setSelectedType('private')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 ${
                  selectedType === 'private' ? 'bg-white text-amber-800 shadow-xs font-bold border border-slate-200/80' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Lock className="w-3 h-3" />
                <span>Privados</span>
              </button>
              <button
                onClick={() => setSelectedType('presencial')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  selectedType === 'presencial' ? 'bg-white text-slate-900 shadow-xs font-bold border border-slate-200/80' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Presenciales
              </button>
              <button
                onClick={() => setSelectedType('virtual')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  selectedType === 'virtual' ? 'bg-white text-blue-800 shadow-xs font-bold border border-slate-200/80' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Virtuales
              </button>
            </div>
          </div>

          {/* Category Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            <span className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider whitespace-nowrap">
              Categoría:
            </span>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-full whitespace-nowrap font-semibold transition-all ${
                  selectedCategory === cat
                    ? 'bg-blue-800 text-white font-bold shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                {cat === 'all' ? 'Todas las Categorías' : cat}
              </button>
            ))}
          </div>
        </div>

        {/* Event Cards Grid */}
        {isLoadingEvents ? (
          <div className="py-20 text-center text-slate-500 text-sm">
            <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <span>Cargando convocatorias institucionales...</span>
          </div>
        ) : events.length === 0 ? (
          <div className="py-16 text-center bg-white rounded-2xl border border-slate-200/80 p-8 sm:p-10 shadow-xs max-w-xl mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 text-blue-800 flex items-center justify-center mx-auto mb-4 border border-blue-100 shadow-xs">
              <Calendar className="w-7 h-7 text-blue-800" />
            </div>
            <h3 className="font-extrabold text-slate-900 text-lg sm:text-xl tracking-tight">
              Próximamente Nuevas Actividades
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 mt-2.5 leading-relaxed max-w-md mx-auto">
              Estamos preparando las próximas jornadas formativas, talleres técnicos y encuentros de liderazgo estudiantil del Instituto Politécnico Max Henríquez Ureña. ¡Mantente atento a los anuncios de la directiva!
            </p>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="py-16 text-center bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
              <Search className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">No se encontraron eventos</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              No hay actividades que coincidan con los filtros o término de búsqueda seleccionado.
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
                setSelectedType('all');
              }}
              className="mt-4 px-4 py-2 bg-blue-800 hover:bg-blue-700 text-white rounded-xl text-xs font-bold"
            >
              Restablecer Filtros
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEvents.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                attendeesCount={attendeeCounts[event.id] || 0}
                onRegister={(ev) => setRegisteringEvent(ev)}
                onUnlockPrivate={(ev) => setPrivateUnlockEvent(ev)}
                isUnlocked={unlockedEventIds.includes(event.id)}
              />
            ))}
          </div>
        )}

        {/* Institutional Accreditation Banner - Luminous and Refined */}
        <section className="mt-16 bg-gradient-to-br from-blue-50 via-slate-50 to-indigo-50/50 rounded-2xl p-8 shadow-xs border border-blue-200/70 relative overflow-hidden">
          <div className="max-w-2xl relative z-10">
            <span className="text-[10px] font-bold tracking-widest uppercase bg-blue-100 text-blue-900 border border-blue-200 px-2.5 py-1 rounded-full">
              Compromiso de Calidad Académica
            </span>
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 mt-3 tracking-tight">
              ¿Por qué asistir a los eventos de CLED?
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed">
              Cada sesión está diseñada con metodologías de caso, talleres técnicos y liderazgo práctico para el desarrollo integral del estudiante del Instituto Politécnico Max Henríquez Ureña. Al registrar tu asistencia física, recibirás tu acreditación verificada oficial.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-4 text-xs font-semibold">
              <button
                onClick={() => setIsLookupOpen(true)}
                className="px-4 py-2.5 rounded-xl bg-blue-800 hover:bg-blue-700 text-white flex items-center gap-2 shadow-xs transition-all font-bold"
              >
                <span>Validar Mi Boleta de Asistencia</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer with Discreet Admin Button */}
      <Footer onOpenAdmin={() => setIsAdminOpen(true)} />

      {/* ---------------------------------------------------- */}
      {/* MODALS */}
      {/* ---------------------------------------------------- */}

      {/* 1. Registration Modal */}
      {registeringEvent && (
        <EventRegistrationModal
          event={registeringEvent}
          onClose={() => setRegisteringEvent(null)}
          onSuccess={handleRegistrationSuccess}
        />
      )}

      {/* 2. Success Ticket Modal */}
      {successAttendee && (
        <RegistrationSuccessModal
          attendee={successAttendee}
          onClose={() => setSuccessAttendee(null)}
        />
      )}

      {/* 3. Ticket Lookup Modal */}
      {isLookupOpen && (
        <TicketLookupModal onClose={() => setIsLookupOpen(false)} />
      )}

      {/* 4. Private Event Unlock Modal */}
      {privateUnlockEvent && (
        <PrivateEventModal
          event={privateUnlockEvent}
          onClose={() => setPrivateUnlockEvent(null)}
          onUnlocked={handlePrivateUnlocked}
        />
      )}

      {/* 5. Admin Panel Modal */}
      {isAdminOpen && (
        <AdminPanel
          events={events}
          onRefreshEvents={fetchEvents}
          onClose={() => setIsAdminOpen(false)}
        />
      )}

    </div>
  );
}
