/**
 * Vista local del Kárdex. No representa un acta oficial ni inventa inscripciones.
 * Conserva la estructura MySQL tal como está. El mínimo de referencia se define
 * solo para la vista del prototipo, no como regla institucional.
 */
export const MINIMO_APROBATORIO_REFERENCIA = 70;

export interface MateriaDePlan {
  id_materia: number;
  nombre_materia: string;
  semestre: number;
  creditos: number;
}

export interface RegistroDeKardex {
  id_kardex: number;
  id_materia: number;
  nombre_materia: string;
  calificacion: number;
  tipo_calificacion: string;
  periodo: string;
  fecha_registro: string;
  creditos: number;
}

export type EstadoEnKardex = 'aprobada' | 'reprobada' | 'semestre' | 'pendiente';

export interface MateriaEnKardex extends MateriaDePlan {
  estado: EstadoEnKardex;
  calificacion: number | null;
  periodo: string;
  tipo_calificacion: string;
  intentos: number;
}

export interface SemestreEnKardex {
  numero: number;
  materias: MateriaEnKardex[];
}

export interface EstadisticasDeKardex {
  materiasTotal: number;
  materiasAprobadas: number;
  materiasReprobadas: number;
  creditosTotal: number;
  creditosAprobados: number;
  avancePorcentaje: number;
  promedioReferencial: number | null;
  materiasConNota: number;
}

export interface VistaDeKardex {
  semestres: SemestreEnKardex[];
  estadisticas: EstadisticasDeKardex;
}

function numeroEnteroPositivo(valor: unknown): number | null {
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** `registros` se recibe de PHP desde el más reciente al más antiguo.
 * Si hay varias oportunidades, se toma el aprobado más reciente; en ausencia
 * de aprobados se muestra el intento más reciente. Cada materia solo suma una vez.
 */
export function construirVistaKardex(
  plan: readonly MateriaDePlan[],
  registros: readonly RegistroDeKardex[],
  semestreActual: number
): VistaDeKardex {
  const porMateria = new Map<number, RegistroDeKardex[]>();
  for (const r of registros) {
    const materia = numeroEnteroPositivo(r.id_materia);
    const nota = Number(r.calificacion);
    if (materia === null || !Number.isFinite(nota) || nota < 0 || nota > 100) continue;
    const anteriores = porMateria.get(materia) ?? [];
    anteriores.push({ ...r, calificacion: nota });
    porMateria.set(materia, anteriores);
  }

  const porSemestre = new Map<number, MateriaEnKardex[]>();
  const usados = new Set<number>();
  let materiasAprobadas = 0;
  let materiasReprobadas = 0;
  let creditosAprobados = 0;
  let creditosTotal = 0;
  let sumaNotas = 0;
  let materiasConNota = 0;

  for (const m of plan) {
    const id = numeroEnteroPositivo(m.id_materia);
    const semestre = numeroEnteroPositivo(m.semestre);
    if (id === null || semestre === null || usados.has(id)) continue;
    usados.add(id);
    const creditos = Math.max(0, Number(m.creditos) || 0);
    creditosTotal += creditos;
    const oportunidades = porMateria.get(id) ?? [];
    const elegida = oportunidades.find(r => r.calificacion >= MINIMO_APROBATORIO_REFERENCIA)
      ?? oportunidades[0] ?? null;
    const aprobada = elegida !== null && elegida.calificacion >= MINIMO_APROBATORIO_REFERENCIA;
    const reprobada = elegida !== null && !aprobada;
    if (aprobada) { materiasAprobadas++; creditosAprobados += creditos; }
    if (reprobada) materiasReprobadas++;
    if (elegida) { sumaNotas += elegida.calificacion; materiasConNota++; }
    const estado: EstadoEnKardex = aprobada ? 'aprobada' : reprobada ? 'reprobada'
      : semestre === semestreActual ? 'semestre' : 'pendiente';
    const elemento: MateriaEnKardex = {
      ...m,
      id_materia: id,
      semestre,
      creditos,
      estado,
      calificacion: elegida?.calificacion ?? null,
      tipo_calificacion: elegida?.tipo_calificacion ?? '',
      periodo: elegida?.periodo ?? '',
      intentos: oportunidades.length
    };
    porSemestre.set(semestre, [...(porSemestre.get(semestre) ?? []), elemento]);
  }

  const semestres = [...porSemestre.entries()]
    .sort(([a], [b]) => a - b)
    .map(([numero, materias]) => ({
      numero,
      materias: materias.sort((a, b) => a.nombre_materia.localeCompare(b.nombre_materia, 'es'))
    }));

  return {
    semestres,
    estadisticas: {
      materiasTotal: usados.size,
      materiasAprobadas,
      materiasReprobadas,
      creditosTotal,
      creditosAprobados,
      avancePorcentaje: creditosTotal ? Math.round((creditosAprobados / creditosTotal) * 1000) / 10 : 0,
      promedioReferencial: materiasConNota ? Math.round((sumaNotas / materiasConNota) * 100) / 100 : null,
      materiasConNota
    }
  };
}
