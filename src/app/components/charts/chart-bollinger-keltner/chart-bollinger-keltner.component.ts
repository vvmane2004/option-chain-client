import { Component, Input, OnChanges, SimpleChanges, ViewChild, ElementRef, AfterViewInit, OnDestroy, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';

Chart.register(...registerables, zoomPlugin);

@Component({
  selector: 'app-chart-bollinger-keltner',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './chart-bollinger-keltner.component.html',
  styleUrl: './chart-bollinger-keltner.component.scss'
})
export class ChartBollingerKeltnerComponent implements OnChanges, AfterViewInit, OnDestroy {
  @Input() priceData: number[] = [];
  @Input() dates: string[] = [];
  @Input() symbol: string = '';
  @Input() bollingerPeriod: number = 20;
  @Input() bollingerStdDev: number = 2;
  @Input() keltnerPeriod: number = 20;
  @Input() keltnerMultiplier: number = 2;

  @Output() bollingerInfoChange = new EventEmitter<string>();
  @Output() keltnerInfoChange = new EventEmitter<string>();

  @ViewChild('chartCanvas', { static: false }) chartCanvas!: ElementRef<HTMLCanvasElement>;

  chart: Chart | null = null;

  ngAfterViewInit(): void {
    if (this.priceData.length > 0 && this.dates.length > 0) {
      setTimeout(() => this.createChart(), 100);
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['priceData'] || changes['dates']) && this.priceData.length > 0 && this.dates.length > 0) {
      setTimeout(() => this.createChart(), 100);
    }
  }

  private createChart(): void {
    if (!this.chartCanvas || !this.chartCanvas.nativeElement) {
      console.warn('Bollinger/Keltner canvas not available yet, retrying...');
      setTimeout(() => this.createChart(), 100);
      return;
    }

    if (this.chart) {
      this.chart.destroy();
    }

    const datasets: any[] = [
      {
        label: 'Underlying Price',
        data: this.priceData,
        borderColor: '#22c55e',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        borderWidth: 1.5,
        fill: false,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 4,
        order: 1
      }
    ];

    // Add Bollinger Bands
    const bollingerBands = this.calculateBollingerBands(this.priceData, this.bollingerPeriod, this.bollingerStdDev);
    datasets.push(
      {
        label: 'Bollinger Upper Band',
        data: bollingerBands.upperBand,
        borderColor: '#8b5cf6',
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        borderWidth: 1,
        fill: false,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 0,
        order: 4
      },
      {
        label: 'Bollinger Middle Band (SMA)',
        data: bollingerBands.middleBand,
        borderColor: '#f59e0b',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        borderWidth: 2,
        fill: false,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 0,
        order: 2
      },
      {
        label: 'Bollinger Lower Band',
        data: bollingerBands.lowerBand,
        borderColor: '#8b5cf6',
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        borderWidth: 1,
        fill: false,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 0,
        order: 4
      }
    );

    // Add Keltner Channels
    const keltnerChannels = this.calculateKeltnerChannels(this.priceData, this.keltnerPeriod, this.keltnerMultiplier);
    datasets.push(
      {
        label: 'Keltner Upper Channel',
        data: keltnerChannels.upperBand,
        borderColor: '#06b6d4',
        backgroundColor: 'rgba(6, 182, 212, 0.1)',
        borderWidth: 1,
        fill: false,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 0,
        order: 5,
        borderDash: [5, 5]
      },
      {
        label: 'Keltner Lower Channel',
        data: keltnerChannels.lowerBand,
        borderColor: '#06b6d4',
        backgroundColor: 'rgba(6, 182, 212, 0.1)',
        borderWidth: 1,
        fill: false,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 0,
        order: 5,
        borderDash: [5, 5]
      }
    );

    const config: ChartConfiguration = {
      type: 'line',
      data: {
        labels: this.dates.map((date: string) => new Date(date).toLocaleDateString()),
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          title: {
            display: true,
            text: `${this.symbol} - Underlying Price with Bollinger Bands & Keltner Channels`,
            font: {
              size: 16,
              weight: 'bold'
            }
          },
          legend: {
            display: true,
            position: 'top' as const
          },
          zoom: {
            pan: {
              enabled: true,
              mode: 'x',
              modifierKey: 'ctrl'
            },
            zoom: {
              wheel: {
                enabled: true,
                speed: 0.1
              },
              pinch: {
                enabled: true
              },
              mode: 'x'
            }
          }
        },
        scales: {
          x: {
            display: true,
            title: {
              display: true,
              text: 'Dates'
            }
          },
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            title: {
              display: true,
              text: 'Underlying Price ($)'
            },
            grid: {
              drawOnChartArea: true,
            },
          }
        }
      }
    };

    this.chart = new Chart(this.chartCanvas.nativeElement, config);

    // Emit info
    this.emitBollingerInfo(bollingerBands);
    this.emitKeltnerInfo(keltnerChannels);
  }

  private calculateBollingerBands(prices: number[], period: number, standardDeviations: number): { upperBand: number[], middleBand: number[], lowerBand: number[] } {
    const upperBand: number[] = [];
    const middleBand: number[] = [];
    const lowerBand: number[] = [];

    for (let i = 0; i < prices.length; i++) {
      if (i < period - 1) {
        upperBand.push(null as any);
        middleBand.push(null as any);
        lowerBand.push(null as any);
      } else {
        const slice = prices.slice(i - period + 1, i + 1);
        const sma = slice.reduce((sum, price) => sum + price, 0) / period;
        middleBand.push(sma);

        const variance = slice.reduce((sum, price) => sum + Math.pow(price - sma, 2), 0) / period;
        const stdDev = Math.sqrt(variance);

        const upper = sma + (standardDeviations * stdDev);
        const lower = sma - (standardDeviations * stdDev);

        upperBand.push(upper);
        lowerBand.push(lower);
      }
    }

    return { upperBand, middleBand, lowerBand };
  }

  private calculateKeltnerChannels(prices: number[], period: number, multiplier: number): { upperBand: number[], middleBand: number[], lowerBand: number[] } {
    const upperBand: number[] = [];
    const middleBand: number[] = [];
    const lowerBand: number[] = [];

    for (let i = 0; i < prices.length; i++) {
      if (i < period - 1) {
        upperBand.push(null as any);
        middleBand.push(null as any);
        lowerBand.push(null as any);
      } else {
        const slice = prices.slice(i - period + 1, i + 1);
        
        const sma = slice.reduce((sum, price) => sum + price, 0) / period;
        middleBand.push(sma);

        const trueRanges: number[] = [];
        for (let j = 1; j < slice.length; j++) {
          const tr = Math.abs(slice[j] - slice[j - 1]);
          trueRanges.push(tr);
        }
        const atr = trueRanges.reduce((sum, tr) => sum + tr, 0) / trueRanges.length;

        const upper = sma + (multiplier * atr);
        const lower = sma - (multiplier * atr);

        upperBand.push(upper);
        lowerBand.push(lower);
      }
    }

    return { upperBand, middleBand, lowerBand };
  }

  private emitBollingerInfo(bollingerBands: { upperBand: number[], middleBand: number[], lowerBand: number[] }): void {
    const lastIndex = bollingerBands.upperBand.length - 1;
    if (lastIndex >= 0 && bollingerBands.upperBand[lastIndex] !== null) {
      const upper = bollingerBands.upperBand[lastIndex]!.toFixed(2);
      const middle = bollingerBands.middleBand[lastIndex]!.toFixed(2);
      const lower = bollingerBands.lowerBand[lastIndex]!.toFixed(2);
      this.bollingerInfoChange.emit(`Upper: $${upper} | Middle: $${middle} | Lower: $${lower}`);
    } else {
      this.bollingerInfoChange.emit('N/A');
    }
  }

  private emitKeltnerInfo(keltnerChannels: { upperBand: number[], middleBand: number[], lowerBand: number[] }): void {
    const lastIndex = keltnerChannels.upperBand.length - 1;
    if (lastIndex >= 0 && keltnerChannels.upperBand[lastIndex] !== null) {
      const upper = keltnerChannels.upperBand[lastIndex]!.toFixed(2);
      const lower = keltnerChannels.lowerBand[lastIndex]!.toFixed(2);
      this.keltnerInfoChange.emit(`Upper: $${upper} | Lower: $${lower}`);
    } else {
      this.keltnerInfoChange.emit('N/A');
    }
  }

  getBollingerInfo(): string {
    if (this.priceData.length === 0) return 'N/A';
    const bollingerBands = this.calculateBollingerBands(this.priceData, this.bollingerPeriod, this.bollingerStdDev);
    const lastIndex = bollingerBands.upperBand.length - 1;
    if (lastIndex >= 0 && bollingerBands.upperBand[lastIndex] !== null) {
      const upper = bollingerBands.upperBand[lastIndex]!.toFixed(2);
      const middle = bollingerBands.middleBand[lastIndex]!.toFixed(2);
      const lower = bollingerBands.lowerBand[lastIndex]!.toFixed(2);
      return `Upper: $${upper} | Middle: $${middle} | Lower: $${lower}`;
    }
    return 'N/A';
  }

  getKeltnerInfo(): string {
    if (this.priceData.length === 0) return 'N/A';
    const keltnerChannels = this.calculateKeltnerChannels(this.priceData, this.keltnerPeriod, this.keltnerMultiplier);
    const lastIndex = keltnerChannels.upperBand.length - 1;
    if (lastIndex >= 0 && keltnerChannels.upperBand[lastIndex] !== null) {
      const upper = keltnerChannels.upperBand[lastIndex]!.toFixed(2);
      const lower = keltnerChannels.lowerBand[lastIndex]!.toFixed(2);
      return `Upper: $${upper} | Lower: $${lower}`;
    }
    return 'N/A';
  }

  private clearChart(): void {
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
  }

  ngOnDestroy(): void {
    this.clearChart();
  }
}

