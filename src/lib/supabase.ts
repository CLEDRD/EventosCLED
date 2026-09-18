import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { CLEDEvent, Attendee, EmailLog } from '../types';
import { decodeStatusFromRow } from '../utils/eventStatus';

export const SUPABASE_URL = 
  (typeof process !== 'undefined' && process.env?.SUPABASE_URL) ||
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL) ||
  'https://pqggmfhatpwqbznxhbrr.supabase.co';

export const SUPABASE_ANON_KEY = 
  (typeof process !== 'undefined' && process.env?.SUPABASE_ANON_KEY) ||
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_ANON_KEY) ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxZ2dtZmhhdHB3cWJ6bnhoYnJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk1MTY0MjAsImV4cCI6MjEwNTA5MjQyMH0.G7aXixFHJCnWHE7M_NJO7FEF-39y84lEQ0q44AvqetA';

export let supabase: SupabaseClient | null = null;

try {
  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false }
    });
  }
} catch (err) {
  console.warn('Could not initialize Supabase client:', err);
}

// Row mappers for Supabase (snake_case) <-> Application Model (camelCase)
export function eventFromRow(row: any): CLEDEvent {
  const { status, description } = decodeStatusFromRow(row.status, row.description);

  return {
    id: row.id,
    title: row.title,
    description: description,
    category: row.category || 'General',
    date: row.date,
    time: row.time || '09:00',
    location: row.location || '',
    isVirtual: Boolean(row.is_virtual),
    virtualLink: row.virtual_link || undefined,
    hasImage: Boolean(row.has_image),
    imageUrl: row.image_url || undefined,
    isPublic: Boolean(row.is_public),
    accessCode: row.access_code || undefined,
    capacity: Number(row.capacity) || 0,
    status: status,
    speaker: row.speaker || undefined,
    speakerRole: row.speaker_role || undefined,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString()
  };
}

export function eventToRow(event: Partial<CLEDEvent>): Record<string, any> {
  const row: Record<string, any> = {};
  if (event.id !== undefined) row.id = event.id;
  if (event.title !== undefined) row.title = event.title;
  if (event.description !== undefined) row.description = event.description;
  if (event.category !== undefined) row.category = event.category;
  if (event.date !== undefined) row.date = event.date;
  if (event.time !== undefined) row.time = event.time;
  if (event.location !== undefined) row.location = event.location;
  if (event.isVirtual !== undefined) row.is_virtual = event.isVirtual;
  if (event.virtualLink !== undefined) row.virtual_link = event.virtualLink;
  if (event.hasImage !== undefined) row.has_image = event.hasImage;
  if (event.imageUrl !== undefined) row.image_url = event.imageUrl;
  if (event.isPublic !== undefined) row.is_public = event.isPublic;
  if (event.accessCode !== undefined) row.access_code = event.accessCode;
  if (event.capacity !== undefined) row.capacity = event.capacity;
  if (event.status !== undefined) row.status = event.status;
  if (event.speaker !== undefined) row.speaker = event.speaker;
  if (event.speakerRole !== undefined) row.speaker_role = event.speakerRole;
  return row;
}

export function attendeeFromRow(row: any): Attendee {
  return {
    id: row.id,
    eventId: row.event_id,
    firstName: row.first_name,
    lastName: row.last_name,
    fullName: row.full_name || `${row.first_name} ${row.last_name}`.trim(),
    grade: row.grade,
    section: row.section,
    technicalMajor: row.technical_major || undefined,
    studentId: row.student_id || undefined,
    email: row.email,
    phone: row.phone,
    career: row.career || undefined,
    academicYear: row.academic_year || undefined,
    attended: Boolean(row.attended),
    attendedAt: row.attended_at || undefined,
    registeredAt: row.registered_at || row.created_at || new Date().toISOString(),
    ticketCode: String(row.ticket_code),
    secretToken: row.secret_token,
    emailConfirmationSent: Boolean(row.email_confirmation_sent),
    emailSentAt: row.email_sent_at || undefined
  };
}

export function attendeeToRow(att: Partial<Attendee>): Record<string, any> {
  const row: Record<string, any> = {};
  if (att.id !== undefined) row.id = att.id;
  if (att.eventId !== undefined) row.event_id = att.eventId;
  if (att.firstName !== undefined) row.first_name = att.firstName;
  if (att.lastName !== undefined) row.last_name = att.lastName;
  if (att.fullName !== undefined) row.full_name = att.fullName;
  if (att.grade !== undefined) row.grade = att.grade;
  if (att.section !== undefined) row.section = att.section;
  if (att.technicalMajor !== undefined) row.technical_major = att.technicalMajor;
  if (att.studentId !== undefined) row.student_id = att.studentId;
  if (att.email !== undefined) row.email = att.email;
  if (att.phone !== undefined) row.phone = att.phone;
  if (att.career !== undefined) row.career = att.career;
  if (att.academicYear !== undefined) row.academic_year = att.academicYear;
  if (att.attended !== undefined) row.attended = att.attended;
  if (att.attendedAt !== undefined) row.attended_at = att.attendedAt;
  if (att.registeredAt !== undefined) row.registered_at = att.registeredAt;
  if (att.ticketCode !== undefined) row.ticket_code = att.ticketCode;
  if (att.secretToken !== undefined) row.secret_token = att.secretToken;
  if (att.emailConfirmationSent !== undefined) row.email_confirmation_sent = att.emailConfirmationSent;
  if (att.emailSentAt !== undefined) row.email_sent_at = att.emailSentAt;
  return row;
}

export function emailLogFromRow(row: any): EmailLog {
  return {
    id: row.id,
    attendeeId: row.attendee_id,
    eventId: row.event_id,
    to: row.recipient_email,
    recipientName: row.recipient_name,
    subject: row.subject,
    eventTitle: row.event_title,
    ticketCode: row.ticket_code,
    sentAt: row.sent_at,
    status: row.status as 'sent' | 'delivered',
    htmlBody: row.html_body || ''
  };
}

export function emailLogToRow(log: Partial<EmailLog>): Record<string, any> {
  const row: Record<string, any> = {};
  if (log.id !== undefined) row.id = log.id;
  if (log.attendeeId !== undefined) row.attendee_id = log.attendeeId;
  if (log.eventId !== undefined) row.event_id = log.eventId;
  if (log.to !== undefined) row.recipient_email = log.to;
  if (log.recipientName !== undefined) row.recipient_name = log.recipientName;
  if (log.subject !== undefined) row.subject = log.subject;
  if (log.eventTitle !== undefined) row.event_title = log.eventTitle;
  if (log.ticketCode !== undefined) row.ticket_code = log.ticketCode;
  if (log.sentAt !== undefined) row.sent_at = log.sentAt;
  if (log.status !== undefined) row.status = log.status;
  if (log.htmlBody !== undefined) row.html_body = log.htmlBody;
  return row;
}
