// TecPlus - Portal de acceso, administración y docente
// Incluye Mis grupos, Mis horarios y Alumnos relacionados académicamente.
import { Component, ChangeDetectorRef, OnInit, ViewChild } from '@angular/core';
import { HttpClient, HttpClientModule, HttpHeaders } from '@angular/common/http';
import {
  ToastController, IonHeader, IonToolbar,
  IonContent, IonItem, IonInput, IonButton
} from '@ionic/angular';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Capacitor } from '@capacitor/core';
import { timeout } from 'rxjs';
import { construirVistaKardex, VistaDeKardex } from '../academico/kardex.utils';
import { construirAgendaSemanal, elegirHorarioEstudiantil, DiaDeAgenda, HorarioReferencia } from '../academico/horario.utils';
import { construirCalendarioSemanal, construirDetalleCalificaciones, CalendarioSemanalVisual, DetalleMateriaCalificada, MateriaReferenciaSinNota } from '../academico/vistas-estudiante.utils';

type RolUsuario = 'administrador' | 'docente' | 'alumno' | null;

interface GrupoDocente {
  id_grupo: string;
  capacidad: number;
  estatus: string;
  id_materia: number;
  nombre_materia: string;
  semestre: number;
  creditos: number;
  nombre_reticula: string;
  nombre_carrera: string;
}

interface HorarioDocente {
  id_horario: number;
  dia_semana: string;
  hora_inicio: string;
  hora_fin: string;
  id_grupo: string;
  estatus: string;
  id_materia: number;
  nombre_materia: string;
  semestre: number;
  id_salon: number;
  tipo_salon: string;
  piso: number;
  nombre_edificio: string;
  nombre_carrera: string;
}

interface AlumnoRelacionado {
  id_grupo: string;
  id_materia: number;
  nombre_materia: string;
  semestre_materia: number;
  n_control: string;
  nombres: string;
  apellido_paterno: string;
  apellido_materno: string;
  nombre_alumno: string;
  semestre_actual: number;
  estatus_alumno: string;
  nombre_carrera: string;
  nombre_reticula: string;
}

interface CalificacionDocente {
  id_kardex: number;
  id_grupo: string;
  n_control: string;
  nombre_alumno: string;
  nombre_materia: string;
  calificacion: number;
  tipo_calificacion: string;
  periodo: string;
  fecha_registro: string;
}

interface RespuestaCalificaciones {
  status: string;
  mensaje?: string;
  calificaciones?: CalificacionDocente[];
  total?: number;
}

interface RespuestaGrupos {
  status: string;
  mensaje?: string;
  grupos?: GrupoDocente[];
  total?: number;
}

interface RespuestaHorarios {
  status: string;
  mensaje?: string;
  horarios?: HorarioDocente[];
  total?: number;
}

interface RespuestaAlumnos {
  status: string;
  mensaje?: string;
  alumnos?: AlumnoRelacionado[];
  total?: number;
  criterio?: string;
  son_inscripciones_confirmadas?: boolean;
}

interface PerfilEstudiante {
  n_control: string;
  nombres: string;
  apellido_paterno: string;
  apellido_materno: string;
  nombre_carrera: string;
  nombre_reticula: string;
  semestre_actual: number;
  estatus: string;
  fecha_ingreso: string;
}
interface NotaEstudiante {
  id_kardex: number;
  id_materia: number;
  nombre_materia: string;
  calificacion: number;
  tipo_calificacion: string;
  periodo: string;
  fecha_registro: string;
  creditos: number;
  semestre?: number;
  id_grupo?: string;
  nombre_docente?: string;
}
interface MateriaPlan { id_materia:number; nombre_materia:string; semestre:number; creditos:number; }
interface RespuestaMiExpediente {status:string; mensaje?:string; perfil?:PerfilEstudiante; kardex?:NotaEstudiante[]; plan_estudios?:MateriaPlan[]; horarios_referencia?:HorarioReferencia[]; horarios_kardex?:HorarioReferencia[]; horarios_inscritos?:HorarioReferencia[];}

interface SolicitudEdicion { id_solicitud:number; tipo:string; id_registro:number; estado:string; motivo:string; }
interface OpcionCarga { id_grupo:string; id_materia:number; nombre_materia:string; semestre:number; capacidad:number; inscritos:number; motivo_bloqueo:string; }
interface SolicitudCarga { id_solicitud:number; fk_grupo:string; nombre_materia:string; periodo:string; estado:string; }

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  imports: [
    FormsModule, CommonModule, HttpClientModule, IonHeader, IonToolbar,
    IonContent, IonItem, IonInput, IonButton, RouterLink
  ]
})
export class HomePage implements OnInit {
  @ViewChild(IonContent) private contenido!: IonContent;
  sesionIniciada = false;
  validandoSesion = false;
  errorInicioSesion = '';
  rolActual: RolUsuario = null;
  nombreActual = '';
  cargando = false;
  usuario = { correo: '', contra: '' };
  activacionAbierta=false;
  activando=false;mensajeActivacion='';errorActivacion='';
  formularioActivacion={identificador:'',codigo:'',nombre:'',segundo_nombre:'',apellido_paterno:'',apellido_materno:'',fecha_nacimiento:'',telefono:'',correo_personal:'',calle:'',numero_exterior:'',numero_interior:'',colonia:'',codigo_postal:'',ciudad:'',municipio:'',estado:'',pais:'México',contrasena:'',confirmacion:''};
  activarAcceso():void {
    const f=this.formularioActivacion;
    this.errorActivacion='';this.mensajeActivacion='';
    if(!f.identificador.trim()||!f.codigo.trim()||!f.nombre.trim()||!f.apellido_paterno.trim()||!f.apellido_materno.trim()||f.contrasena.length<10||f.contrasena!==f.confirmacion||!f.telefono.trim()||!f.correo_personal.trim()||!f.calle.trim()||!f.numero_exterior.trim()||!f.colonia.trim()||!f.codigo_postal.trim()||!f.ciudad.trim()||!f.municipio.trim()||!f.estado.trim()||!f.pais.trim()){
      this.errorActivacion='Completa los campos obligatorios de identidad, contacto y domicilio, además de una contraseña de 10 caracteres que coincida con su confirmación.';return;
    }
    this.activando=true;
    this.http.post<any>(`http://${this.ipServidor.trim()}/api_ionic/registro.php`,{accion:'tp_activarInvitacion',...f}).pipe(timeout(16000)).subscribe({
      next:r=>{this.activando=false;if(r?.status==='success'){
        this.mensajeActivacion=r.mensaje||'Acceso activado. Ya puedes iniciar sesión.';
        this.usuario.correo=f.identificador;
        this.formularioActivacion={identificador:'',codigo:'',nombre:'',segundo_nombre:'',apellido_paterno:'',apellido_materno:'',fecha_nacimiento:'',telefono:'',correo_personal:'',calle:'',numero_exterior:'',numero_interior:'',colonia:'',codigo_postal:'',ciudad:'',municipio:'',estado:'',pais:'México',contrasena:'',confirmacion:''};
      }else this.errorActivacion=r?.mensaje||'No fue posible activar el acceso.';this.cdr.detectChanges();},
      error:e=>{this.activando=false;this.errorActivacion=e?.error?.mensaje||'No fue posible activar el acceso. Revisa el servidor.';this.cdr.detectChanges();}
    });
  }
  recuperacionAbierta=false;
  identificadorRecuperacion='';mensajeRecuperacion='';errorRecuperacion='';enviandoRecuperacion=false;
  solicitarRecuperacion():void {
    if(this.enviandoRecuperacion||this.identificadorRecuperacion.trim().length<3)return;
    this.enviandoRecuperacion=true;this.errorRecuperacion='';this.mensajeRecuperacion='';
    this.http.post<any>(`http://${this.ipServidor.trim()}/api_ionic/registro.php`,{accion:'tp_solicitarClave',identificador:this.identificadorRecuperacion.trim()}).pipe(timeout(12000)).subscribe({
      next:r=>{this.enviandoRecuperacion=false;if(r?.status==='success')this.mensajeRecuperacion=r.mensaje;else this.errorRecuperacion=r?.mensaje||'No se pudo solicitar.';this.cdr.detectChanges();},
      error:e=>{this.enviandoRecuperacion=false;this.errorRecuperacion=e?.error?.mensaje||'No se pudo comunicar con Administración.';this.cdr.detectChanges();}
    });
  }


  // En la web móvil utilizamos el host con el que se abrió Ionic por Wi-Fi.
  // En Android nativo, 10.0.2.2 corresponde al emulador; en celular físico
  // habrá que escribir la IP de la computadora en el formulario de acceso.
ipServidor: string =
  Capacitor.getPlatform() === 'ios'
    ? '192.168.1.69'
    : Capacitor.getPlatform() === 'android'
      ? '10.0.2.2'
      : (typeof window !== 'undefined' &&
          !['localhost', '127.0.0.1'].includes(window.location.hostname)
          ? window.location.hostname
          : 'localhost');

  gruposDocente: GrupoDocente[] = [];
  totalGruposDocente = 0;
  cargandoGruposDocente = false;
  errorGruposDocente = '';
  private versionConsultaGrupos = 0;

  horariosDocente: HorarioDocente[] = [];
  totalHorariosDocente = 0;
  cargandoHorariosDocente = false;
  errorHorariosDocente = '';
  private versionConsultaHorarios = 0;

  alumnosRelacionados: AlumnoRelacionado[] = [];
  totalAlumnosRelacionados = 0;
  cargandoAlumnosRelacionados = false;
  errorAlumnosRelacionados = '';
  private versionConsultaAlumnos = 0;

  horariosInscritosAlumno:HorarioReferencia[]=[];
  horarioAlumnoConfirmado=false;
  opcionesHorarioOmitidas=0;
  totalOfertasHorario=0;
  get materiasHistoricasPendientes():number{
    if(!this.perfilAlumno)return 0;
    return this.vistaKardex.semestres.filter(s=>s.numero<this.perfilAlumno!.semestre_actual)
      .reduce((n,s)=>n+s.materias.filter(m=>m.estado==='sin_historial').length,0);
  }
  ofertaAlumno:OpcionCarga[]=[];cargasAlumno:SolicitudCarga[]=[];errorOferta='';mensajeOferta='';
  nombreMateriaAlumno(id:number):string {return this.planAlumno.find(m=>Number(m.id_materia)===Number(id))?.nombre_materia||'Materia '+id;}
  cargarOfertaAlumno():void {
    if(!this.sesionIniciada||this.rolActual!=='alumno')return;
    const token=this.obtenerToken();if(!token)return;
    this.http.post<any>(this.urlRegistro(),{accion:'tp_ofertaAlumno'},{headers:this.encabezados(token)}).pipe(timeout(12000)).subscribe({
      next:r=>{if(r?.status==='success')this.ofertaAlumno=r.grupos||[];else this.errorOferta=r?.mensaje||'No se pudo consultar la oferta.';this.cdr.detectChanges();},
      error:e=>{this.errorOferta=e?.error?.mensaje||'No se pudo consultar la oferta.';this.cdr.detectChanges();}
    });
    this.http.post<any>(this.urlRegistro(),{accion:'tp_misCargas'},{headers:this.encabezados(token)}).pipe(timeout(12000)).subscribe({
      next:r=>{if(r?.status==='success')this.cargasAlumno=r.solicitudes||[];this.cdr.detectChanges();},
      error:()=>{}
    });
  }
  solicitarCarga(grupo:string,materia:number):void {
    const token=this.obtenerToken();if(!token||!this.sesionIniciada||this.rolActual!=='alumno')return;
    this.http.post<any>(this.urlRegistro(),{accion:'tp_solicitarCarga',id_grupo:grupo,id_materia:materia},{headers:this.encabezados(token)}).pipe(timeout(12000)).subscribe({
      next:r=>{if(r?.status==='success'){this.mensajeOferta=r.mensaje;this.errorOferta='';this.cargarOfertaAlumno();}else this.errorOferta=r?.mensaje||'No se pudo enviar la solicitud.';this.cdr.detectChanges();},
      error:e=>{this.errorOferta=e?.error?.mensaje||'No fue posible enviar la solicitud.';this.cdr.detectChanges();}
    });
  }
  perfilAlumno: PerfilEstudiante | null = null;
  calificacionesAlumno: NotaEstudiante[] = [];
  planAlumno: MateriaPlan[] = [];
  vistaKardex: VistaDeKardex = construirVistaKardex([], [], 1);
  horariosAlumnoReferencia: HorarioReferencia[] = [];
  agendaSemanalAlumno: DiaDeAgenda[] = construirAgendaSemanal([]);
  calendarioSemanalAlumno: CalendarioSemanalVisual = construirCalendarioSemanal([]);
  horariosAlumnoKardex: HorarioReferencia[] = [];
  materiasCalificadasAlumno: DetalleMateriaCalificada[] = [];
  materiasReferenciaSinNota: MateriaReferenciaSinNota[] = [];
  ultimaActualizacionAlumno = '';
  cargandoExpedienteAlumno = false;
  errorExpedienteAlumno = '';
  private versionConsultaExpediente = 0;

  seccionDocente: 'inicio' | 'grupos' | 'horarios' | 'alumnos' | 'calificaciones' = 'grupos';
  seccionAlumno: 'inicio' | 'horario' | 'calificaciones' | 'kardex' = 'inicio';

  /** Navega hasta una sección del portal, dentro del desplazamiento real de Ionic. */
  async irASeccionDocente(seccion: 'grupos' | 'horarios' | 'alumnos' | 'calificaciones'): Promise<void> {
    if (!this.sesionIniciada || this.rolActual !== 'docente' || !this.contenido) return;

    const destinos: Record<'grupos' | 'horarios' | 'alumnos' | 'calificaciones', string> = {
      grupos: 'grupos',
      horarios: 'horarios',
      alumnos: 'alumnos',
      calificaciones: 'calificaciones-docente'
    };

    const seccionDestino = document.getElementById(destinos[seccion]);
    if (!seccionDestino) return;

    this.seccionDocente = seccion;
    this.cdr.detectChanges();

    // ion-content usa un contenedor interno de scroll; no basta con cambiar un #ancla.
    const scrollElement = await this.contenido.getScrollElement();
    const destinoY = Math.max(
      0,
      scrollElement.scrollTop +
        seccionDestino.getBoundingClientRect().top -
        scrollElement.getBoundingClientRect().top - 14
    );
    await this.contenido.scrollToPoint(0, destinoY, 350);
    if (this.sesionIniciada && this.rolActual === 'docente') {
      seccionDestino.focus({ preventScroll: true });
    }
  }

  cambiarSeccionAlumno(seccion: 'inicio' | 'horario' | 'calificaciones' | 'kardex'): void {
    const anterior = this.seccionAlumno;
    this.seccionAlumno = seccion;
    // Al abrir el Kárdex, Calificaciones u Horario se pide información reciente.
    // Es útil cuando un docente acaba de registrar una nota en otra sesión.
    if (seccion !== 'inicio' && seccion !== anterior &&
        this.sesionIniciada && this.rolActual === 'alumno' &&
        this.perfilAlumno && !this.cargandoExpedienteAlumno) {
      this.cargarMiExpedienteAlumno(true);
    }
    this.cdr.detectChanges();
  }

  /** Exporta las alternativas visibles; jamás se anuncia como inscripción oficial. */
  async exportarHorarioReferencia(): Promise<void> {
    if (!this.sesionIniciada || this.rolActual !== 'alumno' || !this.perfilAlumno ||
        this.horariosAlumnoReferencia.length === 0) return;
    const campo = (valor: unknown): string => {
      let cadena = String(valor ?? '').replace(/\r|\n/g, ' ').trim();
      // Impide que las celdas textuales se interpreten como fórmulas en Excel.
      if (/^[=+@-]/.test(cadena)) cadena = "'" + cadena;
      return '"' + cadena.replace(/"/g, '""') + '"';
    };
    const filas: unknown[][] = [
      [this.horarioAlumnoConfirmado?'SESIONES DE CARGA AUTORIZADA. CONSULTAR VIGENCIA.':'PROPUESTA DE HORARIO NO OFICIAL. NO ACREDITA INSCRIPCIÓN.'],
      ['Día', 'Inicio', 'Fin', 'Materia', 'Grupo', 'Salón', 'Piso', 'Edificio', 'Docente'],
      ...this.agendaSemanalAlumno.flatMap(dia => dia.sesiones.map(s => [
        dia.nombre, s.hora_inicio, s.hora_fin, s.nombre_materia,
        s.id_grupo, s.tipo_salon, s.piso ?? '', s.nombre_edificio,
        s.nombre_docente ?? ''
      ]))
    ];
    const csv = '\uFEFF' + filas.map(f => f.map(campo).join(',')).join('\r\n');
    const nombre = this.horarioAlumnoConfirmado?'tecplus_horario_autorizado.csv':'tecplus_horario_propuesto.csv';
    const archivo = new File([csv], nombre, { type: 'text/csv;charset=utf-8' });
    // iOS no siempre admite la descarga directa de Blob dentro del WebView.
    // Usar primero la hoja de compartir cuando admita archivos.
    if (Capacitor.getPlatform() === 'ios' &&
        typeof navigator.share === 'function' &&
        typeof navigator.canShare === 'function' &&
        navigator.canShare({files:[archivo]})) {
      try {
        await navigator.share({files:[archivo],title:'Horario de TecPlus'});
        return;
      } catch (e: unknown) {
        if (e instanceof DOMException && e.name === 'AbortError') return;
      }
    }
    const enlace = document.createElement('a');
    const url = URL.createObjectURL(archivo);
    enlace.href = url;
    enlace.download = nombre;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2500);
  }

  get sesionesReferenciaAlumno(): number {
    return this.agendaSemanalAlumno.reduce((total, dia) => total + dia.sesiones.length, 0);
  }

  get diasConSesionesAlumno(): number {
    return this.agendaSemanalAlumno.filter(dia => dia.sesiones.length > 0).length;
  }

  /** Periodo lectivo del prototipo (validado también por PHP). */
  periodoAcademicoActual(): string {
    const hoy = new Date();
    const mes = hoy.getMonth();
    const anio = hoy.getFullYear();
    if (mes <= 5) return `ENE-JUN ${anio}`;
    if (mes >= 7) return `AGO-DIC ${anio}`;
    return ''; // Julio no corresponde a uno de los periodos configurados.
  }

  get calificacionLista(): boolean {
    const f = this.calificacionForm;
    const nota = Number(f.calificacion);
    const periodo = this.periodoAcademicoActual();
    return this.sesionIniciada && this.rolActual === 'docente' &&
      !this.guardandoCalificacion && !this.cargandoGruposDocente &&
      typeof f.id_grupo === 'string' && f.id_grupo.length > 0 && this.gruposDocente.some(g => g.id_grupo === f.id_grupo && g.id_materia === f.id_materia) &&
      this.alumnosCalificables.some(a => a.n_control === f.n_control) &&
      /^[\p{L}0-9][\p{L}0-9 ./-]{2,39}$/u.test(periodo) &&
      ['ORDINARIO', 'ESPECIAL', 'SEGUNDA OPORTUNIDAD'].includes(f.tipo_calificacion) &&
      f.calificacion !== null && Number.isFinite(nota) &&
      Number.isInteger(nota) && nota >= 0 && nota <= 100;
  }

  solicitudesEdicion:SolicitudEdicion[]=[];
  tipoCorreccion:'FINAL'='FINAL';registroCorreccion=0;motivoCorreccion='';
  notasCorregidas:Record<number,number|null>={};
  errorExtrasDocente='';mensajeExtrasDocente='';
  private apiExtensionDocente(accion:string,campos:Record<string,unknown>={},ok?:(r:any)=>void):void {
    const token=this.obtenerToken();if(!token)return;
    this.http.post<any>(this.urlRegistro(),{accion,...campos},{headers:this.encabezados(token)}).pipe(timeout(15000)).subscribe({
      next:r=>{if(r?.status==='success'){ok?.(r);if(accion!=='tp_misSolicitudesEdicion')this.mensajeExtrasDocente=r.mensaje||'';this.errorExtrasDocente='';}else this.errorExtrasDocente=r?.mensaje||'No se pudo realizar la operación.';this.cdr.detectChanges();},
      error:e=>{this.errorExtrasDocente=e?.error?.mensaje||'No fue posible consultar el servidor.';this.cdr.detectChanges();}
    });
  }
  cargarExtensionesDocente():void {
    this.apiExtensionDocente('tp_misSolicitudesEdicion',{},r=>this.solicitudesEdicion=r.solicitudes||[]);
  }
  solicitarCorreccion(tipo:'FINAL',id:number):void {
    this.tipoCorreccion=tipo;this.registroCorreccion=id;this.motivoCorreccion='';this.cdr.detectChanges();
  }
  enviarCorreccion():void {
    if(!this.registroCorreccion||this.motivoCorreccion.trim().length<15)return;
    this.apiExtensionDocente('tp_solicitarEdicion',{tipo:this.tipoCorreccion,id_registro:this.registroCorreccion,motivo:this.motivoCorreccion.trim()},()=>{
      this.registroCorreccion=0;this.cargarExtensionesDocente();
    });
  }
  guardarCorreccionAutorizada(sol:SolicitudEdicion):void {
    const calificacion=this.notasCorregidas[sol.id_solicitud];
    if(calificacion===null||calificacion===undefined||!Number.isInteger(Number(calificacion))||Number(calificacion)<0||Number(calificacion)>100)return;
    if(!window.confirm('¿Aplicar esta corrección autorizada? Quedará en el historial de auditoría.'))return;
    this.apiExtensionDocente('tp_corregirNota',{id_solicitud:sol.id_solicitud,calificacion:Number(calificacion)},()=>{
      delete this.notasCorregidas[sol.id_solicitud];this.cargarExtensionesDocente();this.cargarMisCalificacionesDocente();
    });
  }
  calificacionesDocente: CalificacionDocente[] = [];
  cargandoCalificaciones = false;
  guardandoCalificacion = false;
  mensajeCalificacion = '';
  errorCalificacion = '';
  private versionCalificaciones = 0;

  calificacionForm: {
    id_grupo: string | null;
    id_materia: number;
    n_control: string;
    periodo: string;
    tipo_calificacion: string;
    calificacion: number | null;
  } = {
    id_grupo: null,
    id_materia: 0,
    n_control: '',
    periodo: '',
    tipo_calificacion: 'ORDINARIO',
    calificacion: null
  };

  filtroGrupoAlumnos: string | null = null;

  get alumnosRelacionadosFiltrados(): AlumnoRelacionado[] {
    return this.filtroGrupoAlumnos === null ? this.alumnosRelacionados :
      this.alumnosRelacionados.filter(a => a.id_grupo === this.filtroGrupoAlumnos);
  }

  filtroGrupoHistorial: string | null = null;
  filtroControlHistorial = '';

  get calificacionesDocenteFiltradas(): CalificacionDocente[] {
    return this.calificacionesDocente.filter(c =>
      (this.filtroGrupoHistorial === null || c.id_grupo === this.filtroGrupoHistorial) &&
      (!this.filtroControlHistorial || c.n_control === this.filtroControlHistorial)
    );
  }

  get alumnosHistorial(): {n_control:string; nombre_alumno:string}[] {
    const vistos = new Map<string,string>();
    for (const c of this.calificacionesDocente) {
      if (this.filtroGrupoHistorial === null || c.id_grupo === this.filtroGrupoHistorial) {
        vistos.set(c.n_control,c.nombre_alumno);
      }
    }
    return [...vistos].map(([n_control,nombre_alumno])=>({n_control,nombre_alumno}));
  }

  get alumnosCalificables(): AlumnoRelacionado[] {
    return this.alumnosRelacionados.filter(a => a.id_grupo === this.calificacionForm.id_grupo && a.id_materia === this.calificacionForm.id_materia);
  }

  seleccionarGrupoMateria(key:string):void {
    const [grupo,materia]=(key||'').split('|');
    this.calificacionForm.id_grupo=grupo||null;
    this.calificacionForm.id_materia=Number(materia||0);
    this.alCambiarGrupo();
  }

  alCambiarGrupo(): void {
    this.calificacionForm.n_control = '';

    this.mensajeCalificacion = '';
    this.errorCalificacion = '';
  }

  constructor(
    private http: HttpClient,
    private toastCtrl: ToastController,
    private cdr: ChangeDetectorRef
  ) {}

  private normalizarRol(valor: unknown): RolUsuario {
    if (typeof valor !== 'string') return null;
    switch (valor.trim().toUpperCase()) {
      case 'ADMINISTRATIVO':
      case 'ADMINISTRADOR': return 'administrador';
      case 'DOCENTE': return 'docente';
      case 'ALUMNO': return 'alumno';
      default: return null;
    }
  }

  ngOnInit(): void {
    const servidor = sessionStorage.getItem('ambar_servidor');
    if (servidor) this.ipServidor = servidor;
    try {
      const sesion = JSON.parse(sessionStorage.getItem('ambar_sesion') || 'null');
      const rol = this.normalizarRol(sesion?.rol);
      const token = sesion?.token;
      if (!rol || typeof token !== 'string' || token.length < 26) {
        sessionStorage.removeItem('ambar_sesion');
        return;
      }
      // Evita mostrar un panel privado hasta verificar la sesión con PHP.
      this.validandoSesion = true;
      const url = `http://${this.ipServidor.trim()}/api_ionic/login.php`;
      this.http.post<{success:boolean; usuario?:{rol?:string}}>(
        url, {accion:'verificarSesion'},
        {headers:new HttpHeaders({Authorization:`Bearer ${token}`})}
      ).pipe(timeout(12000)).subscribe({
        next: r => {
          this.validandoSesion = false;
          if (r.success && this.normalizarRol(r.usuario?.rol) === rol) {
            this.sesionIniciada = true;
            this.rolActual = rol;
            this.nombreActual = String(sesion.nombre || '').trim();
            if (rol === 'docente') this.cargarMisGruposDocente();
            if (rol === 'alumno') this.cargarMiExpedienteAlumno();
          } else {
            sessionStorage.removeItem('ambar_sesion');
            this.errorInicioSesion = 'Tu sesión venció. Inicia sesión nuevamente.';
          }
          this.cdr.detectChanges();
        },
        error: e => {
          this.validandoSesion = false;
          // No mostramos datos de una sesión que no logramos comprobar.
          if (e.status === 401 || e.status === 403) {
            sessionStorage.removeItem('ambar_sesion');
            this.errorInicioSesion = 'Tu sesión ya no está activa. Inicia sesión nuevamente.';
          } else {
            this.errorInicioSesion = 'No se pudo verificar la sesión; comprueba Apache y la dirección del servidor.';
          }
          this.cdr.detectChanges();
        }
      });
    } catch {
      sessionStorage.removeItem('ambar_sesion');
    }
  }

  private obtenerToken(): string {
    try {
      const sesion = JSON.parse(sessionStorage.getItem('ambar_sesion') || '{}');
      return typeof sesion.token === 'string' ? sesion.token : '';
    } catch {
      return '';
    }
  }

  private urlRegistro(): string {
    const servidor = sessionStorage.getItem('ambar_servidor') || this.ipServidor;
    return `http://${servidor.trim()}/api_ionic/registro.php`;
  }

  private encabezados(token: string): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  private sesionDocenteVigente(token: string, version: number, actual: number): boolean {
    return version === actual && this.sesionIniciada &&
      this.rolActual === 'docente' && this.obtenerToken() === token;
  }

  login(): void {
    if (this.cargando) return;
    // Permite escribir localhost, IP, IP:puerto y también http://IP.
    const servidor = this.ipServidor.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
    if (!/^[a-zA-Z0-9.-]+(?::[0-9]{2,5})?$/.test(servidor)) {
      void this.mostrarToast('Escribe localhost o la IP de la computadora, sin rutas adicionales.');
      return;
    }
    this.ipServidor = servidor;
    if (typeof this.usuario.correo !== 'string' || !this.usuario.correo.trim() ||
        typeof this.usuario.contra !== 'string' || !this.usuario.contra.trim()) {
      void this.mostrarToast('Por favor, llena todos los campos');
      return;
    }
    this.cargando = true;
    this.errorInicioSesion = '';
    this.cdr.detectChanges();
    const url = `http://${this.ipServidor.trim()}/api_ionic/login.php`;
    this.http.post<any>(url, { ...this.usuario, correo: this.usuario.correo.trim() }).pipe(timeout(15000)).subscribe({
      next: (respuesta) => {
        this.cargando = false;
        const rol = this.normalizarRol(respuesta?.usuario?.rol);
        const token = respuesta?.token;
        if (respuesta?.success === true && rol &&
            typeof token === 'string' && token.length >= 26) {
          const nombre = String(respuesta.usuario?.nombre ||
            respuesta.usuario?.correo || this.usuario.correo).trim();
          try {
            sessionStorage.setItem('ambar_sesion', JSON.stringify({
              id: respuesta.usuario?.id_usuario ?? respuesta.usuario?.id,
              token, rol, nombre
            }));
            sessionStorage.setItem('ambar_servidor', this.ipServidor.trim());
          } catch {
            void this.mostrarToast('No se pudo guardar la sesión');
            this.cdr.detectChanges();
            return;
          }
          this.sesionIniciada = true;
          this.rolActual = rol;
          this.nombreActual = nombre;
          this.usuario.contra = '';
          this.limpiarDatosDocente();
          this.limpiarDatosAlumno();
          this.cdr.detectChanges();
          void this.mostrarToast('¡Bienvenido!');
          if (rol === 'docente') this.cargarMisGruposDocente();
          if (rol === 'alumno') this.cargarMiExpedienteAlumno();
        } else {
          sessionStorage.removeItem('ambar_sesion');
          this.sesionIniciada = false;
          this.rolActual = null;
          this.nombreActual = '';
          this.limpiarDatosDocente();
          this.limpiarDatosAlumno();
          this.cdr.detectChanges();
          void this.mostrarToast(respuesta?.message || 'Credenciales incorrectas');
        }
      },
      error: (error) => {
        this.cargando = false;
        console.error('Error de inicio de sesión:', error.status);
        sessionStorage.removeItem('ambar_sesion');
        this.sesionIniciada = false;
        this.rolActual = null;
        this.nombreActual = '';
        this.limpiarDatosDocente();
        this.limpiarDatosAlumno();
        this.cdr.detectChanges();
        void this.mostrarToast('Error al conectar con el servidor');
      }
    });
  }

  // El servidor identifica al alumno desde su propia sesión y tabla de vínculo.
  cargarMiExpedienteAlumno(conservarVista = false): void {
    if (!this.sesionIniciada || this.rolActual !== 'alumno') return;
    const token = this.obtenerToken();
    if (!token) { this.errorExpedienteAlumno = 'Sesión estudiantil inválida'; return; }
    const version = ++this.versionConsultaExpediente;
    // Al actualizar, conservamos la pantalla anterior mientras llega la respuesta.
    // Al iniciar una sesión nueva, en cambio, nunca reutilizamos datos previos.
    if (!conservarVista) {
      this.perfilAlumno = null;
      this.calificacionesAlumno = [];
      this.planAlumno = [];
      this.vistaKardex = construirVistaKardex([], [], 1);
      this.horariosAlumnoReferencia = [];
      this.horarioAlumnoConfirmado=false;this.opcionesHorarioOmitidas=0;this.totalOfertasHorario=0;
      this.agendaSemanalAlumno = construirAgendaSemanal([]);
      this.calendarioSemanalAlumno = construirCalendarioSemanal([]);
      this.horariosAlumnoKardex = [];
      this.materiasCalificadasAlumno = [];
      this.materiasReferenciaSinNota = [];
      this.ultimaActualizacionAlumno = '';
    }
    this.errorExpedienteAlumno = '';
    this.cargandoExpedienteAlumno = true;
    this.cdr.detectChanges();
    this.http.post<RespuestaMiExpediente>(this.urlRegistro(), {accion:'miExpedienteAlumno'},
      {headers:this.encabezados(token)}).subscribe({
      next: r => {
        if (version !== this.versionConsultaExpediente || !this.sesionIniciada ||
            this.rolActual !== 'alumno' || token !== this.obtenerToken()) return;
        this.cargandoExpedienteAlumno = false;
        if (r.status === 'success' && r.perfil) {
          this.perfilAlumno = {...r.perfil, semestre_actual:Number(r.perfil.semestre_actual)};
          this.calificacionesAlumno = (Array.isArray(r.kardex) ? r.kardex : []).map(x=>({...x,id_materia:Number(x.id_materia),calificacion:Number(x.calificacion),creditos:Number(x.creditos)}));
          this.planAlumno = (Array.isArray(r.plan_estudios) ? r.plan_estudios : []).map(x=>({...x, id_materia:Number(x.id_materia),semestre:Number(x.semestre), creditos:Number(x.creditos)}));
          this.vistaKardex = construirVistaKardex(this.planAlumno, this.calificacionesAlumno, this.perfilAlumno.semestre_actual);
          const alternativas=Array.isArray(r.horarios_referencia)?r.horarios_referencia:[];
          this.horariosInscritosAlumno=Array.isArray(r.horarios_inscritos)?r.horarios_inscritos:[];
          const seleccion=elegirHorarioEstudiantil(this.planAlumno,this.perfilAlumno.semestre_actual,alternativas,this.horariosInscritosAlumno);
          this.horariosAlumnoReferencia=seleccion.horarios;
          this.horarioAlumnoConfirmado=seleccion.oficial;
          this.opcionesHorarioOmitidas=seleccion.omitidas;
          this.totalOfertasHorario=seleccion.totalOpciones;
          this.agendaSemanalAlumno=construirAgendaSemanal(seleccion.horarios);
          this.calendarioSemanalAlumno=construirCalendarioSemanal(seleccion.horarios);
          this.horariosAlumnoKardex=Array.isArray(r.horarios_kardex)?r.horarios_kardex:[];
          this.cargarOfertaAlumno();
          const vistasCalificaciones = construirDetalleCalificaciones(
            this.calificacionesAlumno, this.planAlumno, this.horariosAlumnoReferencia,
            this.horariosAlumnoKardex, this.perfilAlumno.semestre_actual
          );
          this.materiasCalificadasAlumno = vistasCalificaciones.calificados;
          this.materiasReferenciaSinNota = vistasCalificaciones.sinNota;
          this.ultimaActualizacionAlumno = new Date().toLocaleString('es-MX', {
            dateStyle: 'short', timeStyle: 'short'
          });
          this.nombreActual = [r.perfil.nombres,r.perfil.apellido_paterno,r.perfil.apellido_materno].filter(Boolean).join(' ');
        } else {
          this.errorExpedienteAlumno = (conservarVista && this.perfilAlumno
            ? 'No se pudo actualizar: se muestran los últimos datos consultados. '
            : '') + (r.mensaje || 'No fue posible cargar tu expediente');
        }
        this.cdr.detectChanges();
      },
      error:e=>{
        if (version !== this.versionConsultaExpediente || !this.sesionIniciada ||
            this.rolActual !== 'alumno' || this.obtenerToken() !== token) return;
        this.cargandoExpedienteAlumno = false;
        if (e.status === 401 || e.status === 403) {
          // No conservar en pantalla datos privados si el servidor revoca el acceso.
          this.perfilAlumno = null;
          this.calificacionesAlumno = [];
          this.planAlumno = [];
          this.vistaKardex = construirVistaKardex([], [], 1);
          this.horariosAlumnoReferencia = [];
          this.horarioAlumnoConfirmado=false;this.opcionesHorarioOmitidas=0;this.totalOfertasHorario=0;
          this.agendaSemanalAlumno = construirAgendaSemanal([]);
          this.calendarioSemanalAlumno = construirCalendarioSemanal([]);
          this.horariosAlumnoKardex = [];
          this.materiasCalificadasAlumno = [];
          this.materiasReferenciaSinNota = [];
          this.ultimaActualizacionAlumno = '';
          this.errorExpedienteAlumno = 'La sesión ya no tiene permiso para ver el expediente. Vuelve a iniciar sesión.';
        } else {
          this.errorExpedienteAlumno = (conservarVista && this.perfilAlumno
            ? 'No se pudo actualizar. Sigues viendo la última consulta. '
            : '') + (e.error?.mensaje || 'No se pudo consultar tu expediente. Verifica la conexión.');
        }
        this.cdr.detectChanges();
      }
    });
  }

  // Botón "Actualizar mis grupos": refresca las tres secciones.
  cargarMisGruposDocente(): void {
    if (!this.sesionIniciada || this.rolActual !== 'docente') return;
    this.cargarMisHorariosDocente();
    this.cargarMisAlumnosRelacionados();
    this.cargarMisCalificacionesDocente();
    this.cargarExtensionesDocente();

    const token = this.obtenerToken();
    if (!token) {
      this.errorGruposDocente = 'No existe una sesión docente válida';
      this.cdr.detectChanges();
      return;
    }
    const version = ++this.versionConsultaGrupos;
    this.gruposDocente = [];
    this.totalGruposDocente = 0;
    this.errorGruposDocente = '';
    this.cargandoGruposDocente = true;
    this.cdr.detectChanges();

    this.http.post<RespuestaGrupos>(
      this.urlRegistro(), { accion: 'misGruposDocente' },
      { headers: this.encabezados(token) }
    ).subscribe({
      next: (r) => {
        if (!this.sesionDocenteVigente(token, version, this.versionConsultaGrupos)) return;
        this.cargandoGruposDocente = false;
        if (r.status === 'success' && Array.isArray(r.grupos)) {
          this.gruposDocente = r.grupos.map(g => ({
            ...g, id_grupo: String(g.id_grupo),
            id_materia: Number(g.id_materia),
            capacidad: Number(g.capacidad),
            semestre: Number(g.semestre),
            creditos: Number(g.creditos)
          }));
          this.totalGruposDocente = this.gruposDocente.length;
        } else {
          this.errorGruposDocente = r.mensaje || 'No se pudieron consultar tus grupos';
        }
        this.cdr.detectChanges();
      },
      error: (e) => {
        if (!this.sesionDocenteVigente(token, version, this.versionConsultaGrupos)) return;
        this.cargandoGruposDocente = false;
        this.errorGruposDocente = e.error?.mensaje ||
          (e.status === 401 || e.status === 403
            ? 'Tu sesión no tiene permisos para consultar grupos'
            : 'Error al conectar con el servidor');
        this.cdr.detectChanges();
      }
    });
  }

  cargarMisHorariosDocente(): void {
    if (!this.sesionIniciada || this.rolActual !== 'docente') return;
    const token = this.obtenerToken();
    if (!token) {
      this.errorHorariosDocente = 'No existe una sesión docente válida';
      this.cdr.detectChanges();
      return;
    }
    const version = ++this.versionConsultaHorarios;
    this.horariosDocente = [];
    this.totalHorariosDocente = 0;
    this.errorHorariosDocente = '';
    this.cargandoHorariosDocente = true;
    this.cdr.detectChanges();

    this.http.post<RespuestaHorarios>(
      this.urlRegistro(), { accion: 'misHorariosDocente' },
      { headers: this.encabezados(token) }
    ).subscribe({
      next: (r) => {
        if (!this.sesionDocenteVigente(token, version, this.versionConsultaHorarios)) return;
        this.cargandoHorariosDocente = false;
        if (r.status === 'success' && Array.isArray(r.horarios)) {
          this.horariosDocente = r.horarios.map(h => ({
            ...h, id_horario: Number(h.id_horario), id_grupo: String(h.id_grupo),
            id_materia: Number(h.id_materia), id_salon: Number(h.id_salon),
            semestre: Number(h.semestre), piso: Number(h.piso)
          }));
          this.totalHorariosDocente = this.horariosDocente.length;
        } else {
          this.errorHorariosDocente = r.mensaje || 'No se pudieron consultar tus horarios';
        }
        this.cdr.detectChanges();
      },
      error: (e) => {
        if (!this.sesionDocenteVigente(token, version, this.versionConsultaHorarios)) return;
        this.cargandoHorariosDocente = false;
        this.errorHorariosDocente = e.error?.mensaje ||
          (e.status === 401 || e.status === 403
            ? 'Tu sesión no tiene permisos para consultar horarios'
            : 'Error al conectar con el servidor');
        this.cdr.detectChanges();
      }
    });
  }

  // Los resultados son coincidencias académicas, no inscripciones confirmadas.
  cargarMisAlumnosRelacionados(): void {
    if (!this.sesionIniciada || this.rolActual !== 'docente') return;
    const token = this.obtenerToken();
    if (!token) {
      this.errorAlumnosRelacionados = 'No existe una sesión docente válida';
      this.cdr.detectChanges();
      return;
    }
    const version = ++this.versionConsultaAlumnos;
    this.alumnosRelacionados = [];
    this.totalAlumnosRelacionados = 0;
    this.errorAlumnosRelacionados = '';
    this.cargandoAlumnosRelacionados = true;
    this.cdr.detectChanges();

    this.http.post<RespuestaAlumnos>(
      this.urlRegistro(), { accion: 'misAlumnosRelacionadosDocente' },
      { headers: this.encabezados(token) }
    ).subscribe({
      next: (r) => {
        if (!this.sesionDocenteVigente(token, version, this.versionConsultaAlumnos)) return;
        this.cargandoAlumnosRelacionados = false;
        if (r.status === 'success' && Array.isArray(r.alumnos)) {
          this.alumnosRelacionados = r.alumnos.map(a => ({
            ...a, id_grupo: String(a.id_grupo), id_materia: Number(a.id_materia),
            semestre_materia: Number(a.semestre_materia),
            semestre_actual: Number(a.semestre_actual)
          }));
          this.totalAlumnosRelacionados = this.alumnosRelacionados.length;
        } else {
          this.errorAlumnosRelacionados = r.mensaje ||
            'No se pudieron consultar los alumnos relacionados';
        }
        this.cdr.detectChanges();
      },
      error: (e) => {
        if (!this.sesionDocenteVigente(token, version, this.versionConsultaAlumnos)) return;
        this.cargandoAlumnosRelacionados = false;
        this.errorAlumnosRelacionados = e.error?.mensaje ||
          (e.status === 401 || e.status === 403
            ? 'Tu sesión no tiene permisos para consultar alumnos'
            : 'Error al conectar con el servidor');
        this.cdr.detectChanges();
      }
    });
  }

  cargarMisCalificacionesDocente(): void {
    if (!this.sesionIniciada || this.rolActual !== 'docente') return;
    const token = this.obtenerToken();
    if (!token) { this.errorCalificacion = 'Inicia sesión como docente'; return; }
    const version = ++this.versionCalificaciones;
    this.cargandoCalificaciones = true;
    this.errorCalificacion = '';
    this.cdr.detectChanges();
    this.http.post<RespuestaCalificaciones>(this.urlRegistro(),
      { accion: 'misCalificacionesDocente' },
      { headers: this.encabezados(token) }
    ).subscribe({
      next: r => {
        if (!this.sesionDocenteVigente(token, version, this.versionCalificaciones)) return;
        this.cargandoCalificaciones = false;
        if (r.status === 'success' && Array.isArray(r.calificaciones)) {
          this.calificacionesDocente = r.calificaciones.map(c => ({
            ...c, id_kardex: Number(c.id_kardex),
            id_grupo: String(c.id_grupo), calificacion: Number(c.calificacion)
          }));
        } else this.errorCalificacion = r.mensaje || 'No fue posible consultar las calificaciones';
        this.cdr.detectChanges();
      },
      error: e => {
        if (!this.sesionDocenteVigente(token, version, this.versionCalificaciones)) return;
        this.cargandoCalificaciones = false;
        this.errorCalificacion = e.error?.mensaje || 'No se pudo conectar con el servidor';
        this.cdr.detectChanges();
      }
    });
  }

  guardarCalificacionDocente(): void {
    if (this.guardandoCalificacion || !this.sesionIniciada || this.rolActual !== 'docente') return;
    const f = this.calificacionForm;
    if (!this.calificacionLista) {
      this.errorCalificacion = 'Revisa grupo, alumno y nota. Solo se permite capturar en el periodo lectivo activo.';
      return;
    }
    const grupo = this.gruposDocente.find(g => g.id_grupo === f.id_grupo && g.id_materia === f.id_materia);
    const alumno = this.alumnosCalificables.find(a => a.n_control === f.n_control);
    if (!grupo || !alumno) {
      this.errorCalificacion = 'Selecciona un alumno relacionado con un grupo que tengas asignado.';
      return;
    }
    const confirmado = window.confirm(
      `¿Registrar la calificación final ${f.calificacion} de ${alumno.nombre_alumno} en ${grupo.nombre_materia} (${this.periodoAcademicoActual()})?\n\nEste registro se guardará en el Kárdex de prueba y no sustituye un acta oficial.`
    );
    if (!confirmado) return;
    const token = this.obtenerToken();
    if (!token) { this.errorCalificacion = 'Tu sesión ya no está disponible'; return; }
    this.guardandoCalificacion = true;
    this.mensajeCalificacion = '';
    this.errorCalificacion = '';
    this.http.post<{status: string; mensaje?: string}>(
      this.urlRegistro(),
      { accion: 'registrarCalificacionDocente', ...f, periodo: this.periodoAcademicoActual(), calificacion: Number(f.calificacion) },
      { headers: this.encabezados(token) }
    ).subscribe({
      next: r => {
        if (!this.sesionIniciada || this.rolActual !== 'docente' || this.obtenerToken() !== token) return;
        this.guardandoCalificacion = false;
        if (r.status === 'success') {
          this.mensajeCalificacion = r.mensaje || 'Calificación guardada';
          this.calificacionForm.n_control = '';
          this.calificacionForm.calificacion = null;
          this.cargarMisCalificacionesDocente();
        } else this.errorCalificacion = r.mensaje || 'No fue posible guardar la calificación';
        this.cdr.detectChanges();
      },
      error: e => {
        if (!this.sesionIniciada || this.rolActual !== 'docente' || this.obtenerToken() !== token) return;
        this.guardandoCalificacion = false;
        this.errorCalificacion = e.error?.mensaje || 'No se pudo registrar la calificación';
        this.cdr.detectChanges();
      }
    });
  }

  private limpiarDatosAlumno(): void {
    ++this.versionConsultaExpediente;
    this.perfilAlumno = null;
    this.calificacionesAlumno = [];
    this.planAlumno = [];
    this.vistaKardex = construirVistaKardex([], [], 1);
    this.horariosAlumnoReferencia = [];
    this.agendaSemanalAlumno = construirAgendaSemanal([]);
    this.calendarioSemanalAlumno = construirCalendarioSemanal([]);
    this.horariosAlumnoKardex = [];
    this.materiasCalificadasAlumno = [];
    this.materiasReferenciaSinNota = [];
    this.ultimaActualizacionAlumno = '';
    this.horariosInscritosAlumno=[];this.ofertaAlumno=[];this.cargasAlumno=[];
    this.cargandoExpedienteAlumno = false;
    this.errorExpedienteAlumno = '';
    this.seccionAlumno = 'inicio';
  }

  private limpiarDatosDocente(): void {
    this.versionConsultaGrupos++;
    this.versionConsultaHorarios++;
    this.versionConsultaAlumnos++;
    this.versionCalificaciones++;
    this.calificacionesDocente = [];
    this.solicitudesEdicion=[];
    this.cargandoCalificaciones = false;
    this.guardandoCalificacion = false;
    this.mensajeCalificacion = '';
    this.errorCalificacion = '';
    this.calificacionForm = { id_grupo: null, id_materia:0, n_control: '', periodo: '', tipo_calificacion: 'ORDINARIO', calificacion: null };
    this.seccionDocente = 'grupos';

    this.gruposDocente = [];
    this.totalGruposDocente = 0;
    this.cargandoGruposDocente = false;
    this.errorGruposDocente = '';
    this.horariosDocente = [];
    this.totalHorariosDocente = 0;
    this.cargandoHorariosDocente = false;
    this.errorHorariosDocente = '';
    this.alumnosRelacionados = [];
    this.totalAlumnosRelacionados = 0;
    this.cargandoAlumnosRelacionados = false;
    this.errorAlumnosRelacionados = '';
  }

  claveAnterior='';claveNueva='';cambiandoClave=false;mensajeClave='';
  cambiarMiClave():void{
    if(this.cambiandoClave || this.claveNueva.length<10 || !this.claveAnterior)return;
    const token=this.obtenerToken();if(!token){this.mensajeClave='Inicia sesión nuevamente.';return;}
    const servidor=sessionStorage.getItem('ambar_servidor')||this.ipServidor;
    this.cambiandoClave=true;this.mensajeClave='';this.cdr.detectChanges();
    this.http.post<any>(`http://${servidor.trim()}/api_ionic/login.php`,{
      accion:'cambiarClave',anterior:this.claveAnterior,nueva:this.claveNueva
    },{headers:this.encabezados(token)}).pipe(timeout(12000)).subscribe({
      next:r=>{this.cambiandoClave=false;this.claveAnterior='';this.claveNueva='';
        if(r?.success===true){this.mensajeClave='Contraseña cambiada. Inicia sesión con la nueva.';this.cerrarSesion();}
        else this.mensajeClave=r?.message||'No fue posible cambiar la contraseña.';
        this.cdr.detectChanges();},
      error:e=>{this.cambiandoClave=false;this.claveAnterior='';this.claveNueva='';this.mensajeClave=e?.error?.message||'No se pudo cambiar la contraseña.';this.cdr.detectChanges();}
    });
  }
  cerrarSesion(): void {
    const token = this.obtenerToken();
    const servidor = sessionStorage.getItem('ambar_servidor') || this.ipServidor;
    if (token) {
      this.http.post(
        `http://${servidor.trim()}/api_ionic/login.php`,
        { accion: 'logout' },
        { headers: this.encabezados(token) }
      ).subscribe({ error: () => console.warn('No se confirmó el cierre de sesión en PHP') });
    }
    sessionStorage.removeItem('ambar_sesion');
    this.sesionIniciada = false;
    this.rolActual = null;
    this.nombreActual = '';
    this.usuario = { correo: '', contra: '' };
    this.cargando = false;
    this.limpiarDatosDocente();
    this.limpiarDatosAlumno();
    this.cdr.detectChanges();
    void this.mostrarToast('Sesión cerrada correctamente');
  }

  async mostrarToast(mensaje: string): Promise<void> {
    const toast = await this.toastCtrl.create({
      message: mensaje, duration: 2000, position: 'bottom'
    });
    await toast.present();
  }
}
