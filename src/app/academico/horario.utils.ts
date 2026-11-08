/**
 * Horario académico de referencia (no representa inscripciones confirmadas).
 * Deriva únicamente de grupos y horarios válidos que coinciden con la retícula.
 */
export interface HorarioReferencia {
  id_horario?: number;
  id_materia?: number;
  dia_semana: string;
  hora_inicio: string;
  hora_fin: string;
  nombre_materia: string;
  id_grupo: number;
  tipo_salon: string;
  nombre_edificio: string;
  piso?: number;
  nombre_docente?: string;
  creditos?: number;
}

export interface DiaDeAgenda {
  nombre: string;
  abreviatura: string;
  sesiones: HorarioReferencia[];
}

const DIAS = [
  { nombre: 'Lunes', abreviatura: 'LUN' },
  { nombre: 'Martes', abreviatura: 'MAR' },
  { nombre: 'Miércoles', abreviatura: 'MIÉ' },
  { nombre: 'Jueves', abreviatura: 'JUE' },
  { nombre: 'Viernes', abreviatura: 'VIE' },
  { nombre: 'Sábado', abreviatura: 'SÁB' },
  { nombre: 'Domingo', abreviatura: 'DOM' }
] as const;

function normalizarDia(valor: string): string {
  return String(valor ?? '').trim().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/**
 * Incluye los siete días para que no desaparezcan los días vacíos.
 * Desduplica registros idénticos y descarta horas inválidas.
 * Si hay varios grupos del mismo curso, los conserva como alternativas.
 */
export function construirAgendaSemanal(horarios: readonly HorarioReferencia[]): DiaDeAgenda[] {
  const salida = DIAS.map(d => ({ ...d, sesiones: [] as HorarioReferencia[] }));
  const duplicados = new Set<string>();
  for (const horario of horarios) {
    if (!horario || typeof horario !== 'object') continue;
    const dia = normalizarDia(horario.dia_semana);
    const indice = DIAS.findIndex(d => normalizarDia(d.nombre) === dia);
    if (indice === -1) continue;
    const inicio = String(horario.hora_inicio ?? '').slice(0, 5);
    const fin = String(horario.hora_fin ?? '').slice(0, 5);
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(inicio) ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(fin) || fin <= inicio) continue;
    const grupo = Number(horario.id_grupo);
    if (!Number.isInteger(grupo) || grupo <= 0) continue;
    const clave = [dia, inicio, fin, grupo, horario.nombre_materia, horario.tipo_salon].join('|');
    if (duplicados.has(clave)) continue;
    duplicados.add(clave);
    salida[indice].sesiones.push({ ...horario, id_grupo: grupo, hora_inicio: inicio, hora_fin: fin });
  }
  for (const dia of salida) {
    dia.sesiones.sort((a,b) => a.hora_inicio.localeCompare(b.hora_inicio) ||
      a.nombre_materia.localeCompare(b.nombre_materia, 'es') || a.id_grupo - b.id_grupo);
  }
  return salida;
}
