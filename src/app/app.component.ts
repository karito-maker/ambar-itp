import { Component, DestroyRef, inject } from '@angular/core';
import { Router, NavigationStart } from '@angular/router';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { IonApp, IonRouterOutlet } from '@ionic/angular';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent {
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  constructor() {
    // Evita que el foco quede dentro de una página que Ionic va a ocultar.
    // Es una corrección de accesibilidad, no altera sesión ni permisos.
    this.router.events.pipe(
      filter(event => event instanceof NavigationStart),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => {
      if (typeof document === 'undefined') return;
      const focused = document.activeElement;
      if (focused instanceof HTMLElement && focused !== document.body) focused.blur();
    });
  }
}
