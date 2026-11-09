import { Component, OnInit, ChangeDetectorRef, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { RouterLink, Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { timeout } from 'rxjs';
import { IonContent, IonHeader, IonTitle, IonToolbar, IonItem, IonInput, IonSelect, IonSelectOption, IonButton } from '@ionic/angular';

interface Carrera { id: number; nombre: string; }
interface Reticula { id_reticula: number; nombre_reticula: string; anio_inicio: number; }
interface Alumno { n_control: string; nombres: string; apellido_paterno: string; apellido_materno: string; semestre_actual: number; estatus: string; nombre_carrera: string; nombre_reticula: string; acceso_habilitado?: number | string; }
interface Expediente { alumno: any; materias_reticula: any[]; kardex: any[]; }

@Component({ selector:'app-gestion-alumnos', templateUrl:'./gestion-alumnos.page.html', styleUrls:['./gestion-alumnos.page.scss'], standalone:true,
  imports:[CommonModule,FormsModule,RouterLink,IonContent,IonHeader,IonTitle,IonToolbar,IonItem,IonInput,IonSelect,IonSelectOption,IonButton] })
export class GestionAlumnosPage implements OnInit {
  alumnos: Alumno[] = []; busquedaAlumno = ''; carreras: Carrera[] = []; reticulas: Reticula[] = [];
  form = { n_control:'', nombres:'', apellido_paterno:'', apellido_materno:'', fecha_nacimiento:'', fecha_ingreso:'', semestre_actual:1, estatus:'activo', fk_carrera:0, fk_reticula:0 };
  acceso = { n_control:'', contra:'' };
  confirmarAcceso = '';
  activandoAcceso = false;
  mensajeAcceso = '';
  errorAcceso = '';
  expediente: Expediente | null = null; controlSeleccionado=''; cargando=false; guardando=false; cargandoDetalle=false; mensaje=''; error='';
  // Búsqueda local; no altera datos ni requiere modificar MySQL.
  get alumnosFiltrados(): Alumno[] {
    const normalizar = (texto: unknown): string => String(texto ?? '').toLocaleLowerCase('es')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const q = normalizar(this.busquedaAlumno.trim());
    if (!q) return this.alumnos;
    return this.alumnos.filter(a => normalizar([
      a.n_control, a.nombres, a.apellido_paterno, a.apellido_materno,
      a.nombre_carrera, a.nombre_reticula, a.semestre_actual
    ].join(' ')).includes(q));
  }
  private consulta = 0;
  constructor(private http: HttpClient, private router:Router, private cdr: ChangeDetectorRef, private destroyRef: DestroyRef) {}
  private refrescar(): void { this.cdr.markForCheck(); queueMicrotask(() => { if (!this.destroyRef.destroyed) this.cdr.detectChanges(); }); }
  ngOnInit():void { this.cargar(); }
  ionViewWillEnter():void { this.cargar(); }
  private url():string { const s=sessionStorage.getItem('ambar_servidor') || (Capacitor.getPlatform()==='android'?'10.0.2.2':'localhost');return `http://${s.trim()}/api_ionic/registro.php`; }
  private headers():HttpHeaders {let t='';try{t=JSON.parse(sessionStorage.getItem('ambar_sesion')||'{}').token||'';}catch{}return new HttpHeaders({Authorization:`Bearer ${t}`});}
  private aviso(error:any):string {
    if(error?.name === 'TimeoutError')return 'La consulta tardó demasiado; revisa Apache y MySQL.';
    if(error?.status === 401 || error?.status === 403)return 'Sesión caducada o sin permisos. Inicia sesión otra vez.';
    if(error?.status === 0)return 'No se pudo comunicar con el servidor PHP. Revisa XAMPP y la dirección del servidor.';
    return error?.error?.mensaje||'No se pudo conectar con el servidor.';
  }
  cargar(): void {
    const actual = ++this.consulta;
    this.cargando = true; this.error = ''; this.refrescar();
    this.http.post<any>(this.url(), {accion:'listarCarreras'}).pipe(timeout(12000)).subscribe({
      next:r=> { if(actual !== this.consulta)return; this.carreras=Array.isArray(r?.carreras)?r.carreras:[]; this.refrescar(); },
      error:e=> { if(actual !== this.consulta)return; this.error=this.aviso(e); this.refrescar(); }
    });
    this.http.post<any>(this.url(), {accion:'listarAlumnos'}, {headers:this.headers()}).pipe(timeout(12000)).subscribe({
      next:r=> {
        if(actual !== this.consulta)return;
        this.cargando=false; this.alumnos=Array.isArray(r?.alumnos)?r.alumnos:[];
        if(r?.status !== 'success') this.error=r?.mensaje||'Error consultando alumnos.';
        this.refrescar();
      },
      error:e=> { if(actual !== this.consulta)return; this.cargando=false; this.error=this.aviso(e); this.refrescar(); }
    });
  }
  cargarReticulas():void {
    this.form.fk_reticula=0;this.reticulas=[];
    if(!this.form.fk_carrera)return;
    this.http.post<any>(this.url(),{accion:'listarReticulas',fk_carrera:Number(this.form.fk_carrera)})
      .pipe(timeout(12000)).subscribe({
        next:r=>{this.reticulas=Array.isArray(r?.reticulas)?r.reticulas:[];this.refrescar();},
        error:e=>{this.error=this.aviso(e);this.refrescar();}
      });
  }
  guardar():void {this.mensaje='';this.error='';if(this.guardando)return;
    const f = this.form;
    if (!/^[A-Za-z0-9-]{3,20}$/.test(f.n_control.trim()) || !f.nombres.trim() ||
        !f.apellido_paterno.trim() || !f.apellido_materno.trim() ||
        f.nombres.trim().length > 100 || f.apellido_paterno.trim().length > 70 || f.apellido_materno.trim().length > 70) {
      this.error = 'Completa el número de control (3–20 caracteres), nombres y apellidos.'; return;
    }
    const ahora = new Date();
    const hoy = `${ahora.getFullYear()}-${String(ahora.getMonth()+1).padStart(2,'0')}-${String(ahora.getDate()).padStart(2,'0')}`;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.fecha_nacimiento) || !/^\d{4}-\d{2}-\d{2}$/.test(f.fecha_ingreso) ||
        f.fecha_nacimiento >= f.fecha_ingreso || f.fecha_ingreso > hoy) {
      this.error = 'Revisa las fechas: el ingreso debe ser posterior al nacimiento y no estar en el futuro.'; return;
    }
    if (!Number.isInteger(Number(f.semestre_actual)) || Number(f.semestre_actual) < 1 || Number(f.semestre_actual) > 12 ||
        !['activo','inactivo'].includes(f.estatus) ||
        !this.carreras.some(c=>Number(c.id)===Number(f.fk_carrera)) ||
        !this.reticulas.some(r=>Number(r.id_reticula)===Number(f.fk_reticula))) {
      this.error = 'Selecciona un semestre del 1 al 12, estatus, carrera y retícula válida.'; return;
    }
    this.guardando=true;this.http.post<any>(this.url(),{accion:'registrarAlumno',...this.form,fk_carrera:Number(this.form.fk_carrera),fk_reticula:Number(this.form.fk_reticula),semestre_actual:Number(this.form.semestre_actual)},{headers:this.headers()}).pipe(timeout(15000)).subscribe({next:r=>{this.guardando=false;if(r.status==='success'){this.mensaje=r.mensaje||'Alumno guardado.';this.form={n_control:'',nombres:'',apellido_paterno:'',apellido_materno:'',fecha_nacimiento:'',fecha_ingreso:'',semestre_actual:1,estatus:'activo',fk_carrera:0,fk_reticula:0};this.reticulas=[];this.cargar();}else this.error=r.mensaje||'No se pudo registrar.';this.refrescar();},error:e=>{this.guardando=false;this.error=this.aviso(e);this.refrescar();}}); }
  consultar(control:string):void {this.controlSeleccionado=control;this.expediente=null;this.cargandoDetalle=true;this.http.post<any>(this.url(),{accion:'consultarExpediente',n_control:control},{headers:this.headers()}).pipe(timeout(12000)).subscribe({next:r=>{this.cargandoDetalle=false;if(r.status==='success')this.expediente=r;else this.error=r.mensaje||'No se pudo abrir el expediente';this.refrescar();},error:e=>{this.cargandoDetalle=false;this.error=this.aviso(e);this.refrescar();}}); }
  habilitarAcceso():void { this.enviarCuentaAlumno('habilitarAccesoAlumno'); }
  restablecerAcceso():void { this.enviarCuentaAlumno('restablecerAccesoAlumno'); }
  private enviarCuentaAlumno(accion: 'habilitarAccesoAlumno' | 'restablecerAccesoAlumno'): void {
    this.mensajeAcceso = ''; this.errorAcceso = '';
    if (this.activandoAcceso) return;
    const a = this.alumnos.find(x => x.n_control === this.acceso.n_control);
    if (!a || a.estatus !== 'activo' ||
        !this.acceso.contra || this.acceso.contra.length < 8 ||
        this.acceso.contra.length > 128) {
      this.errorAcceso = 'Selecciona un alumno activo y una contraseña entre 8 y 128 caracteres.';
      return;
    }
    if (this.acceso.contra !== this.confirmarAcceso) {
      this.errorAcceso = 'Las contraseñas no coinciden.';
      return;
    }
    const habilitado = Number(a.acceso_habilitado) === 1;
    if (accion === 'habilitarAccesoAlumno' && habilitado) {
      this.errorAcceso = 'Esta cuenta ya existe. Usa Restablecer contraseña.';
      return;
    }
    if (accion === 'restablecerAccesoAlumno' && !habilitado) {
      this.errorAcceso = 'Esta cuenta aún no existe. Usa Habilitar acceso.';
      return;
    }
    if (accion === 'restablecerAccesoAlumno' && !window.confirm(
      `¿Restablecer la contraseña de ${a.nombres} ${a.apellido_paterno} (${a.n_control})? La contraseña anterior dejará de ser válida.`
    )) return;
    this.activandoAcceso = true;
    this.http.post<any>(this.url(), {accion, ...this.acceso},
      {headers:this.headers()}).pipe(timeout(15000)).subscribe({
      next:r=>{
        this.activandoAcceso = false;
        if (r.status === 'success') {
          this.mensajeAcceso = r.mensaje || 'Cuenta actualizada.';
          this.acceso={n_control:'',contra:''}; this.confirmarAcceso='';
          this.cargar();
        } else this.errorAcceso = r.mensaje || 'No se pudo actualizar la cuenta.';
        this.refrescar();
      },
      error:e=>{this.activandoAcceso = false; this.errorAcceso=this.aviso(e); this.refrescar();}
    });
  }
  cerrarDetalle():void{this.expediente=null;this.controlSeleccionado='';}
}
