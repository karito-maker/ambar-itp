
import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { catchError, map, of, timeout } from 'rxjs';

// Guardia de navegación. No sustituye la autorización en PHP.
const soloAdministrador: CanActivateFn = () => {
  const router = inject(Router);
  const http = inject(HttpClient);
  let token = '';
  try {
    const sesion = JSON.parse(sessionStorage.getItem('ambar_sesion') || '{}');
    if (sesion?.rol !== 'administrador' || typeof sesion?.token !== 'string') {
      return router.createUrlTree(['/home']);
    }
    token = sesion.token;
  } catch {
    sessionStorage.removeItem('ambar_sesion');
    return router.createUrlTree(['/home']);
  }
  // Validar la sesión en el servidor, no solo el texto guardado en el navegador.
  const servidor = sessionStorage.getItem('ambar_servidor') || 'localhost';
  if (!/^[a-zA-Z0-9.:-]+$/.test(servidor)) {
    return router.createUrlTree(['/home']);
  }
  return http.post<{success: boolean; usuario?: {rol?: string}}>(
    `http://${servidor}/api_ionic/login.php`,
    { accion: 'verificarSesion' },
    { headers: new HttpHeaders({ Authorization: `Bearer ${token}` }) }
  ).pipe(
    timeout(12000),
    map(r => r.success === true && r.usuario?.rol === 'ADMINISTRATIVO'
      ? true : router.createUrlTree(['/home'])),
    catchError(() => of(router.createUrlTree(['/home'])))
  );
};

export const routes: Routes = [
  {
    path: 'home',
    loadComponent: () =>
      import('./home/home.page').then((m) => m.HomePage),
  },
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full',
  },
  {
    path: 'detalle',
    loadComponent: () =>
      import('./detalle/detalle.page').then((m) => m.DetallePage),
  },
  {
    path: 'registro',
    loadComponent: () =>
      import('./registro/registro.page').then((m) => m.RegistroPage),
  },
  {
    path: 'gestion-alumnos',
    canActivate: [soloAdministrador],
    loadComponent: () =>
      import('./gestion-alumnos/gestion-alumnos.page').then((m) => m.GestionAlumnosPage),
  },
  {
    path: 'carreras',
    canActivate: [soloAdministrador],
    loadComponent: () =>
      import('./carreras/carreras.page').then((m) => m.CarrerasPage),
  },
  {
    path: 'docentes',
    canActivate: [soloAdministrador],
    loadComponent: () => import('./docentes/docentes.page').then((m) => m.DocentesPage),
  },
  {
    path: 'grupos-horarios',
    canActivate: [soloAdministrador],
    loadComponent: () => import('./grupos-horarios/grupos-horarios.page').then((m) => m.GruposHorariosPage),
  },
  {
    path: 'materias',
    canActivate: [soloAdministrador],
    loadComponent: () =>
      import('./materias/materias.page').then((m) => m.MateriasPage),
  },
];
