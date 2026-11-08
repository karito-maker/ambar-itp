import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AlertController } from '@ionic/angular';
import {
  IonContent, IonHeader, IonTitle, IonToolbar, IonItem,
  IonInput, IonTextarea, IonSelect, IonSelectOption, IonButton
} from '@ionic/angular';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Capacitor } from '@capacitor/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-carreras',
  templateUrl: './carreras.page.html',
  styleUrls: ['./carreras.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterLink,
    IonContent, IonHeader, IonTitle, IonToolbar,
    IonItem, IonInput, IonTextarea, IonSelect, IonSelectOption,
    IonButton
  ]
})
export class CarrerasPage {
  // Atributos reales de carreras en la nueva BD `ionic`.
  carrera = {
    nombre_carrera: '',
    descripcion: '',
    estatus: 'activo'
  };

  guardando = false;

  constructor(
    private alertController: AlertController,
    private http: HttpClient
  ) {}

  async mostrarAlerta(mensaje: string): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Atención',
      message: mensaje,
      buttons: ['OK']
    });
    await alert.present();
  }

  validarGuardar(): void {
    if (this.guardando) { return; }

    const nombre = this.carrera.nombre_carrera.trim();
    const descripcion = this.carrera.descripcion.trim();
    const estatus = this.carrera.estatus;

    if (!nombre) {
      void this.mostrarAlerta('El nombre de la carrera es obligatorio.');
      return;
    }
    if (nombre.length > 120) {
      void this.mostrarAlerta('El nombre no puede tener más de 120 caracteres.');
      return;
    }
    if (descripcion.length > 255) {
      void this.mostrarAlerta('La descripción no puede tener más de 255 caracteres.');
      return;
    }
    if (estatus !== 'activo' && estatus !== 'inactivo') {
      void this.mostrarAlerta('Selecciona un estatus válido.');
      return;
    }

    const servidor = sessionStorage.getItem('ambar_servidor') ||
      (Capacitor.getPlatform() === 'android' ? '10.0.2.2' : 'localhost');
    const urlAPI = `http://${servidor}/api_ionic/registro.php`;

    let token = '';
    try {
      const sesion = JSON.parse(sessionStorage.getItem('ambar_sesion') || '{}');
      token = typeof sesion?.token === 'string' ? sesion.token : '';
    } catch {
      token = '';
    }

    if (!token) {
      void this.mostrarAlerta('Tu sesión no está disponible. Cierra sesión e inicia nuevamente como administrador.');
      return;
    }

    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
    const datos = {
      accion: 'carrera',
      nombre_carrera: nombre,
      descripcion,
      estatus
    };

    this.guardando = true;
    this.http.post<{status: string; mensaje: string}>(urlAPI, datos, { headers }).subscribe({
      next: (respuesta) => {
        this.guardando = false;
        void this.mostrarAlerta(respuesta?.mensaje || 'Respuesta recibida.');
        if (respuesta?.status === 'success') {
          this.carrera = { nombre_carrera: '', descripcion: '', estatus: 'activo' };
        }
      },
      error: (error) => {
        this.guardando = false;
        const mensajeBackend = typeof error?.error?.mensaje === 'string'
          ? error.error.mensaje : '';
        const mensaje = mensajeBackend ||
          (error.status === 401 || error.status === 403
            ? 'Sesión inválida o sin permisos. Vuelve a iniciar sesión.'
            : 'No se pudo registrar la carrera. Revisa Apache, MySQL y la conexión al servidor.');
        void this.mostrarAlerta(mensaje);
      }
    });
  }
}
