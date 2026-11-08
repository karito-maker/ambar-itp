import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonButton, IonItem, IonInput, IonSelect, IonSelectOption } from '@ionic/angular';
interface Carrera {id:number;nombre:string;}
interface Reticula {id_reticula:number;nombre_reticula:string;anio_inicio:number;}
interface Materia {id_materia:number;nombre_materia:string;nombre_reticula:string;carrera:string;semestre:number;creditos:number;horas_teoria:number|null;horas_practica:number|null;}
@Component({selector:'app-materias',templateUrl:'./materias.page.html',styleUrls:['./materias.page.scss'],standalone:true,
 imports:[CommonModule,FormsModule,RouterLink,IonHeader,IonToolbar,IonTitle,IonContent,IonButton,IonItem,IonInput,IonSelect,IonSelectOption]})
export class MateriasPage implements OnInit {
 materias:Materia[]=[];carreras:Carrera[]=[];reticulas:Reticula[]=[];cargando=false;guardando=false;mensaje='';error='';
 form={nombre_materia:'',creditos:5,semestre:1,horas_teoria:4,horas_practica:2,fk_carrera:0,fk_reticula:0};
 constructor(private http:HttpClient){}
 ngOnInit():void{this.cargar();}ionViewWillEnter():void{this.cargar();}
 private url():string{const s=sessionStorage.getItem('ambar_servidor')||(Capacitor.getPlatform()==='android'?'10.0.2.2':'localhost');return `http://${s.trim()}/api_ionic/registro.php`;}
 private headers():HttpHeaders{let t='';try{t=JSON.parse(sessionStorage.getItem('ambar_sesion')||'{}').token||'';}catch{}return new HttpHeaders({Authorization:`Bearer ${t}`});}
 private fallo(e:any):string{return e?.error?.mensaje||'No fue posible conectar con el servidor.';}
 cargar():void{this.cargando=true;this.error='';this.http.post<any>(this.url(),{accion:'listarCarreras'}).subscribe({next:r=>{this.carreras=r.carreras||[];},error:e=>{this.error=this.fallo(e);}});
 this.http.post<any>(this.url(),{accion:'listarMaterias'},{headers:this.headers()}).subscribe({next:r=>{this.cargando=false;if(r.status==='success')this.materias=r.materias||[];else this.error=r.mensaje||'No se pudo consultar materias.';},error:e=>{this.cargando=false;this.error=this.fallo(e);}});}
 cargarReticulas():void{this.form.fk_reticula=0;this.reticulas=[];if(!this.form.fk_carrera)return;this.http.post<any>(this.url(),{accion:'listarReticulas',fk_carrera:Number(this.form.fk_carrera)}).subscribe({next:r=>{this.reticulas=r.reticulas||[];},error:e=>{this.error=this.fallo(e);}});}
 guardar():void{if(this.guardando)return;this.error='';this.mensaje='';const f=this.form;
 if (!f.nombre_materia.trim() || f.nombre_materia.trim().length>120 ||
     !this.carreras.some(c=>Number(c.id)===Number(f.fk_carrera)) ||
     !this.reticulas.some(r=>Number(r.id_reticula)===Number(f.fk_reticula)) ||
     !Number.isInteger(Number(f.creditos)) || Number(f.creditos)<1 || Number(f.creditos)>50 ||
     !Number.isInteger(Number(f.semestre)) || Number(f.semestre)<1 || Number(f.semestre)>12 ||
     !Number.isInteger(Number(f.horas_teoria)) || Number(f.horas_teoria)<0 || Number(f.horas_teoria)>50 ||
     !Number.isInteger(Number(f.horas_practica)) || Number(f.horas_practica)<0 || Number(f.horas_practica)>50) {
   this.error='Completa materia, carrera, retícula, semestre (1–12), créditos (1–50) y horas (0–50).'; return;
 }
 this.guardando=true;this.http.post<any>(this.url(),{accion:'registrarMateria',nombre_materia:this.form.nombre_materia.trim(),creditos:Number(this.form.creditos),semestre:Number(this.form.semestre),horas_teoria:Number(this.form.horas_teoria),horas_practica:Number(this.form.horas_practica),fk_reticula:Number(this.form.fk_reticula)},{headers:this.headers()}).subscribe({next:r=>{this.guardando=false;if(r.status==='success'){this.mensaje=r.mensaje||'Materia registrada.';this.form.nombre_materia='';this.cargar();}else this.error=r.mensaje||'No se pudo registrar.';},error:e=>{this.guardando=false;this.error=this.fallo(e);}});}
}
