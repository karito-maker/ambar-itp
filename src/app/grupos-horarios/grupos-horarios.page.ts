import { Component, OnInit, ChangeDetectorRef, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { timeout } from 'rxjs';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonButton, IonItem, IonInput, IonSelect, IonSelectOption } from '@ionic/angular';

type Dia = {dia_semana:string; horas:number; hora_inicio:string};
@Component({
  selector:'app-grupos-horarios', standalone:true,
  templateUrl:'./grupos-horarios.page.html',styleUrls:['./grupos-horarios.page.scss'],
  imports:[CommonModule,FormsModule,RouterLink,IonHeader,IonToolbar,IonTitle,IonContent,IonButton,IonItem,IonInput,IonSelect,IonSelectOption]
})
export class GruposHorariosPage implements OnInit {
  grupos:any[]=[]; horarios:any[]=[]; materias:any[]=[]; docentes:any[]=[]; salones:any[]=[]; edificios:any[]=[];
  esquemaListo=true; columnasFaltantes:string[]=[]; nuevoEdificio={nombre_edificio:'',ubicacion:''}; nuevoSalon={tipo_salon:'',piso:0,fk_edificio:0};
  nuevo={id_grupo:'',capacidad:30};
  cupoActual=30;
  oferta={id_grupo:'',fk_materia:0,fk_docente:0,fk_salon:0,reemplazar:false};
  semana:Dia[]=['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'].map(d=>({dia_semana:d,horas:0,hora_inicio:'08:00'}));
  dias=['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  mensaje='';error='';cargando=false;guardando=false;mostrarTodo=false;
  seccionActiva:'infraestructura'|'grupos'|'programacion'|'horario'='infraestructura';
  irASeccion(seccion:'infraestructura'|'grupos'|'programacion'|'horario'):void{
    this.seccionActiva=seccion;
    // La página permanece en /grupos-horarios: la navegación es un desplazamiento local.
    setTimeout(()=>document.getElementById(seccion)?.scrollIntoView({behavior:'smooth',block:'start'}),0);
  }
  private pendientes=0;private carga=0;
  constructor(private http:HttpClient,private cdr:ChangeDetectorRef,private destroyRef:DestroyRef){}
  ngOnInit():void{this.cargar();}
  ionViewWillEnter():void{this.cargar();}
  private refresh():void{this.cdr.markForCheck();queueMicrotask(()=>{if(!this.destroyRef.destroyed)this.cdr.detectChanges();});}
  private url():string{
    const server=sessionStorage.getItem('ambar_servidor')||(Capacitor.getPlatform()==='android'?'10.0.2.2':'localhost');
    return `http://${server.trim()}/api_ionic/registro.php`;
  }
  private headers():HttpHeaders{
    let token='';try{token=JSON.parse(sessionStorage.getItem('ambar_sesion')||'{}').token||'';}catch{}
    return new HttpHeaders({Authorization:`Bearer ${token}`});
  }
  private errorMsg(e:any):string{
    if(e?.status===401||e?.status===403)return 'Tu sesión venció o no tienes permisos de Administración.';
    if(e?.status===0)return 'No se pudo conectar con PHP. Comprueba XAMPP y el servidor.';
    return e?.error?.mensaje||'No fue posible completar la operación.';
  }
  private consultar(accion:string,alRecibir:(r:any)=>void,actual:number):void{
    this.http.post<any>(this.url(),{accion},{headers:this.headers()}).pipe(timeout(20000)).subscribe({
      next:r=>{
        if(actual!==this.carga)return;
        if(r?.status==='success')alRecibir(r);
        else this.error=r?.mensaje||'No se pudo cargar el catálogo.';
        this.pendientes--;this.cargando=this.pendientes>0;this.refresh();
      },
      error:e=>{
        if(actual!==this.carga)return;
        this.error=this.errorMsg(e);this.pendientes--;this.cargando=this.pendientes>0;this.refresh();
      }
    });
  }
  cargar():void{
    this.cargando=true;this.error='';this.pendientes=5;const id=++this.carga;this.refresh();
    this.consultar('listarOrganizacionGrupos',r=>{this.grupos=r.grupos||[];this.horarios=r.horarios||[];this.esquemaListo=r.esquema_listo===true;this.columnasFaltantes=r.columnas_faltantes||[];},id);
    this.consultar('listarMaterias',r=>{this.materias=[...new Map((r.materias||[]).map((m:any)=>[Number(m.id_materia),m])).values()];},id);
    this.consultar('listarDocentes',r=>{this.docentes=r.docentes||[];},id);
    this.consultar('listarSalones',r=>{this.salones=r.salones||[];},id);
    this.consultar('listarEdificios',r=>{this.edificios=r.edificios||[];},id);
  }
  get grupoSeleccionado():any{return this.grupos.find(g=>g.id_grupo===this.oferta.id_grupo);}
  get materiaSeleccionada():any{return this.materias.find(m=>Number(m.id_materia)===Number(this.oferta.fk_materia));}
  get creditos():number{return Number(this.materiaSeleccionada?.creditos||0);}
  get horasProgramadas():number{return this.semana.reduce((n,s)=>n+Number(s.horas||0),0);}
  get horariosDelGrupo():any[]{return this.horarios.filter(h=>String(h.fk_grupo)===this.oferta.id_grupo);}
  get materiasDelGrupo():any[]{
    const map=new Map<number,any>();for(const h of this.horariosDelGrupo){
      const id=Number(h.fk_materia);if(id<=0)continue;if(!map.has(id))map.set(id,{...h,sesiones:0});map.get(id).sesiones++;
    }return [...map.values()].sort((a,b)=>String(a.nombre_materia).localeCompare(String(b.nombre_materia),'es'));
  }
  get horarioMateriaActual():any[]{return this.horariosDelGrupo.filter(h=>Number(h.fk_materia)===Number(this.oferta.fk_materia));}
  get horarioOrdenado():any[]{
    const dia=(v:string)=>this.dias.indexOf(v);
    return [...this.horariosDelGrupo].sort((a,b)=>dia(a.dia_semana)-dia(b.dia_semana)||String(a.hora_inicio).localeCompare(String(b.hora_inicio)));
  }
  get horariosSinVincular():any[]{return this.horariosDelGrupo.filter(h=>!Number(h.fk_materia)||!Number(h.fk_docente));}
  get horariosConMateria():any[]{return this.horarioOrdenado.filter(h=>Number(h.fk_materia)>0&&Number(h.fk_docente)>0);}
  get horarioVisible():any[]{return this.mostrarTodo?this.horarios:this.horarioOrdenado;}
  /** Advertencia inmediata; el servidor repite esta validación dentro de una transacción. */
  get avisoEmpalmeSemana():string{
    if(!this.oferta.id_grupo || !this.oferta.fk_materia || !this.oferta.fk_docente || !this.oferta.fk_salon)return '';
    for(const dia of this.semana.filter(d=>Number(d.horas)>0)){
      const fin=this.minutos(dia.hora_inicio,Number(dia.horas));
      if(!fin)return 'La hora final no es válida.';
      for(const existente of this.horarios){
        if(existente.dia_semana!==dia.dia_semana)continue;
        if(this.oferta.reemplazar && String(existente.fk_grupo)===this.oferta.id_grupo && Number(existente.fk_materia)===Number(this.oferta.fk_materia))continue;
        const inicioPrevio=String(existente.hora_inicio||'').slice(0,5);
        const finPrevio=String(existente.hora_fin||'').slice(0,5);
        if(dia.hora_inicio>=finPrevio || fin<=inicioPrevio)continue;
        if(String(existente.fk_grupo)===this.oferta.id_grupo)return `El grupo ${this.oferta.id_grupo} ya tiene clase el ${dia.dia_semana} de ${inicioPrevio} a ${finPrevio}.`;
        if(Number(existente.fk_docente)===Number(this.oferta.fk_docente))return `El docente ya tiene clase el ${dia.dia_semana} de ${inicioPrevio} a ${finPrevio}.`;
        if(Number(existente.fk_salon)===Number(this.oferta.fk_salon))return `El salón está ocupado el ${dia.dia_semana} de ${inicioPrevio} a ${finPrevio}.`;
      }
    }
    return '';
  }
  get puedeGuardarSemana():boolean{
    return this.esquemaListo && !!this.oferta.id_grupo && !!this.oferta.fk_materia &&
      !!this.oferta.fk_docente && !!this.oferta.fk_salon &&
      this.horasProgramadas === this.creditos && this.creditos > 0 &&
      !this.avisoEmpalmeSemana && (this.horarioMateriaActual.length === 0 || this.oferta.reemplazar) && !this.guardando;
  }
  get patronesDisponibles():{codigo:string;etiqueta:string;horas:number[]}[]{
    const c=this.creditos;
    if(c===4)return [{codigo:'LM',etiqueta:'Lunes y miércoles',horas:[2,2]},{codigo:'MJ',etiqueta:'Martes y jueves',horas:[2,2]},{codigo:'LMV',etiqueta:'Lunes, miércoles y viernes',horas:[2,1,1]}];
    if(c===5)return [{codigo:'LMV',etiqueta:'Lunes, miércoles y viernes',horas:[2,2,1]},{codigo:'MJV',etiqueta:'Martes, jueves y viernes',horas:[2,2,1]},{codigo:'LM',etiqueta:'Lunes y miércoles',horas:[3,2]},{codigo:'MJ',etiqueta:'Martes y jueves',horas:[3,2]}];
    if(c===6)return [{codigo:'LMV',etiqueta:'Lunes, miércoles y viernes',horas:[2,2,2]},{codigo:'MJV',etiqueta:'Martes, jueves y viernes',horas:[2,2,2]},{codigo:'LM',etiqueta:'Lunes y miércoles',horas:[3,3]},{codigo:'MJ',etiqueta:'Martes y jueves',horas:[3,3]}];
    return [];
  }
  get capacidadValida():boolean{return Number.isInteger(Number(this.nuevo.capacidad))&&Number(this.nuevo.capacidad)>=1&&Number(this.nuevo.capacidad)<=30;}
  normalizarCapacidad():void{const v=Number(this.nuevo.capacidad);this.nuevo.capacidad=Number.isFinite(v)?Math.min(30,Math.max(1,Math.trunc(v))):30;this.refresh();}
  seleccionarGrupo():void{this.cupoActual=Number(this.grupoSeleccionado?.capacidad||30);this.oferta.fk_materia=0;this.oferta.fk_docente=0;this.oferta.fk_salon=0;this.oferta.reemplazar=false;this.limpiarHoras();}
  elegirMateria():void{
    this.oferta.reemplazar=false;
    this.limpiarHoras();
    const existentes=this.horarioMateriaActual;
    if(existentes.length){
      // Al editar una materia, mostrar su distribución guardada en vez de obligar a capturarla otra vez.
      this.oferta.fk_docente=Number(existentes[0].fk_docente);
      this.oferta.fk_salon=Number(existentes[0].fk_salon);
      for(const h of existentes){
        const dia=this.semana.find(s=>s.dia_semana===h.dia_semana);
        if(!dia)continue;
        const ini=String(h.hora_inicio).split(':').map(Number);
        const fin=String(h.hora_fin).split(':').map(Number);
        const duracion=(fin[0]*60+fin[1]-ini[0]*60-ini[1])/60;
        if(Number.isInteger(duracion)&&duracion>=1&&duracion<=4){
          dia.horas=duracion;
          dia.hora_inicio=String(h.hora_inicio).slice(0,5);
        }
      }
    } else {
      this.oferta.fk_docente=0;
      this.oferta.fk_salon=0;
    }
    this.refresh();
  }
  limpiarHoras():void{for(const d of this.semana){d.horas=0;d.hora_inicio='08:00';}}
  aplicarPatron(patron:string):void{
    const item=this.patronesDisponibles.find(p=>p.codigo===patron);if(!item)return;
    this.limpiarHoras();
    const dias=patron==='LM'||patron==='LMV'?['Lunes','Miércoles',...(patron==='LMV'?['Viernes']:[])]:patron==='MJ'?['Martes','Jueves']:['Martes','Jueves','Viernes'];
    dias.forEach((dia,i)=>{const s=this.semana.find(x=>x.dia_semana===dia);if(s)s.horas=item.horas[i];});
    this.refresh();
  }
  minutos(inicio:string,horas:number):string{
    const [h,m]=(inicio||'').split(':').map(Number);if(!Number.isFinite(h)||!Number.isFinite(m))return '';
    const fin=h*60+m+horas*60;if(fin>1439)return '';
    return `${String(Math.floor(fin/60)).padStart(2,'0')}:${String(fin%60).padStart(2,'0')}`;
  }
  enviar(accion:string,data:any):void{
    if(this.guardando)return;
    this.guardando=true;this.error='';this.mensaje='';this.refresh();
    this.http.post<any>(this.url(),{accion,...data},{headers:this.headers()}).pipe(timeout(20000)).subscribe({
      next:r=>{
        this.guardando=false;
        if(r?.status==='success'){
          this.mensaje=r.mensaje||'Guardado correctamente.';
          if(accion==='crearGrupoOrganizacion')this.oferta.id_grupo=String(this.nuevo.id_grupo).trim().toUpperCase();
          if(accion==='registrarEdificio')this.nuevoEdificio={nombre_edificio:'',ubicacion:''};
          if(accion==='registrarSalon')this.nuevoSalon={tipo_salon:'',piso:0,fk_edificio:this.nuevoSalon.fk_edificio};
          if(accion==='prepararEsquemaHorarios')this.esquemaListo=true;
          this.cargar();
        }else this.error=r?.mensaje||'No se pudo guardar.';
        this.refresh();
      },
      error:e=>{this.guardando=false;this.error=this.errorMsg(e);this.refresh();}
    });
  }
  habilitarHorarios():void{
    if(this.esquemaListo)return;
    if(!confirm('Antes de continuar, exporta un respaldo de la base ionic en phpMyAdmin. ¿Ya tienes el respaldo y autorizas agregar dos columnas a horarios SIN eliminar registros?'))return;
    this.enviar('prepararEsquemaHorarios',{confirmacion:'HABILITAR-HORARIOS'});
  }
  crearEdificio():void{
    const nombre=this.nuevoEdificio.nombre_edificio.trim();
    if(!nombre){this.error='Escribe el nombre del edificio.';return;}
    this.enviar('registrarEdificio',{nombre_edificio:nombre,ubicacion:this.nuevoEdificio.ubicacion.trim()});
  }
  crearSalon():void{
    if(!this.nuevoSalon.tipo_salon.trim()||!this.nuevoSalon.fk_edificio){this.error='Selecciona edificio y escribe el nombre del salón.';return;}
    this.enviar('registrarSalon',this.nuevoSalon);
  }
  vincularSesion(h:any):void{
    if(!this.esquemaListo||!h?.id_horario||!this.oferta.fk_materia||!this.oferta.fk_docente){this.error='Elige materia y docente en la sección de asignaturas antes de vincular esta sesión.';return;}
    if(!confirm('¿Vincular esta sesión anterior a la materia y docente seleccionados? No se cambiarán los días, la hora ni el salón.'))return;
    this.enviar('vincularSesionAnterior',{id_horario:h.id_horario,fk_materia:this.oferta.fk_materia,fk_docente:this.oferta.fk_docente});
  }
  crearGrupo():void{
    const id=this.nuevo.id_grupo.trim().toUpperCase();
    if(!/^[A-Z0-9-]{1,10}$/.test(id)||!this.capacidadValida){this.error='Escribe una clave de hasta 10 caracteres y capacidad máxima de 30.';return;}
    if(this.grupos.some(g=>g.id_grupo===id)){this.error='La clave ya existe. Selecciona el grupo para agregar sus materias.';return;}
    this.enviar('crearGrupoOrganizacion',{id_grupo:id,capacidad:this.nuevo.capacidad});
  }
  guardarCapacidad():void{
    const cupo=Number(this.cupoActual);if(!Number.isInteger(cupo)||cupo<1||cupo>30){this.error='La capacidad debe estar entre 1 y 30.';return;}
    this.enviar('actualizarCapacidadGrupo',{id_grupo:this.oferta.id_grupo,capacidad:cupo});
  }
  guardarSemana():void{
    if(!this.esquemaListo){this.error='Habilita primero los horarios multimateria con un respaldo de MySQL.';return;}
    if(!this.oferta.id_grupo||!this.oferta.fk_materia||!this.oferta.fk_docente||!this.oferta.fk_salon){this.error='Selecciona grupo, materia, docente y salón.';return;}
    if(this.avisoEmpalmeSemana){this.error=this.avisoEmpalmeSemana;return;}
    if(this.horarioMateriaActual.length && !this.oferta.reemplazar){this.error='Para actualizar una materia existente, confirma primero el reemplazo de su propio horario.';return;}
    const elegidas=this.semana.filter(d=>Number(d.horas)>0);
    if(!elegidas.length||elegidas.length>6||this.horasProgramadas!==this.creditos){this.error=`Las horas semanales deben sumar exactamente ${this.creditos} créditos.`;return;}
    const sesiones=elegidas.map(d=>({dia_semana:d.dia_semana,hora_inicio:d.hora_inicio,hora_fin:this.minutos(d.hora_inicio,Number(d.horas))}));
    if(sesiones.some(s=>!s.hora_fin)){this.error='Las sesiones deben terminar el mismo día. Revisa las horas de inicio.';return;}
    this.enviar('guardarMateriaGrupoSemana',{...this.oferta,sesiones});
  }
  retirarMateria(m:any):void{
    if(!this.oferta.id_grupo||!m?.fk_materia)return;
    if(!confirm(`¿Quitar las sesiones de ${m.nombre_materia} del grupo ${this.oferta.id_grupo}? Las otras materias permanecen intactas.`))return;
    this.enviar('eliminarMateriaGrupoSemana',{id_grupo:this.oferta.id_grupo,fk_materia:m.fk_materia});
  }
}
