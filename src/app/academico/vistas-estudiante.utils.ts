import { construirAgendaSemanal, DiaDeAgenda, HorarioReferencia } from './horario.utils';

/** Datos devueltos por el servidor y autorizados por la sesión del alumno. */
export interface NotaConGrupo {
  id_kardex: number;
  id_materia: number;
  nombre_materia: string;
  calificacion: number;
  tipo_calificacion: string;
  periodo: string;
  fecha_registro: string;
  creditos: number;
  semestre?: number;
  id_grupo?: number;
  nombre_docente?: string;
}
export interface MateriaPlanAlumno {
  id_materia: number;
  nombre_materia: string;
  semestre: number;
  creditos: number;
}
export interface DetalleMateriaCalificada {
  clave: string;
  nombre: string;
  id_materia: number;
  grupo: number;
  docente: string;
  creditos: number;
  semestre: number | null;
  ultimaNota: number;
  tipo: string;
  periodo: string;
  historial: NotaConGrupo[];
  dias: DiaDeAgenda[];
  tieneHorario: boolean;
}
export interface MateriaReferenciaSinNota {
  id_materia: number;
  nombre: string;
  creditos: number;
  semestre: number;
  grupos: number[];
}

function fechasOrdenadas(a: NotaConGrupo, b: NotaConGrupo): number {
  // El id_kardex autoincremental mantiene un orden estable cuando las fechas coinciden.
  return Number(b.id_kardex) - Number(a.id_kardex);
}

/**
 * Agrupa por grupo y materia, sin mezclar oportunidades de distintas asignaciones.
 * Los grupos sin nota son SOLO alternativas del semestre, nunca inscripciones.
 */
export function construirDetalleCalificaciones(
  notas: readonly NotaConGrupo[],
  plan: readonly MateriaPlanAlumno[],
  referencias: readonly HorarioReferencia[],
  horariosDeGruposCalificados: readonly HorarioReferencia[],
  semestreActual: number
): { calificados: DetalleMateriaCalificada[]; sinNota: MateriaReferenciaSinNota[] } {
  const mapa = new Map<string, NotaConGrupo[]>();
  for (const nota of notas) {
    if (!nota || !Number.isInteger(Number(nota.id_materia))) continue;
    const idGrupo = Number(nota.id_grupo);
    const clave = `${Number(nota.id_materia)}:${Number.isInteger(idGrupo) && idGrupo > 0 ? idGrupo : 0}`;
    if (!mapa.has(clave)) mapa.set(clave, []);
    mapa.get(clave)!.push(nota);
  }
  const calificados = [...mapa.entries()].map(([clave, historial]) => {
    historial.sort(fechasOrdenadas);
    const ultima = historial[0];
    const grupo = Number(ultima.id_grupo) || 0;
    const materiaPlan = plan.find(m => Number(m.id_materia) === Number(ultima.id_materia));
    const horarios = horariosDeGruposCalificados.filter(h =>
      Number(h.id_grupo) === grupo && Number(h.id_materia) === Number(ultima.id_materia));
    return {
      clave, nombre: ultima.nombre_materia, id_materia: Number(ultima.id_materia),
      grupo, docente: ultima.nombre_docente || 'No disponible',
      creditos: Number(ultima.creditos) || 0,
      semestre: materiaPlan?.semestre ?? (ultima.semestre ? Number(ultima.semestre) : null),
      ultimaNota: Number(ultima.calificacion), tipo: ultima.tipo_calificacion,
      periodo: ultima.periodo, historial,
      dias: construirAgendaSemanal(horarios), tieneHorario: horarios.length > 0
    } satisfies DetalleMateriaCalificada;
  });
  calificados.sort((a,b)=> b.historial[0].id_kardex - a.historial[0].id_kardex);

  const materiasConNota = new Set(notas.map(n => Number(n.id_materia)));
  const sinNota = plan.filter(m => Number(m.semestre) === Number(semestreActual) &&
    !materiasConNota.has(Number(m.id_materia))).map(m => ({
      id_materia: Number(m.id_materia), nombre: m.nombre_materia,
      creditos: Number(m.creditos), semestre: Number(m.semestre),
      grupos: [...new Set(referencias.filter(r => Number(r.id_materia) === Number(m.id_materia))
        .map(r => Number(r.id_grupo)))].sort((a,b)=>a-b)
    }));
  return { calificados, sinNota };
}

export interface BloqueHorarioVisual extends HorarioReferencia {
  clave: string;
  topPx: number;
  altoPx: number;
  izquierda: number;
  ancho: number;
  tono: number;
}
export interface DiaHorarioVisual {
  nombre: string;
  abreviatura: string;
  bloques: BloqueHorarioVisual[];
}
export interface CalendarioSemanalVisual {
  horas: string[];
  altoPx: number;
  dias: DiaHorarioVisual[];
}

const PIXELES_POR_HORA = 69;
function minutos(hora: string): number {
  const v = String(hora ?? '').match(/^(\d{2}):(\d{2})/);
  return v ? Number(v[1])*60 + Number(v[2]) : NaN;
}

/** Dibuja las sesiones por altura real, manejando bloques que se empalman. */
export function construirCalendarioSemanal(horarios: readonly HorarioReferencia[]): CalendarioSemanalVisual {
  const agenda = construirAgendaSemanal(horarios);
  const sesiones = agenda.flatMap(d => d.sesiones);
  const inicio = sesiones.length
    ? Math.min(7, ...sesiones.map(s => Math.floor(minutos(s.hora_inicio)/60))) : 7;
  const fin = sesiones.length
    ? Math.max(18, ...sesiones.map(s => Math.ceil(minutos(s.hora_fin)/60))) : 18;
  const horas = Array.from({length: Math.max(1, fin-inicio)}, (_, i) =>
    String(inicio + i).padStart(2, '0') + ':00');
  const dias = agenda.map((dia, indiceDia) => {
    const items = dia.sesiones.map((s,index) => ({
      s, index, inicio: minutos(s.hora_inicio), fin: minutos(s.hora_fin),
      carril: 0, columnas: 1
    })).sort((a,b)=>a.inicio-b.inicio || a.fin-b.fin);

    // Componentes de intervalos conectados; todo componente comparte el mismo ancho.
    let indice = 0;
    while (indice < items.length) {
      let final = indice + 1;
      let finGrupo = items[indice].fin;
      while (final < items.length && items[final].inicio < finGrupo) {
        finGrupo = Math.max(finGrupo, items[final].fin);
        final++;
      }
      const finPorCarril: number[] = [];
      for (const item of items.slice(indice,final)) {
        let carril = finPorCarril.findIndex(fin => fin <= item.inicio);
        if (carril === -1) { carril = finPorCarril.length; finPorCarril.push(item.fin); }
        else finPorCarril[carril] = item.fin;
        item.carril = carril;
      }
      for (let i=indice; i<final; i++) items[i].columnas = finPorCarril.length;
      indice = final;
    }
    const bloques: BloqueHorarioVisual[] = items.map(item => {
      const factor = 100/item.columnas;
      const idMateria = Number(item.s.id_materia) || Number(item.s.id_grupo);
      return {
        ...item.s,
        clave: `${indiceDia}-${item.s.id_horario || item.s.id_grupo}-${item.index}`,
        topPx: Math.round((item.inicio - inicio*60) / 60 * PIXELES_POR_HORA),
        altoPx: Math.max(25, Math.round((item.fin-item.inicio)/60*PIXELES_POR_HORA)-2),
        izquierda: item.carril*factor,
        ancho: factor,
        tono: Math.abs(idMateria) % 4
      };
    });
    return { nombre:dia.nombre, abreviatura:dia.abreviatura, bloques };
  });
  return { horas, altoPx: horas.length*PIXELES_POR_HORA, dias };
}
