import { Component, Input, OnChanges, SimpleChanges, ViewChild, ElementRef, AfterViewInit, OnDestroy, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';

Chart.register(...registerables, zoomPlugin);

@Component({
  selector: 'app-chart-macd',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './chart-macd.component.html',
  styleUrl: './chart-macd.component.scss'
})
export class ChartMacdComponent implements OnChanges, AfterViewInit, OnDestroy {
  @Input() priceData: number[] = [];
  @Input() dates: string[] = [];
  @Input() fastPeriod: number = 12;
  @Input() slowPeriod: number = 26;
  @Input() signalPeriod: number = 9;

  @Output() macdInfoChange = new EventEmitter<string>();

  @ViewChild('macdCanvas', { static: false }) macdCanvas!: ElementRef<HTMLCanvasElement>;

  macdChart: Chart | null = null;
  macdData: { macd: number[], signal: number[], histogram: number[] } = { macd: [], signal: [], histogram: [] };

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
    if (!this.macdCanvas || !this.macdCanvas.nativeElement) {
      console.warn('MACD canvas not available yet, retrying...');
      setTimeout(() => this.createChart(), 100);
      return;
    }

    this.calculateMACD(this.priceData, this.fastPeriod, this.slowPeriod, this.signalPeriod);
    this.createMACDChart();
    this.emitMACDInfo();
  }

  private calculateMACD(prices: number[], fastPeriod: number, slowPeriod: number, signalPeriod: number): void {
    this.macdData = { macd: [], signal: [], histogram: [] };
    
    if (prices.length < slowPeriod) {
      // Not enough data for MACD calculation
      for (let i = 0; i < prices.length; i++) {
        this.macdData.macd.push(null as any);
        this.macdData.signal.push(null as any);
        this.macdData.histogram.push(null as any);
      }
      return;
    }

    // Calculate EMAs
    const fastEMA = this.calculateEMA(prices, fastPeriod);
    const slowEMA = this.calculateEMA(prices, slowPeriod);

    // Calculate MACD line (fast EMA - slow EMA)
    const macdLine: number[] = [];
    for (let i = 0; i < prices.length; i++) {
      if (fastEMA[i] !== null && slowEMA[i] !== null) {
        macdLine.push(fastEMA[i]! - slowEMA[i]!);
      } else {
        macdLine.push(null as any);
      }
    }

    // Calculate Signal line (EMA of MACD line)
    const signalLine = this.calculateEMA(macdLine.filter(val => val !== null), signalPeriod);
    
    // Align signal line with macd line
    const alignedSignalLine: number[] = [];
    let signalIndex = 0;
    for (let i = 0; i < macdLine.length; i++) {
      if (macdLine[i] !== null) {
        if (signalIndex < signalLine.length) {
          alignedSignalLine.push(signalLine[signalIndex]);
          signalIndex++;
        } else {
          alignedSignalLine.push(null as any);
        }
      } else {
        alignedSignalLine.push(null as any);
      }
    }

    // Calculate Histogram (MACD - Signal)
    const histogram: number[] = [];
    for (let i = 0; i < macdLine.length; i++) {
      if (macdLine[i] !== null && alignedSignalLine[i] !== null) {
        histogram.push(macdLine[i]! - alignedSignalLine[i]!);
      } else {
        histogram.push(null as any);
      }
    }

    this.macdData = {
      macd: macdLine,
      signal: alignedSignalLine,
      histogram: histogram
    };
  }

  private calculateEMA(prices: number[], period: number): number[] {
    const ema: number[] = [];
    const multiplier = 2 / (period + 1);

    // First EMA is SMA
    if (prices.length < period) {
      for (let i = 0; i < prices.length; i++) {
        ema.push(null as any);
      }
      return ema;
    }

    // Calculate initial SMA
    let sum = 0;
    for (let i = 0; i < period; i++) {
      sum += prices[i];
      ema.push(null as any);
    }
    ema[period - 1] = sum / period;

    // Calculate subsequent EMAs
    for (let i = period; i < prices.length; i++) {
      ema.push((prices[i] * multiplier) + (ema[i - 1]! * (1 - multiplier)));
    }

    return ema;
  }

  private createMACDChart(): void {
    if (this.macdChart) {
      this.macdChart.destroy();
    }

    if (!this.macdData || !this.macdCanvas || !this.macdCanvas.nativeElement) {
      console.warn('MACD canvas or data not available');
      return;
    }

    const macdConfig: ChartConfiguration = {
      type: 'line',
      data: {
        labels: this.dates.map((date: string) => new Date(date).toLocaleDateString()),
        datasets: [
          {
            label: 'MACD Line',
            data: this.macdData.macd,
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            borderWidth: 1,
            fill: false,
            tension: 0.4,
            pointRadius: 0,
            pointHoverRadius: 4,
            order: 1
          },
          {
            label: 'Signal Line',
            data: this.macdData.signal,
            borderColor: '#ef4444',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            borderWidth: 1,
            fill: false,
            tension: 0.4,
            pointRadius: 0,
            pointHoverRadius: 4,
            order: 2
          },
          {
            label: 'MACD Histogram',
            data: this.macdData.histogram,
            type: 'bar',
            backgroundColor: this.macdData.histogram.map((value: number) => {
              if (value === null) return 'rgba(128, 128, 128, 0.3)';
              return value >= 0 ? 'rgba(34, 197, 94, 0.7)' : 'rgba(239, 68, 68, 0.7)';
            }),
            borderColor: this.macdData.histogram.map((value: number) => {
              if (value === null) return 'rgba(128, 128, 128, 0.5)';
              return value >= 0 ? 'rgba(34, 197, 94, 1)' : 'rgba(239, 68, 68, 1)';
            }),
            borderWidth: 1,
            borderSkipped: false,
            order: 3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'top' as const
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
              text: 'MACD'
            },
            grid: {
              color: 'rgba(0,0,0,0.1)'
            },
            ticks: {
              callback: function(value) {
                return typeof value === 'number' ? value.toFixed(3) : value;
              }
            }
          }
        }
      }
    };

    this.macdChart = new Chart(this.macdCanvas.nativeElement, macdConfig);
  }

  private emitMACDInfo(): void {
    this.macdInfoChange.emit(this.getMACDInfo());
  }

  getMACDInfo(): string {
    if (!this.macdData || this.macdData.macd.length === 0) {
      return 'N/A';
    }

    const validMACD = this.macdData.macd.filter(value => value !== null);
    const validSignal = this.macdData.signal.filter(value => value !== null);
    const validHistogram = this.macdData.histogram.filter(value => value !== null);

    if (validMACD.length === 0 || validSignal.length === 0) {
      return 'N/A';
    }

    const currentMACD = validMACD[validMACD.length - 1];
    const currentSignal = validSignal[validSignal.length - 1];
    const currentHistogram = validHistogram.length > 0 ? validHistogram[validHistogram.length - 1] : 0;

    const macdValue = currentMACD.toFixed(3);
    const signalValue = currentSignal.toFixed(3);
    const histogramValue = currentHistogram.toFixed(3);

    let signal = 'Neutral';
    if (currentMACD > currentSignal) {
      signal = 'Bullish';
    } else if (currentMACD < currentSignal) {
      signal = 'Bearish';
    }

    return `MACD: ${macdValue} | Signal: ${signalValue} | Histogram: ${histogramValue} | ${signal}`;
  }

  private clearChart(): void {
    if (this.macdChart) {
      this.macdChart.destroy();
      this.macdChart = null;
    }
    this.macdData = { macd: [], signal: [], histogram: [] };
  }

  ngOnDestroy(): void {
    this.clearChart();
  }
}

