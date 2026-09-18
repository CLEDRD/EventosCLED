import { EventStatus } from '../types';

export interface StatusConfig {
  value: EventStatus;
  label: string;
  badgeLabel: string;
  badgeColor: string; // Tailwind classes for badge
  cardBorder?: string;
  buttonLabel: string;
  canRegister: boolean;
  description: string;
}

export const EVENT_STATUS_OPTIONS: { value: EventStatus; label: string; icon: string; description: string }[] = [
  {
    value: 'DISPONIBLE',
    label: 'DISPONIBLE',
    icon: '🟢',
    description: 'Inscripciones abiertas y activas'
  },
  {
    value: 'SOLD OUT',
    label: 'SOLD OUT',
    icon: '🔴',
    description: 'Capacidad máxima alcanzada / Boletas agotadas'
  },
  {
    value: 'SUSPENDIDO',
    label: 'SUSPENDIDO',
    icon: '⛔',
    description: 'Evento pausado o suspendido temporalmente'
  },
  {
    value: 'PROXIMAMENTE',
    label: 'PRÓXIMAMENTE',
    icon: '⏳',
    description: 'Próximo a abrir inscripciones'
  },
  {
    value: 'PASADO',
    label: 'PASADO',
    icon: '🏁',
    description: 'Evento concluido / Ya finalizado'
  }
];

export function normalizeEventStatus(status?: string): EventStatus {
  if (!status) return 'DISPONIBLE';
  const clean = status.trim().toUpperCase();
  if (clean === 'ACTIVE' || clean === 'DISPONIBLE' || clean === 'ACTIVO') return 'DISPONIBLE';
  if (clean === 'SOLD OUT' || clean === 'SOLDOUT' || clean === 'AGOTADO') return 'SOLD OUT';
  if (clean === 'SUSPENDIDO' || clean === 'SUPENSDIDO' || clean === 'CANCELLED' || clean === 'CANCELADO') return 'SUSPENDIDO';
  if (clean === 'PROXIMAMENTE' || clean === 'PRÓXIMAMENTE' || clean === 'COMING SOON') return 'PROXIMAMENTE';
  if (clean === 'PASADO' || clean === 'COMPLETED' || clean === 'FINALIZADO') return 'PASADO';
  return 'DISPONIBLE';
}

/**
 * Maps modern CLED status to legacy Supabase check constraint ('active', 'completed', 'cancelled')
 */
export function statusToLegacySupabase(status?: string): 'active' | 'completed' | 'cancelled' {
  const norm = normalizeEventStatus(status);
  switch (norm) {
    case 'DISPONIBLE':
      return 'active';
    case 'PASADO':
    case 'SOLD OUT':
      return 'completed';
    case 'SUSPENDIDO':
      return 'cancelled';
    case 'PROXIMAMENTE':
      return 'active';
    default:
      return 'active';
  }
}

/**
 * Encodes modern status inside description as a safe hidden comment fallback
 */
export function encodeStatusInDescription(status: EventStatus, currentDesc?: string): string {
  const cleanDesc = (currentDesc || '').replace(/<!--cled_status:[A-Z\s]+-->/g, '').trim();
  return `<!--cled_status:${status}-->${cleanDesc ? ' ' + cleanDesc : ''}`;
}

/**
 * Extracts modern status and cleans description
 */
export function decodeStatusFromRow(rowStatus?: string, rowDescription?: string): { status: EventStatus; description: string } {
  let rawDesc = rowDescription || '';
  let status: EventStatus = normalizeEventStatus(rowStatus);

  const match = rawDesc.match(/<!--cled_status:([A-Z\s]+)-->/);
  if (match) {
    status = normalizeEventStatus(match[1]);
    rawDesc = rawDesc.replace(/<!--cled_status:[A-Z\s]+-->/, '').trim();
  }

  return { status, description: rawDesc };
}

export const SUPABASE_STATUS_MIGRATION_SQL = `-- Ejecutar en el SQL Editor de Supabase si deseas guardar los nuevos estados directamente sin restricción:
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_status_check;
`;

export function getStatusConfig(status?: string): StatusConfig {
  const normalized = normalizeEventStatus(status);

  switch (normalized) {
    case 'SOLD OUT':
      return {
        value: 'SOLD OUT',
        label: 'SOLD OUT',
        badgeLabel: 'SOLD OUT',
        badgeColor: 'bg-rose-600 text-white border-rose-700 shadow-xs',
        buttonLabel: 'Agotado (Sold Out)',
        canRegister: false,
        description: 'Boletas agotadas'
      };
    case 'SUSPENDIDO':
      return {
        value: 'SUSPENDIDO',
        label: 'SUSPENDIDO',
        badgeLabel: 'SUSPENDIDO',
        badgeColor: 'bg-red-700 text-white border-red-800 shadow-xs',
        buttonLabel: 'Evento Suspendido',
        canRegister: false,
        description: 'Evento suspendido'
      };
    case 'PROXIMAMENTE':
      return {
        value: 'PROXIMAMENTE',
        label: 'PRÓXIMAMENTE',
        badgeLabel: 'PRÓXIMAMENTE',
        badgeColor: 'bg-amber-500 text-slate-950 font-black border-amber-600 shadow-xs',
        buttonLabel: 'Próximamente',
        canRegister: false,
        description: 'Inscripciones abrirán pronto'
      };
    case 'PASADO':
      return {
        value: 'PASADO',
        label: 'PASADO',
        badgeLabel: 'PASADO / FINALIZADO',
        badgeColor: 'bg-slate-700 text-slate-100 border-slate-800 shadow-xs',
        buttonLabel: 'Evento Finalizado',
        canRegister: false,
        description: 'Evento concluido con éxito'
      };
    case 'DISPONIBLE':
    default:
      return {
        value: 'DISPONIBLE',
        label: 'DISPONIBLE',
        badgeLabel: 'DISPONIBLE',
        badgeColor: 'bg-emerald-600 text-white border-emerald-700 shadow-xs',
        buttonLabel: 'Inscribirme',
        canRegister: true,
        description: 'Inscripciones abiertas'
      };
  }
}
