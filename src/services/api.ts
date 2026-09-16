import { CLEDEvent, Attendee } from '../types';
import { supabase, eventFromRow, attendeeFromRow, attendeeToRow } from '../lib/supabase';

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
