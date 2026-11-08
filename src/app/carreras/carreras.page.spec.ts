import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CarrerasPage } from './carreras.page';

describe('CarrerasPage', () => {
  let component: CarrerasPage;
  let fixture: ComponentFixture<CarrerasPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(CarrerasPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
