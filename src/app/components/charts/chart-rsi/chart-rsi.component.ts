import { Component, Input, OnChanges, SimpleChanges, ViewChild, ElementRef, AfterViewInit, OnDestroy, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';

Chart.register(...registerables, zoomPlugin);

@Component({
  selector: 'app-chart-rsi',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './chart-rsi.component.html',
  styleUrl: './chart-rsi.component.scss'
})
export class ChartRsiComponent implements OnChanges, AfterViewInit, OnDestroy {
  @Input() priceData: number[] = [];
  @Input() dates: string[] = [];
  @Input() period: number = 14;
  @Input() overbought: number = 70;
  @Input() oversold: number = 30;

  @Output() rsiInfoChange = new EventEmitter<string>();

  @ViewChild('rsiCanvas', { static: false }) rsiCanvas!: ElementRef<HTMLCanvasElement>;

  rsiChart: Chart | null = null;
  rsiData: number[] = [];

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
    if (!this.rsiCanvas || !this.rsiCanvas.nativeElement) {
      console.warn('RSI canvas not available yet, retrying...');
      setTimeout(() => this.createChart(), 100);
      return;
    }

    this.calculateRSI(this.priceData, this.period);
    this.createRSIChart();
    this.emitRSIInfo();
  }

  private calculateRSI(prices: number[], period: number): void {
    this.rsiData = [];
    
    if (prices.length < period + 1) {
      // Not enough data for RSI calculation
      for (let i = 0; i < prices.length; i++) {
        this.rsiData.push(null as any);
      }
      return;
    }

    const gains: number[] = [];
    const losses: number[] = [];

    // Calculate price changes
    for (let i = 1; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? Math.abs(change) : 0);
    }

    // Add null for first price (no change)
    this.rsiData.push(null as any);

    // Calculate initial average gain and loss
    let avgGain = gains.slice(0, period).reduce((sum, gain) => sum + gain, 0) / period;
    let avgLoss = losses.slice(0, period).reduce((sum, loss) => sum + loss, 0) / period;

    // Calculate RSI for the first valid period
    if (avgLoss === 0) {
      this.rsiData.push(100);
    } else {
      const rs = avgGain / avgLoss;
      const rsi = 100 - (100 / (1 + rs));
      this.rsiData.push(rsi);
    }

    // Calculate RSI for remaining periods using Wilder's smoothing
    for (let i = period + 1; i < prices.length; i++) {
      const gain = gains[i - 1];
      const loss = losses[i - 1];

      // Wilder's smoothing: new average = (previous average * (period - 1) + current value) / period
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;

      if (avgLoss === 0) {
        this.rsiData.push(100);
      } else {
        const rs = avgGain / avgLoss;
        const rsi = 100 - (100 / (1 + rs));
        this.rsiData.push(rsi);
      }
    }
  }

  private createRSIChart(): void {
    if (this.rsiChart) {
      this.rsiChart.destroy();
    }

    if (!this.rsiData || !this.rsiCanvas || !this.rsiCanvas.nativeElement) {
      console.warn('RSI canvas or data not available');
      return;
    }

    const rsiConfig: ChartConfiguration = {
      type: 'line',
      data: {
        labels: this.dates.map((date: string) => new Date(date).toLocaleDateString()),
        datasets: [{
          label: `RSI (${this.period})`,
          data: this.rsiData,
          borderColor: '#8b5cf6',
          backgroundColor: 'rgba(139, 92, 246, 0.1)',
          borderWidth: 1,
          fill: false,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 4,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          title: {
            display: false
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
            },
            grid: {
              display: false
            }
          },
          y: {
            display: true,
            title: {
              display: true,
              text: 'RSI'
            },
            min: 0,
            max: 100,
            grid: {
              color: 'rgba(0,0,0,0.1)'
            },
            ticks: {
              callback: function(value) {
                return value + '%';
              }
            }
          }
        },
        elements: {
          point: {
            backgroundColor: (context: any) => {
              const value = context.parsed.y;
              if (value === null) return 'rgba(128, 128, 128, 0.5)';
              if (value >= this.overbought) return '#ef4444'; // Overbought - red
              if (value <= this.oversold) return '#22c55e'; // Oversold - green
              return '#8b5cf6'; // Neutral - purple
            },
            borderColor: (context: any) => {
              const value = context.parsed.y;
              if (value === null) return 'rgba(128, 128, 128, 0.8)';
              if (value >= this.overbought) return '#dc2626';
              if (value <= this.oversold) return '#16a34a';
              return '#7c3aed';
            }
          }
        }
      }
    };

    this.rsiChart = new Chart(this.rsiCanvas.nativeElement, rsiConfig);
  }

  private emitRSIInfo(): void {
    this.rsiInfoChange.emit(this.getRSIInfo());
  }

  getRSIInfo(): string {
    if (!this.rsiData || this.rsiData.length === 0) {
      return 'N/A';
    }

    const validRSI = this.rsiData.filter(value => value !== null);
    if (validRSI.length === 0) {
      return 'N/A';
    }

    const currentRSI = validRSI[validRSI.length - 1];
    const rsiValue = currentRSI.toFixed(2);
    
    let status = 'Neutral';
    if (currentRSI >= this.overbought) {
      status = 'Overbought';
    } else if (currentRSI <= this.oversold) {
      status = 'Oversold';
    }

    return `Current: ${rsiValue}% | Status: ${status}`;
  }

  private clearChart(): void {
    if (this.rsiChart) {
      this.rsiChart.destroy();
      this.rsiChart = null;
    }
    this.rsiData = [];
  }

  ngOnDestroy(): void {
    this.clearChart();
  }
}

