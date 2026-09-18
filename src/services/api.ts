import { CLEDEvent, Attendee, EventStatus } from '../types';
import { supabase, eventFromRow, eventToRow, attendeeFromRow, attendeeToRow, emailLogFromRow } from '../lib/supabase';
import { statusToLegacySupabase, encodeStatusInDescription } from '../utils/eventStatus';

// Initial fallback event if both backend API and Supabase network fail
const FALLBACK_EVENTS: CLEDEvent[] = [
  {
    id: 'event-1789524185867-tq9',
    title: 'Apertura CLED 2K26',
    description: 'Acto formal de apertura institucional del Club de Liderazgo Estudiantil y Desarrollo (CLED).',
    category: 'Liderazgo Escolar',
    date: '2026-09-17',
    time: '13:50',
    location: 'Salón Multiusos, Instituto Politécnico Max Henríquez Ureña',
    isVirtual: false,
    hasImage: false,
    isPublic: true,
    capacity: 150,
    status: 'active',
    createdAt: '2026-09-16T02:03:05.95299+00:00',
    updatedAt: '2026-09-16T02:03:05.95299+00:00'
  }
];

/**
 * Safely parses a Fetch response into JSON without throwing DOMException
 * 'The string did not match the expected pattern' on non-JSON/HTML 404 responses.
 */
export async function safeFetchJson<T = any>(
  url: string,
  options?: RequestInit
): Promise<{ ok: boolean; data: T | null; status: number; error?: string }> {
  try {
    const res = await fetch(url, options);
    const contentType = res.headers.get('content-type') || '';

    if (!contentType.includes('application/json')) {
      return {
        ok: false,
        data: null,
        status: res.status,
        error: `El servidor no devolvió una respuesta válida (${res.status}).`
      };
    }

    const json = await res.json();

    if (!res.ok) {
      return {
        ok: false,
        data: json,
        status: res.status,
        error: json.message || `Error en la solicitud (${res.status}).`
      };
    }

    return { ok: true, data: json, status: res.status };
  } catch (err: any) {
    return {
      ok: false,
      data: null,
      status: 0,
      error: 'Error de red o servidor no disponible.'
    };
  }
}

/**
 * Sanitizes any raw exception string so technical DOMException errors
 * like "The string did not match the expected pattern" are never displayed to students.
 */
export function sanitizeUserErrorMessage(error: any): string {
  if (!error) return 'Ocurrió un error inesperado al procesar la solicitud.';
  const msg = typeof error === 'string' ? error : (error.message || String(error));
  
  if (
    msg.includes('The string did not match the expected pattern') ||
    msg.includes('Unexpected token') ||
    msg.includes('is not valid JSON') ||
    msg.includes('JSON Parse error') ||
    msg.includes('Failed to fetch')
  ) {
    return 'No se pudo conectar con el servidor central. Por favor verifica tu conexión a internet o intenta nuevamente.';
  }
  
  return msg;
}

/**
 * Generates a unique 5-digit ticket code
 */
function generateTicketCode(): string {
  return String(Math.floor(10000 + Math.random() * 90000));
}

/**
 * Fetch all events (tries Express backend first; falls back seamlessly to Supabase; falls back to static seed)
 */
export async function getEvents(): Promise<CLEDEvent[]> {
  // 1. Try local or Cloud Run backend API
  const apiResult = await safeFetchJson<{ success: boolean; events: CLEDEvent[] }>('/api/events');
  if (apiResult.ok && apiResult.data?.events && Array.isArray(apiResult.data.events)) {
    return apiResult.data.events;
  }

  // 2. Direct Supabase fallback (crucial for GitHub Pages static hosting)
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('date', { ascending: true });

      if (!error && data && data.length > 0) {
        return data.map(eventFromRow);
      }
    } catch (err) {
      console.warn('Supabase query error:', err);
    }
  }

  // 3. Fallback static seed
  return FALLBACK_EVENTS;
}

/**
 * Registers an attendee for an event.
 * Tries the backend API first, but if running on static GitHub Pages,
 * directly handles validation and storage in Supabase.
 */
export async function registerAttendee(
  event: CLEDEvent,
  formData: {
    firstName: string;
    lastName: string;
    grade: string;
    section: string;
    technicalMajor?: string;
    phone: string;
    email: string;
    accessCode?: string;
  }
): Promise<{ success: boolean; attendee?: any; message?: string }> {
  // Pre-validate event status
  const normStatus = (event.status || 'DISPONIBLE').toUpperCase();
  if (normStatus !== 'ACTIVE' && normStatus !== 'DISPONIBLE') {
    let msg = 'Este evento no está admitiendo inscripciones.';
    if (normStatus === 'SOLD OUT') {
      msg = 'Las boletas para este evento están agotadas (SOLD OUT).';
    } else if (normStatus === 'SUSPENDIDO' || normStatus === 'SUPENSDIDO') {
      msg = 'Este evento se encuentra temporalmente suspendido.';
    } else if (normStatus === 'PROXIMAMENTE') {
      msg = 'Las inscripciones para este evento estarán abiertas próximamente.';
    } else if (normStatus === 'PASADO' || normStatus === 'COMPLETED') {
      msg = 'Este evento ya ha finalizado.';
    }
    return { success: false, message: msg };
  }

  // 1. Try backend API first
  const apiResult = await safeFetchJson<{ success: boolean; attendee: any; message?: string }>(
    `/api/events/${event.id}/register`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    }
  );

  if (apiResult.ok && apiResult.data?.success && apiResult.data.attendee) {
    return { success: true, attendee: apiResult.data.attendee, message: apiResult.data.message };
  }

  // If the backend exists and explicitly returned a business error (e.g. duplicate email), return it directly
  if (apiResult.status === 400 || apiResult.status === 409 || apiResult.status === 403) {
    return { success: false, message: apiResult.error || 'No se pudo completar la inscripción.' };
  }

  // 2. Fallback to direct Supabase registration (active for GitHub Pages / static hosting)
  if (supabase) {
    try {
      const normEmail = formData.email.trim().toLowerCase();
      const normPhone = formData.phone.trim();

      // Check private access code
      if (!event.isPublic) {
        if (!formData.accessCode || formData.accessCode.trim().toUpperCase() !== (event.accessCode || '').trim().toUpperCase()) {
          return {
            success: false,
            message: 'El código de invitación o acceso especial para este evento privado no es correcto.'
          };
        }
      }

      // Check duplicate in Supabase for this event
      const { data: existingAttendees } = await supabase
        .from('attendees')
        .select('id, email, phone')
        .eq('event_id', event.id);

      if (existingAttendees && existingAttendees.length > 0) {
        const dup = existingAttendees.some(
          a => a.email?.toLowerCase() === normEmail || (a.phone && a.phone.replace(/[^0-9]/g, '') === normPhone.replace(/[^0-9]/g, ''))
        );
        if (dup) {
          return {
            success: false,
            message: 'Ya existe una inscripción registrada con este correo o teléfono para este evento.'
          };
        }
      }

      const ticketCode = generateTicketCode();
      const secretToken = `sec-${ticketCode}`;
      const nowIso = new Date().toISOString();
      const resolvedFullName = `${formData.firstName.trim()} ${formData.lastName.trim()}`.trim();

      const newAttendee: Attendee = {
        id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        eventId: event.id,
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        fullName: resolvedFullName,
        grade: (formData.grade.trim() || '4to') as '3ro' | '4to' | '5to' | '6to',
        section: formData.section.trim().toUpperCase(),
        technicalMajor: formData.grade === '3ro' ? undefined : (formData.technicalMajor ? formData.technicalMajor.trim() : undefined),
        email: normEmail,
        phone: normPhone,
        career: formData.technicalMajor || (formData.grade === '3ro' ? 'Ciclo General' : 'Secundaria Técnica'),
        academicYear: `${formData.grade} de Secundaria`,
        attended: false,
        registeredAt: nowIso,
        ticketCode,
        secretToken,
        emailConfirmationSent: false
      };

      const row = attendeeToRow(newAttendee);
      const { error: insertError } = await supabase.from('attendees').insert(row);

      if (insertError) {
        console.error('Supabase direct insert error:', insertError);
        return {
          success: false,
          message: 'Error al registrar los datos en la base de datos institucional.'
        };
      }

      return {
        success: true,
        attendee: {
          id: newAttendee.id,
          ticketCode: newAttendee.ticketCode,
          fullName: newAttendee.fullName,
          firstName: newAttendee.firstName,
          lastName: newAttendee.lastName,
          grade: newAttendee.grade,
          section: newAttendee.section,
          technicalMajor: newAttendee.technicalMajor,
          email: newAttendee.email,
          phone: newAttendee.phone,
          eventTitle: event.title,
          date: event.date,
          time: event.time,
          location: event.location,
          isVirtual: event.isVirtual,
          virtualLink: event.virtualLink,
          registeredAt: newAttendee.registeredAt
        },
        message: '¡Inscripción confirmada con éxito!'
      };
    } catch (err) {
      console.error('Direct Supabase registration failed:', err);
      return {
        success: false,
        message: sanitizeUserErrorMessage(err)
      };
    }
  }

  return {
    success: false,
    message: apiResult.error || 'Servidor no disponible para procesar la inscripción.'
  };
}

/**
 * Searches for a ticket by code and verification credential (email, phone, or name).
 */
export async function lookupTicket(
  query: string,
  verify: string
): Promise<{ success: boolean; attendee?: any; message?: string }> {
  const normQuery = query.trim().toLowerCase();
  const normVerify = verify.trim().toLowerCase();

  // 1. Try backend API first
  const apiResult = await safeFetchJson<{ success: boolean; attendee: any; message?: string }>(
    `/api/attendees/lookup?query=${encodeURIComponent(normQuery)}&verify=${encodeURIComponent(normVerify)}`
  );

  if (apiResult.ok && apiResult.data?.attendee) {
    return { success: true, attendee: apiResult.data.attendee };
  }

  if (apiResult.status === 404) {
    return { success: false, message: apiResult.error || 'No se encontró ninguna inscripción con estos datos.' };
  }

  // 2. Direct Supabase query fallback (for GitHub Pages static hosting)
  if (supabase) {
    try {
      const { data: attendees, error } = await supabase
        .from('attendees')
        .select('*')
        .eq('ticket_code', normQuery);

      if (!error && attendees && attendees.length > 0) {
        const match = attendees.find(a => {
          const aEmail = (a.email || '').toLowerCase();
          const aPhone = (a.phone || '').replace(/[^0-9]/g, '');
          const cleanVerifyPhone = normVerify.replace(/[^0-9]/g, '');
          const aFullName = (a.full_name || '').toLowerCase();
          const aLastName = (a.last_name || '').toLowerCase();

          return (
            aEmail === normVerify ||
            (cleanVerifyPhone && aPhone === cleanVerifyPhone) ||
            aFullName.includes(normVerify) ||
            aLastName.includes(normVerify)
          );
        });

        if (match) {
          // Fetch event details
          let eventDetails: any = null;
          if (match.event_id) {
            const { data: evData } = await supabase
              .from('events')
              .select('*')
              .eq('id', match.event_id)
              .maybeSingle();
            if (evData) {
              eventDetails = eventFromRow(evData);
            }
          }

          const resolved = attendeeFromRow(match);
          return {
            success: true,
            attendee: {
              ...resolved,
              event: eventDetails
            }
          };
        }
      }

      return {
        success: false,
        message: 'No se encontró ninguna inscripción con esa boleta y dato de verificación.'
      };
    } catch (err) {
      return {
        success: false,
        message: sanitizeUserErrorMessage(err)
      };
    }
  }

  return {
    success: false,
    message: apiResult.error || 'No se pudo consultar la inscripción en este momento.'
  };
}

/**
 * Verifies a private event access code
 */
export async function verifyAccessCode(
  event: CLEDEvent,
  code: string
): Promise<{ success: boolean; message?: string }> {
  // 1. Try backend API
  const apiResult = await safeFetchJson<{ success: boolean; message?: string }>(
    `/api/events/${event.id}/verify-access`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: code.trim() })
    }
  );

  if (apiResult.ok && apiResult.data?.success) {
    return { success: true };
  }

  if (apiResult.status === 401 || apiResult.status === 400) {
    return { success: false, message: apiResult.error || 'Código de invitación no válido.' };
  }

  // 2. Direct comparison with event's accessCode
  if (event.accessCode && event.accessCode.trim().toUpperCase() === code.trim().toUpperCase()) {
    return { success: true };
  }

  return {
    success: false,
    message: 'Código de invitación no válido.'
  };
}

/**
 * Fetches attendees for an event or all attendees.
 * Tries the backend API first; falls back directly to Supabase (essential for GitHub Pages static hosting).
 */
export async function getAttendees(eventId?: string, adminToken?: string): Promise<Attendee[]> {
  // 1. Try backend API first if token is available
  if (adminToken) {
    const queryParam = eventId ? `?eventId=${encodeURIComponent(eventId)}` : '';
    const apiResult = await safeFetchJson<{ attendees: Attendee[] }>(`/api/admin/attendees${queryParam}`, {
      headers: { 'x-admin-token': adminToken }
    });
    if (apiResult.ok && apiResult.data?.attendees && Array.isArray(apiResult.data.attendees)) {
      return apiResult.data.attendees;
    }
  }

  // 2. Direct Supabase query (works seamlessly on GitHub Pages static deployment)
  if (supabase) {
    try {
      let query = supabase.from('attendees').select('*').order('registered_at', { ascending: false });
      if (eventId && eventId !== 'all') {
        query = query.eq('event_id', eventId);
      }
      const { data, error } = await query;
      if (!error && data) {
        return data.map(attendeeFromRow);
      }
      if (error) {
        console.warn('Supabase getAttendees query error:', error);
      }
    } catch (err) {
      console.warn('Supabase getAttendees error:', err);
    }
  }

  return [];
}

/**
 * Toggles attendance check-in for an attendee.
 * Tries backend API first; falls back directly to Supabase for GitHub Pages.
 */
export async function toggleAttendeeAttendance(
  attendee: Attendee,
  adminToken?: string
): Promise<{ success: boolean; attendee?: Attendee; message?: string }> {
  // 1. Try backend API
  if (adminToken) {
    const apiResult = await safeFetchJson<{ success: boolean; attendee: Attendee }>(
      `/api/admin/attendees/${attendee.id}/toggle-attendance`,
      {
        method: 'POST',
        headers: { 'x-admin-token': adminToken }
      }
    );
    if (apiResult.ok && apiResult.data?.attendee) {
      return { success: true, attendee: apiResult.data.attendee };
    }
  }

  // 2. Direct Supabase update
  if (supabase) {
    try {
      const newStatus = !attendee.attended;
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from('attendees')
        .update({
          attended: newStatus,
          attended_at: newStatus ? nowIso : null
        })
        .eq('id', attendee.id)
        .select()
        .single();

      if (!error && data) {
        return { success: true, attendee: attendeeFromRow(data) };
      }
      if (error) {
        return { success: false, message: error.message };
      }
    } catch (err) {
      return { success: false, message: sanitizeUserErrorMessage(err) };
    }
  }

  return { success: false, message: 'No se pudo actualizar la asistencia.' };
}

/**
 * Deletes an attendee record.
 * Tries backend API first; falls back directly to Supabase for GitHub Pages.
 */
export async function deleteAttendeeRecord(
  attendeeId: string,
  adminToken?: string
): Promise<{ success: boolean; message?: string }> {
  if (adminToken) {
    const apiResult = await safeFetchJson(`/api/admin/attendees/${attendeeId}`, {
      method: 'DELETE',
      headers: { 'x-admin-token': adminToken }
    });
    if (apiResult.ok) {
      return { success: true };
    }
  }

  if (supabase) {
    try {
      const { error } = await supabase.from('attendees').delete().eq('id', attendeeId);
      if (!error) {
        return { success: true };
      }
      return { success: false, message: error.message };
    } catch (err) {
      return { success: false, message: sanitizeUserErrorMessage(err) };
    }
  }

  return { success: false, message: 'No se pudo eliminar el registro.' };
}

/**
 * Saves (creates or updates) an event record.
 * Tries backend API first; falls back directly to Supabase for GitHub Pages.
 */
export async function saveEventRecord(
  eventData: Partial<CLEDEvent>,
  isEditing: boolean,
  editingId?: string,
  adminToken?: string
): Promise<{ success: boolean; event?: CLEDEvent; message?: string }> {
  if (adminToken) {
    const url = isEditing && editingId ? `/api/events/${editingId}` : '/api/events';
    const method = isEditing ? 'PUT' : 'POST';
    const apiResult = await safeFetchJson<{ success: boolean; event: CLEDEvent }>(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': adminToken
      },
      body: JSON.stringify(eventData)
    });
    if (apiResult.ok && apiResult.data?.event) {
      return { success: true, event: apiResult.data.event };
    }
  }

  if (supabase) {
    try {
      const nowIso = new Date().toISOString();
      const eventToSave: CLEDEvent = {
        id: (isEditing && editingId) ? editingId : (eventData.id || `event-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`),
        title: eventData.title || 'Evento CLED',
        description: eventData.description || '',
        category: eventData.category || 'General',
        date: eventData.date || new Date().toISOString().split('T')[0],
        time: eventData.time || '09:00',
        location: eventData.location || 'Salón Multiusos, IPMHU',
        isVirtual: Boolean(eventData.isVirtual),
        virtualLink: eventData.virtualLink || undefined,
        hasImage: Boolean(eventData.hasImage),
        imageUrl: eventData.imageUrl || undefined,
        isPublic: eventData.isPublic !== undefined ? eventData.isPublic : true,
        accessCode: eventData.accessCode || undefined,
        capacity: Number(eventData.capacity) || 150,
        status: eventData.status || 'DISPONIBLE',
        speaker: eventData.speaker || undefined,
        speakerRole: eventData.speakerRole || undefined,
        createdAt: eventData.createdAt || nowIso,
        updatedAt: nowIso
      };

      const row = eventToRow(eventToSave);
      const { data, error } = await supabase.from('events').upsert(row).select().single();
      if (!error && data) {
        return { success: true, event: eventFromRow(data) };
      }
      if (error) {
        return { success: false, message: error.message };
      }
    } catch (err) {
      return { success: false, message: sanitizeUserErrorMessage(err) };
    }
  }

  return { success: false, message: 'No se pudo guardar el evento.' };
}

/**
 * Changes an event's status to DISPONIBLE, SOLD OUT, SUSPENDIDO, PROXIMAMENTE or PASADO.
 * Works seamlessly in both backend environment and direct Supabase (GitHub Pages).
 */
export async function updateEventStatus(
  eventId: string,
  newStatus: EventStatus,
  adminToken?: string
): Promise<{ success: boolean; message?: string }> {
  // 1. Try backend API if admin token is present
  if (adminToken) {
    const apiResult = await safeFetchJson<{ success: boolean; event: CLEDEvent; message?: string }>(
      `/api/events/${eventId}/status`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': adminToken
        },
        body: JSON.stringify({ status: newStatus })
      }
    );
    if (apiResult.ok && apiResult.data?.success) {
      return { success: true, message: apiResult.data.message };
    }
  }

  // 2. Direct Supabase update (for GitHub Pages static hosting or direct DB sync)
  if (supabase) {
    try {
      // First attempt: direct update on status column
      const { error } = await supabase
        .from('events')
        .update({
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', eventId);

      if (!error) {
        return { success: true, message: `Estado actualizado a ${newStatus}.` };
      }

      // If Supabase table has the check constraint events_status_check
      if (error.message?.includes('events_status_check') || error.code === '23514') {
        const legacyStatus = statusToLegacySupabase(newStatus);
        const { data: evData } = await supabase.from('events').select('description').eq('id', eventId).maybeSingle();
        const fallbackDesc = encodeStatusInDescription(newStatus, evData?.description);

        const { error: fbErr } = await supabase
          .from('events')
          .update({
            status: legacyStatus,
            description: fallbackDesc,
            updated_at: new Date().toISOString()
          })
          .eq('id', eventId);

        if (!fbErr) {
          return { success: true, message: `Estado actualizado a ${newStatus} con compatibilidad de base de datos.` };
        }
        return { success: false, message: fbErr.message };
      }

      return { success: false, message: error.message };
    } catch (err: any) {
      return { success: false, message: sanitizeUserErrorMessage(err) };
    }
  }

  return { success: false, message: 'No se pudo actualizar el estado del evento.' };
}

/**
 * Deletes an event and its attendees.
 * Tries backend API first; falls back directly to Supabase for GitHub Pages.
 */
export async function deleteEventRecord(
  eventId: string,
  adminToken?: string
): Promise<{ success: boolean; message?: string }> {
  if (adminToken) {
    const apiResult = await safeFetchJson(`/api/events/${eventId}`, {
      method: 'DELETE',
      headers: { 'x-admin-token': adminToken }
    });
    if (apiResult.ok) {
      return { success: true };
    }
  }

  if (supabase) {
    try {
      await supabase.from('attendees').delete().eq('event_id', eventId);
      const { error } = await supabase.from('events').delete().eq('id', eventId);
      if (!error) {
        return { success: true };
      }
      return { success: false, message: error.message };
    } catch (err) {
      return { success: false, message: sanitizeUserErrorMessage(err) };
    }
  }

  return { success: false, message: 'No se pudo eliminar el evento.' };
}

/**
 * Computes or retrieves admin dashboard statistics.
 * Tries backend API first; computes directly from Supabase for GitHub Pages.
 */
export async function getAdminStats(
  adminToken?: string
): Promise<{ stats: any; emails?: any[]; events?: CLEDEvent[] }> {
  if (adminToken) {
    const apiResult = await safeFetchJson<{ stats: any; emails?: any[]; events?: CLEDEvent[] }>('/api/admin/stats', {
      headers: { 'x-admin-token': adminToken }
    });
    if (apiResult.ok && apiResult.data?.stats) {
      return apiResult.data;
    }
  }

  if (supabase) {
    try {
      const [eventsRes, attendeesRes, emailsRes] = await Promise.all([
        supabase.from('events').select('*').order('date', { ascending: true }),
        supabase.from('attendees').select('*'),
        supabase.from('email_logs').select('*').order('sent_at', { ascending: false }).limit(50)
      ]);

      const events: CLEDEvent[] = (eventsRes.data || []).map(eventFromRow);
      const attendees: Attendee[] = (attendeesRes.data || []).map(attendeeFromRow);
      const emails = (emailsRes.data || []).map(emailLogFromRow);

      const totalEvents = events.length;
      const totalAttendees = attendees.length;
      const checkedInAttendees = attendees.filter(a => a.attended).length;
      const pendingCheckIn = totalAttendees - checkedInAttendees;

      const attendeesByGrade: { [key: string]: number } = {};
      const attendeesByMajor: { [key: string]: number } = {};
      const attendeesBySection: { [key: string]: number } = {};

      attendees.forEach(a => {
        const gradeKey = a.grade || 'Sin especificar';
        attendeesByGrade[gradeKey] = (attendeesByGrade[gradeKey] || 0) + 1;

        const majorKey = a.technicalMajor || (a.grade === '3ro' ? 'Ciclo General' : 'Secundaria Técnica');
        attendeesByMajor[majorKey] = (attendeesByMajor[majorKey] || 0) + 1;

        const secKey = `${a.grade}-${a.section}`;
        attendeesBySection[secKey] = (attendeesBySection[secKey] || 0) + 1;
      });

      return {
        stats: {
          totalEvents,
          totalAttendees,
          checkedInAttendees,
          pendingCheckIn,
          attendeesByGrade,
          attendeesByMajor,
          attendeesBySection
        },
        emails,
        events
      };
    } catch (err) {
      console.warn('Error calculating stats from Supabase:', err);
    }
  }

  return {
    stats: {
      totalEvents: 0,
      totalAttendees: 0,
      checkedInAttendees: 0,
      pendingCheckIn: 0,
      attendeesByGrade: {},
      attendeesByMajor: {},
      attendeesBySection: {}
    },
    emails: [],
    events: []
  };
}

/**
 * Checks Supabase live connection status and counts.
 */
export async function getSupabaseLiveStatus(): Promise<{
  connected: boolean;
  totalEvents?: number;
  totalAttendees?: number;
  projectUrl?: string;
}> {
  // 1. Try backend endpoint first
  const apiResult = await safeFetchJson<any>('/api/supabase/status');
  if (apiResult.ok && apiResult.data) {
    return apiResult.data;
  }

  // 2. Direct Supabase count query
  if (supabase) {
    try {
      const { count: evCount, error: evErr } = await supabase.from('events').select('*', { count: 'exact', head: true });
      const { count: attCount, error: attErr } = await supabase.from('attendees').select('*', { count: 'exact', head: true });

      if (!evErr && !attErr) {
        return {
          connected: true,
          totalEvents: evCount || 0,
          totalAttendees: attCount || 0,
          projectUrl: 'https://pqggmfhatpwqbznxhbrr.supabase.co'
        };
      }
    } catch (err) {
      console.warn('Direct Supabase status check error:', err);
    }
  }

  return { connected: false };
}

/**
 * Validates admin PIN (checks backend API first; falls back to Supabase app_settings or hardcoded defaults).
 */
export async function verifyAdminPin(pin: string): Promise<{ ok: boolean; token?: string; error?: string }> {
  // 1. Try backend API
  const apiResult = await safeFetchJson<{ token: string; message?: string }>('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin })
  });

  if (apiResult.ok && apiResult.data?.token) {
    return { ok: true, token: apiResult.data.token };
  }

  // 2. Direct Supabase verification (for GitHub Pages static hosting)
  if (supabase) {
    try {
      const { data } = await supabase.from('app_settings').select('value').eq('key', 'admin_credentials').maybeSingle();
      const storedPin = data?.value?.pin;
      if (storedPin && pin.trim().toLowerCase() === String(storedPin).trim().toLowerCase()) {
        return { ok: true, token: 'admin-supabase-token' };
      }
    } catch (err) {
      console.warn('Error checking PIN from Supabase:', err);
    }
  }

  // 3. Fallback defaults
  if (pin.trim() === 'CLED1906' || pin.trim().toLowerCase() === 'cled2026') {
    return { ok: true, token: 'admin-static-token' };
  }

  return { ok: false, error: 'Clave de administración incorrecta.' };
}

/**
 * Retrieves total attendee counts per event.
 * Tries backend API first; falls back directly to Supabase for GitHub Pages.
 */
export async function getAttendeeCounts(): Promise<{ [eventId: string]: number }> {
  // 1. Try backend API
  const apiRes = await safeFetchJson<{ counts: { [id: string]: number } }>('/api/events/counts');
  if (apiRes.ok && apiRes.data?.counts) {
    return apiRes.data.counts;
  }

  // 2. Direct Supabase query
  if (supabase) {
    try {
      const { data, error } = await supabase.from('attendees').select('event_id');
      if (!error && data) {
        const counts: { [id: string]: number } = {};
        data.forEach(row => {
          if (row.event_id) {
            counts[row.event_id] = (counts[row.event_id] || 0) + 1;
          }
        });
        return counts;
      }
    } catch (err) {
      console.warn('Error fetching counts from Supabase:', err);
    }
  }

  return {};
}


