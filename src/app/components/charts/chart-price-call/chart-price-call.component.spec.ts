import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChartPriceCallComponent } from './chart-price-call.component';

describe('ChartPriceCallComponent', () => {
  let component: ChartPriceCallComponent;
  let fixture: ComponentFixture<ChartPriceCallComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChartPriceCallComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ChartPriceCallComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
