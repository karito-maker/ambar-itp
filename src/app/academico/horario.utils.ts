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
  id_grupo: string;
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
    const grupo = String(horario.id_grupo ?? '').trim();
    if (!/^[A-Za-z0-9-]{1,10}$/.test(grupo)) continue;
    const clave = [dia, inicio, fin, grupo, horario.nombre_materia, horario.tipo_salon].join('|');
    if (duplicados.has(clave)) continue;
    duplicados.add(clave);
    salida[indice].sesiones.push({ ...horario, id_grupo: grupo, hora_inicio: inicio, hora_fin: fin });
  }
  for (const dia of salida) {
    dia.sesiones.sort((a,b) => a.hora_inicio.localeCompare(b.hora_inicio) ||
      a.nombre_materia.localeCompare(b.nombre_materia, 'es') || a.id_grupo.localeCompare(b.id_grupo, 'es', { numeric: true }));
  }
  return salida;
}

/**
 * Selecciona un horario legible sin mezclar grupos alternativos.
 * Las inscripciones aprobadas tienen prioridad; si no hay, se propone una
 * combinación NO OFICIAL de materias del semestre actual. Nunca se inventan
 * calificaciones o inscripciones para completar una cuadrícula.
 * Las sesiones de una misma materia y grupo se aceptan o descartan juntas.
 */
export function elegirHorarioEstudiantil(
  plan: readonly {id_materia:number;semestre:number}[],
  semestreActual: number,
  alternativas: readonly HorarioReferencia[],
  autorizadas: readonly HorarioReferencia[]
): {horarios:HorarioReferencia[];omitidas:number;oficial:boolean;totalOpciones:number} {
  const oficial=autorizadas.length>0;
  const permitidas=new Set(plan.filter(m=>Number(m.semestre)===Number(semestreActual)).map(m=>Number(m.id_materia)));
  const origen=oficial?autorizadas:alternativas.filter(h=>permitidas.has(Number(h.id_materia)));
  const validadas=construirAgendaSemanal(origen).flatMap(d=>d.sesiones);
  const paquetes=new Map<string,HorarioReferencia[]>();
  for(const h of validadas){
    const key=String(h.id_grupo)+'|'+Number(h.id_materia);
    if(!paquetes.has(key))paquetes.set(key,[]);
    paquetes.get(key)!.push(h);
  }
  const cantidadPorGrupo=new Map<string,number>();
  for(const p of paquetes.keys()){
    const grupo=p.split('|')[0];cantidadPorGrupo.set(grupo,(cantidadPorGrupo.get(grupo)||0)+1);
  }
  const entradas=[...paquetes.entries()].sort((a,b)=>{
    const ga=a[0].split('|')[0],gb=b[0].split('|')[0];
    return (cantidadPorGrupo.get(gb)||0)-(cantidadPorGrupo.get(ga)||0)
      ||ga.localeCompare(gb,'es',{numeric:true})
      ||a[0].localeCompare(b[0],'es',{numeric:true});
  });
  const elegidas:HorarioReferencia[]=[];
  const materias=new Set<number>();
  const valorMinutos=(v:string):number=>{
    const h=String(v).slice(0,5).split(':').map(Number);
    return h.length===2?h[0]*60+h[1]:NaN;
  };
  const empalma=(a:HorarioReferencia,b:HorarioReferencia):boolean=>{
    return a.dia_semana===b.dia_semana && valorMinutos(a.hora_inicio)<valorMinutos(b.hora_fin)
      && valorMinutos(b.hora_inicio)<valorMinutos(a.hora_fin);
  };
  for(const [key,grupo] of entradas){
    const materia=Number(key.split('|')[1]);
    // No mezclar dos grupos diferentes para la misma materia.
    if(materias.has(materia))continue;
    if(grupo.some((a,i)=>grupo.slice(i+1).some(b=>empalma(a,b))))continue;
    if(grupo.some(a=>elegidas.some(b=>empalma(a,b))))continue;
    elegidas.push(...grupo);materias.add(materia);
  }
  return {horarios:elegidas,omitidas:Math.max(0,validadas.length-elegidas.length),oficial,totalOpciones:validadas.length};
}
