// Security, Validation, and Anti-Troll Engine for EventosCLED

// Comprehensive list of vulgarities, slurs, obscenities and typical prank names in Spanish and English
const BANNED_WORDS = [
  'puta', 'puto', 'putita', 'puton', 'mierda', 'mierdero', 'pendejo', 'pendeja',
  'coño', 'culiao', 'culia', 'culo', 'culote', 'verga', 'vergazo', 'vergon',
  'chucha', 'maldito', 'maldita', 'chinga', 'chingada', 'chingon', 'cabron', 'cabrona',
  'maricon', 'marica', 'marico', 'zorra', 'zorrera', 'gonorrea', 'hijodeputa', 'hdp',
  'malparido', 'malparida', 'carechimba', 'chimba', 'chupala', 'chupamela', 'mamaguevo',
  'mamahuevo', 'guevon', 'guevona', 'huevon', 'huevona', 'polla', 'pene', 'vagina',
  'tetas', 'teta', 'semen', 'cojone', 'cojones', 'gilipollas', 'bastardo', 'imbecil',
  'estupido', 'estupida', 'tarado', 'tarada', 'idiota', 'prostituta', 'ramera', 'nazi',
  'hitler', 'violador', 'pedofilo', 'drogas', 'cocaina', 'fuck', 'shit', 'bitch', 'asshole',
  'dick', 'cunt', 'pussy', 'nigger', 'faggot'
];

// Well-known double entendre / troll names in Hispanic student culture
const TROLL_PATTERNS = [
  /elver\s*ga/i,
  /rosa\s*mela/i,
  /debora\s*melo/i,
  /aquiles\s*ba/i,
  /alma\s*marce/i,
  /benito\s*camela/i,
  /jorge\s*nitales/i,
  /miren\s*amado/i,
  /lola\s*mento/i,
  /soila\s*cerda/i,
  /elba\s*surero/i,
  /armando\s*paredes/i,
  /marta\s*baco/i,
  /sevelinda\s*parada/i,
  /lucas\s*melo/i,
  /chupa\s*m/i,
  /come\s*m/i,
  /me\s*pica/i,
  /mama\s*lo/i,
  /chupa\s*el/i
];

/**
 * Normalizes string removing accents, special characters, and leetspeak
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .replace(/4/g, 'a')
    .replace(/3/g, 'e')
    .replace(/1/g, 'i')
    .replace(/!/g, 'i')
    .replace(/0/g, 'o')
    .replace(/5/g, 's')
    .replace(/7/g, 't')
    .replace(/@/g, 'a')
    .replace(/[$]/g, 's')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  field?: string;
}

/**
 * Validates text against obscene words, insults, and troll names
 */
export function checkProfanity(text: string): { hasProfanity: boolean; reason?: string } {
  if (!text) return { hasProfanity: false };

  // Check troll pattern regexes
  for (const pattern of TROLL_PATTERNS) {
    if (pattern.test(text)) {
      return {
        hasProfanity: true,
        reason: 'El nombre parece ser una broma o juego de palabras inapropiado.'
      };
    }
  }

  const normalized = normalizeText(text);
  const words = normalized.split(/\s+/);

  for (const banned of BANNED_WORDS) {
    // Exact word match or word containing substring if word is long enough
    for (const word of words) {
      if (word === banned) {
        return {
          hasProfanity: true,
          reason: `Se detectó vocabulario no permitido ("${banned}") bajo la política institucional de respeto de CLED.`
        };
      }
    }
    // Also check if text without spaces has the banned word (e.g. "pu-ta" -> "puta")
    const collapsed = normalized.replace(/\s+/g, '');
    if (collapsed.includes(banned) && banned.length >= 4) {
      return {
        hasProfanity: true,
        reason: `El texto ingresado contiene términos restringidos no conformes con las normas de convivencia institucional.`
      };
    }
  }

  return { hasProfanity: false };
}

export const VALID_GRADES = ['3ro', '4to', '5to', '6to'] as const;
export type GradeType = typeof VALID_GRADES[number];

export const VALID_SECTIONS_3RO = ['A', 'B', 'C', 'D', 'E'] as const;
export const VALID_SECTIONS_OTHER = ['A', 'B'] as const;

export const VALID_TECHNICAL_MAJORS = [
  'Desarrollo y Adm. Apps. Informáticas',
  'Logística y Transporte',
  'Gestión Administrativa y Tributaria',
  'Refrigeración',
  'Electrónica',
  'Electricidad'
] as const;

export const IPMHU_CELLPHONE_NOTICE = 
  'Resulta indispensable presentar el ID de la boleta (máximo 5 dígitos), nombre o apellido del usuario para ingresar al evento. ' +
  'Se exhorta a anotar el ID de la boleta, nombre o apellido en papel o libreta debido a las reglas internas del ' +
  'Instituto Politécnico Max Henríquez Ureña que prohíbe rotundamente el uso de celulares en el centro. ' +
  'Lo pueden llevar, pero CLED no se hace cargo del retiro del mismo ni exhorta a su uso dentro de las instalaciones.';

/**
 * Comprehensive registration validator for Instituto Politécnico Max Henríquez Ureña
 */
export function validateRegistrationData(data: {
  firstName: string;
  lastName: string;
  grade: string;
  section: string;
  technicalMajor?: string;
  email: string;
  phone: string;
  fullName?: string;
  studentId?: string;
  career?: string;
}): ValidationResult {
  // 1. First Name (Nombre s)
  const firstName = (data.firstName || '').trim();
  if (firstName.length < 2) {
    return {
      isValid: false,
      field: 'firstName',
      error: 'Por favor ingresa tu nombre (mínimo 2 caracteres).'
    };
  }

  const fnCheck = checkProfanity(firstName);
  if (fnCheck.hasProfanity) {
    return {
      isValid: false,
      field: 'firstName',
      error: fnCheck.reason || 'Nombre no admitido por el filtro institucional.'
    };
  }

  // 2. Last Name (Apellido s)
  const lastName = (data.lastName || '').trim();
  if (lastName.length < 2) {
    return {
      isValid: false,
      field: 'lastName',
      error: 'Por favor ingresa tu apellido (mínimo 2 caracteres).'
    };
  }

  const lnCheck = checkProfanity(lastName);
  if (lnCheck.hasProfanity) {
    return {
      isValid: false,
      field: 'lastName',
      error: lnCheck.reason || 'Apellido no admitido por el filtro institucional.'
    };
  }

  // 3. Grade (Grado: 3ro, 4to, 5to, 6to)
  const grade = (data.grade || '').trim();
  if (!VALID_GRADES.includes(grade as GradeType)) {
    return {
      isValid: false,
      field: 'grade',
      error: 'Selecciona un grado válido (3ro, 4to, 5to o 6to de secundaria).'
    };
  }

  // 4. Section (Sección: 3ro -> A, B, C, D, E; otros -> A, B)
  const section = (data.section || '').trim().toUpperCase();
  if (grade === '3ro') {
    if (!VALID_SECTIONS_3RO.includes(section as any)) {
      return {
        isValid: false,
        field: 'section',
        error: 'Para 3ro de secundaria, la sección debe ser A, B, C, D o E.'
      };
    }
  } else {
    if (!VALID_SECTIONS_OTHER.includes(section as any)) {
      return {
        isValid: false,
        field: 'section',
        error: `Para ${grade} de secundaria, la sección debe ser A o B.`
      };
    }
  }

  // 5. Technical (Técnico / Mención Técnica)
  // En caso de ser 3ro, no debe estar habilitada / no aplica.
  // En caso contrario, debe ser una de las 6 opciones oficiales.
  const technicalMajor = (data.technicalMajor || '').trim();
  if (grade !== '3ro') {
    if (!VALID_TECHNICAL_MAJORS.includes(technicalMajor as any)) {
      return {
        isValid: false,
        field: 'technicalMajor',
        error: 'Para 4to, 5to y 6to debes seleccionar tu especialidad técnica (Desarrollo y Adm. Apps. Informáticas, Logística y Transporte, Gestión Administrativa y Tributaria, Refrigeración, Electrónica o Electricidad).'
      };
    }
  }

  // 6. Phone (+1 (000) 000 - 0000 format)
  const phone = (data.phone || '').trim();
  const phoneDigits = phone.replace(/[^0-9]/g, '');
  if (!phone || phoneDigits.length < 10) {
    return {
      isValid: false,
      field: 'phone',
      error: 'Ingresa un teléfono de contacto válido con código de área (ej: +1 (809) 000 - 0000).'
    };
  }

  // 7. Email
  const email = (data.email || '').trim().toLowerCase();
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!email || !emailRegex.test(email)) {
    return {
      isValid: false,
      field: 'email',
      error: 'Por favor ingresa un correo electrónico válido (ej: nombreusuarios@dominio.com).'
    };
  }

  return { isValid: true };
}

/**
 * Generates unique institutional ticket code (max 5 digits strictly)
 * Format: 5-digit number string e.g. "48291"
 */
export function generateTicketCode(eventId?: string): string {
  // strictly 5 digits (between 10000 and 99999)
  return Math.floor(10000 + Math.random() * 90000).toString();
}

/**
 * Generates official institutional HTML Confirmation Email for IPMHU
 */
export function generateConfirmationEmailHtml(params: {
  fullName: string;
  firstName?: string;
  lastName?: string;
  grade?: string;
  section?: string;
  technicalMajor?: string;
  eventTitle: string;
  eventDate: string;
  eventTime: string;
  eventLocation: string;
  ticketCode: string;
  isVirtual: boolean;
  virtualLink?: string;
  studentId?: string;
  career?: string;
}): string {
  const {
    fullName,
    grade,
    section,
    technicalMajor,
    eventTitle,
    eventDate,
    eventTime,
    eventLocation,
    ticketCode,
    isVirtual,
    virtualLink,
  } = params;

  const academicInfo = grade === '3ro'
    ? `Grado: 3ro de Secundaria — Sección ${section || 'General'}`
    : `Grado: ${grade || 'Secundaria'} — Sección ${section || 'A'} — Técnico: ${technicalMajor || 'General'}`;

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirmación de Boleta - CLED | IPMHU</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b1528; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #0b1528; padding: 30px 10px;">
    <tr>
      <td align="center">
        <!-- Main Email Container -->
        <table role="presentation" width="100%" max-width="600" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.35);">
          
          <!-- Header Navy Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #0A192F 0%, #1E3A8A 100%); padding: 36px 30px; text-align: center; border-bottom: 4px solid #3B82F6;">
              <div style="display: inline-block; background-color: rgba(255,255,255,0.12); padding: 8px 16px; border-radius: 30px; margin-bottom: 12px; border: 1px solid rgba(255,255,255,0.2);">
                <span style="color: #93C5FD; font-size: 11px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase;">Instituto Politécnico Max Henríquez Ureña</span>
              </div>
              <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">Club de Liderazgo Estudiantil y Desarrollo (CLED)</h1>
              <p style="color: #BFDBFE; margin: 8px 0 0 0; font-size: 13px; font-weight: 500;">Portal Oficial de Eventos Estudiantiles e Inscripciones</p>
            </td>
          </tr>

          <!-- Success Alert Banner -->
          <tr>
            <td style="background-color: #EFF6FF; padding: 18px 30px; border-bottom: 1px solid #DBEAFE; text-align: center;">
              <p style="margin: 0; color: #1E40AF; font-size: 14px; font-weight: 700;">
                ✓ ¡Inscripción y Boleta Confirmada Exitosamente!
              </p>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 32px 30px;">
              <p style="font-size: 16px; color: #334155; margin-top: 0; line-height: 1.6;">
                Hola estudiante <strong>${fullName}</strong>,
              </p>
              <p style="font-size: 14px; color: #475569; line-height: 1.6;">
                Tu inscripción ha sido confirmada en el sistema institucional para el siguiente evento del <strong>Club de Liderazgo Estudiantil y Desarrollo</strong> en el <strong>Instituto Politécnico Max Henríquez Ureña</strong>:
              </p>

              <!-- Event Card -->
              <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-left: 5px solid #1E3A8A; border-radius: 8px; padding: 20px; margin: 24px 0;">
                <h2 style="font-size: 18px; color: #0F172A; margin: 0 0 14px 0; font-weight: 700;">
                  ${eventTitle}
                </h2>
                
                <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #334155;">
                  <tr>
                    <td style="padding: 6px 0; font-weight: 600; width: 90px; color: #64748B;">Fecha:</td>
                    <td style="padding: 6px 0; font-weight: 600; color: #0F172A;">${eventDate}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; font-weight: 600; color: #64748B;">Hora:</td>
                    <td style="padding: 6px 0; font-weight: 600; color: #0F172A;">${eventTime}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; font-weight: 600; color: #64748B;">Modalidad:</td>
                    <td style="padding: 6px 0; font-weight: 600; color: ${isVirtual ? '#2563EB' : '#059669'};">
                      ${isVirtual ? '🌐 Virtual' : '📍 Presencial (Politécnico)'}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; font-weight: 600; color: #64748B;">Lugar:</td>
                    <td style="padding: 6px 0; font-weight: 600; color: #0F172A;">${eventLocation}</td>
                  </tr>
                  ${isVirtual && virtualLink ? `
                  <tr>
                    <td style="padding: 6px 0; font-weight: 600; color: #64748B;">Enlace:</td>
                    <td style="padding: 6px 0;"><a href="${virtualLink}" style="color: #2563EB; word-break: break-all;">Acceder a Sala</a></td>
                  </tr>
                  ` : ''}
                </table>
              </div>

              <!-- Ticket Code (Max 5 Digits) -->
              <div style="text-align: center; background-color: #0A192F; border-radius: 10px; padding: 24px; margin: 24px 0; color: #ffffff;">
                <p style="margin: 0 0 6px 0; font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #94A3B8;">ID de Boleta Oficial (5 Dígitos)</p>
                <div style="font-size: 36px; font-weight: 800; letter-spacing: 6px; color: #60A5FA; font-family: monospace; padding: 6px 0;">
                  #${ticketCode}
                </div>
                <div style="margin-top: 10px; font-size: 12px; color: #CBD5E1;">
                  ${academicInfo}
                </div>
              </div>

              <!-- MANDATORY NOTICE REGARDING CELLPHONES IN IPMHU -->
              <div style="background-color: #FEF3C7; border: 1.5px solid #F59E0B; border-radius: 8px; padding: 18px; font-size: 12.5px; color: #92400E; line-height: 1.6; margin: 20px 0;">
                <p style="margin: 0 0 8px 0; font-weight: 800; font-size: 13px; color: #B45309; text-transform: uppercase; letter-spacing: 0.5px;">
                  ⚠️ AVISO INDISPENSABLE - REGLAMENTO INTERNO DE CELULARES:
                </p>
                <p style="margin: 0 0 8px 0;">
                  Resulta <strong>indispensable presentar el ID de la boleta (#${ticketCode}), tu nombre o tu apellido</strong> para ingresar al evento en las puertas de acceso.
                </p>
                <p style="margin: 0; font-weight: 600;">
                  Te exhortamos encarecidamente a <u>anotar en tu cuaderno o libreta este ID de boleta (#${ticketCode}), tu nombre y apellido</u> debido a las <strong>reglas internas del Instituto Politécnico Max Henríquez Ureña que prohíben rotundamente el uso de celulares en el centro</strong>. Lo puedes llevar, pero CLED no se hace cargo del retiro del mismo ni exhorta a su uso.
                </p>
              </div>

              <p style="font-size: 13px; color: #64748B; margin-top: 24px; line-height: 1.6;">
                ¡Nos vemos en el evento para seguir fortaleciendo tu liderazgo y formación técnica!
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #0F172A; padding: 24px 30px; text-align: center; border-top: 1px solid #1E293B;">
              <p style="margin: 0; color: #E2E8F0; font-size: 13px; font-weight: 600;">
                Club de Liderazgo Estudiantil y Desarrollo (CLED)
              </p>
              <p style="margin: 3px 0 0 0; color: #94A3B8; font-size: 12px;">
                Instituto Politécnico Max Henríquez Ureña (IPMHU)
              </p>
              <p style="margin: 6px 0 0 0; color: #93C5FD; font-size: 11px;">
                Instagram: @cled_pmhu &nbsp;|&nbsp; Email: contacto.cled@outlook.com
              </p>
              <p style="margin: 6px 0 0 0; color: #64748B; font-size: 11px;">
                © ${new Date().getFullYear()} EventosCLED • Todos los derechos reservados.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}
