import { Component, OnInit, ChangeDetectorRef, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { timeout } from 'rxjs';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonButton, IonItem, IonInput, IonSelect, IonSelectOption } from '@ionic/angular';

interface Carrera { id: number; nombre: string; }
interface Reticula { id_reticula: number; nombre_reticula: string; anio_inicio: number; }
interface Materia { id_materia: number; nombre_materia: string; nombre_reticula: string; carrera: string; fk_reticula: number; fk_prerrequisito: number | null; semestre: number; creditos: number; horas_teoria: number | null; horas_practica: number | null; }

@Component({
  selector: 'app-materias', templateUrl: './materias.page.html',
  styleUrls: ['./materias.page.scss'], standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, IonHeader, IonToolbar, IonTitle,
    IonContent, IonButton, IonItem, IonInput, IonSelect, IonSelectOption]
})
export class MateriasPage implements OnInit {
  materias: Materia[] = [];
  carreras: Carrera[] = [];
  reticulas: Reticula[] = [];
  cargando = false;
  guardando = false;
  mensaje = '';
  error = '';
  errorCarga = '';
  private consulta = 0;

  form = { nombre_materia: '', creditos: 5, semestre: 1, horas_teoria: 4, horas_practica: 2, fk_carrera: 0, fk_reticula: 0, es_cadena: false, fk_prerrequisito: 0 };
  // Si falta la materia antecedente, guardamos el formulario actual en memoria y
  // lo recuperamos al dar de alta la materia anterior. Nada se simula en MySQL.
  borradorDependiente: typeof this.form | null = null;
  get creandoAntecedente(): boolean { return this.borradorDependiente !== null; }
  registrarAntecedentePrimero(): void {
    if (!this.form.fk_reticula || !this.form.fk_carrera) {
      this.error = 'Primero selecciona la carrera y el plan de estudios.';this.refrescar();return;
    }
    if (Number(this.form.semestre) < 2) {
      this.error = 'Una materia de primer semestre no puede depender de una de un semestre anterior.';this.refrescar();return;
    }
    this.borradorDependiente = { ...this.form };
    this.form = { ...this.form,
      nombre_materia:'', semestre:Number(this.form.semestre)-1,
      es_cadena:false, fk_prerrequisito:0
    };
    this.error='';
    this.mensaje='Escribe los datos de la materia anterior y guárdala. Después volverás automáticamente a la materia dependiente.';
    this.refrescar();
  }
  cancelarAntecedente():void {
    if (!this.borradorDependiente) return;
    this.form={...this.borradorDependiente};this.borradorDependiente=null;
    this.mensaje='Volviste a la materia dependiente.';this.error='';this.refrescar();
  }

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef, private destroyRef: DestroyRef) {}
  ngOnInit(): void { this.cargar(); }
  ionViewWillEnter(): void { this.cargar(); }

  private refrescar(): void {
    this.cdr.markForCheck();
    queueMicrotask(() => { if (!this.destroyRef.destroyed) this.cdr.detectChanges(); });
  }
  private url(): string {
    const s = sessionStorage.getItem('ambar_servidor') ||
      (Capacitor.getPlatform() === 'android' ? '10.0.2.2' : 'localhost');
    return `http://${s.trim()}/api_ionic/registro.php`;
  }
  private headers(): HttpHeaders {
    let t = '';
    try { t = JSON.parse(sessionStorage.getItem('ambar_sesion') || '{}').token || ''; }
    catch { /* sesion no disponible */ }
    return new HttpHeaders({ Authorization: `Bearer ${t}` });
  }
  private fallo(e: any): string {
    if (e?.name === 'TimeoutError') return 'La consulta tardó demasiado. Revisa Apache y MySQL e intenta Actualizar.';
    if (e?.status === 401 || e?.status === 403) return 'La sesión caducó o no tiene permisos. Cierra sesión y vuelve a iniciar.';
    if (e?.status === 0) return 'No se pudo comunicar con PHP. Revisa el campo Servidor y que Apache esté encendido.';
    return e?.error?.mensaje || 'No fue posible conectar con el servidor.';
  }

  cargar(): void {
    const actual = ++this.consulta;
    this.cargando = true;
    this.errorCarga = '';
    this.refrescar();

    this.http.post<any>(this.url(), { accion: 'listarCarreras' })
      .pipe(timeout(12000)).subscribe({
        next: r => {
          if (actual !== this.consulta) return;
          if (r?.status === 'success') this.carreras = Array.isArray(r.carreras) ? r.carreras : [];
          else this.errorCarga = r?.mensaje || 'No se pudieron consultar las carreras.';
          this.refrescar();
        },
        error: e => { if (actual !== this.consulta) return; this.errorCarga = this.fallo(e); this.refrescar(); }
      });

    this.http.post<any>(this.url(), { accion: 'listarMaterias' }, { headers: this.headers() })
      .pipe(timeout(12000)).subscribe({
        next: r => {
          if (actual !== this.consulta) return;
          this.cargando = false;
          if (r?.status === 'success') this.materias = Array.isArray(r.materias) ? r.materias : [];
          else this.errorCarga = r?.mensaje || 'No se pudo consultar materias.';
          this.refrescar();
        },
        error: e => { if (actual !== this.consulta) return; this.cargando = false; this.errorCarga = this.fallo(e); this.refrescar(); }
      });
  }

  get prerrequisitosDisponibles(): Materia[] {
    return this.materias.filter(m=>Number(m.fk_reticula)===Number(this.form.fk_reticula) &&
      Number(m.semestre)<Number(this.form.semestre));
  }
  get nombrePrerrequisito():string {return this.form.es_cadena?'Sí, requiere aprobar una materia previa':'No tiene materia previa obligatoria';}

  cargarReticulas(): void {
    this.form.fk_reticula = 0;
    this.form.fk_prerrequisito = 0;
    this.reticulas = [];
    if (!this.form.fk_carrera) return;
    this.http.post<any>(this.url(), { accion: 'listarReticulas', fk_carrera: Number(this.form.fk_carrera) })
      .pipe(timeout(12000)).subscribe({
        next: r => { this.reticulas = Array.isArray(r?.reticulas) ? r.reticulas : []; this.refrescar(); },
        error: e => { this.error = this.fallo(e); this.refrescar(); }
      });
  }

  guardar(): void {
    if (this.guardando) return;
    this.error = ''; this.mensaje = '';
    const f = this.form;
    if (!f.nombre_materia.trim() || f.nombre_materia.trim().length > 120 ||
        !this.carreras.some(c => Number(c.id) === Number(f.fk_carrera)) ||
        !this.reticulas.some(r => Number(r.id_reticula) === Number(f.fk_reticula)) ||
        !Number.isInteger(Number(f.creditos)) || Number(f.creditos) < 1 || Number(f.creditos) > 50 ||
        !Number.isInteger(Number(f.semestre)) || Number(f.semestre) < 1 || Number(f.semestre) > 12 ||
        !Number.isInteger(Number(f.horas_teoria)) || Number(f.horas_teoria) < 0 || Number(f.horas_teoria) > 50 ||
        !Number.isInteger(Number(f.horas_practica)) || Number(f.horas_practica) < 0 || Number(f.horas_practica) > 50) {
      this.error = 'Completa materia, carrera, retícula, semestre (1–12), créditos (1–50) y horas (0–50).'; return;
    }
    if(f.es_cadena && !this.prerrequisitosDisponibles.some(m=>Number(m.id_materia)===Number(f.fk_prerrequisito))) {
      this.error='Selecciona la materia previa de la misma retícula y un semestre anterior.';return;
    }
    this.guardando = true;
    this.refrescar();
    this.http.post<any>(this.url(), {
      accion: 'registrarMateria', nombre_materia: f.nombre_materia.trim(), creditos: Number(f.creditos),
      semestre: Number(f.semestre), horas_teoria: Number(f.horas_teoria), horas_practica: Number(f.horas_practica), 
      fk_reticula: Number(f.fk_reticula),
      fk_prerrequisito: f.es_cadena ? Number(f.fk_prerrequisito) : null
    }, { headers: this.headers() }).pipe(timeout(15000)).subscribe({
      next: r => {
        this.guardando = false;
        if (r?.status === 'success') {
          this.mensaje = r.mensaje || 'Materia registrada.';
          if (this.borradorDependiente) {
            const idCreado = Number(r.id_materia || 0);
            this.form = { ...this.borradorDependiente,
              fk_prerrequisito: Number.isInteger(idCreado) && idCreado > 0 ? idCreado : 0 };
            this.borradorDependiente = null;
            this.mensaje = idCreado > 0
              ? 'Materia anterior registrada. Recuperamos tu formulario; ahora registra la materia dependiente.'
              : 'Materia anterior registrada. Recuperamos tu formulario; selecciónala como prerrequisito.';
          } else {
            this.form.nombre_materia = '';this.form.es_cadena = false;this.form.fk_prerrequisito=0;
          }
          this.cargar();
        } else this.error = r?.mensaje || 'No se pudo registrar.';
        this.refrescar();
      },
      error: e => { this.guardando = false; this.error = this.fallo(e); this.refrescar(); }
    });
  }
}
