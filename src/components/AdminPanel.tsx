import React, { useState, useEffect } from 'react';
import {
  X, Shield, Lock, Calendar, Users, FileSpreadsheet, FileText, Send, Plus,
  Edit2, Trash2, CheckCircle2, Clock, MapPin, Eye, Search, Download, Upload,
  RefreshCw, Sparkles, AlertTriangle, Check, QrCode, Mail, Video, ExternalLink,
  Phone, GraduationCap, BookOpen, UserCheck, AlertCircle, DoorOpen, Database, Cloud
} from 'lucide-react';
import { CLEDEvent, Attendee, EmailLog, EventStats } from '../types';
import { exportAttendanceToExcel, exportAttendanceToPDF } from '../utils/reports';
import { checkProfanity, VALID_GRADES, VALID_SECTIONS_3RO, VALID_SECTIONS_OTHER, VALID_TECHNICAL_MAJORS } from '../utils/security';
import { CLED_LOGO } from '../utils/logo';
import {
  safeFetchJson,
  sanitizeUserErrorMessage,
  getAttendees,
  toggleAttendeeAttendance,
  deleteAttendeeRecord,
  saveEventRecord,
  deleteEventRecord,
  getAdminStats,
  getSupabaseLiveStatus,
  verifyAdminPin
} from '../services/api';

interface AdminPanelProps {
  events: CLEDEvent[];
  onRefreshEvents: () => void;
  onClose: () => void;
}

const IPMHU_PRESET_IMAGES = [
  { label: 'Auditorio Max Henríquez Ureña', url: 'https://images.unsplash.com/photo-1515187029135-18ee286d815b?auto=format&fit=crop&w=1200&q=80' },
  { label: 'Taller Técnico y Robótica', url: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=1200&q=80' },
  { label: 'Debate y Liderazgo Juvenil', url: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=1200&q=80' },
  { label: 'Laboratorio de Informática', url: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80' },
  { label: 'Acto Institucional CLED', url: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&w=1200&q=80' }
];

export const AdminPanel: React.FC<AdminPanelProps> = ({
  events,
  onRefreshEvents,
  onClose,
}) => {
  // Authentication state
  const [adminToken, setAdminToken] = useState<string | null>(() => localStorage.getItem('cled_admin_token'));
  const [pinInput, setPinInput] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  // Active Tab: default to 'doors' (Entrance Registration requested by user)
  const [activeTab, setActiveTab] = useState<'doors' | 'events' | 'attendees' | 'database'>('doors');

  // Stats
  const [stats, setStats] = useState<EventStats | null>(null);
  const [supabaseStatus, setSupabaseStatus] = useState<{ connected: boolean; totalEvents?: number; totalAttendees?: number } | null>(null);

  // Selected event for check-in and attendees
  const [selectedEventId, setSelectedEventId] = useState<string>(events[0]?.id || '');
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [attendeesLoading, setAttendeesLoading] = useState(false);

  // Search filter for entrance check-in
  const [entranceSearch, setEntranceSearch] = useState('');
  const [entranceFilter, setEntranceFilter] = useState<'all' | 'pending' | 'attended'>('all');
  const [doorNotice, setDoorNotice] = useState<string | null>(null);

  // Table search
  const [attendeeSearch, setAttendeeSearch] = useState('');

  // Event modal (Create / Edit)
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CLEDEvent | null>(null);
  const [eventFormData, setEventFormData] = useState({
    title: '',
    description: '',
    category: 'Liderazgo Escolar',
    date: new Date().toISOString().slice(0, 10),
    time: '09:00',
    location: 'Auditorio Principal, Instituto Politécnico Max Henríquez Ureña',
    isVirtual: false,
    virtualLink: '',
    hasImage: true,
    imageUrl: IPMHU_PRESET_IMAGES[0].url,
    isPublic: true,
    accessCode: 'CLED-MAX-2026',
    capacity: 150,
    speaker: '',
    speakerRole: ''
  });
  const [eventFormError, setEventFormError] = useState<string | null>(null);

  // 1. Check Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    try {
      const res = await verifyAdminPin(pinInput);
      if (res.ok && res.token) {
        setAdminToken(res.token);
        localStorage.setItem('cled_admin_token', res.token);
        return;
      }
      throw new Error(res.error || 'Clave de administración incorrecta');
    } catch (err: any) {
      setAuthError(sanitizeUserErrorMessage(err));
    }
  };

  const handleLogout = () => {
    setAdminToken(null);
    localStorage.removeItem('cled_admin_token');
  };

  // Play pleasant acoustic check-in chime via Web Audio API
  const playCheckInChime = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.08); // A5
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch {
      // Audio not permitted or supported, silent fallback
    }
  };

  // 2. Fetch Stats & Emails
  const fetchStats = async () => {
    if (!adminToken) return;
    try {
      const res = await getAdminStats(adminToken);
      if (res.stats) {
        setStats(res.stats);
      }
    } catch (err) {
      console.error('Error fetching admin stats:', err);
    }
  };

  const fetchSupabaseStatus = async () => {
    try {
      const res = await getSupabaseLiveStatus();
      if (res) {
        setSupabaseStatus(res);
      }
    } catch (err) {
      console.error('Error fetching Supabase status:', err);
    }
  };

  // 3. Fetch Attendees for selected event (retrieves real Supabase data on GitHub Pages)
  const fetchAttendees = async (eventId: string) => {
    if (!adminToken || !eventId) return;
    setAttendeesLoading(true);
    try {
      const data = await getAttendees(eventId, adminToken);
      setAttendees(data);
    } catch (err) {
      console.error('Error fetching attendees:', err);
    } finally {
      setAttendeesLoading(false);
    }
  };

  useEffect(() => {
    if (adminToken) {
      fetchStats();
      fetchSupabaseStatus();
      if (selectedEventId) {
        fetchAttendees(selectedEventId);
      }
    }
  }, [adminToken, selectedEventId]);

  useEffect(() => {
    if (!selectedEventId && events.length > 0) {
      setSelectedEventId(events[0].id);
    }
  }, [events]);

  // Attendance Toggle (Check-in)
  const handleToggleAttendance = async (attendeeId: string) => {
    if (!adminToken) return;
    const targetAttendee = attendees.find(a => a.id === attendeeId);
    if (!targetAttendee) return;
    try {
      const res = await toggleAttendeeAttendance(targetAttendee, adminToken);
      if (res.success && res.attendee) {
        const updated = res.attendee;
        setAttendees(prev => prev.map(a => a.id === updated.id ? updated : a));
        fetchStats();

        if (updated.attended) {
          playCheckInChime();
          setDoorNotice(`✓ Asistencia aceptada para: ${updated.fullName} (Boleta #${updated.ticketCode})`);
        } else {
          setDoorNotice(`Asistencia desmarcada para: ${updated.fullName}`);
        }

        setTimeout(() => setDoorNotice(null), 5000);
      }
    } catch (err) {
      console.error('Error toggling attendance:', err);
    }
  };

  // Delete attendee
  const handleDeleteAttendee = async (attendeeId: string) => {
    if (!confirm('¿Estás seguro de eliminar este registro de estudiante?')) return;
    if (!adminToken) return;
    try {
      const res = await deleteAttendeeRecord(attendeeId, adminToken);
      if (res.success) {
        setAttendees(prev => prev.filter(a => a.id !== attendeeId));
        fetchStats();
      }
    } catch (err) {
      console.error('Error deleting attendee:', err);
    }
  };

  // Save Event (Create or Edit)
  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setEventFormError(null);

    const check = checkProfanity(eventFormData.title + ' ' + eventFormData.description);
    if (check.hasProfanity) {
      setEventFormError('El texto contiene términos no permitidos.');
      return;
    }

    try {
      const res = await saveEventRecord(
        eventFormData,
        Boolean(editingEvent),
        editingEvent?.id,
        adminToken || undefined
      );

      if (!res.success) throw new Error(res.message || 'Error guardando evento');

      setIsEventModalOpen(false);
      setEditingEvent(null);
      onRefreshEvents();
      fetchStats();
    } catch (err: any) {
      setEventFormError(sanitizeUserErrorMessage(err));
    }
  };

  // Open Edit Event Modal
  const handleOpenEditEvent = (ev: CLEDEvent) => {
    setEditingEvent(ev);
    setEventFormData({
      title: ev.title,
      description: ev.description,
      category: ev.category,
      date: ev.date,
      time: ev.time,
      location: ev.location,
      isVirtual: ev.isVirtual,
      virtualLink: ev.virtualLink || '',
      hasImage: ev.hasImage,
      imageUrl: ev.imageUrl || IPMHU_PRESET_IMAGES[0].url,
      isPublic: ev.isPublic,
      accessCode: ev.accessCode || 'CLED-MAX-2026',
      capacity: ev.capacity,
      speaker: ev.speaker || '',
      speakerRole: ev.speakerRole || ''
    });
    setIsEventModalOpen(true);
  };

  // Delete Event
  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm('¿Deseas eliminar este evento y todas sus inscripciones asociadas?')) return;
    if (!adminToken) return;
    try {
      const res = await deleteEventRecord(eventId, adminToken);
      if (res.success) {
        onRefreshEvents();
        fetchStats();
        if (selectedEventId === eventId) {
          const remaining = events.filter(e => e.id !== eventId);
          setSelectedEventId(remaining[0]?.id || '');
        }
      }
    } catch (err) {
      console.error('Error deleting event:', err);
    }
  };

  const currentEvent = events.find(e => e.id === selectedEventId) || events[0];

  // Filtering for Entrance Check-In Cards
  const filteredForEntrance = attendees.filter(att => {
    // 1. Status filter
    if (entranceFilter === 'pending' && att.attended) return false;
    if (entranceFilter === 'attended' && !att.attended) return false;

    // 2. Search query: Nombre, Apellido, or Ticket ID (5 digits)
    if (!entranceSearch.trim()) return true;
    const q = entranceSearch.trim().toLowerCase();
    const fn = (att.firstName || '').toLowerCase();
    const ln = (att.lastName || '').toLowerCase();
    const full = (att.fullName || '').toLowerCase();
    const ticket = (att.ticketCode || '').toLowerCase();

    return fn.includes(q) || ln.includes(q) || full.includes(q) || ticket.includes(q);
  });

  // Filtering for general attendees table
  const filteredAttendees = attendees.filter(att => {
    if (!attendeeSearch.trim()) return true;
    const q = attendeeSearch.trim().toLowerCase();
    return (
      (att.fullName || '').toLowerCase().includes(q) ||
      (att.firstName || '').toLowerCase().includes(q) ||
      (att.lastName || '').toLowerCase().includes(q) ||
      (att.ticketCode || '').toLowerCase().includes(q) ||
      (att.email || '').toLowerCase().includes(q)
    );
  });

  // Entrance door metrics
  const totalCount = attendees.length;
  const attendedCount = attendees.filter(a => a.attended).length;
  const pendingCount = totalCount - attendedCount;

  // ----------------------------------------------------------------
  // RENDER: LOGIN SCREEN IF NOT AUTHENTICATED
  // ----------------------------------------------------------------
  if (!adminToken) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 text-white p-6 text-center relative">
            <button
              onClick={onClose}
              className="absolute right-4 top-4 p-1.5 rounded-full text-blue-200 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="w-16 h-16 bg-white rounded-2xl border border-white/40 flex items-center justify-center mx-auto mb-3 p-1 overflow-hidden shadow-sm">
              <img
                src={CLED_LOGO}
                alt="Logo CLED"
                className="w-full h-full object-contain"
              />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-white">
              Panel Administrativo CLED
            </h2>
            <p className="text-xs text-blue-100 mt-1">
              Instituto Politécnico Max Henríquez Ureña
            </p>
          </div>

          <form onSubmit={handleLogin} className="p-6 space-y-4">
            <div className="bg-blue-50/80 border border-blue-100 p-3 rounded-xl text-xs text-blue-900">
              Ingresa la clave de administración para gestionar eventos, boletas y registrar la entrada de estudiantes.
            </div>

            {authError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Clave de Seguridad PIN *
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  placeholder="Introduce tu PIN administrativo"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600 font-semibold"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-blue-800 hover:bg-blue-700 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-xs transition-colors"
              >
                Acceder al Panel
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------------------
  // RENDER: AUTHENTICATED DASHBOARD
  // ----------------------------------------------------------------
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
      <div className="relative w-full max-w-6xl bg-slate-50 rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6 max-h-[92vh] flex flex-col">
        
        {/* Top Header Bar */}
        <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 text-white px-6 py-4 flex flex-wrap items-center justify-between gap-3 border-b border-blue-950/40">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white border border-white/40 flex items-center justify-center p-0.5 overflow-hidden shadow-xs">
              <img
                src={CLED_LOGO}
                alt="Logo CLED"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-white tracking-tight">
                  Panel Administrativo CLED
                </h2>
                <span className="text-[10px] uppercase font-bold tracking-wider bg-emerald-400/20 text-emerald-200 border border-emerald-400/30 px-2 py-0.5 rounded-full">
                  Sesión Activa
                </span>
                {supabaseStatus?.connected && (
                  <span className="text-[10px] font-bold tracking-wider bg-sky-400/20 text-sky-200 border border-sky-400/30 px-2 py-0.5 rounded-full flex items-center gap-1.5" title="Base de datos PostgreSQL sincronizada con Supabase Cloud">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <Cloud className="w-3 h-3 text-sky-300" />
                    <span>Supabase DB Activa</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-blue-100">
                Instituto Politécnico Max Henríquez Ureña • Gestión de Eventos y Entradas
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 rounded-xl bg-rose-600/80 hover:bg-rose-600 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <span>Salir</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-full text-blue-200 hover:text-white hover:bg-white/15 transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main Body with Lateral Menu on the Right */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
          {/* Main Content Area (Left / Center on desktop) */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 order-2 md:order-1 min-w-0">
          
          {/* ============================================================== */}
          {/* TAB 1: REGISTRO EN PUERTA / ENTRADAS (CARDS SEARCH WORKFLOW) */}
          {/* ============================================================== */}
          {activeTab === 'doors' && (
            <div className="space-y-5">
              {/* Event Selector & Door Metrics */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex-1 max-w-md">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Seleccionar Evento en Puerta:
                  </label>
                  <select
                    value={selectedEventId}
                    onChange={(e) => setSelectedEventId(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 bg-white font-bold text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  >
                    {events.map(ev => (
                      <option key={ev.id} value={ev.id}>
                        {ev.title} — {ev.date} ({ev.time} hrs)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Real-time counters at the door */}
                <div className="flex items-center gap-3">
                  <div className="px-3.5 py-2 bg-slate-100 rounded-xl border border-slate-200 text-center min-w-[90px]">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Inscritos</span>
                    <span className="text-lg font-black text-slate-900">{totalCount}</span>
                  </div>

                  <div className="px-3.5 py-2 bg-emerald-50 rounded-xl border border-emerald-200 text-center min-w-[90px]">
                    <span className="text-[10px] uppercase font-bold text-emerald-700 block">En Evento</span>
                    <span className="text-lg font-black text-emerald-700">{attendedCount}</span>
                  </div>

                  <div className="px-3.5 py-2 bg-amber-50 rounded-xl border border-amber-200 text-center min-w-[90px]">
                    <span className="text-[10px] uppercase font-bold text-amber-700 block">Pendientes</span>
                    <span className="text-lg font-black text-amber-700">{pendingCount}</span>
                  </div>
                </div>
              </div>

              {/* Instant Search Bar & Filter Buttons */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                      <DoorOpen className="w-4 h-4 text-emerald-600" />
                      <span>Búsqueda Rápida para Registro en Entrada</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Busca por <strong>Nombre</strong>, <strong>Apellido</strong> o <strong>ID de boleta (5 dígitos)</strong> para registrar estudiantes en tarjetas.
                    </p>
                  </div>

                  {/* Filter Pills */}
                  <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
                    <button
                      onClick={() => setEntranceFilter('all')}
                      className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors ${
                        entranceFilter === 'all'
                          ? 'bg-blue-800 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Todos ({totalCount})
                    </button>
                    <button
                      onClick={() => setEntranceFilter('pending')}
                      className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors ${
                        entranceFilter === 'pending'
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Pendientes ({pendingCount})
                    </button>
                    <button
                      onClick={() => setEntranceFilter('attended')}
                      className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors ${
                        entranceFilter === 'attended'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Ingresados ({attendedCount})
                    </button>
                  </div>
                </div>

                {/* Big Search Input */}
                <div className="relative">
                  <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Escribe Nombre(s), Apellido(s) o ID de boleta (ej: 48291, Marcos, Henríquez)..."
                    value={entranceSearch}
                    onChange={(e) => setEntranceSearch(e.target.value)}
                    className="w-full pl-11 pr-10 py-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                  {entranceSearch && (
                    <button
                      onClick={() => setEntranceSearch('')}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-slate-900 bg-slate-200 hover:bg-slate-300 p-1 rounded-md"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Live Door Notice / Success Feedback Banner */}
              {doorNotice && (
                <div className="p-3.5 rounded-xl bg-emerald-100 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center justify-between animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                    <span>{doorNotice}</span>
                  </div>
                  <button
                    onClick={() => setDoorNotice(null)}
                    className="text-emerald-700 hover:text-emerald-950 text-xs"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* CARD GRID OF REGISTERED STUDENTS */}
              {attendeesLoading ? (
                <div className="p-12 text-center text-sm text-slate-500 font-medium">
                  Cargando inscripciones del evento...
                </div>
              ) : filteredForEntrance.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center space-y-2">
                  <p className="text-base font-bold text-slate-800">
                    No se encontraron estudiantes para los criterios seleccionados.
                  </p>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    {entranceSearch
                      ? `No hay coincidencias para "${entranceSearch}". Verifica el nombre, apellido o ID de 5 dígitos.`
                      : 'No hay estudiantes registrados aún en este evento.'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredForEntrance.map((att) => {
                    const firstName = att.firstName || att.fullName.split(' ')[0] || '';
                    const lastName = att.lastName || att.fullName.split(' ').slice(1).join(' ') || '';
                    const isAttended = att.attended;

                    return (
                      <div
                        key={att.id}
                        className={`bg-white rounded-2xl border transition-all duration-200 p-5 flex flex-col justify-between shadow-sm hover:shadow-md ${
                          isAttended
                            ? 'border-emerald-300 bg-emerald-50/20 ring-1 ring-emerald-400/30'
                            : 'border-slate-200 hover:border-blue-400'
                        }`}
                      >
                        {/* Card Top: Ticket ID + Status Badge */}
                        <div>
                          <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3 mb-3">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] uppercase font-black tracking-widest text-slate-400">
                                BOLETA:
                              </span>
                              <span className="px-2.5 py-0.5 rounded-lg bg-blue-950 font-mono font-black text-amber-400 text-sm tracking-wider">
                                #{att.ticketCode}
                              </span>
                            </div>

                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1 ${
                                isAttended
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                  : 'bg-amber-100 text-amber-800 border border-amber-300'
                              }`}
                            >
                              {isAttended ? (
                                <>
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>INGRESADO</span>
                                </>
                              ) : (
                                <>
                                  <Clock className="w-3 h-3" />
                                  <span>PENDIENTE</span>
                                </>
                              )}
                            </span>
                          </div>

                          {/* Student Data */}
                          <div className="space-y-2.5">
                            {/* Nombre y Apellido */}
                            <div>
                              <div className="flex items-baseline gap-1.5">
                                <span className="text-xs text-slate-500 font-semibold">Nombre(s):</span>
                                <span className="text-sm font-extrabold text-slate-900">{firstName || att.fullName}</span>
                              </div>
                              <div className="flex items-baseline gap-1.5">
                                <span className="text-xs text-slate-500 font-semibold">Apellido(s):</span>
                                <span className="text-sm font-extrabold text-slate-900">{lastName || '—'}</span>
                              </div>
                            </div>

                            {/* Academic Badge: Grado & Sección */}
                            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                              <div className="flex justify-between items-center">
                                <span className="text-slate-500 font-medium">Grado:</span>
                                <span className="font-bold text-blue-900">{att.grade || 'Secundaria'}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-slate-500 font-medium">Sección:</span>
                                <span className="font-bold text-blue-900">Sección {att.section || 'A'}</span>
                              </div>
                              <div className="flex justify-between items-center pt-1 border-t border-slate-200/60">
                                <span className="text-slate-500 font-medium">Técnico:</span>
                                <span className="font-semibold text-slate-800 text-right max-w-[170px] truncate">
                                  {att.grade === '3ro'
                                    ? 'No Habilitada (Ciclo General)'
                                    : (att.technicalMajor || 'General')}
                                </span>
                              </div>
                            </div>

                            {/* Contact Details */}
                            <div className="space-y-1 text-xs text-slate-600">
                              <p className="flex items-center gap-1.5 font-mono">
                                <Phone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                                <span>{att.phone}</span>
                              </p>
                              <p className="flex items-center gap-1.5 truncate text-[11px]">
                                <Mail className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                                <span className="truncate">{att.email}</span>
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Card Bottom: "Aceptar Asistencia" Action */}
                        <div className="mt-4 pt-3 border-t border-slate-100">
                          {!isAttended ? (
                            <button
                              onClick={() => handleToggleAttendance(att.id)}
                              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] text-white rounded-xl text-xs font-extrabold uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm transition-all"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Aceptar Asistencia</span>
                            </button>
                          ) : (
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-[11px] text-emerald-800 font-bold flex items-center gap-1">
                                <Check className="w-4 h-4 text-emerald-600" />
                                <span>
                                  Asistencia Registrada{' '}
                                  {att.attendedAt && (
                                    <span className="font-mono text-[10px] text-slate-500">
                                      ({new Date(att.attendedAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })})
                                    </span>
                                  )}
                                </span>
                              </div>

                              <button
                                onClick={() => handleToggleAttendance(att.id)}
                                className="px-2.5 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-50 rounded-lg border border-rose-200 transition-colors"
                                title="Desmarcar si se registró por error"
                              >
                                Revertir
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 2: EVENTS MANAGEMENT */}
          {/* ============================================================== */}
          {activeTab === 'events' && (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm">
                    Eventos del Instituto Politécnico Max Henríquez Ureña
                  </h3>
                  <p className="text-xs text-slate-500">
                    Crea, modifica o elimina eventos institucionales, configura eventos públicos o privados con clave.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setEditingEvent(null);
                    setEventFormData({
                      title: '',
                      description: '',
                      category: 'Liderazgo Escolar',
                      date: new Date().toISOString().slice(0, 10),
                      time: '09:00',
                      location: 'Auditorio Principal, Instituto Politécnico Max Henríquez Ureña',
                      isVirtual: false,
                      virtualLink: '',
                      hasImage: true,
                      imageUrl: IPMHU_PRESET_IMAGES[0].url,
                      isPublic: true,
                      accessCode: 'CLED-MAX-2026',
                      capacity: 150,
                      speaker: '',
                      speakerRole: ''
                    });
                    setIsEventModalOpen(true);
                  }}
                  className="px-4 py-2 rounded-lg bg-blue-900 hover:bg-blue-800 text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span>Nuevo Evento</span>
                </button>
              </div>

              {/* Events Table */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100/80 text-slate-700 uppercase font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-3">Evento</th>
                      <th className="p-3">Fecha / Hora</th>
                      <th className="p-3">Lugar / Modalidad</th>
                      <th className="p-3">Acceso</th>
                      <th className="p-3">Imagen</th>
                      <th className="p-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-800">
                    {events.map(ev => (
                      <tr key={ev.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3 max-w-xs">
                          <p className="font-bold text-slate-900 truncate">{ev.title}</p>
                          <p className="text-[11px] text-slate-500 truncate">{ev.category}</p>
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <p className="font-semibold text-slate-800">{ev.date}</p>
                          <p className="text-[11px] text-slate-500">{ev.time} hrs</p>
                        </td>
                        <td className="p-3 max-w-[200px] truncate">
                          <p className="truncate font-medium text-slate-700">{ev.location}</p>
                          <p className="text-[11px] text-blue-600">{ev.isVirtual ? 'Virtual' : 'Presencial'}</p>
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          {ev.isPublic ? (
                            <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold">
                              Público
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold flex items-center gap-1 w-fit">
                              <Lock className="w-2.5 h-2.5" />
                              <span>{ev.accessCode}</span>
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          {ev.hasImage ? (
                            <span className="text-[10px] bg-blue-50 text-blue-800 font-semibold px-2 py-0.5 rounded border border-blue-200">
                              Con Imagen
                            </span>
                          ) : (
                            <span className="text-[10px] bg-slate-100 text-slate-600 font-semibold px-2 py-0.5 rounded">
                              Sin Imagen
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenEditEvent(ev)}
                              className="p-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100"
                              title="Editar Evento"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteEvent(ev.id)}
                              className="p-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100"
                              title="Eliminar Evento"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 3: ATTENDEES LIST & OFFICIAL REPORTS */}
          {/* ============================================================== */}
          {activeTab === 'attendees' && (
            <div className="space-y-5">
              <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-1 max-w-md">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Seleccionar Evento para Reportes:
                  </label>
                  <select
                    value={selectedEventId}
                    onChange={(e) => setSelectedEventId(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white font-semibold text-slate-800 focus:ring-2 focus:ring-blue-600"
                  >
                    {events.map(ev => (
                      <option key={ev.id} value={ev.id}>
                        {ev.title} ({ev.date})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => {
                      if (currentEvent) exportAttendanceToExcel(currentEvent, attendees);
                    }}
                    disabled={attendees.length === 0}
                    className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 disabled:bg-slate-300 text-white text-xs font-bold flex items-center gap-2 shadow-sm transition-all"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>Exportar a Excel (.xlsx)</span>
                  </button>

                  <button
                    onClick={() => {
                      if (currentEvent) exportAttendanceToPDF(currentEvent, attendees);
                    }}
                    disabled={attendees.length === 0}
                    className="px-4 py-2 rounded-lg bg-rose-700 hover:bg-rose-600 disabled:bg-slate-300 text-white text-xs font-bold flex items-center gap-2 shadow-sm transition-all"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Exportar a PDF Oficial</span>
                  </button>
                </div>
              </div>

              {/* Table search and list */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                      Inscritos ({attendees.length})
                    </span>
                    <span className="text-xs text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      {attendees.filter(a => a.attended).length} Presentes
                    </span>
                    <span className="text-xs text-rose-700 font-semibold bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                      {attendees.filter(a => !a.attended).length} Ausentes
                    </span>
                  </div>

                  <div className="relative max-w-xs w-full">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Buscar por nombre o boleta..."
                      value={attendeeSearch}
                      onChange={(e) => setAttendeeSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100/80 text-slate-700 uppercase font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-3">#</th>
                        <th className="p-3">Boleta (5 Díg.)</th>
                        <th className="p-3">Estudiante</th>
                        <th className="p-3">Grado / Sec.</th>
                        <th className="p-3">Técnico</th>
                        <th className="p-3">Teléfono</th>
                        <th className="p-3 text-center">Asistencia</th>
                        <th className="p-3 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-800">
                      {filteredAttendees.map((att, index) => (
                        <tr key={att.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3 text-slate-400 font-mono">{index + 1}</td>
                          <td className="p-3 font-mono font-bold text-blue-900">
                            #{att.ticketCode}
                          </td>
                          <td className="p-3">
                            <p className="font-bold text-slate-900">
                              {att.firstName ? `${att.firstName} ${att.lastName || ''}` : att.fullName}
                            </p>
                            <p className="text-[11px] text-slate-500">{att.email}</p>
                          </td>
                          <td className="p-3 font-semibold text-slate-700">
                            {att.grade || 'Sec.'} - Sec. {att.section || 'A'}
                          </td>
                          <td className="p-3 max-w-[160px] truncate text-slate-600">
                            {att.grade === '3ro' ? 'N/A (Ciclo General)' : (att.technicalMajor || 'General')}
                          </td>
                          <td className="p-3 text-slate-600 font-mono">{att.phone}</td>
                          <td className="p-3 text-center whitespace-nowrap">
                            <button
                              onClick={() => handleToggleAttendance(att.id)}
                              className={`px-3 py-1 rounded-full font-bold text-[11px] transition-all flex items-center justify-center gap-1 mx-auto ${
                                att.attended
                                  ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border border-emerald-300'
                                  : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                              }`}
                            >
                              {att.attended ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                              <span>{att.attended ? 'PRESENTE' : 'AUSENTE'}</span>
                            </button>
                          </td>
                          <td className="p-3 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleDeleteAttendee(att.id)}
                                className="p-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100"
                                title="Eliminar Inscripción"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 4: DATABASE & SECURITY INFO */}
          {/* ============================================================== */}
          {activeTab === 'database' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-slate-900 to-blue-950 text-white p-6 rounded-2xl border border-blue-900/60 shadow-lg">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white">
                    <Shield className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-white">
                      Instituto Politécnico Max Henríquez Ureña — Seguridad y Persistencia
                    </h3>
                    <p className="text-xs text-blue-200">
                      Reglas institucionales de acceso y control estricto de duplicados
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 text-xs text-slate-200">
                  <div className="bg-slate-900/80 p-4 rounded-xl border border-blue-800/40 space-y-2">
                    <h4 className="font-bold text-blue-300 uppercase tracking-wider text-[11px]">
                      🔒 Control Anti-Duplicados y Filtro de Nombres
                    </h4>
                    <p className="leading-relaxed">
                      El sistema valida que ningún estudiante se registre dos veces en el mismo evento utilizando el mismo correo, nombre y apellido. Además cuenta con un filtro activo de palabras ofensivas y bromas.
                    </p>
                  </div>

                  <div className="bg-slate-900/80 p-4 rounded-xl border border-blue-800/40 space-y-2">
                    <h4 className="font-bold text-amber-300 uppercase tracking-wider text-[11px]">
                      📱 Política de No Celulares en el Centro
                    </h4>
                    <p className="leading-relaxed">
                      Conforme al reglamento interno del Instituto Politécnico Max Henríquez Ureña, los estudiantes no requieren teléfonos en la entrada; su asistencia se valida directamente con su ID de boleta de 5 dígitos, nombre o apellido.
                    </p>
                  </div>
                </div>
              </div>

              {/* Supabase Cloud Live Status Card */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-700 border border-sky-200 flex items-center justify-center">
                      <Cloud className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                        <span>Base de Datos Supabase (PostgreSQL Cloud)</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                          Conectado en Tiempo Real
                        </span>
                      </h4>
                      <p className="text-xs text-slate-500">
                        Proyecto en la nube: <code className="text-sky-800 font-mono font-bold">pqggmfhatpwqbznxhbrr.supabase.co</code>
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={fetchSupabaseStatus}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Verificar Conexión</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-slate-500 block text-[11px] font-semibold">Tabla 'events'</span>
                    <span className="text-lg font-black text-slate-900">{supabaseStatus?.totalEvents ?? events.length}</span>
                    <span className="text-slate-400 block text-[10px]">Eventos Registrados</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-slate-500 block text-[11px] font-semibold">Tabla 'attendees'</span>
                    <span className="text-lg font-black text-blue-900">{supabaseStatus?.totalAttendees ?? attendees.length}</span>
                    <span className="text-slate-400 block text-[10px]">Boletas Emitidas</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-slate-500 block text-[11px] font-semibold">Respaldo Automático</span>
                    <span className="text-sm font-bold text-emerald-700 flex items-center gap-1 mt-1">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Híbrido Activo</span>
                    </span>
                    <span className="text-slate-400 block text-[10px]">Cloud Supabase + Caché Local</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ============================================================== */}
        {/* LATERAL MENU ON THE RIGHT SIDE */}
        {/* ============================================================== */}
        <aside className="w-full md:w-72 lg:w-80 bg-white border-b md:border-b-0 md:border-l border-slate-200 flex flex-col justify-between shrink-0 p-3.5 sm:p-4 z-10 shadow-xs order-1 md:order-2 overflow-y-auto">
          <div className="space-y-3">
            <div className="hidden md:flex items-center justify-between pb-2.5 border-b border-slate-100">
              <div>
                <p className="text-[11px] font-extrabold text-slate-800 uppercase tracking-wider">
                  Menú de Gestión
                </p>
                <p className="text-[10px] text-slate-500">
                  Opciones del Panel CLED
                </p>
              </div>
              <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                Panel CLED
              </span>
            </div>

            <nav className="flex flex-row md:flex-col gap-2 overflow-x-auto md:overflow-x-visible pb-1 md:pb-0">
              {/* OPTION 1: REGISTRO EN PUERTA / ENTRADAS */}
              <button
                type="button"
                onClick={() => setActiveTab('doors')}
                className={`w-full text-left p-3 rounded-xl transition-all border flex items-center justify-between gap-2.5 shrink-0 md:shrink ${
                  activeTab === 'doors'
                    ? 'bg-emerald-50/90 border-emerald-500 text-emerald-950 ring-2 ring-emerald-500/20 shadow-xs'
                    : 'bg-slate-50/70 hover:bg-slate-100 border-slate-200/80 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    activeTab === 'doors' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-white text-emerald-700 border border-slate-200'
                  }`}>
                    <DoorOpen className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 text-left">
                    <p className="text-xs font-bold truncate">Registro en Puerta</p>
                    <p className="text-[10px] text-slate-500 truncate hidden sm:block">Control y validación de boletas</p>
                  </div>
                </div>
                {pendingCount > 0 && (
                  <span className="bg-amber-500 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 shadow-xs">
                    {pendingCount}
                  </span>
                )}
              </button>

              {/* OPTION 2: GESTIONAR EVENTOS */}
              <button
                type="button"
                onClick={() => setActiveTab('events')}
                className={`w-full text-left p-3 rounded-xl transition-all border flex items-center justify-between gap-2.5 shrink-0 md:shrink ${
                  activeTab === 'events'
                    ? 'bg-blue-50/90 border-blue-600 text-blue-950 ring-2 ring-blue-500/20 shadow-xs'
                    : 'bg-slate-50/70 hover:bg-slate-100 border-slate-200/80 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    activeTab === 'events' ? 'bg-blue-800 text-white shadow-xs' : 'bg-white text-blue-800 border border-slate-200'
                  }`}>
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 text-left">
                    <p className="text-xs font-bold truncate">Gestionar Eventos</p>
                    <p className="text-[10px] text-slate-500 truncate hidden sm:block">Crear, editar y códigos</p>
                  </div>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                  activeTab === 'events' ? 'bg-blue-200/80 text-blue-900' : 'bg-slate-200 text-slate-700'
                }`}>
                  {events.length}
                </span>
              </button>

              {/* OPTION 3: LISTADO & REPORTES */}
              <button
                type="button"
                onClick={() => setActiveTab('attendees')}
                className={`w-full text-left p-3 rounded-xl transition-all border flex items-center justify-between gap-2.5 shrink-0 md:shrink ${
                  activeTab === 'attendees'
                    ? 'bg-blue-50/90 border-blue-600 text-blue-950 ring-2 ring-blue-500/20 shadow-xs'
                    : 'bg-slate-50/70 hover:bg-slate-100 border-slate-200/80 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    activeTab === 'attendees' ? 'bg-blue-800 text-white shadow-xs' : 'bg-white text-blue-800 border border-slate-200'
                  }`}>
                    <Users className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 text-left">
                    <p className="text-xs font-bold truncate">Listado & Reportes</p>
                    <p className="text-[10px] text-slate-500 truncate hidden sm:block">Excel y PDF oficial</p>
                  </div>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                  activeTab === 'attendees' ? 'bg-blue-200/80 text-blue-900' : 'bg-slate-200 text-slate-700'
                }`}>
                  {attendees.length}
                </span>
              </button>

              {/* OPTION 4: SEGURIDAD & DATOS */}
              <button
                type="button"
                onClick={() => setActiveTab('database')}
                className={`w-full text-left p-3 rounded-xl transition-all border flex items-center justify-between gap-2.5 shrink-0 md:shrink ${
                  activeTab === 'database'
                    ? 'bg-blue-50/90 border-blue-600 text-blue-950 ring-2 ring-blue-500/20 shadow-xs'
                    : 'bg-slate-50/70 hover:bg-slate-100 border-slate-200/80 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    activeTab === 'database' ? 'bg-blue-800 text-white shadow-xs' : 'bg-white text-blue-800 border border-slate-200'
                  }`}>
                    <Shield className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 text-left">
                    <p className="text-xs font-bold truncate">Seguridad & Datos</p>
                    <p className="text-[10px] text-slate-500 truncate hidden sm:block">Supabase & respaldo</p>
                  </div>
                </div>
              </button>
            </nav>
          </div>

          {/* Bottom Widget in Lateral Sidebar */}
          <div className="mt-4 pt-3 border-t border-slate-200/80 hidden md:block space-y-2.5">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                <span>Evento Activo:</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              </div>
              <p className="text-xs font-extrabold text-blue-950 mt-1 truncate">
                {currentEvent?.title || 'Sin eventos'}
              </p>
              <p className="text-[10px] text-slate-500">
                {currentEvent?.date} • {currentEvent?.time} hrs
              </p>
            </div>

            <div className="flex items-center justify-between text-[10px] text-slate-500 px-1">
              <span>Sistema: IPMHU CLED</span>
              <span className="font-bold text-slate-700">v2.6 Cloud</span>
            </div>
          </div>
        </aside>
      </div>
    </div>

      {/* ============================================================== */}
      {/* MODAL: CREATE / EDIT EVENT */}
      {/* ============================================================== */}
      {isEventModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6">
            <div className="bg-slate-950 text-white p-5 flex items-center justify-between border-b border-blue-900/40">
              <h3 className="font-extrabold text-sm text-white">
                {editingEvent ? 'Editar Evento Institucional' : 'Crear Nuevo Evento Politécnico'}
              </h3>
              <button
                onClick={() => setIsEventModalOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEvent} className="p-6 space-y-4 text-xs text-slate-800">
              {eventFormError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg">
                  {eventFormError}
                </div>
              )}

              <div>
                <label className="block font-bold uppercase tracking-wider mb-1">Título del Evento *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Cumbre de Liderazgo Estudiantil CLED 2026"
                  value={eventFormData.title}
                  onChange={(e) => setEventFormData({ ...eventFormData, title: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold uppercase tracking-wider mb-1">Fecha *</label>
                  <input
                    type="date"
                    required
                    value={eventFormData.date}
                    onChange={(e) => setEventFormData({ ...eventFormData, date: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block font-bold uppercase tracking-wider mb-1">Hora *</label>
                  <input
                    type="time"
                    required
                    value={eventFormData.time}
                    onChange={(e) => setEventFormData({ ...eventFormData, time: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold uppercase tracking-wider mb-1">Lugar en el Politécnico *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Auditorio Principal, Instituto Politécnico Max Henríquez Ureña"
                  value={eventFormData.location}
                  onChange={(e) => setEventFormData({ ...eventFormData, location: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block font-bold uppercase tracking-wider mb-1">Descripción</label>
                <textarea
                  rows={3}
                  value={eventFormData.description}
                  onChange={(e) => setEventFormData({ ...eventFormData, description: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  placeholder="Detalles sobre el evento para los estudiantes de 3ro a 6to..."
                />
              </div>

              {/* Has Image / No Image Choice */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800">¿Lleva Imagen de Portada?</span>
                  <input
                    type="checkbox"
                    checked={eventFormData.hasImage}
                    onChange={(e) => setEventFormData({ ...eventFormData, hasImage: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                </div>

                {eventFormData.hasImage && (
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">URL de la Imagen:</label>
                    <input
                      type="url"
                      value={eventFormData.imageUrl}
                      onChange={(e) => setEventFormData({ ...eventFormData, imageUrl: e.target.value })}
                      className="w-full px-3 py-1.5 text-xs rounded border border-slate-300 bg-white"
                    />
                    <div className="flex gap-2 mt-2 overflow-x-auto pb-1">
                      {IPMHU_PRESET_IMAGES.map((img, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setEventFormData({ ...eventFormData, imageUrl: img.url })}
                          className="text-[10px] px-2 py-1 rounded bg-slate-200 hover:bg-blue-100 whitespace-nowrap"
                        >
                          {img.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Public vs Private Choice */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800">Tipo de Evento:</span>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        checked={eventFormData.isPublic}
                        onChange={() => setEventFormData({ ...eventFormData, isPublic: true })}
                        className="text-blue-600"
                      />
                      <span>Público</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        checked={!eventFormData.isPublic}
                        onChange={() => setEventFormData({ ...eventFormData, isPublic: false })}
                        className="text-blue-600"
                      />
                      <span>Privado (Clave)</span>
                    </label>
                  </div>
                </div>

                {!eventFormData.isPublic && (
                  <div className="pt-2">
                    <label className="block font-semibold text-amber-800 mb-1">Clave de Acceso para Invitados:</label>
                    <input
                      type="text"
                      value={eventFormData.accessCode}
                      onChange={(e) => setEventFormData({ ...eventFormData, accessCode: e.target.value.toUpperCase() })}
                      className="w-full px-3 py-1.5 text-xs rounded border border-amber-300 bg-white font-mono uppercase"
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsEventModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-900"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-900 hover:bg-blue-800 text-white font-bold rounded-lg uppercase tracking-wider text-xs"
                >
                  {editingEvent ? 'Guardar Cambios' : 'Crear Evento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
