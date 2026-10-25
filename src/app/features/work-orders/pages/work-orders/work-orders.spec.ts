import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { WorkOrders } from './work-orders';

describe('WorkOrders', () => {
  let component: WorkOrders;
  let fixture: ComponentFixture<WorkOrders>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WorkOrders],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(WorkOrders);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
