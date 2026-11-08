import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonButton, IonItem, IonInput, IonSelect, IonSelectOption } from '@ionic/angular';
interface Area {id_area:number;nombre_area:string;nombre_edificio:string;}
interface Docente {id_docente:number;nombres:string;apellido_paterno:string;apellido_materno:string;correo_contacto:string;telefono:string;correo_acceso:string;nombre_area:string;activo:number;}
@Component({selector:'app-docentes',templateUrl:'./docentes.page.html',styleUrls:['./docentes.page.scss'],standalone:true,imports:[CommonModule,FormsModule,RouterLink,IonHeader,IonToolbar,IonTitle,IonContent,IonButton,IonItem,IonInput,IonSelect,IonSelectOption]})
export class DocentesPage implements OnInit {
 areas:Area[]=[];docentes:Docente[]=[];guardando=false;cargando=false;mensaje='';error='';
 form={nombres:'',apellido_paterno:'',apellido_materno:'',correo:'',contrasena:'',correo_contacto:'',telefono:'',fk_area:0};
 constructor(private http:HttpClient){}
 ngOnInit():void{this.cargar();}ionViewWillEnter():void{this.cargar();}
 private url():string{const s=sessionStorage.getItem('ambar_servidor')||(Capacitor.getPlatform()==='android'?'10.0.2.2':'localhost');return `http://${s.trim()}/api_ionic/registro.php`;}
 private headers():HttpHeaders{let t='';try{t=JSON.parse(sessionStorage.getItem('ambar_sesion')||'{}').token||'';}catch{}return new HttpHeaders({Authorization:`Bearer ${t}`});}
 private fallo(e:any):string{return e?.error?.mensaje||'Error al conectar con el servidor.';}
 cargar():void{this.cargando=true;this.error='';this.http.post<any>(this.url(),{accion:'listarAreas'},{headers:this.headers()}).subscribe({next:r=>{this.areas=r.areas||[];},error:e=>{this.error=this.fallo(e);}});
 this.http.post<any>(this.url(),{accion:'listarDocentes'},{headers:this.headers()}).subscribe({next:r=>{this.cargando=false;if(r.status==='success')this.docentes=r.docentes||[];else this.error=r.mensaje||'No se pudieron consultar docentes.';},error:e=>{this.cargando=false;this.error=this.fallo(e);}});}
 guardar():void{if(this.guardando)return;this.error='';this.mensaje='';const f=this.form;
 if (!f.nombres.trim() || !f.apellido_paterno.trim() || !f.apellido_materno.trim() ||
     f.nombres.trim().length > 100 || f.apellido_paterno.trim().length > 70 || f.apellido_materno.trim().length > 70) {
   this.error='Completa nombres y apellidos válidos.'; return;
 }
 if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.correo.trim()) || f.correo.trim().length>191 ||
     f.contrasena.length<8 || f.contrasena.length>72 || !f.contrasena.trim() ||
     !this.areas.some(a=>Number(a.id_area)===Number(f.fk_area))) {
   this.error='Selecciona un área válida, correo y contraseña de 8 a 72 caracteres.'; return;
 }
 if ((f.correo_contacto.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.correo_contacto.trim())) ||
     !/^[0-9+()\s-]{0,20}$/.test(f.telefono.trim())) {
   this.error='El correo o teléfono de contacto no tiene un formato válido.'; return;
 }
 this.guardando=true;this.http.post<any>(this.url(),{accion:'registrarDocente',...f,fk_area:Number(f.fk_area)},{headers:this.headers()}).subscribe({next:r=>{this.guardando=false;if(r.status==='success'){this.mensaje=r.mensaje||'Docente registrado.';this.form={nombres:'',apellido_paterno:'',apellido_materno:'',correo:'',contrasena:'',correo_contacto:'',telefono:'',fk_area:0};this.cargar();}else this.error=r.mensaje||'No se pudo registrar.';},error:e=>{this.guardando=false;this.error=this.fallo(e);}});}
}
