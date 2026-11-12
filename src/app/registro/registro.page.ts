import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { timeout } from 'rxjs';
import {
  IonContent, IonHeader, IonTitle, IonToolbar, IonButton, IonItem, IonInput
} from '@ionic/angular';

/** Pantalla de ayuda y configuración única de la primera cuenta de TecPlus. */
@Component({
  selector: 'app-registro',
  standalone: true,
  templateUrl: './registro.page.html',
  styleUrls: ['./registro.page.scss'],
  imports: [CommonModule, FormsModule, RouterLink, IonContent, IonHeader,
    IonTitle, IonToolbar, IonButton, IonItem, IonInput]
})
export class RegistroPage implements OnInit {
  servidor = 'localhost';
  consultando = true;
  disponible = false;
  guardando = false;
  creado = false;
  error = '';
  mensaje = '';
  correo = '';
  contrasena = '';
  confirmar = '';

  constructor(
    private http: HttpClient,
    private ruta: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Solo se ofrece la configuración inicial desde el equipo local.
    // En iPhone el acceso se habilita desde Administración, no con alta abierta.
    const recibido = this.ruta.snapshot.queryParamMap.get('servidor') || 'localhost';
    this.servidor = ['localhost', '127.0.0.1'].includes(recibido.trim().toLowerCase())
      ? recibido.trim().toLowerCase() : 'localhost';
    this.consultarEstado();
  }

  private get url(): string {
    return `http://${this.servidor}/api_ionic/login.php`;
  }

  consultarEstado(): void {
    this.consultando = true;
    this.error = '';
    this.http.post<{ success: boolean; disponible?: boolean; message?: string }>(
      this.url, { accion: 'estadoPrimerAdministrador' }
    ).pipe(timeout(12000)).subscribe({
      next: r => {
        this.consultando = false;
        this.disponible = r.success === true && r.disponible === true;
        this.cdr.detectChanges();
      },
      error: e => {
        this.consultando = false;
        this.disponible = false;
        // No se permite configurar Administración por una red externa.
        if (e?.status !== 403) {
          this.error = 'No se pudo comprobar la configuración inicial. Verifica Apache en XAMPP.';
        }
        this.cdr.detectChanges();
      }
    });
  }

  crearAdministrador(): void {
    if (!this.disponible || this.guardando) return;
    this.error = '';
    this.mensaje = '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.correo.trim()) ||
        this.contrasena.length < 12 || this.contrasena.length > 128 ||
        !/[A-Za-z]/.test(this.contrasena) || !/[0-9]/.test(this.contrasena) ||
        this.contrasena !== this.confirmar) {
      this.error = 'Escribe un correo válido y una contraseña de al menos 12 caracteres con letras y números. Las contraseñas deben coincidir.';
      return;
    }
    this.guardando = true;
    this.http.post<{ success: boolean; message?: string }>(this.url, {
      accion: 'crearPrimerAdministrador',
      correo: this.correo.trim(),
      contrasena: this.contrasena,
      confirmacion: this.confirmar
    }).pipe(timeout(15000)).subscribe({
      next: r => {
        this.guardando = false;
        this.contrasena = '';
        this.confirmar = '';
        if (r.success === true) {
          this.creado = true;
          this.disponible = false;
          this.mensaje = 'Cuenta administrativa creada. Ya puedes iniciar sesión desde TecPlus.';
        } else {
          this.error = r.message || 'No se pudo registrar la cuenta.';
        }
        this.cdr.detectChanges();
      },
      error: e => {
        this.guardando = false;
        this.contrasena = '';
        this.confirmar = '';
        this.error = e?.error?.message || 'No se pudo crear la cuenta. Comprueba la conexión y vuelve a intentarlo.';
        this.cdr.detectChanges();
      }
    });
  }
}
