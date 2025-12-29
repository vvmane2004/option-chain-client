import { Component, Input, OnInit, OnChanges, SimpleChanges, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OptionChainService } from '../../../services/option-chain.service';
import { OptionChainUnderlyingPrice } from '../../../interfaces/option-chain.interface';
import { ChartRsiComponent } from '../chart-rsi/chart-rsi.component';
import { ChartMacdComponent } from '../chart-macd/chart-macd.component';
import { ChartBollingerKeltnerComponent } from '../chart-bollinger-keltner/chart-bollinger-keltner.component';

@Component({
  selector: 'app-chart-price-container-1',
  standalone: true,
  imports: [CommonModule, ChartRsiComponent, ChartMacdComponent, ChartBollingerKeltnerComponent],
  templateUrl: './chart-price-container-1.component.html',
  styleUrl: './chart-price-container-1.component.scss'
})
export class ChartPriceContainer1Component implements OnInit, OnChanges, OnDestroy {
  @Input() symbol: string | null = null;
  @Input() expiration: string | null = null;
  @Input() loadTrigger: boolean = false;
  
  loading = false;
  error: string | null = null;
  data: OptionChainUnderlyingPrice[] = [];
  
  // Expose data for child components
  priceData: number[] = [];
  chartDates: string[] = [];
  rsiInfo: string = 'N/A';
  macdInfo: string = 'N/A';
  bollingerInfo: string = 'N/A';
  keltnerInfo: string = 'N/A';

  constructor(private optionChainService: OptionChainService) {}

  ngOnInit(): void {
    // Don't auto-load on init, wait for loadTrigger
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['loadTrigger'] && this.loadTrigger) {
      setTimeout(() => this.loadData(), 0);
    }
  }

  loadData(): void {
    if (!this.symbol || !this.expiration) {
      this.clearData();
      return;
    }

    this.loading = true;
    this.error = null;

    this.optionChainService.getUnderlyingPrice(this.symbol, this.expiration, 'call')
      .subscribe({
        next: (data) => {
          this.data = data;
          this.processData();
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading underlying price data:', error);
          this.error = 'Failed to load underlying price data';
          this.loading = false;
          this.clearData();
        }
      });
  }

  private processData(): void {
    if (!this.data || this.data.length === 0) {
      return;
    }

    const groupedData = this.groupDataByDate();
    const dates = Object.keys(groupedData).sort();
    const priceDataArr = dates.map(date => groupedData[date].avgPrice);
    
    // Expose data for child components
    this.priceData = priceDataArr;
    this.chartDates = dates;
  }

  private groupDataByDate(): { [date: string]: { avgPrice: number, count: number } } {
    const grouped: { [date: string]: { avgPrice: number, count: number } } = {};

    this.data.forEach(item => {
      if (item.imported_date && item.underlying_price !== undefined) {
        const date = item.imported_date;
        if (!grouped[date]) {
          grouped[date] = { avgPrice: 0, count: 0 };
        }
        grouped[date].avgPrice += item.underlying_price;
        grouped[date].count++;
      }
    });

    Object.keys(grouped).forEach(date => {
      const group = grouped[date];
      group.avgPrice = group.avgPrice / group.count;
    });

    return grouped;
  }

  private clearData(): void {
    this.priceData = [];
    this.chartDates = [];
  }

  getDateRange(): string {
    if (!this.data || this.data.length === 0) {
      return 'N/A';
    }

    const dates = this.data
      .map(item => item.imported_date)
      .filter(date => date)
      .sort();

    if (dates.length === 0) {
      return 'N/A';
    }

    const startDate = new Date(dates[0]!).toLocaleDateString();
    const endDate = new Date(dates[dates.length - 1]!).toLocaleDateString();

    return startDate === endDate ? startDate : `${startDate} - ${endDate}`;
  }

  getPriceRange(): string {
    if (!this.data || this.data.length === 0) {
      return 'N/A';
    }

    const prices = this.data
      .map(item => item.underlying_price)
      .filter(price => price !== undefined)
      .sort((a, b) => a! - b!);

    if (prices.length === 0) {
      return 'N/A';
    }

    const minPrice = prices[0]!.toFixed(2);
    const maxPrice = prices[prices.length - 1]!.toFixed(2);

    return minPrice === maxPrice ? `$${minPrice}` : `$${minPrice} - $${maxPrice}`;
  }

  onRsiInfoChange(info: string): void {
    this.rsiInfo = info;
  }

  onMacdInfoChange(info: string): void {
    this.macdInfo = info;
  }

  onBollingerInfoChange(info: string): void {
    this.bollingerInfo = info;
  }

  onKeltnerInfoChange(info: string): void {
    this.keltnerInfo = info;
  }

  ngOnDestroy(): void {
    this.clearData();
  }
}

