import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonButton, IonItem, IonInput, IonSelect, IonSelectOption } from '@ionic/angular';
@Component({selector:'app-grupos-horarios',templateUrl:'./grupos-horarios.page.html',styleUrls:['./grupos-horarios.page.scss'],standalone:true,imports:[CommonModule,FormsModule,RouterLink,IonHeader,IonToolbar,IonTitle,IonContent,IonButton,IonItem,IonInput,IonSelect,IonSelectOption]})
export class GruposHorariosPage implements OnInit {
 edificios:any[]=[];salones:any[]=[];grupos:any[]=[];horarios:any[]=[];docentes:any[]=[];materias:any[]=[];
 formEdificio={nombre_edificio:'',ubicacion:''};formSalon={tipo_salon:'',piso:1,fk_edificio:0};
 formGrupo={fk_materia:0,fk_docente:0,capacidad:30};formHorario={fk_grupo:0,fk_salon:0,dia_semana:'Lunes',hora_inicio:'08:00',hora_fin:'10:00'};
 guardando='';cargando=false;mensaje='';error='';
 dias=['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
 constructor(private http:HttpClient){}
 ngOnInit():void{this.cargar();}ionViewWillEnter():void{this.cargar();}
 private url():string{const s=sessionStorage.getItem('ambar_servidor')||(Capacitor.getPlatform()==='android'?'10.0.2.2':'localhost');return `http://${s.trim()}/api_ionic/registro.php`;}
 private headers():HttpHeaders{let t='';try{t=JSON.parse(sessionStorage.getItem('ambar_sesion')||'{}').token||'';}catch{}return new HttpHeaders({Authorization:`Bearer ${t}`});}
 private fallo(e:any):string{return e?.error?.mensaje||'No se pudo conectar con el servidor.';}
 private obtener(accion:string,campo:'edificios'|'salones'|'grupos'|'horarios'|'docentes'|'materias'):void {this.http.post<any>(this.url(),{accion},{headers:this.headers()}).subscribe({next:r=>{if(r.status==='success'){this[campo]=r[campo]||[];}else this.error=r.mensaje||'Error en catálogo';this.cargando=false;},error:e=>{this.error=this.fallo(e);this.cargando=false;}});}
 cargar():void{this.cargando=true;this.error='';this.obtener('listarEdificios','edificios');this.obtener('listarSalones','salones');this.obtener('listarGruposAdmin','grupos');this.obtener('listarHorariosAdmin','horarios');this.obtener('listarDocentes','docentes');this.obtener('listarMaterias','materias');}
 guardar(accion:string,datos:object):void{
   if(this.guardando)return;
   this.mensaje='';this.error='';
   const entero = (n:unknown,min:number,max:number) => Number.isInteger(Number(n)) && Number(n)>=min && Number(n)<=max && n!==null && n!=='';
   if (accion==='registrarEdificio' && (!this.formEdificio.nombre_edificio.trim() || this.formEdificio.nombre_edificio.trim().length>100 || this.formEdificio.ubicacion.trim().length>255)) {
     this.error='El nombre del edificio es obligatorio (máximo 100 caracteres).'; return;
   }
   if (accion==='registrarSalon' && (!this.formSalon.tipo_salon.trim() || this.formSalon.tipo_salon.trim().length>60 ||
       !entero(this.formSalon.piso,-10,100) || !this.edificios.some(e=>Number(e.id_edificio)===Number(this.formSalon.fk_edificio)))) {
     this.error='Selecciona edificio y completa el salón y piso válidos.'; return;
   }
   if (accion==='registrarGrupo' && (!this.materias.some(m=>Number(m.id_materia)===Number(this.formGrupo.fk_materia)) ||
       !this.docentes.some(d=>Number(d.id_docente)===Number(this.formGrupo.fk_docente)) || !entero(this.formGrupo.capacidad,1,1000))) {
     this.error='Elige materia, docente y capacidad entre 1 y 1000.'; return;
   }
   if (accion==='registrarHorario' && (!this.grupos.some(g=>Number(g.id_grupo)===Number(this.formHorario.fk_grupo)) ||
       !this.salones.some(s=>Number(s.id_salon)===Number(this.formHorario.fk_salon)) ||
       !this.dias.includes(this.formHorario.dia_semana) ||
       !/^([01]\d|2[0-3]):[0-5]\d$/.test(this.formHorario.hora_inicio) ||
       !/^([01]\d|2[0-3]):[0-5]\d$/.test(this.formHorario.hora_fin) ||
       this.formHorario.hora_inicio>=this.formHorario.hora_fin)) {
     this.error='Completa grupo, salón, día y horas válidas: la hora final debe ser posterior a la inicial.'; return;
   }
   this.guardando=accion;
   this.http.post<any>(this.url(),{accion,...datos},{headers:this.headers()}).subscribe({
     next:r=>{this.guardando='';if(r.status==='success'){this.mensaje=r.mensaje||'Guardado.';this.cargar();}else this.error=r.mensaje||'No se pudo guardar.';},
     error:e=>{this.guardando='';this.error=this.fallo(e);}
   });
 }
}
