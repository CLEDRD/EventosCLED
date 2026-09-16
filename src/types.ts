export interface CLEDEvent {
  id: string;
  title: string;
  description: string;
  category: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  location: string;
  isVirtual: boolean;
  virtualLink?: string;
  hasImage: boolean;
  imageUrl?: string;
  isPublic: boolean;
  accessCode?: string; // For private events
  capacity: number; // 0 for unlimited
  status: 'active' | 'completed' | 'cancelled';
  speaker?: string;
  speakerRole?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Attendee {
  id: string;
  eventId: string;
  firstName: string; // Nombre (s)
  lastName: string;  // Apellido (s)
  fullName: string;  // Nombre y Apellido combinado
  grade: '3ro' | '4to' | '5to' | '6to'; // Grado
  section: string;   // Sección: A, B, C, D, E para 3ro; A, B para 4to-6to
  technicalMajor?: string; // Técnico (vacío o N/A para 3ro)
  studentId?: string; // Matrícula o ID escolar
  email: string;     // nombreusuarios@dominio.com
  phone: string;     // +1 (000) 000 - 0000
  career?: string;   // Compatibilidad con reportes previos
  academicYear?: string;
  attended: boolean;
  attendedAt?: string;
  registeredAt: string;
  ticketCode: string; // ID de boleta de máximo 5 dígitos
  secretToken: string;
  emailConfirmationSent: boolean;
  emailSentAt?: string;
}

export interface EmailLog {
  id: string;
  attendeeId: string;
  eventId: string;
  to: string;
  recipientName: string;
  subject: string;
  eventTitle: string;
  ticketCode: string;
  sentAt: string;
  status: 'sent' | 'delivered';
  htmlBody: string;
}

export interface EventStats {
  totalEvents: number;
  activeEvents: number;
  totalAttendees: number;
  confirmedAttendees: number;
  attendanceRate: number;
}
