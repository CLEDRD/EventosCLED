import jsPDF from 'jspdf';

export interface TicketData {
  ticketCode: string;
  fullName: string;
  firstName?: string;
  lastName?: string;
  grade?: string;
  section?: string;
  technicalMajor?: string;
  studentId?: string;
  email: string;
  phone?: string;
  eventTitle: string;
  date: string;
  time: string;
  location: string;
  isVirtual?: boolean;
}

/**
 * Downloads a high-quality, print-ready PDF digital ticket for IPMHU CLED
 */
export function downloadTicketPDF(ticket: TicketData): void {
  try {
    // Ticket dimensions: 180mm x 110mm (convenient horizontal ticket card)
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: [115, 185]
    });

    // 1. Background
    doc.setFillColor(248, 250, 252); // light slate #F8FAFC
    doc.rect(0, 0, 185, 115, 'F');

    // 2. Main Ticket Card with border
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(203, 213, 225); // #CBD5E1
    doc.setLineWidth(0.6);
    doc.roundedRect(6, 6, 173, 103, 3, 3, 'FD');

    // 3. Navy Header Banner
    doc.setFillColor(10, 25, 47); // #0A192F Deep Navy
    doc.roundedRect(6, 6, 173, 26, 3, 3, 'F');
    // Square off bottom corners of header
    doc.rect(6, 20, 173, 12, 'F');

    // Gold Accent Stripe
    doc.setFillColor(217, 119, 6); // Amber / Gold #D97706
    doc.rect(6, 32, 173, 1.8, 'F');

    // Header Text
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('INSTITUTO POLITÉCNICO MAX HENRÍQUEZ UREÑA', 12, 14);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(191, 219, 254); // Blue 200
    doc.text('Club de Liderazgo Estudiantil y Desarrollo (CLED) • Boleta Oficial de Entrada', 12, 20);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(253, 230, 138); // Light Amber
    doc.text('BOLETA VÁLIDA PARA ACCESO INSTITUCIONAL', 12, 27);

    // 4. Ticket Code Callout (Top Right)
    doc.setFillColor(15, 23, 42); // slate 900
    doc.roundedRect(128, 10, 45, 18, 2, 2, 'F');
    doc.setTextColor(148, 163, 184);
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.text('ID DE BOLETA (5 DÍGITOS)', 131, 15);

    doc.setTextColor(251, 191, 36); // Gold Amber 400
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(`#${ticket.ticketCode}`, 131, 24);

    // 5. Event Information
    doc.setTextColor(15, 23, 42); // Slate 900
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    // Split title if long
    const titleLines = doc.splitTextToSize(ticket.eventTitle, 160);
    doc.text(titleLines, 12, 40);

    const afterTitleY = 40 + (titleLines.length * 4.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(`Fecha: ${ticket.date}   |   Hora: ${ticket.time} hrs   |   Lugar: ${ticket.location}`, 12, afterTitleY);

    // 6. Student Data Box
    const boxY = afterTitleY + 4;
    doc.setFillColor(241, 245, 249); // slate 100
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.4);
    doc.roundedRect(12, boxY, 161, 26, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('DATOS DEL ESTUDIANTE REGISTRADO:', 16, boxY + 5.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(ticket.fullName, 16, boxY + 11.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    const gradeStr = `${ticket.grade || 'Secundaria'} - Sección ${ticket.section || 'A'}`;
    const majorStr = ticket.technicalMajor ? `Técnico: ${ticket.technicalMajor}` : (ticket.grade === '3ro' ? 'Ciclo General' : '');
    doc.text(`Grado: ${gradeStr}   ${majorStr ? ` |   ${majorStr}` : ''}`, 16, boxY + 17);

    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Correo: ${ticket.email}   |   Tel: ${ticket.phone || 'No registrado'}`, 16, boxY + 22.5);

    // 7. Simulated Barcode Stripes (Clean aesthetic representation)
    const barcodeY = boxY + 29;
    doc.setFillColor(15, 23, 42);
    let barX = 12;
    const barWidths = [1.2, 0.6, 1.8, 0.4, 2.2, 0.8, 1.0, 2.5, 0.5, 1.6, 0.6, 2.0, 0.8, 1.4, 0.6, 2.2, 0.5, 1.1, 1.9, 0.7, 1.3, 0.5, 2.4, 0.9, 1.5, 0.6, 1.8, 0.4, 2.0, 0.7, 1.2, 0.5, 1.7, 0.8, 2.1, 0.6, 1.4];
    for (let i = 0; i < barWidths.length; i++) {
      doc.rect(barX, barcodeY, barWidths[i], 7, 'F');
      barX += barWidths[i] + (i % 3 === 0 ? 1.0 : 0.6);
      if (barX > 68) break;
    }

    doc.setFont('courier', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(15, 23, 42);
    doc.text(`IPMHU-${ticket.ticketCode}-CLED`, 16, barcodeY + 10.5);

    // 8. Mandatory Policy Alert
    const noticeX = 75;
    doc.setFillColor(254, 243, 199); // Amber 100
    doc.setDrawColor(252, 211, 77); // Amber 300
    doc.roundedRect(noticeX, barcodeY, 98, 11.5, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(146, 64, 14); // Amber 800
    doc.text('AVISO OBLIGATORIO - REGLAS IPMHU (NO CELULARES):', noticeX + 3, barcodeY + 4);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(120, 53, 15);
    doc.text('No traigas tu celular. En la entrada se verifica tu ID (# ' + ticket.ticketCode + ') o tu nombre.', noticeX + 3, barcodeY + 8);

    // 9. Save PDF directly to user's downloads folder
    const safeName = ticket.fullName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20);
    const fileName = `Boleta_CLED_IPMHU_${ticket.ticketCode}_${safeName}.pdf`;
    doc.save(fileName);
  } catch (err) {
    console.error('Error generating PDF ticket:', err);
    throw err;
  }
}

/**
 * Generates and downloads a crisp PNG digital ticket image using HTML5 Canvas
 */
export function downloadTicketPNG(ticket: TicketData): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 720;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Canvas 2D context not available');
      }

      // Background
      ctx.fillStyle = '#0A192F'; // Deep Navy
      ctx.fillRect(0, 0, 1200, 720);

      // Gradient accent in center
      const grad = ctx.createLinearGradient(0, 0, 1200, 720);
      grad.addColorStop(0, '#0F274A');
      grad.addColorStop(0.5, '#0A192F');
      grad.addColorStop(1, '#1A1E36');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1200, 720);

      // Card border
      ctx.strokeStyle = '#2563EB';
      ctx.lineWidth = 3;
      ctx.strokeRect(30, 30, 1140, 660);

      // Top Gold Bar
      ctx.fillStyle = '#D97706';
      ctx.fillRect(30, 30, 1140, 8);

      // Header Text
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 30px system-ui, -apple-system, sans-serif';
      ctx.fillText('INSTITUTO POLITÉCNICO MAX HENRÍQUEZ UREÑA', 60, 85);

      ctx.fillStyle = '#93C5FD';
      ctx.font = '500 20px system-ui, -apple-system, sans-serif';
      ctx.fillText('Club de Liderazgo Estudiantil y Desarrollo (CLED) • Boleta Digital Oficial', 60, 118);

      // Ticket Code Badge
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(860, 60, 280, 85);
      ctx.strokeStyle = '#D97706';
      ctx.lineWidth = 2;
      ctx.strokeRect(860, 60, 280, 85);

      ctx.fillStyle = '#94A3B8';
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.fillText('ID DE BOLETA (5 DÍGITOS)', 880, 88);

      ctx.fillStyle = '#F59E0B';
      ctx.font = 'bold 36px monospace';
      ctx.fillText(`#${ticket.ticketCode}`, 880, 130);

      // Event Info Box
      ctx.fillStyle = '#162A45';
      ctx.fillRect(60, 170, 1080, 130);
      ctx.strokeStyle = '#1E3A8A';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(60, 170, 1080, 130);

      ctx.fillStyle = '#F8FAFC';
      ctx.font = 'bold 26px system-ui, sans-serif';
      // Truncate event title if very long
      const title = ticket.eventTitle.length > 70 ? ticket.eventTitle.substring(0, 67) + '...' : ticket.eventTitle;
      ctx.fillText(title, 85, 215);

      ctx.fillStyle = '#CBD5E1';
      ctx.font = '500 19px system-ui, sans-serif';
      ctx.fillText(`📅 ${ticket.date}   •   ⏰ ${ticket.time} hrs   •   📍 ${ticket.location}`, 85, 265);

      // Student Details Box
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(60, 330, 1080, 190);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(60, 330, 1080, 190);

      ctx.fillStyle = '#94A3B8';
      ctx.font = 'bold 16px system-ui, sans-serif';
      ctx.fillText('ESTUDIANTE REGISTRADO:', 85, 365);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 28px system-ui, sans-serif';
      ctx.fillText(ticket.fullName, 85, 405);

      ctx.fillStyle = '#60A5FA';
      ctx.font = '600 20px system-ui, sans-serif';
      const gradeText = `${ticket.grade || 'Secundaria'} - Sección ${ticket.section || 'A'}`;
      const majorText = ticket.technicalMajor ? `Técnico: ${ticket.technicalMajor}` : (ticket.grade === '3ro' ? 'Ciclo General' : '');
      ctx.fillText(`${gradeText}   ${majorText ? ` |   ${majorText}` : ''}`, 85, 445);

      ctx.fillStyle = '#94A3B8';
      ctx.font = '17px system-ui, sans-serif';
      ctx.fillText(`Email: ${ticket.email}   •   Tel: ${ticket.phone || 'No registrado'}`, 85, 485);

      // Barcode simulation
      let bx = 60;
      const bHeights = 50;
      const bY = 555;
      const bPattern = [3, 1, 4, 1, 2, 5, 2, 1, 3, 2, 4, 1, 2, 1, 4, 2, 3, 1, 5, 2, 1, 3, 2, 4, 1, 3, 2, 1, 4, 2, 3, 1, 2, 4, 1, 3];
      ctx.fillStyle = '#F8FAFC';
      for (const w of bPattern) {
        ctx.fillRect(bx, bY, w * 3, bHeights);
        bx += w * 3 + 4;
        if (bx > 380) break;
      }

      ctx.fillStyle = '#94A3B8';
      ctx.font = 'bold 16px monospace';
      ctx.fillText(`*IPMHU-${ticket.ticketCode}-CLED*`, 60, 630);

      // Rule warning notice box
      ctx.fillStyle = '#78350F';
      ctx.fillRect(440, 545, 700, 110);
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 2;
      ctx.strokeRect(440, 545, 700, 110);

      ctx.fillStyle = '#FEF3C7';
      ctx.font = 'bold 18px system-ui, sans-serif';
      ctx.fillText('⚠️ REGLA INSTITUCIONAL OBLIGATORIA (NO CELULARES)', 460, 578);

      ctx.fillStyle = '#FDE68A';
      ctx.font = '15px system-ui, sans-serif';
      ctx.fillText('Prohibido el uso de celulares en el Instituto Politécnico Max Henríquez Ureña.', 460, 608);
      ctx.fillText(`Para ingresar, solo di tu ID de boleta (#${ticket.ticketCode}) o tu nombre en la puerta.`, 460, 634);

      // Convert to blob and download
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Failed to create ticket image blob'));
          return;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const safeName = ticket.fullName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20);
        a.href = url;
        a.download = `Boleta_CLED_IPMHU_${ticket.ticketCode}_${safeName}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        resolve();
      }, 'image/png');
    } catch (err) {
      reject(err);
    }
  });
}
