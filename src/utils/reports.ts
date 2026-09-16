import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CLEDEvent, Attendee } from '../types';

/**
 * Exports event attendance list to Excel (.xlsx) for Instituto Politécnico Max Henríquez Ureña
 */
export function exportAttendanceToExcel(event: CLEDEvent, attendees: Attendee[]): void {
  const totalInscritos = attendees.length;
  const asistieron = attendees.filter(a => a.attended).length;
  const ausentes = totalInscritos - asistieron;
  const porcentaje = totalInscritos > 0 ? ((asistieron / totalInscritos) * 100).toFixed(1) + '%' : '0%';

  // Format attendees rows with secondary school data
  const rows = attendees.map((a, index) => ({
    'N°': index + 1,
    'ID de Boleta': a.ticketCode,
    'Nombre (s)': a.firstName || a.fullName.split(' ')[0] || a.fullName,
    'Apellido (s)': a.lastName || a.fullName.split(' ').slice(1).join(' ') || '',
    'Grado': a.grade || 'Secundaria',
    'Sección': a.section || 'A',
    'Técnico / Especialidad': a.grade === '3ro' ? 'N/A (Ciclo General)' : (a.technicalMajor || 'General'),
    'Teléfono': a.phone,
    'Email': a.email,
    'Estado Asistencia': a.attended ? 'PRESENTE / INGRESÓ' : 'PENDIENTE / AUSENTE',
    'Hora Check-In': a.attendedAt ? new Date(a.attendedAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-',
    'Fecha Inscripción': new Date(a.registeredAt).toLocaleString('es-ES'),
  }));

  // Create workbook
  const wb = XLSX.utils.book_new();

  // Summary Metadata Header
  const headerData = [
    ['INSTITUTO POLITÉCNICO MAX HENRÍQUEZ UREÑA (IPMHU)'],
    ['CLUB DE LIDERAZGO ESTUDIANTIL Y DESARROLLO (CLED)'],
    ['REPORTE OFICIAL DE CONTROL DE ASISTENCIA Y ENTRADAS'],
    [],
    ['Evento:', event.title],
    ['Modalidad:', event.isVirtual ? 'Virtual' : 'Presencial'],
    ['Lugar:', event.location],
    ['Fecha del Evento:', event.date],
    ['Hora del Evento:', event.time],
    ['Total Estudiantes Inscritos:', totalInscritos],
    ['Asistencia Aceptada en Puerta:', asistieron],
    ['Pendientes / Ausentes:', ausentes],
    ['Porcentaje de Asistencia:', porcentaje],
    ['Fecha de Generación del Reporte:', new Date().toLocaleString('es-ES')],
    [],
    ['LISTADO DETALLADO DE ESTUDIANTES:']
  ];

  const ws = XLSX.utils.aoa_to_sheet(headerData);

  // Append attendee table starting below header
  XLSX.utils.sheet_add_json(ws, rows, { origin: 'A17' });

  // Column width hints
  ws['!cols'] = [
    { wch: 6 },  // N°
    { wch: 14 }, // ID de Boleta
    { wch: 20 }, // Nombre(s)
    { wch: 22 }, // Apellido(s)
    { wch: 10 }, // Grado
    { wch: 10 }, // Sección
    { wch: 32 }, // Técnico
    { wch: 20 }, // Teléfono
    { wch: 28 }, // Email
    { wch: 22 }, // Estado
    { wch: 16 }, // Hora Check-In
    { wch: 22 }  // Fecha Inscripción
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Asistencia IPMHU');

  // File name sanitization
  const cleanTitle = event.title.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30);
  const fileName = `IPMHU_CLED_Asistencia_${cleanTitle}_${event.date}.xlsx`;

  XLSX.writeFile(wb, fileName);
}

/**
 * Generates an official, highly polished institutional PDF report for IPMHU
 */
export function exportAttendanceToPDF(event: CLEDEvent, attendees: Attendee[]): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter',
  });

  const totalInscritos = attendees.length;
  const asistieron = attendees.filter(a => a.attended).length;
  const ausentes = totalInscritos - asistieron;
  const porcentaje = totalInscritos > 0 ? ((asistieron / totalInscritos) * 100).toFixed(1) + '%' : '0%';

  // Navy Top Institutional Banner
  doc.setFillColor(10, 25, 47); // #0A192F Dark Navy
  doc.rect(0, 0, 216, 36, 'F');

  // Accent Line
  doc.setFillColor(37, 99, 235); // Royal Blue
  doc.rect(0, 36, 216, 2.5, 'F');

  // Header Titles
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('INSTITUTO POLITÉCNICO MAX HENRÍQUEZ UREÑA', 14, 15);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(191, 219, 254);
  doc.text('Club de Liderazgo Estudiantil y Desarrollo (CLED) • Control de Asistencia', 14, 22);
  doc.setFontSize(8);
  doc.text(`Reporte Oficial de Entradas • Generado el: ${new Date().toLocaleString('es-ES')}`, 14, 29);

  // Metadata Card
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, 43, 188, 38, 3, 3, 'FD');

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(event.title, 18, 51);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);

  doc.text(`Fecha: ${event.date}   |   Hora: ${event.time}`, 18, 58);
  doc.text(`Modalidad: ${event.isVirtual ? 'Virtual' : 'Presencial'}   |   Lugar: ${event.location}`, 18, 64);
  doc.text(`Categoría: ${event.category}   |   Tipo: ${event.isPublic ? 'Público' : 'Privado (Restringido)'}`, 18, 70);
  if (event.speaker) {
    doc.text(`Ponente / Facilitador: ${event.speaker} (${event.speakerRole || 'Invitado Especial'})`, 18, 76);
  }

  // Summary Metrics Badges
  const metricY = 85;
  const colW = 44;

  // Box 1: Total Inscritos
  doc.setFillColor(239, 246, 255);
  doc.setDrawColor(191, 219, 254);
  doc.roundedRect(14, metricY, colW, 16, 2, 2, 'FD');
  doc.setFontSize(7);
  doc.setTextColor(30, 64, 175);
  doc.text('TOTAL INSCRITOS', 17, metricY + 5);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(totalInscritos.toString(), 17, metricY + 12);

  // Box 2: Presentes
  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(187, 247, 208);
  doc.roundedRect(14 + colW + 4, metricY, colW, 16, 2, 2, 'FD');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(22, 101, 52);
  doc.text('ASISTENCIA ACEPTADA', 17 + colW + 4, metricY + 5);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(asistieron.toString(), 17 + colW + 4, metricY + 12);

  // Box 3: Ausentes
  doc.setFillColor(254, 242, 242);
  doc.setDrawColor(254, 202, 202);
  doc.roundedRect(14 + (colW + 4) * 2, metricY, colW, 16, 2, 2, 'FD');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(153, 27, 27);
  doc.text('PENDIENTES / AUSENTES', 17 + (colW + 4) * 2, metricY + 5);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(ausentes.toString(), 17 + (colW + 4) * 2, metricY + 12);

  // Box 4: Tasa de Asistencia
  doc.setFillColor(245, 243, 255);
  doc.setDrawColor(221, 214, 254);
  doc.roundedRect(14 + (colW + 4) * 3, metricY, colW, 16, 2, 2, 'FD');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(91, 33, 182);
  doc.text('TASA DE ASISTENCIA', 17 + (colW + 4) * 3, metricY + 5);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(porcentaje, 17 + (colW + 4) * 3, metricY + 12);

  // Table
  const tableData = attendees.map((a, i) => [
    (i + 1).toString(),
    `#${a.ticketCode}`,
    `${a.firstName || ''} ${a.lastName || ''}`.trim() || a.fullName,
    `${a.grade || 'Sec.'} - ${a.section || 'A'}`,
    a.grade === '3ro' ? 'Ciclo General' : (a.technicalMajor || 'General'),
    a.phone,
    a.attended ? 'PRESENTE' : 'AUSENTE',
    a.attendedAt ? new Date(a.attendedAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '-'
  ]);

  autoTable(doc, {
    startY: 106,
    head: [['#', 'Boleta', 'Estudiante', 'Grado / Sec.', 'Especialidad Técnica', 'Teléfono', 'Estado', 'Entrada']],
    body: tableData,
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
      font: 'helvetica',
      textColor: [30, 41, 59],
    },
    headStyles: {
      fillColor: [10, 25, 47],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 7, halign: 'center' },
      1: { cellWidth: 18, fontStyle: 'bold' },
      2: { cellWidth: 42 },
      3: { cellWidth: 24 },
      4: { cellWidth: 40 },
      5: { cellWidth: 25 },
      6: { cellWidth: 20, halign: 'center' },
      7: { cellWidth: 12, halign: 'center' },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 6) {
        if (data.cell.raw === 'PRESENTE') {
          data.cell.styles.textColor = [22, 101, 52];
          data.cell.styles.fontStyle = 'bold';
        } else {
          data.cell.styles.textColor = [185, 28, 28];
        }
      }
    },
    margin: { left: 14, right: 14, bottom: 25 },
  });

  // Footer on each page
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.setDrawColor(226, 232, 240);
    doc.line(14, 268, 202, 268);
    doc.text('Instituto Politécnico Max Henríquez Ureña • Club CLED • Control Oficial de Accesos', 14, 273);
    doc.text(`Página ${i} de ${pageCount}`, 190, 273, { align: 'right' });
  }

  const cleanTitle = event.title.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30);
  doc.save(`IPMHU_CLED_Reporte_${cleanTitle}_${event.date}.pdf`);
}
