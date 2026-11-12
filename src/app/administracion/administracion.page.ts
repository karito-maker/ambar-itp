import { Component, OnInit, ChangeDetectorRef, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Capacitor } from '@capacitor/core';
import { timeout } from 'rxjs';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonButton, IonItem, IonInput, IonSelect, IonSelectOption } from '@ionic/angular';
interface Columna { nombre:string;tipo:string; obligatorio:boolean;editable:boolean;opciones:string[]; }
interface Referencia { valor:number|string; etiqueta:string; }
@Component({selector:'app-administracion',standalone:true,templateUrl:'./administracion.page.html', styleUrls:['./administracion.page.scss'],imports:[CommonModule,FormsModule,RouterLink,IonHeader,IonToolbar,IonTitle,IonContent,IonButton,IonItem,IonInput,IonSelect,IonSelectOption]})
export class AdministracionPage implements OnInit {
  tablas=[
    {valor:'alumnos',nombre:'Alumnos'},
    {valor:'areas',nombre:'Áreas académicas'},
    {valor:'carreras',nombre:'Carreras'},
    {valor:'contratos',nombre:'Contratos'},
    {valor:'datos_contacto',nombre:'Datos de contacto del alumno'},
    {valor:'datos_profesor',nombre:'Datos personales del docente'},
    {valor:'docentes',nombre:'Docentes'},
    {valor:'edificios',nombre:'Edificios'},
    {valor:'grupos',nombre:'Grupos'},
    {valor:'horarios',nombre:'Horarios'},
    {valor:'kardex',nombre:'Kárdex y calificaciones finales'},
    {valor:'materias',nombre:'Materias'},
    {valor:'reticulas',nombre:'Retículas'},
    {valor:'reticula_materia',nombre:'Materias asignadas a retículas'},
    {valor:'salones',nombre:'Salones'},
    {valor:'usuarios',nombre:'Cuentas y perfiles de acceso'}
  ];
  // Administración emite invitaciones; la persona captura sus datos y activa su propia cuenta.
  invitacion = {rol:'ALUMNO', n_control:'', correo:'', fk_reticula:0, semestre_actual:1, fk_area:0, tipo_docente:'BASE'};
  invitaciones: {identificador:string; correo:string; rol:string; carrera:string; area:string; semestre:number|null; estado:string; expira:string}[]=[];
  opcionesCarreraInv: {id_carrera:number; nombre_carrera:string}[]=[];
  opcionesReticulaInv: {id_reticula:number; nombre_reticula:string; fk_carrera:number}[]=[];
  opcionesAreaInv: {id_area:number; nombre_area:string}[]=[];
  codigoEmitido=''; invitadoEmitido=''; mensajeInvitacion=''; errorInvitacion=''; procesandoInvitacion=false;
  cargarInvitaciones():void {
    this.http.post<any>(this.url(),{accion:'tp_listarInvitaciones'},{headers:this.headers()}).pipe(timeout(12000)).subscribe({
      next:r=>{if(r?.status==='success'){
        this.invitaciones=Array.isArray(r.invitaciones)?r.invitaciones:[];
        this.opcionesCarreraInv=r.carreras||[];this.opcionesReticulaInv=r.reticulas||[];this.opcionesAreaInv=r.areas||[];
      }else this.errorInvitacion=r?.mensaje||'No se pudieron consultar las invitaciones.';this.refresh();},
      error:e=>{this.errorInvitacion=this.fallo(e);this.refresh();}
    });
  }
  prepararInvitacion():void {
    if(this.procesandoInvitacion||!this.invitacion.correo.trim()||
      (this.invitacion.rol==='ALUMNO'&&(!this.invitacion.n_control.trim()||!this.invitacion.fk_reticula))||
      (this.invitacion.rol==='DOCENTE'&&!this.invitacion.fk_area))return;
    this.procesandoInvitacion=true;this.codigoEmitido='';this.errorInvitacion='';this.mensajeInvitacion='';
    this.http.post<any>(this.url(),{accion:'tp_prepararInvitacion',...this.invitacion},{headers:this.headers()}).pipe(timeout(12000)).subscribe({
      next:r=>{this.procesandoInvitacion=false;if(r?.status==='success'){
        this.codigoEmitido=r.codigo||'';this.invitadoEmitido=r.identificador||'';
        this.mensajeInvitacion=(r.mensaje||'Invitación creada.')+' El código se muestra una sola vez.';
        this.cargarInvitaciones();
      }else this.errorInvitacion=r?.mensaje||'No se pudo preparar la invitación.';this.refresh();},
      error:e=>{this.procesandoInvitacion=false;this.errorInvitacion=this.fallo(e);this.refresh();}
    });
  }
  cancelarInvitacion(id:string):void {
    if(!window.confirm('¿Cancelar esta invitación? El código ya no servirá.'))return;
    this.http.post<any>(this.url(),{accion:'tp_revocarInvitacion',identificador:id},{headers:this.headers()}).pipe(timeout(12000)).subscribe({
      next:r=>{if(r?.status==='success'){this.mensajeInvitacion=r.mensaje;this.cargarInvitaciones();}else this.errorInvitacion=r?.mensaje||'No se pudo cancelar.';this.refresh();},
      error:e=>{this.errorInvitacion=this.fallo(e);this.refresh();}
    });
  }
  async copiarInvitacion():Promise<void>{
    if(!this.codigoEmitido)return;
    const texto=`TecPlus\nIdentificador: ${this.invitadoEmitido}\nCódigo temporal: ${this.codigoEmitido}\nActiva tu cuenta desde la página de inicio. El código vence en 72 horas.`;
    try{await navigator.clipboard.writeText(texto);this.mensajeInvitacion='Datos copiados. Entrégalos solo a la persona autorizada.';}
    catch{this.errorInvitacion='La copia automática no está disponible. Copia el código mostrado de forma manual.';}
    this.refresh();
  }
  readonly altasDirectas=['datos_contacto','datos_profesor','reticula_materia'];
  readonly rutasDeRegistro: Record<string,string> = {
    alumnos:'/gestion-alumnos',docentes:'/docentes',materias:'/materias',
    carreras:'/carreras',grupos:'/grupos-horarios',horarios:'/grupos-horarios',
    edificios:'/grupos-horarios',salones:'/grupos-horarios'
  };
  pagina=0;
  totalRegistros=0;
  registrosPorPagina=50;
  get paginaMax():number{return Math.max(1,Math.ceil(this.totalRegistros/this.registrosPorPagina));}
  get enlaceAlta():string{return this.rutasDeRegistro[this.tabla]||'';}
  tabla='alumnos';clave='';columnas:Columna[]=[]; registros:Record<string,any>[]=[];
  referencias:Record<string,Referencia[]>={};
  actual:Record<string,any>|null=null; identificador:any=null; nuevo=false;
  cargando=false;guardando=false;error='';mensaje=''; filtro='';
  cuentas:{id_usuario:number;correo:string;rol:string;activo:number}[]=[]; cuentaElegida=0; claveTemporal='';restableciendo=false;
  solicitudesClave:{id_solicitud:number;fk_usuario:number;correo:string;rol:string;solicitado:string}[]=[];
  solicitudesNota:{id_solicitud:number;tipo:string;id_registro:number;docente:string;motivo:string;estado:string}[]=[];
  solicitudesCarga:{id_solicitud:number;fk_alumno:string;fk_grupo:string;periodo:string;nombre_materia:string}[]=[];
  guardandoExtras=false; mensajeExtras='';errorExtras='';
  // Población calculada a partir de los docentes y alumnos activos vinculados al edificio.
  carrerasPoblacion:{id_carrera:number;nombre_carrera:string}[]=[];
  areasPoblacion:{id_area:number;nombre_area:string;fk_edificio:number}[]=[];
  edificiosPoblacion:{id_edificio:number;nombre_edificio:string;docentes:number;alumnos:number;poblacion:number}[]=[];
  vinculosPoblacion:Record<string,number>={};
  carreraVincular=0;areaVincular=0;guardandoPoblacion=false;errorPoblacion='';mensajePoblacion='';
  cargarPoblacion():void {
    this.http.post<any>(this.url(),{accion:'tp_catalogoPoblacion'},{headers:this.headers()}).pipe(timeout(12000)).subscribe({
      next:r=>{if(r?.status==='success')this.recibirPoblacion(r);else this.errorPoblacion=r?.mensaje||'No se pudo calcular la población.';this.refresh();},
      error:e=>{this.errorPoblacion=this.fallo(e);this.refresh();}
    });
  }
  private recibirPoblacion(r:any):void {
    this.carrerasPoblacion=r.carreras||[];
    this.areasPoblacion=r.areas||[];
    this.edificiosPoblacion=r.edificios||[];
    this.vinculosPoblacion=r.vinculos||{};
  }
  cambiarCarreraVincular():void {
    this.areaVincular=Number(this.vinculosPoblacion[String(this.carreraVincular)]||0);
  }
  guardarVinculoPoblacion():void {
    if(this.guardandoPoblacion||!this.carreraVincular)return;
    this.guardandoPoblacion=true;this.errorPoblacion='';this.mensajePoblacion='';this.refresh();
    this.http.post<any>(this.url(),{accion:'tp_vincularCarreraArea',id_carrera:Number(this.carreraVincular),id_area:Number(this.areaVincular)},{headers:this.headers()}).pipe(timeout(12000)).subscribe({
      next:r=>{this.guardandoPoblacion=false;if(r?.status==='success'){
        this.recibirPoblacion(r);this.mensajePoblacion=r.mensaje||'Asignación actualizada.';
        if(this.tabla==='edificios')this.cargar();
      }else this.errorPoblacion=r?.mensaje||'No se pudo guardar la asignación.';this.refresh();},
      error:e=>{this.guardandoPoblacion=false;this.errorPoblacion=this.fallo(e);this.refresh();}
    });
  }

  private extra(accion:string,parametros:Record<string,unknown>={},ok?:(r:any)=>void):void {
    this.errorExtras='';this.http.post<any>(this.url(),{accion,...parametros},{headers:this.headers()}).pipe(timeout(12000)).subscribe({
      next:r=>{if(r?.status==='success'){ok?.(r);this.mensajeExtras=r.mensaje||'';} else this.errorExtras=r?.mensaje||'No se pudo completar la operación.';this.refresh();},
      error:e=>{this.errorExtras=this.fallo(e);this.refresh();}
    });
  }
  cargarExtras():void {
    this.extra('tp_clavesPendientes',{},r=>this.solicitudesClave=r.solicitudes||[]);
    this.extra('tp_solicitudesEdicionAdmin',{},r=>this.solicitudesNota=(r.solicitudes||[]).filter((s:any)=>s.estado==='PENDIENTE'));
    this.extra('tp_cargasPendientesAdmin',{},r=>this.solicitudesCarga=r.solicitudes||[]);
  }
  @ViewChild('formularioEditor', { read: ElementRef }) private formularioEditor?: ElementRef<HTMLElement>;
  private mostrarFormulario():void {
    this.refresh();
    this.formularioEditor?.nativeElement.scrollIntoView({behavior:'smooth',block:'start'});
  }
  // La selección debe verse inmediatamente y llevar a la sección donde se restablece el acceso.
  @ViewChild('panelRestablecer', { read: ElementRef }) private panelRestablecer?: ElementRef<HTMLElement>;
  cuentaSolicitanteSeleccionada = '';
  cuentaSolicitanteId = 0;
  seleccionarCuentaSolicitante(s:{fk_usuario:number;correo?:string;rol?:string}):void {
    const id = Number(s?.fk_usuario);
    if (!Number.isSafeInteger(id) || id < 1) {
      this.errorExtras = 'La solicitud no tiene una cuenta válida. Actualiza las solicitudes e inténtalo nuevamente.';
      this.refresh();
      return;
    }
    // Una solicitud puede corresponder a una cuenta no incluida en los primeros 200 registros.
    // Incorporarla únicamente al selector local no modifica MySQL: PHP valida el identificador al guardar.
    if (!this.cuentas.some(c => Number(c.id_usuario) === id)) {
      this.cuentas = [
        { id_usuario:id, correo:s.correo || `Cuenta ${id}`, rol:s.rol || 'ALUMNO', activo:1 },
        ...this.cuentas
      ];
    }
    this.cuentaElegida = id;
    this.cuentaSolicitanteId = id;
    this.claveTemporal = '';
    this.error = '';
    this.errorExtras = '';
    this.cuentaSolicitanteSeleccionada = `${s.correo || 'Cuenta ' + id} · ${s.rol || 'Usuario'}`;
    this.refresh();
    this.panelRestablecer?.nativeElement.scrollIntoView({ behavior:'smooth', block:'start' });
  }
  resolverNota(id:number,aprobar:boolean):void {
    if(!window.confirm(aprobar?'¿Autorizar una única corrección?':'¿Rechazar esta corrección?'))return;
    this.extra('tp_resolverEdicionAdmin',{id_solicitud:id,aprobar},()=>this.cargarExtras());
  }
  resolverCarga(id:number,aprobar:boolean):void {
    if(!window.confirm(aprobar?'¿Autorizar la carga tras comprobar los requisitos?':'¿Rechazar la solicitud de carga?'))return;
    this.extra('tp_resolverCargaAdmin',{id_solicitud:id,aprobar},()=>this.cargarExtras());
  }
  constructor(private http:HttpClient,private cdr:ChangeDetectorRef){}
  ngOnInit():void{this.cargar();this.cargarCuentas();this.cargarExtras();this.cargarPoblacion();this.cargarInvitaciones();}
  ionViewWillEnter():void{this.cargar();}
  private url():string{const s=sessionStorage.getItem('ambar_servidor')||(Capacitor.getPlatform()==='android'?'10.0.2.2':'localhost');return `http://${s.trim()}/api_ionic/registro.php`;}
  private headers():HttpHeaders{let t='';try{t=JSON.parse(sessionStorage.getItem('ambar_sesion')||'{}').token||'';}catch{}return new HttpHeaders({Authorization:`Bearer ${t}`});}
  private refresh():void{this.cdr.detectChanges();}
  private fallo(e:any):string{return e?.name==='TimeoutError'?'El servidor no respondió. Revisa Apache y MySQL.':e?.error?.mensaje||'No fue posible completar la operación.';}
  get visibles():Record<string,any>[] {
    // La búsqueda se hace en MySQL, no solo en la página visible.
    return this.registros;
  }
  get editables():Columna[]{return this.columnas.filter(c=>c.editable);}
  get noEditables():Columna[]{return this.nuevo?[]:this.columnas.filter(c=>!c.editable&&c.nombre!=='contraseña');}
  mostrarValorNoEditable(c:Columna):string {
    if(!this.actual)return '';
    const valor=this.actual[c.nombre];
    if(valor===null||valor===undefined||valor==='')return 'No registrado';
    if(c.nombre.startsWith('fk_'))return this.referencias[c.nombre]?.find(r=>String(r.valor)===String(valor))?.etiqueta||String(valor);
    return String(valor);
  }
  get tituloTabla():string{return this.tablas.find(t=>t.valor===this.tabla)?.nombre||this.tabla;}
  get tituloFormulario():string {
    if(!this.nuevo) return 'Editar ' + this.tituloTabla;
    if(this.tabla==='areas') return 'Registrar área académica';
    if(this.tabla==='reticulas') return 'Registrar nueva retícula';
    return 'Nuevo registro de ' + this.tituloTabla.toLowerCase();
  }
  get etiquetaGuardar():string {
    if(!this.nuevo) return 'Guardar cambios';
    if(this.tabla==='areas') return 'Registrar área académica';
    if(this.tabla==='reticulas') return 'Registrar retícula';
    return 'Guardar nuevo registro';
  }
  // Etiquetas de uso escolar: nunca mostrar nombres internos de MySQL al usuario.
  private etiquetas:Record<string,string>={
    n_control:'Número de control',id_docente:'Número de docente',id_usuario:'Cuenta de acceso',
    nombre:'Primer nombre',segundo_nombre:'Segundo nombre',snombre:'Segundo nombre',nombres:'Nombres',apellido_paterno:'Apellido paterno',apellido_materno:'Apellido materno',
    nombre_materia:'Nombre de la materia',nombre_carrera:'Carrera',nombre_reticula:'Plan de estudios',
    nombre_area:'Nombre del área académica',nombre_edificio:'Edificio',nombre_salon:'Salón o aula',tipo_salon:'Salón o aula',
    fecha_inicio:'Fecha de inicio',fecha_fin:'Fecha de término',fecha_nacimiento:'Fecha de nacimiento',
    fecha_ingreso:'Fecha de ingreso',tipo_contrato:'Tipo de contratación',rol:'Rol del contrato',
    funcion:'Función o cargo',horas_contratadas:'Horas contratadas por semana',estatus:'Estatus',
    id_contacto:'Registro de contacto',id_contacto_profesor:'Registro de datos personales',
    id_kardex:'Registro en Kárdex',id_reticula_materia:'Asignación al plan',id_horario:'Sesión de clase',
    correo_sesion:'Correo institucional de acceso',contrasena:'Contraseña',
    calle:'Calle',numero_exterior:'Número exterior',numero_interior:'Número interior',
    colonia:'Colonia',codigo_postal:'Código postal',ciudad:'Ciudad',municipio:'Municipio',
    estado:'Estado',pais:'País',correo_personal:'Correo personal',
    fk_usuario:'Cuenta de acceso',fk_usuarios:'Cuenta de acceso',fk_alumno:'Alumno',
    fk_docentes:'Docente que evaluó',fk_salones:'Salón de evaluación',
    id_grupo:'Clave de grupo',id_salon:'Clave de salón',
    fk_docente:'Persona docente',fk_materia:'Materia',fk_reticula:'Plan de estudios',
    fk_carrera:'Carrera',fk_area:'Área académica',fk_edificio:'Edificio',fk_salon:'Salón',
    fk_grupo:'Grupo',fk_prerrequisito:'Materia que debe aprobarse primero',
    calificacion:'Calificación final',tipo_calificacion:'Tipo de evaluación',periodo:'Periodo escolar',fecha_registro:'Fecha de registro',
    dia_semana:'Día de la semana',hora_inicio:'Hora de inicio',hora_fin:'Hora de término',
    semestre:'Semestre',semestre_actual:'Semestre actual',creditos:'Créditos',
    horas_teoria:'Horas de teoría',horas_practica:'Horas de práctica',
    correo:'Correo',correo_contacto:'Correo de contacto',telefono:'Teléfono',
    capacidad:'Capacidad máxima',piso:'Piso',ubicacion:'Ubicación',poblacion:'Población académica automática',vigente:'Vigente',
    anio_inicio:'Año de inicio','año_inicio':'Año de inicio',tipo_docente:'Tipo de contratación docente',descripcion:'Descripción',activo:'Activo'
  };
  etiquetaCampo(c:Columna):string {
    const nombre=(this.tabla==='usuarios'&&c.nombre==='rol'?'Perfil de acceso':this.etiquetas[c.nombre]) || c.nombre.replace(/^fk_/, '').replaceAll('_',' ');
    return nombre.charAt(0).toUpperCase()+nombre.slice(1)+(c.obligatorio?' *':'');
  }
  tipoCampo(c:Columna):string {
    if(c.tipo.startsWith('date'))return 'date';
    if(c.tipo.startsWith('time'))return 'time';
    if(c.nombre==='anio_inicio' || c.nombre==='año_inicio')return 'number';
    if(/^(?:int|tinyint|smallint|bigint|mediumint|decimal|float|double)/.test(c.tipo))return 'number';
    return 'text';
  }
  esSeleccion(c:Columna):boolean {
    return c.nombre.startsWith('fk_') || c.opciones.length>0 || c.nombre==='dia_semana' || c.nombre==='estatus' || (this.tabla==='reticulas' && c.nombre==='vigente') ||
      (this.tabla==='contratos' && ['tipo_contrato','rol'].includes(c.nombre));
  }
  // Se respeta el valor real de la BD: por ejemplo "plaza" puede mostrarse como "Base (plaza)".
  opcionesCampo(c:Columna):Referencia[]{
    if(c.nombre.startsWith('fk_'))return (this.referencias[c.nombre]||[]).map(x=>({
      valor:['fk_grupo','fk_alumno'].includes(c.nombre)?String(x.valor):Number(x.valor),etiqueta:x.etiqueta
    }));
    if(c.nombre==='dia_semana')return ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'].map(x=>({valor:x,etiqueta:x}));
    if(c.nombre==='estatus')return ['activo','inactivo'].map(x=>({valor:x,etiqueta:this.etiquetaOpcion(c.nombre,x)}));
    if(this.tabla==='reticulas' && c.nombre==='vigente') return [{valor:1,etiqueta:'Vigente (disponible para alumnos)'},{valor:0,etiqueta:'No vigente (solo consulta)'}];
    const permitido=['base','plaza','interinato','honorarios'];
    if(this.tabla==='contratos' && c.nombre==='tipo_contrato') {
      const crudos=c.opciones.length?c.opciones: ['BASE','INTERINATO','HONORARIOS'];
      return crudos.filter(x=>permitido.includes(x.toLowerCase())).map(x=>({valor:x,etiqueta:this.etiquetaOpcion(c.nombre,x)}));
    }
    if(this.tabla==='contratos' && c.nombre==='rol'){
      const crudos=c.opciones.length?c.opciones:['DOCENTE','JEFE','SUBJEFE'];
      return crudos.map(x=>({valor:x,etiqueta:this.etiquetaOpcion(c.nombre,x)}));
    }
    return c.opciones.map(x=>({valor:x,etiqueta:this.etiquetaOpcion(c.nombre,x)}));
  }
  private etiquetaOpcion(campo:string,valor:string):string{
    const t=valor.toLowerCase();
    if(campo==='tipo_docente')return t==='base'?'Base (plaza)':t==='interinato'?'Interinato':'Honorarios';
    if(campo==='tipo_contrato')return t==='base'||t==='plaza'?'Base (plaza)':t==='interinato'?'Interinato':'Honorarios';
    if(campo==='rol')return t==='docente'?'Docente':t==='jefe'?'Jefe de área':t==='subjefe'?'Subjefe de área':valor;
    if(t==='activo')return 'Activo';if(t==='inactivo')return 'Inactivo';
    return valor.charAt(0).toUpperCase()+valor.slice(1).replaceAll('_',' ');
  }
  resumen(r:Record<string,any>):string{
    if(this.tabla==='edificios')return String(r['nombre_edificio']||'Edificio')+' · '+Number(r['poblacion']||0)+' personas';
    if(this.tabla==='usuarios')return String(r['correo']||'')+' · '+String(r['rol']||'');
    if(this.tabla==='reticula_materia')return 'Plan '+String(r['fk_reticula'])+' · Materia '+String(r['fk_materia']);
    if(this.tabla==='kardex')return 'Alumno '+String(r['fk_alumno'])+' · '+String(r['calificacion'])+' puntos';
    if(this.tabla==='datos_contacto')return 'Alumno '+String(r['fk_alumno'])+' · '+String(r['correo_personal']||'');
    if(this.tabla==='datos_profesor')return 'Docente '+String(r['fk_docente'])+' · '+String(r['correo_personal']||'');
    if(this.tabla==='horarios')return String(r['dia_semana'])+' · '+String(r['hora_inicio'])+' a '+String(r['hora_fin']);
    return ['nombre','nombres','apellido_paterno','nombre_materia','nombre_carrera','nombre_area','nombre_reticula','nombre_edificio','tipo_salon','tipo_contrato','estatus'].map(k=>r[k]).filter(v=>v!==null&&v!==undefined&&v!=='').slice(0,3).join(' · ') || String(r[this.clave]);
  }
  cambiarTabla():void{this.actual=null;this.filtro='';this.pagina=0;this.cargar();if(this.tabla==='edificios'||this.tabla==='areas')this.cargarPoblacion();}
  cargarCuentas():void{
    this.http.post<any>(this.url(),{accion:'listarCuentasAdmin'},{headers:this.headers()}).pipe(timeout(12000)).subscribe({
      next:r=>{if(r?.status==='success')this.cuentas=Array.isArray(r.cuentas)?r.cuentas:[];else this.error=r?.mensaje||'No se pudieron cargar las cuentas.';this.refresh();},
      error:e=>{this.error=this.fallo(e);this.refresh();}
    });
  }
  restablecerClave():void{
    if(this.restableciendo || !this.cuentaElegida || this.claveTemporal.length<10)return;
    this.restableciendo=true;this.error='';this.mensaje='';
    this.http.post<any>(this.url(),{accion:'restablecerClaveAdmin',id_usuario:Number(this.cuentaElegida),nueva:this.claveTemporal},{headers:this.headers()}).pipe(timeout(12000)).subscribe({
      next:r=>{this.restableciendo=false;if(r?.status==='success'){this.mensaje=r.mensaje;this.claveTemporal='';this.cuentaElegida=0;this.cuentaSolicitanteSeleccionada='';this.cuentaSolicitanteId=0;this.cargarExtras();}else this.error=r?.mensaje||'No se pudo cambiar.';this.refresh();},
      error:e=>{this.restableciendo=false;this.error=this.fallo(e);this.refresh();}
    });
  }
  buscarCatalogo():void {this.pagina=0;this.cargar();}
  navegarPagina(p:number):void {if(p<0||p>=this.paginaMax||this.cargando)return;this.pagina=p;this.cargar();}
  cargar():void{
    this.cargando=true;this.error='';this.mensaje='';this.actual=null;this.refresh();
    this.http.post<any>(this.url(),{accion:'catalogoEditableAdmin',tabla:this.tabla,buscar:this.filtro,pagina:this.pagina},{headers:this.headers()}).pipe(timeout(12000)).subscribe({
      next:r=>{this.cargando=false;
        if(r?.status==='success'){this.registros=Array.isArray(r.registros)?r.registros:[];this.columnas=Array.isArray(r.columnas)?r.columnas:[];this.clave=r.clave_primaria||'';this.referencias=r.referencias||{};this.totalRegistros=Number(r.total||0);this.registrosPorPagina=Number(r.tam_pagina||50);}
        else this.error=r?.mensaje||'No se pudo consultar.';
        this.refresh();},
      error:e=>{this.cargando=false;this.error=this.fallo(e);this.refresh();}
    });
  }
  editar(r:Record<string,any>):void{
    this.nuevo=false;this.identificador=r[this.clave];this.actual={...r};
    for(const columna of this.editables){
      if(columna.nombre.startsWith('fk_') && this.actual[columna.nombre]!==null && this.actual[columna.nombre]!==undefined){
        const n=Number(this.actual[columna.nombre]);
        if(Number.isInteger(n) && n>0)this.actual[columna.nombre]=n;
      }
    }
    this.error='';this.mensaje='';this.refresh();
  }
  crearContrato():void{this.tabla='contratos';this.nuevo=true;this.identificador=null;this.actual={tipo_contrato:'',rol:'',funcion:'',horas_contratadas:0,fecha_inicio:'',fecha_fin:'',estatus:'activo'};this.error='';this.mensaje='';this.refresh();}
  crearReticula():void {
    if(this.tabla!=='reticulas'||this.cargando) return;
    this.nuevo=true;
    this.identificador=null;
    this.actual={nombre_reticula:'',fk_carrera:null,'año_inicio':new Date().getFullYear(),vigente:1};
    this.error='';this.mensaje='';this.mostrarFormulario();
  }
  crearGenerico():void {
    if(!this.altasDirectas.includes(this.tabla)||this.cargando)return;
    this.nuevo=true;this.identificador=null;this.actual={};
    for(const c of this.editables)this.actual[c.nombre]=c.obligatorio?'':null;
    this.error='';this.mensaje='';this.mostrarFormulario();
  }
  crearArea():void{
    this.tabla='areas';
    this.nuevo=true;
    this.identificador=null;
    this.actual={nombre_area:'',descripcion:'',fk_edificio:null};
    this.error='';this.mensaje='';this.refresh();
  }
  cancelar():void{this.actual=null;this.refresh();}
  guardar():void{
    if(this.guardando || !this.actual)return;
    this.error='';this.mensaje='';
    if(this.tabla==='contratos') {
      if(this.nuevo && (!this.actual['fk_docente'] || !this.actual['tipo_contrato'] || !this.actual['rol'] || !this.actual['fecha_inicio'])) {
        this.error='Selecciona la persona, el tipo de contratación, la responsabilidad y la fecha de inicio.';this.refresh();return;
      }
      const h=Number(this.actual['horas_contratadas']);
      if(this.actual['horas_contratadas']!==undefined && (!Number.isFinite(h)||h<0||h>80)){
        this.error='Las horas contratadas deben estar entre 0 y 80 por semana.';this.refresh();return;
      }
      if(this.actual['fecha_inicio']&&this.actual['fecha_fin']&&this.actual['fecha_fin']<this.actual['fecha_inicio']){
        this.error='La fecha de término no puede ser anterior al inicio.';this.refresh();return;
      }
    }
    if(this.tabla==='reticulas' && this.nuevo){
      const nombre=String(this.actual['nombre_reticula']||'').trim();
      const carrera=Number(this.actual['fk_carrera']);
      const anio=Number(this.actual['año_inicio']??this.actual['anio_inicio']);
      const vigente=Number(this.actual['vigente']);
      const carreraValida=(this.referencias['fk_carrera']||[]).some(r=>Number(r.valor)===carrera);
      if(nombre.length<3 || !carreraValida || !Number.isInteger(anio) || anio<1950 || anio>new Date().getFullYear()+5 || ![0,1].includes(vigente)){
        this.error='Indica el nombre del plan, selecciona una carrera existente, revisa el año de inicio y elige su vigencia.';
        this.refresh();return;
      }
      this.actual['nombre_reticula']=nombre;
      this.actual['año_inicio']=anio;
      this.actual['fk_carrera']=carrera;
      this.actual['vigente']=vigente;
    }
    if(this.tabla==='areas' && this.nuevo){
      if(!String(this.actual['nombre_area']||'').trim() || !this.actual['fk_edificio']){
        this.error='Escribe el nombre del área y selecciona el edificio al que pertenece.';this.refresh();return;
      }
    }
    this.guardando=true;
    const valores:Record<string,any>={};for(const c of this.editables){if(this.actual[c.nombre]!==undefined)valores[c.nombre]=this.actual[c.nombre];}
    let motivo_edicion='';
    if(!this.nuevo && this.tabla==='kardex'){
      const reason=window.prompt('Motivo de la corrección del Kárdex (obligatorio; queda registrado en auditoría):','');
      if(reason===null)return;
      motivo_edicion=reason.trim();
      if(motivo_edicion.length<10){this.error='Escribe un motivo de al menos 10 caracteres para modificar una nota.';this.refresh();return;}
    }
    const accion=this.nuevo?(this.tabla==='areas'?'crearAreaAdmin':this.tabla==='reticulas'?'crearReticulaAdmin':this.tabla==='contratos'?'crearContratoAdmin':'crearRegistroAdmin'):'guardarEdicionAdmin';
    this.http.post<any>(this.url(),{accion,tabla:this.tabla,id:this.identificador,valores,motivo_edicion},{headers:this.headers()}).pipe(timeout(15000)).subscribe({
      next:r=>{this.guardando=false;if(r?.status==='success'){this.mensaje=r.mensaje||'Guardado.';this.cargar();this.mensaje=r.mensaje||'Guardado.';}else this.error=r?.mensaje||'No se pudo guardar.';this.refresh();},
      error:e=>{this.guardando=false;this.error=this.fallo(e);this.refresh();}
    });
  }
}
