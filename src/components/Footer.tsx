import React from 'react';
import { Lock, Award, Heart, Mail, Instagram, MapPin, Sparkles } from 'lucide-react';
import { CLED_LOGO } from '../utils/logo';

interface FooterProps {
  onOpenAdmin: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onOpenAdmin }) => {
  return (
    <footer className="bg-slate-100/90 text-slate-600 border-t border-slate-200 mt-16 font-sans">
      {/* Main Footer Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          
          {/* Col 1: Brand & Mission */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-center p-0.5 overflow-hidden">
                <img
                  src={CLED_LOGO}
                  alt="Logo CLED"
                  className="w-full h-full object-contain"
                  loading="lazy"
                />
              </div>
              <div>
                <span className="text-lg font-extrabold text-slate-900 tracking-tight">
                  Eventos<span className="text-blue-700">CLED</span>
                </span>
                <p className="text-xs text-slate-500 font-medium">
                  Club de Liderazgo Estudiantil y Desarrollo • IPMHU
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed max-w-md">
              Organización estudiantil sin fines de lucro dedicada a potenciar las competencias de liderazgo, oratoria, tecnología y compromiso cívico de la comunidad del Instituto Politécnico Max Henríquez Ureña.
            </p>

            <div className="flex items-center gap-3 text-xs text-blue-800 font-semibold pt-1">
              <span className="flex items-center gap-1.5">
                <Award className="w-4 h-4 text-blue-700" />
                <span>Acreditación Oficial</span>
              </span>
              <span>•</span>
              <span>Certificaciones Verificadas</span>
            </div>
          </div>

          {/* Col 2: Institutional Values */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-3">
              Pilares CLED
            </h4>
            <ul className="space-y-2 text-xs text-slate-600">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                <span>Liderazgo Transformacional</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                <span>Ética y Responsabilidad Cívica</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                <span>Gestión de Proyectos de Impacto</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                <span>Oratoria y Resolución de Conflictos</span>
              </li>
            </ul>
          </div>

          {/* Col 3: Contact & Campus */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-3">
              Contacto Oficial
            </h4>
            <ul className="space-y-2.5 text-xs text-slate-600">
              <li className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-blue-700 flex-shrink-0 mt-0.5" />
                <span className="leading-snug">Instituto Politécnico Max Henríquez Ureña</span>
              </li>
              <li className="flex items-center gap-2">
                <Instagram className="w-4 h-4 text-pink-600 flex-shrink-0" />
                <a
                  href="https://instagram.com/cled_pmhu"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-slate-700 hover:text-pink-600 transition-colors"
                >
                  @cled_pmhu
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-blue-700 flex-shrink-0" />
                <a
                  href="mailto:contacto.cled@outlook.com"
                  className="font-medium text-slate-700 hover:text-blue-700 transition-colors"
                >
                  contacto.cled@outlook.com
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar with the requested discreet admin button */}
        <div className="mt-10 pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>
            © {new Date().getFullYear()} Club de Liderazgo Estudiantil y Desarrollo (CLED). Todos los derechos reservados.
          </p>

          {/* Discreet small administration button as explicitly requested */}
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-slate-400">Portal IPMHU v2.6</span>
            <button
              onClick={onOpenAdmin}
              className="text-[11px] font-semibold text-slate-600 hover:text-blue-900 transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-300 shadow-xs"
              title="Panel de administración de eventos y asistentes"
            >
              <Lock className="w-3 h-3 text-blue-700" />
              <span>Administración</span>
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};
