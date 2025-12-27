import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChartPricePutComponent } from './chart-price-put.component';

describe('ChartPricePutComponent', () => {
  let component: ChartPricePutComponent;
  let fixture: ComponentFixture<ChartPricePutComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChartPricePutComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ChartPricePutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
