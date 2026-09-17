import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();
import { createServer as createViteServer } from 'vite';
import { checkProfanity, validateRegistrationData, generateTicketCode, generateConfirmationEmailHtml } from './src/utils/security';
import { CLEDEvent, Attendee, EmailLog } from './src/types';
import { 
  supabase, 
  eventFromRow, 
  eventToRow, 
  attendeeFromRow, 
  attendeeToRow, 
  emailLogFromRow, 
  emailLogToRow 
} from './src/lib/supabase';

const app = express();
const PORT = 3000;

app.use(express.json());

// Health check route for container & AI Studio readiness probes
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve LOGO_CLED_CF.jpg whether uploaded in /public/ or in root
app.get(['/LOGO_CLED_CF.jpg', '/public/LOGO_CLED_CF.jpg'], (req: Request, res: Response, next) => {
  const publicPath = path.join(process.cwd(), 'public', 'LOGO_CLED_CF.jpg');
  const rootPath = path.join(process.cwd(), 'LOGO_CLED_CF.jpg');
  if (fs.existsSync(publicPath)) {
    return res.sendFile(publicPath);
  } else if (fs.existsSync(rootPath)) {
    return res.sendFile(rootPath);
  }
  next();
});

// Database storage setup
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');

interface DatabaseSchema {
  events: CLEDEvent[];
  attendees: Attendee[];
  emails: EmailLog[];
  adminPin: string;
}

// Initial database state for CLED - Instituto Politécnico Max Henríquez Ureña
const INITIAL_SEED: DatabaseSchema = {
  adminPin: 'cled2026',
  events: [],
  attendees: [],
  emails: []
};

// Database persistence helpers
function loadDatabase(): DatabaseSchema {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify(INITIAL_SEED, null, 2), 'utf-8');
      return INITIAL_SEED;
    }
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(raw) as DatabaseSchema;
  } catch (err) {
    console.error('Error reading database file, using fallback:', err);
    return INITIAL_SEED;
  }
}

function saveDatabase(db: DatabaseSchema): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tempFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(db, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_FILE);
  } catch (err) {
    console.error('Error saving database file:', err);
  }
}

// ----------------------------------------------------
// HYBRID SUPABASE / LOCAL REPOSITORY HELPERS
// ----------------------------------------------------
async function fetchAllEvents(): Promise<CLEDEvent[]> {
  if (supabase) {
    try {
      const { data, error } = await supabase.from('events').select('*').order('date', { ascending: true });
      if (!error && data) {
        const events = data.map(eventFromRow);
        // keep local cache updated
        const db = loadDatabase();
        db.events = events;
        saveDatabase(db);
        return events;
      }
    } catch (err) {
      console.warn('[Supabase] Error fetching events, using local cache:', err);
    }
  }
  return loadDatabase().events;
}

async function fetchEventById(id: string): Promise<CLEDEvent | null> {
  if (supabase) {
    try {
      const { data, error } = await supabase.from('events').select('*').eq('id', id).maybeSingle();
      if (!error && data) {
        return eventFromRow(data);
      }
    } catch (err) {
      console.warn('[Supabase] Error fetching event by id:', err);
    }
  }
  const db = loadDatabase();
  return db.events.find(e => e.id === id) || null;
}

async function saveEventToDB(event: CLEDEvent): Promise<void> {
  const db = loadDatabase();
  const idx = db.events.findIndex(e => e.id === event.id);
  if (idx >= 0) {
    db.events[idx] = event;
  } else {
    db.events.unshift(event);
  }
  saveDatabase(db);

  if (supabase) {
    try {
      await supabase.from('events').upsert(eventToRow(event));
    } catch (err) {
      console.warn('[Supabase] Error saving event:', err);
    }
  }
}

async function deleteEventFromDB(id: string): Promise<void> {
  const db = loadDatabase();
  db.events = db.events.filter(e => e.id !== id);
  db.attendees = db.attendees.filter(a => a.eventId !== id);
  saveDatabase(db);

  if (supabase) {
    try {
      await supabase.from('events').delete().eq('id', id);
      await supabase.from('attendees').delete().eq('event_id', id);
    } catch (err) {
      console.warn('[Supabase] Error deleting event:', err);
    }
  }
}

async function fetchAllAttendees(eventId?: string): Promise<Attendee[]> {
  if (supabase) {
    try {
      let query = supabase.from('attendees').select('*').order('registered_at', { ascending: false });
      if (eventId) {
        query = query.eq('event_id', eventId);
      }
      const { data, error } = await query;
      if (!error && data) {
        const attendees = data.map(attendeeFromRow);
        return attendees;
      }
    } catch (err) {
      console.warn('[Supabase] Error fetching attendees, using local cache:', err);
    }
  }
  const db = loadDatabase();
  return eventId ? db.attendees.filter(a => a.eventId === eventId) : db.attendees;
}

async function insertAttendeeToDB(attendee: Attendee): Promise<void> {
  const db = loadDatabase();
  db.attendees.push(attendee);
  saveDatabase(db);

  if (supabase) {
    try {
      const row = attendeeToRow(attendee);
      const { error } = await supabase.from('attendees').insert(row);
      if (error) {
        console.error('[Supabase] Error inserting attendee:', error);
      }
    } catch (err) {
      console.warn('[Supabase] Error inserting attendee:', err);
    }
  }
}

async function updateAttendeeInDB(id: string, updates: Partial<Attendee>): Promise<Attendee | null> {
  const db = loadDatabase();
  const attendee = db.attendees.find(a => a.id === id || a.ticketCode.toUpperCase() === id.toUpperCase());
  if (attendee) {
    Object.assign(attendee, updates);
    saveDatabase(db);
  }

  if (supabase) {
    try {
      const rowUpdates = attendeeToRow(updates);
      const { data, error } = await supabase
        .from('attendees')
        .update(rowUpdates)
        .or(`id.eq.${id},ticket_code.eq.${id}`)
        .select()
        .maybeSingle();

      if (!error && data) {
        return attendeeFromRow(data);
      }
    } catch (err) {
      console.warn('[Supabase] Error updating attendee in Supabase:', err);
    }
  }
  return attendee || null;
}

async function deleteAttendeeFromDB(id: string): Promise<void> {
  const db = loadDatabase();
  db.attendees = db.attendees.filter(a => a.id !== id);
  saveDatabase(db);

  if (supabase) {
    try {
      await supabase.from('attendees').delete().eq('id', id);
    } catch (err) {
      console.warn('[Supabase] Error deleting attendee:', err);
    }
  }
}

async function insertEmailLogToDB(log: EmailLog): Promise<void> {
  const db = loadDatabase();
  db.emails.unshift(log);
  saveDatabase(db);

  if (supabase) {
    try {
      const row = emailLogToRow(log);
      await supabase.from('email_logs').insert(row);
    } catch (err) {
      console.warn('[Supabase] Error inserting email log:', err);
    }
  }
}

async function fetchEmailLogs(): Promise<EmailLog[]> {
  if (supabase) {
    try {
      const { data, error } = await supabase.from('email_logs').select('*').order('sent_at', { ascending: false });
      if (!error && data) {
        return data.map(emailLogFromRow);
      }
    } catch (err) {
      console.warn('[Supabase] Error fetching email logs:', err);
    }
  }
  return loadDatabase().emails;
}

async function getAdminPinFromDB(): Promise<string> {
  if (supabase) {
    try {
      const { data, error } = await supabase.from('app_settings').select('value').eq('key', 'admin_credentials').maybeSingle();
      if (!error && data && data.value && data.value.pin) {
        return String(data.value.pin);
      }
    } catch (err) {
      console.warn('[Supabase] Error fetching admin pin:', err);
    }
  }
  return loadDatabase().adminPin;
}

async function setAdminPinInDB(newPin: string): Promise<void> {
  const db = loadDatabase();
  db.adminPin = newPin;
  saveDatabase(db);

  if (supabase) {
    try {
      await supabase.from('app_settings').upsert({
        key: 'admin_credentials',
        value: { pin: newPin },
        description: 'PIN de acceso administrativo',
        updated_at: new Date().toISOString()
      });
    } catch (err) {
      console.warn('[Supabase] Error saving admin pin:', err);
    }
  }
}

// ----------------------------------------------------
// API ROUTES
// ----------------------------------------------------

// 0. Supabase Connection Status
app.get('/api/supabase/status', async (req: Request, res: Response) => {
  if (!supabase) {
    return res.json({ connected: false, message: 'Supabase client no configurado.' });
  }
  try {
    const { count, error } = await supabase.from('events').select('*', { count: 'exact', head: true });
    if (error) {
      return res.json({ connected: false, error: error.message });
    }
    const { count: attendeeCount } = await supabase.from('attendees').select('*', { count: 'exact', head: true });
    res.json({
      connected: true,
      projectUrl: 'https://pqggmfhatpwqbznxhbrr.supabase.co',
      database: 'PostgreSQL (Supabase Cloud)',
      totalEvents: count || 0,
      totalAttendees: attendeeCount || 0,
      message: 'Conectado exitosamente a la base de datos Supabase en la nube.'
    });
  } catch (err: any) {
    res.json({ connected: false, error: err?.message || 'Error de conexión' });
  }
});

// 1. Get all events
app.get('/api/events', async (req: Request, res: Response) => {
  const adminPin = await getAdminPinFromDB();
  const isAdmin = req.headers['x-admin-token'] === adminPin;
  const events = await fetchAllEvents();

  // If public request, sanitize private accessCodes
  const sanitizedEvents = events.map(ev => {
    if (isAdmin) return ev;
    // Hide access code and internal virtual links for private events until verified
    if (!ev.isPublic) {
      return {
        ...ev,
        accessCode: undefined,
        virtualLink: undefined
      };
    }
    return ev;
  });

  res.json({
    success: true,
    events: sanitizedEvents
  });
});

// 1b. Get attendee counts per event
app.get('/api/events/counts', async (req: Request, res: Response) => {
  try {
    const attendees = await fetchAllAttendees();
    const counts: { [id: string]: number } = {};
    attendees.forEach(a => {
      if (a.eventId) {
        counts[a.eventId] = (counts[a.eventId] || 0) + 1;
      }
    });
    res.json({ success: true, counts });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 2. Get single event
app.get('/api/events/:id', async (req: Request, res: Response) => {
  const event = await fetchEventById(req.params.id);
  if (!event) {
    return res.status(404).json({ success: false, message: 'Evento no encontrado' });
  }

  const adminPin = await getAdminPinFromDB();
  const isAdmin = req.headers['x-admin-token'] === adminPin;
  if (!isAdmin && !event.isPublic) {
    return res.json({
      success: true,
      event: { ...event, accessCode: undefined, virtualLink: undefined }
    });
  }

  res.json({ success: true, event });
});

// 3. Verify private event access code
app.post('/api/events/:id/verify-access', async (req: Request, res: Response) => {
  const { code } = req.body;
  const event = await fetchEventById(req.params.id);

  if (!event) {
    return res.status(404).json({ success: false, message: 'Evento no encontrado' });
  }

  if (event.isPublic) {
    return res.json({ success: true, unlocked: true, event });
  }

  if (!code || (code.trim().toUpperCase() !== (event.accessCode || '').trim().toUpperCase())) {
    return res.status(401).json({
      success: false,
      unlocked: false,
      message: 'Código de acceso o invitación incorrecto. Este evento es exclusivo para miembros autorizados.'
    });
  }

  res.json({
    success: true,
    unlocked: true,
    event
  });
});

// 4. Register attendee with strict security, anti-duplicate, and anti-profanity
app.post('/api/events/:id/register', async (req: Request, res: Response) => {
  const eventId = req.params.id;
  const event = await fetchEventById(eventId);

  if (!event) {
    return res.status(404).json({ success: false, message: 'El evento no existe.' });
  }

  if (event.status !== 'active') {
    return res.status(400).json({ success: false, message: 'Este evento se encuentra finalizado o no está admitiendo inscripciones.' });
  }

  // Private event code verification if not public
  if (!event.isPublic) {
    const providedCode = req.body.accessCode;
    if (!providedCode || providedCode.trim().toUpperCase() !== (event.accessCode || '').trim().toUpperCase()) {
      return res.status(403).json({
        success: false,
        message: 'Código de invitación inválido para este evento privado.'
      });
    }
  }

  const {
    firstName,
    lastName,
    fullName,
    grade,
    section,
    technicalMajor,
    email,
    phone,
    studentId,
    career,
    academicYear
  } = req.body;

  const resolvedFirstName = (firstName || (fullName ? fullName.split(' ')[0] : '')).trim();
  const resolvedLastName = (lastName || (fullName ? fullName.split(' ').slice(1).join(' ') : '')).trim();
  const resolvedFullName = (fullName || `${resolvedFirstName} ${resolvedLastName}`).trim();

  // Validation using IPMHU requirements
  const validation = validateRegistrationData({
    firstName: resolvedFirstName,
    lastName: resolvedLastName,
    grade: grade || '4to',
    section: section || 'A',
    technicalMajor,
    email: email || '',
    phone: phone || '',
    fullName: resolvedFullName,
    studentId
  });

  if (!validation.isValid) {
    return res.status(400).json({
      success: false,
      message: validation.error,
      field: validation.field
    });
  }

  // Normalized checks
  const normEmail = (email || '').trim().toLowerCase();
  const normFirstName = resolvedFirstName.toLowerCase();
  const normLastName = resolvedLastName.toLowerCase();

  // ANTI-DUPLICATE SECURITY: Check if already registered in database
  const currentAttendees = await fetchAllAttendees(eventId);
  const duplicate = currentAttendees.find(
    a => (
      (normEmail && a.email.trim().toLowerCase() === normEmail) ||
      (a.firstName && a.lastName && a.firstName.trim().toLowerCase() === normFirstName && a.lastName.trim().toLowerCase() === normLastName) ||
      (a.fullName && a.fullName.trim().toLowerCase() === resolvedFullName.toLowerCase())
    )
  );

  if (duplicate) {
    return res.status(409).json({
      success: false,
      message: `Ya existe una inscripción registrada para este evento a nombre de ${resolvedFullName} o con el correo ${email}. Tu código de boleta es: ${duplicate.ticketCode}`,
      existingTicketCode: duplicate.ticketCode
    });
  }

  // Capacity Check
  if (event.capacity > 0) {
    const currentCount = currentAttendees.length;
    if (currentCount >= event.capacity) {
      return res.status(400).json({
        success: false,
        message: 'Lo sentimos, las plazas para este evento se encuentran totalmente agotadas.'
      });
    }
  }

  // Generate unique 5-digit ticket code strictly
  const ticketCode = generateTicketCode(eventId);
  const secretToken = `sec-${ticketCode}`;
  const nowIso = new Date().toISOString();

  const newAttendee: Attendee = {
    id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    eventId,
    firstName: resolvedFirstName,
    lastName: resolvedLastName,
    fullName: resolvedFullName,
    grade: (grade || '4to').trim(),
    section: (section || 'A').trim().toUpperCase(),
    technicalMajor: grade === '3ro' ? undefined : (technicalMajor ? technicalMajor.trim() : undefined),
    studentId: studentId ? studentId.trim().toUpperCase() : undefined,
    email: normEmail,
    phone: phone.trim(),
    career: technicalMajor || (grade === '3ro' ? 'Ciclo General' : 'Secundaria Técnica'),
    academicYear: grade ? `${grade} de Secundaria` : academicYear,
    attended: false,
    registeredAt: nowIso,
    ticketCode,
    secretToken,
    emailConfirmationSent: false,
  };

  await insertAttendeeToDB(newAttendee);

  res.status(201).json({
    success: true,
    message: '¡Inscripción confirmada con éxito! Tu boleta de acceso ha sido generada.',
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
    }
  });
});

// 5. Secure lookup of a participant's ticket (Attendees can query with 5-digit TicketCode + Email or Phone or Name)
app.get('/api/attendees/lookup', async (req: Request, res: Response) => {
  const query = (req.query.query as string || '').trim().toLowerCase();
  const verify = (req.query.verify as string || '').trim().toLowerCase();

  if (!query || !verify) {
    return res.status(400).json({
      success: false,
      message: 'Debes proporcionar tu Código de Boleta (5 dígitos) y tu Correo o Teléfono para validar tu inscripción de forma segura.'
    });
  }

  const allAttendees = await fetchAllAttendees();
  const attendee = allAttendees.find(a =>
    a.ticketCode.toLowerCase() === query &&
    (
      a.email.toLowerCase() === verify ||
      (a.phone && a.phone.replace(/[^0-9]/g, '') === verify.replace(/[^0-9]/g, '')) ||
      (a.studentId && a.studentId.toLowerCase() === verify) ||
      (a.lastName && a.lastName.toLowerCase() === verify) ||
      (a.fullName && a.fullName.toLowerCase() === verify)
    )
  );

  if (!attendee) {
    return res.status(404).json({
      success: false,
      message: 'No se encontró ninguna inscripción con esa boleta y dato de verificación. Revisa el ID de 5 dígitos y el correo registrado.'
    });
  }

  const event = await fetchEventById(attendee.eventId);

  res.json({
    success: true,
    attendee: {
      id: attendee.id,
      ticketCode: attendee.ticketCode,
      fullName: attendee.fullName,
      studentId: attendee.studentId,
      email: attendee.email,
      phone: attendee.phone,
      career: attendee.career,
      attended: attendee.attended,
      registeredAt: attendee.registeredAt,
      event: event ? {
        id: event.id,
        title: event.title,
        date: event.date,
        time: event.time,
        location: event.location,
        isVirtual: event.isVirtual,
        virtualLink: event.virtualLink
      } : null
    }
  });
});

// ----------------------------------------------------
// ADMIN PROTECTED ROUTES
// ----------------------------------------------------

const checkAdminAuth = async (req: Request, res: Response, next: Function) => {
  const token = req.headers['x-admin-token'];
  const currentPin = await getAdminPinFromDB();
  if (token !== currentPin) {
    return res.status(401).json({ success: false, message: 'Acceso no autorizado al panel administrativo.' });
  }
  next();
};

// Admin Login
app.post('/api/admin/login', async (req: Request, res: Response) => {
  const { pin } = req.body;
  const currentPin = await getAdminPinFromDB();
  if (pin === currentPin) {
    res.json({ success: true, token: currentPin, message: 'Autenticación administrativa exitosa.' });
  } else {
    res.status(401).json({ success: false, message: 'Clave de acceso administrativo incorrecta.' });
  }
});

// Admin change PIN
app.post('/api/admin/change-pin', checkAdminAuth, async (req: Request, res: Response) => {
  const { newPin } = req.body;
  if (!newPin || newPin.length < 4) {
    return res.status(400).json({ success: false, message: 'La nueva clave debe tener al menos 4 caracteres.' });
  }
  await setAdminPinInDB(newPin.trim());
  res.json({ success: true, message: 'Clave de administración actualizada correctamente.' });
});

// Admin stats
app.get('/api/admin/stats', checkAdminAuth, async (req: Request, res: Response) => {
  const events = await fetchAllEvents();
  const attendees = await fetchAllAttendees();
  const emails = await fetchEmailLogs();

  const totalEvents = events.length;
  const activeEvents = events.filter(e => e.status === 'active').length;
  const totalAttendees = attendees.length;
  const confirmedAttendees = attendees.filter(a => a.attended).length;
  const attendanceRate = totalAttendees > 0 ? Number(((confirmedAttendees / totalAttendees) * 100).toFixed(1)) : 0;

  res.json({
    success: true,
    stats: {
      totalEvents,
      activeEvents,
      totalAttendees,
      confirmedAttendees,
      attendanceRate,
      totalEmailsSent: emails.length
    }
  });
});

// Admin Create Event
app.post('/api/events', checkAdminAuth, async (req: Request, res: Response) => {
  const {
    title,
    description,
    category,
    date,
    time,
    location,
    isVirtual,
    virtualLink,
    hasImage,
    imageUrl,
    isPublic,
    accessCode,
    capacity,
    speaker,
    speakerRole
  } = req.body;

  if (!title || !date || !time || !location) {
    return res.status(400).json({ success: false, message: 'Título, fecha, hora y lugar son obligatorios.' });
  }

  const profanityCheck = checkProfanity(title + ' ' + (description || ''));
  if (profanityCheck.hasProfanity) {
    return res.status(400).json({ success: false, message: 'El texto del evento contiene términos no autorizados.' });
  }

  const id = `event-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
  const now = new Date().toISOString();

  const newEvent: CLEDEvent = {
    id,
    title: title.trim(),
    description: (description || '').trim(),
    category: (category || 'General').trim(),
    date,
    time,
    location: location.trim(),
    isVirtual: Boolean(isVirtual),
    virtualLink: isVirtual ? (virtualLink || '').trim() : '',
    hasImage: Boolean(hasImage),
    imageUrl: hasImage ? (imageUrl || '').trim() : '',
    isPublic: isPublic !== false,
    accessCode: isPublic ? '' : (accessCode || 'CLED-VIP').trim().toUpperCase(),
    capacity: Number(capacity) || 0,
    status: 'active',
    speaker: (speaker || '').trim(),
    speakerRole: (speakerRole || '').trim(),
    createdAt: now,
    updatedAt: now
  };

  await saveEventToDB(newEvent);

  res.status(201).json({ success: true, event: newEvent, message: 'Evento creado exitosamente en la base de datos.' });
});

// Admin Update Event
app.put('/api/events/:id', checkAdminAuth, async (req: Request, res: Response) => {
  const existing = await fetchEventById(req.params.id);
  if (!existing) {
    return res.status(404).json({ success: false, message: 'Evento no encontrado.' });
  }

  const updated: CLEDEvent = {
    ...existing,
    ...req.body,
    id: existing.id,
    updatedAt: new Date().toISOString()
  };

  await saveEventToDB(updated);

  res.json({ success: true, event: updated, message: 'Evento actualizado exitosamente.' });
});

// Admin Delete Event
app.delete('/api/events/:id', checkAdminAuth, async (req: Request, res: Response) => {
  const id = req.params.id;
  await deleteEventFromDB(id);
  res.json({ success: true, message: 'Evento y sus inscripciones eliminados.' });
});

// Admin Get Attendees (optionally filter by eventId)
app.get('/api/admin/attendees', checkAdminAuth, async (req: Request, res: Response) => {
  const eventId = req.query.eventId as string;
  const list = await fetchAllAttendees(eventId);
  res.json({ success: true, attendees: list });
});

// Admin Toggle Attendance (Check-in)
app.post('/api/admin/attendees/:id/toggle-attendance', checkAdminAuth, async (req: Request, res: Response) => {
  const idOrCode = req.params.id;
  const allAttendees = await fetchAllAttendees();
  const attendee = allAttendees.find(a => a.id === idOrCode || a.ticketCode.toUpperCase() === idOrCode.toUpperCase());

  if (!attendee) {
    return res.status(404).json({ success: false, message: 'Participante no encontrado.' });
  }

  const nextAttended = !attendee.attended;
  const nextAttendedAt = nextAttended ? new Date().toISOString() : undefined;

  const updated = await updateAttendeeInDB(attendee.id, {
    attended: nextAttended,
    attendedAt: nextAttendedAt
  });

  res.json({
    success: true,
    attendee: updated || { ...attendee, attended: nextAttended, attendedAt: nextAttendedAt },
    message: nextAttended
      ? `Asistencia registrada para ${attendee.fullName}`
      : `Asistencia desmarcada para ${attendee.fullName}`
  });
});

// Admin Delete Attendee
app.delete('/api/admin/attendees/:id', checkAdminAuth, async (req: Request, res: Response) => {
  await deleteAttendeeFromDB(req.params.id);
  res.json({ success: true, message: 'Registro de inscripción eliminado.' });
});

// Admin Resend Email
app.post('/api/admin/attendees/:id/resend-email', checkAdminAuth, async (req: Request, res: Response) => {
  const allAttendees = await fetchAllAttendees();
  const attendee = allAttendees.find(a => a.id === req.params.id);
  if (!attendee) {
    return res.status(404).json({ success: false, message: 'Participante no encontrado.' });
  }

  const event = await fetchEventById(attendee.eventId);
  if (!event) {
    return res.status(404).json({ success: false, message: 'Evento asociado no encontrado.' });
  }

  const nowIso = new Date().toISOString();
  const htmlBody = generateConfirmationEmailHtml({
    fullName: attendee.fullName,
    eventTitle: event.title,
    eventDate: event.date,
    eventTime: event.time,
    eventLocation: event.location,
    ticketCode: attendee.ticketCode,
    isVirtual: event.isVirtual,
    virtualLink: event.virtualLink,
    studentId: attendee.studentId,
    career: attendee.career
  });

  const emailLog: EmailLog = {
    id: `eml-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    attendeeId: attendee.id,
    eventId: event.id,
    to: attendee.email,
    recipientName: attendee.fullName,
    subject: `[Reenvío] Confirmación de Inscripción CLED: ${event.title}`,
    eventTitle: event.title,
    ticketCode: attendee.ticketCode,
    sentAt: nowIso,
    status: 'sent',
    htmlBody
  };

  await updateAttendeeInDB(attendee.id, {
    emailConfirmationSent: true,
    emailSentAt: nowIso
  });
  await insertEmailLogToDB(emailLog);

  res.json({
    success: true,
    message: `Correo de confirmación reenviado exitosamente a ${attendee.email}`,
    emailLog
  });
});

// Admin Get Sent Emails Log
app.get('/api/admin/emails', checkAdminAuth, async (req: Request, res: Response) => {
  const emails = await fetchEmailLogs();
  res.json({ success: true, emails });
});

// Admin Backup & Restore endpoints
app.get('/api/admin/backup', checkAdminAuth, async (req: Request, res: Response) => {
  const events = await fetchAllEvents();
  const attendees = await fetchAllAttendees();
  const emails = await fetchEmailLogs();
  const adminPin = await getAdminPinFromDB();

  const backup = {
    adminPin,
    events,
    attendees,
    emails,
    exportedAt: new Date().toISOString()
  };

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename=CLED_Backup_${new Date().toISOString().slice(0, 10)}.json`);
  res.send(JSON.stringify(backup, null, 2));
});

app.post('/api/admin/restore', checkAdminAuth, async (req: Request, res: Response) => {
  const backupData = req.body;
  if (!backupData || !Array.isArray(backupData.events) || !Array.isArray(backupData.attendees)) {
    return res.status(400).json({ success: false, message: 'El archivo de respaldo no tiene el formato válido de EventosCLED.' });
  }

  saveDatabase(backupData);

  if (supabase) {
    try {
      if (backupData.events.length > 0) {
        await supabase.from('events').upsert(backupData.events.map(eventToRow));
      }
      if (backupData.attendees.length > 0) {
        await supabase.from('attendees').upsert(backupData.attendees.map(attendeeToRow));
      }
    } catch (err) {
      console.warn('[Supabase] Error restoring to Supabase:', err);
    }
  }

  res.json({ success: true, message: 'Base de datos restaurada correctamente desde el respaldo.' });
});

// ----------------------------------------------------
// SERVER STARTUP & VITE INTEGRATION
// ----------------------------------------------------

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`EventosCLED Server running at http://localhost:${PORT}`);
  });

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use.`);
    } else {
      console.error('Server error:', err);
    }
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
