import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';

Chart.register(...registerables, zoomPlugin);

export interface TTMSqueezeData {
  upperBand: (number | null)[];
  lowerBand: (number | null)[];
  momentum: (number | null)[];
  squeeze: boolean[];
  histogram: (number | null)[];
  barColors: string[];
}

/**
 * TTM Squeeze Component
 * 
 * The TTM Squeeze is a volatility and momentum indicator that combines:
 * - Bollinger Bands (volatility)
 * - Keltner Channels (volatility)
 * - Linear Regression momentum
 * 
 * When Bollinger Bands are inside Keltner Channels = "Squeeze" (low volatility)
 * When Bollinger Bands expand outside Keltner Channels = "Release" (high volatility)
 * 
 * This component can work in two modes:
 * 1. Calculate mode: Provide priceData and dates, component calculates TTM Squeeze
 * 2. Display mode: Provide pre-calculated squeezeData directly
 */
@Component({
  selector: 'app-chart-ttm-squeeze',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './chart-ttm-squeeze.component.html',
  styleUrl: './chart-ttm-squeeze.component.scss'
})
export class ChartTtmSqueezeComponent implements OnChanges, OnDestroy {
  // Input for calculate mode
  @Input() priceData: number[] = [];
  @Input() dates: string[] = [];
  @Input() period: number = 20;
  @Input() kcMultiplier: number = 1.5;
  @Input() bbMultiplier: number = 2.0;
  
  // Input for display mode (pre-calculated data)
  @Input() squeezeData: TTMSqueezeData | null = null;
  
  @Output() ttmSqueezeInfoChange = new EventEmitter<string>();
  @Output() ttmSqueezeDataChange = new EventEmitter<TTMSqueezeData>();
  
  @ViewChild('histogramCanvas', { static: false }) histogramCanvas!: ElementRef<HTMLCanvasElement>;
  
  histogramChart: Chart | null = null;
  ttmSqueezeData: TTMSqueezeData | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    // Display mode: use pre-calculated data
    if (changes['squeezeData'] && this.squeezeData && this.dates.length > 0) {
      this.ttmSqueezeData = this.squeezeData;
      this.emitTTMSqueezeInfo();
      setTimeout(() => this.createHistogramChart(), 100);
      return;
    }
    
    // Calculate mode: calculate from priceData
    if ((changes['priceData'] || changes['dates'] || changes['period'] || 
         changes['kcMultiplier'] || changes['bbMultiplier']) && 
        this.priceData.length > 0 && this.dates.length > 0 && !this.squeezeData) {
      this.calculateTTMSqueeze();
      setTimeout(() => this.createHistogramChart(), 100);
    }
  }

  private calculateTTMSqueeze(): void {
    const prices = this.priceData;
    const period = this.period;
    const kcMultiplier = this.kcMultiplier;
    const bbMultiplier = this.bbMultiplier;

    const upperBand: (number | null)[] = [];
    const lowerBand: (number | null)[] = [];
    const momentum: (number | null)[] = [];
    const squeeze: boolean[] = [];
    const histogram: (number | null)[] = [];
    const barColors: string[] = [];

    // First pass: calculate raw momentum values
    const rawMomentum: (number | null)[] = [];

    for (let i = 0; i < prices.length; i++) {
      if (i < period - 1) {
        // Not enough data points for the period
        upperBand.push(null);
        lowerBand.push(null);
        rawMomentum.push(null);
        squeeze.push(false);
      } else {
        const slice = prices.slice(i - period + 1, i + 1);
        
        // Calculate True Range (simplified - using price differences)
        const trueRanges: number[] = [];
        for (let j = 1; j < slice.length; j++) {
          const tr = Math.abs(slice[j] - slice[j - 1]);
          trueRanges.push(tr);
        }
        const avgTrueRange = trueRanges.reduce((sum, tr) => sum + tr, 0) / trueRanges.length;

        // Calculate Keltner Channels
        const sma = slice.reduce((sum, price) => sum + price, 0) / period;
        const kcUpper = sma + (kcMultiplier * avgTrueRange);
        const kcLower = sma - (kcMultiplier * avgTrueRange);

        // Calculate Bollinger Bands
        const variance = slice.reduce((sum, price) => sum + Math.pow(price - sma, 2), 0) / period;
        const stdDev = Math.sqrt(variance);
        const bbUpper = sma + (bbMultiplier * stdDev);
        const bbLower = sma - (bbMultiplier * stdDev);

        // TTM Squeeze: Use Keltner Channels as bands
        upperBand.push(kcUpper);
        lowerBand.push(kcLower);

        // Determine if in squeeze (BB inside KC)
        const isInSqueeze = bbUpper < kcUpper && bbLower > kcLower;
        squeeze.push(isInSqueeze);

        // TTM Squeeze Momentum using Linear Regression
        // Calculate: val = close - average(average(highest, lowest), SMA)
        const highest = Math.max(...slice);
        const lowest = Math.min(...slice);
        const donchianMid = (highest + lowest) / 2;
        const midpoint = (donchianMid + sma) / 2;

        // Build the value series for this lookback window for linear regression
        const valSeries: number[] = [];
        for (let k = i - period + 1; k <= i; k++) {
          if (k >= period - 1) {
            const kSlice = prices.slice(k - period + 1, k + 1);
            const kSma = kSlice.reduce((sum, p) => sum + p, 0) / period;
            const kHighest = Math.max(...kSlice);
            const kLowest = Math.min(...kSlice);
            const kDonchianMid = (kHighest + kLowest) / 2;
            const kMidpoint = (kDonchianMid + kSma) / 2;
            valSeries.push(prices[k] - kMidpoint);
          }
        }

        // Calculate Linear Regression value (endpoint of the regression line)
        const linRegValue = this.linearRegression(valSeries);
        rawMomentum.push(linRegValue);
      }
    }

    // Second pass: determine colors based on momentum value and direction
    for (let i = 0; i < rawMomentum.length; i++) {
      const currentMomentum = rawMomentum[i];
      const prevMomentum = i > 0 ? rawMomentum[i - 1] : null;

      if (currentMomentum === null) {
        momentum.push(null);
        histogram.push(null);
        barColors.push('rgba(128, 128, 128, 0.5)');
      } else {
        momentum.push(currentMomentum);
        histogram.push(currentMomentum);
        
        // Determine color based on momentum sign and direction
        // Positive momentum: Blue (up) or Cyan (down)
        // Negative momentum: Yellow (up) or Red (down)
        const isPositive = currentMomentum >= 0;
        const isIncreasing = prevMomentum !== null ? currentMomentum > prevMomentum : true;

        if (isPositive) {
          if (isIncreasing) {
            barColors.push('#2196F3'); // Blue - Positive and Up
          } else {
            barColors.push('#00BCD4'); // Cyan - Positive and Down
          }
        } else {
          if (isIncreasing) {
            barColors.push('#FFEB3B'); // Yellow - Negative and Up
          } else {
            barColors.push('#F44336'); // Red - Negative and Down
          }
        }
      }
    }

    this.ttmSqueezeData = { upperBand, lowerBand, momentum, squeeze, histogram, barColors };
    
    // Emit data for parent components
    this.ttmSqueezeDataChange.emit(this.ttmSqueezeData);
    this.emitTTMSqueezeInfo();
  }

  /**
   * Linear Regression - returns the endpoint value of the regression line
   */
  private linearRegression(values: number[]): number {
    const n = values.length;
    if (n === 0) return 0;
    if (n === 1) return values[0];

    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumX2 = 0;

    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += values[i];
      sumXY += i * values[i];
      sumX2 += i * i;
    }

    const denominator = n * sumX2 - sumX * sumX;
    if (denominator === 0) return values[n - 1];

    const slope = (n * sumXY - sumX * sumY) / denominator;
    const intercept = (sumY - slope * sumX) / n;

    // Return the value at the last point (endpoint of regression line)
    return intercept + slope * (n - 1);
  }

  private createHistogramChart(): void {
    if (this.histogramChart) {
      this.histogramChart.destroy();
    }

    if (!this.ttmSqueezeData || !this.histogramCanvas || !this.histogramCanvas.nativeElement) {
      console.warn('Histogram canvas or TTM Squeeze data not available');
      return;
    }

    // Create squeeze dots data (0 for all points to place on zero line)
    const squeezeDots = this.ttmSqueezeData.squeeze.map(() => 0);
    const squeezeDotColors = this.ttmSqueezeData.squeeze.map((isInSqueeze: boolean, index: number) => {
      if (this.ttmSqueezeData!.histogram[index] === null) return 'transparent';
      return isInSqueeze ? '#F44336' : '#4CAF50'; // Red = squeeze on, Green = squeeze off
    });

    const histogramConfig: ChartConfiguration = {
      type: 'bar',
      data: {
        labels: this.dates.map((date: string) => new Date(date).toLocaleDateString()),
        datasets: [
          {
            label: 'TTM Squeeze Momentum',
            data: this.ttmSqueezeData.histogram,
            backgroundColor: this.ttmSqueezeData.barColors,
            borderColor: this.ttmSqueezeData.barColors,
            borderWidth: 0,
            borderSkipped: false,
            order: 2
          },
          {
            label: 'Squeeze Status',
            data: squeezeDots,
            type: 'scatter' as any,
            backgroundColor: squeezeDotColors,
            borderColor: squeezeDotColors,
            pointRadius: 4,
            pointStyle: 'circle',
            order: 1
          }
        ]
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
          tooltip: {
            mode: 'index',
            intersect: false,
            callbacks: {
              label: (context) => {
                if (context.datasetIndex === 0) {
                  const value = context.parsed.y;
                  if (value === null) return '';
                  return `Momentum: ${value.toFixed(4)}`;
                } else {
                  const isInSqueeze = this.ttmSqueezeData?.squeeze[context.dataIndex];
                  return `Squeeze: ${isInSqueeze ? 'ON' : 'OFF'}`;
                }
              }
            }
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
              text: 'Momentum'
            },
            grid: {
              color: 'rgba(0,0,0,0.1)'
            },
            ticks: {
              callback: function(value) {
                return typeof value === 'number' ? value.toFixed(2) : value;
              }
            }
          }
        }
      }
    };

    this.histogramChart = new Chart(this.histogramCanvas.nativeElement, histogramConfig);
  }

  private emitTTMSqueezeInfo(): void {
    const info = this.getTTMSqueezeInfo();
    this.ttmSqueezeInfoChange.emit(info);
  }

  getTTMSqueezeInfo(): string {
    if (!this.ttmSqueezeData) {
      return 'N/A';
    }

    const lastIndex = this.ttmSqueezeData.upperBand.length - 1;
    if (lastIndex >= 0 && this.ttmSqueezeData.upperBand[lastIndex] !== null) {
      const upper = this.ttmSqueezeData.upperBand[lastIndex]!.toFixed(2);
      const lower = this.ttmSqueezeData.lowerBand[lastIndex]!.toFixed(2);
      const momentumVal = this.ttmSqueezeData.momentum[lastIndex];
      const momentum = momentumVal !== null ? momentumVal.toFixed(4) : 'N/A';
      const isInSqueeze = this.ttmSqueezeData.squeeze[lastIndex];
      const squeezeStatus = isInSqueeze ? 'IN SQUEEZE' : 'NO SQUEEZE';
      return `Upper: $${upper} | Lower: $${lower} | Momentum: ${momentum} | Status: ${squeezeStatus}`;
    }

    return 'N/A';
  }

  /**
   * Get the calculated TTM Squeeze data for use by parent components
   * (e.g., for adding bands to the main price chart)
   */
  getSqueezeData(): TTMSqueezeData | null {
    return this.ttmSqueezeData;
  }

  ngOnDestroy(): void {
    if (this.histogramChart) {
      this.histogramChart.destroy();
      this.histogramChart = null;
    }
  }
}

