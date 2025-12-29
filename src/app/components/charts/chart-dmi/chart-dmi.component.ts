import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';

Chart.register(...registerables, zoomPlugin);

/**
 * DMI (Directional Movement Index) Component
 * 
 * Based on thinkorswim DMI settings:
 * - Length: 14 (configurable)
 * - Average Type: WILDERS (Wilder's smoothing)
 * - Plots: DI+, DI-, ADX
 * 
 * Wilder's Smoothing Formula:
 * First Value: SUM of first N periods / N
 * Subsequent: (Previous Value × (N-1) + Current Value) / N
 */
@Component({
  selector: 'app-chart-dmi',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './chart-dmi.component.html',
  styleUrl: './chart-dmi.component.scss'
})
export class ChartDmiComponent implements OnChanges, OnDestroy {
  @Input() priceData: number[] = [];
  @Input() dates: string[] = [];
  @Input() length: number = 14;  // thinkorswim default
  
  @Output() dmiInfoChange = new EventEmitter<string>();
  
  @ViewChild('dmiCanvas', { static: false }) dmiCanvas!: ElementRef<HTMLCanvasElement>;
  
  dmiChart: Chart | null = null;
  dmiData: { plusDI: (number | null)[], minusDI: (number | null)[], adx: (number | null)[] } = { 
    plusDI: [], 
    minusDI: [], 
    adx: [] 
  };

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['priceData'] || changes['dates'] || changes['length']) && this.priceData.length > 0) {
      this.calculateDMI();
      setTimeout(() => this.createChart(), 100);
    }
  }

  /**
   * Calculate DMI using thinkorswim's methodology
   * Uses Wilder's Smoothing with configurable length (default 14)
   */
  private calculateDMI(): void {
    this.dmiData = { plusDI: [], minusDI: [], adx: [] };
    
    const prices = this.priceData;
    const period = this.length;

    if (prices.length < period + 1) {
      // Not enough data for DMI calculation
      for (let i = 0; i < prices.length; i++) {
        this.dmiData.plusDI.push(null);
        this.dmiData.minusDI.push(null);
        this.dmiData.adx.push(null);
      }
      this.emitDmiInfo();
      return;
    }

    // Calculate True Range (TR) and Directional Movement (+DM, -DM)
    const trueRanges: number[] = [];
    const plusDM: number[] = [];
    const minusDM: number[] = [];

    for (let i = 1; i < prices.length; i++) {
      // Since we only have close prices, we estimate high/low from price movement
      const currentPrice = prices[i];
      const prevPrice = prices[i - 1];
      
      // True Range: For single price data, use absolute price change
      const tr = Math.abs(currentPrice - prevPrice);
      trueRanges.push(tr);

      // Directional Movement calculation
      const upMove = currentPrice - prevPrice;
      const downMove = prevPrice - currentPrice;

      // +DM: If upMove > downMove and upMove > 0, use upMove; else 0
      if (upMove > downMove && upMove > 0) {
        plusDM.push(upMove);
        minusDM.push(0);
      } 
      // -DM: If downMove > upMove and downMove > 0, use downMove; else 0
      else if (downMove > upMove && downMove > 0) {
        plusDM.push(0);
        minusDM.push(downMove);
      } 
      // Both are 0 if conditions not met
      else {
        plusDM.push(0);
        minusDM.push(0);
      }
    }

    // Apply Wilder's Smoothing to TR, +DM, -DM
    const smoothedTR = this.wildersSmoothing(trueRanges, period);
    const smoothedPlusDM = this.wildersSmoothing(plusDM, period);
    const smoothedMinusDM = this.wildersSmoothing(minusDM, period);

    // Calculate +DI, -DI, and DX
    const plusDIValues: number[] = [];
    const minusDIValues: number[] = [];
    const dxValues: number[] = [];

    for (let i = 0; i < smoothedTR.length; i++) {
      const tr = smoothedTR[i];
      
      // Avoid division by zero
      if (tr === 0) {
        plusDIValues.push(0);
        minusDIValues.push(0);
        dxValues.push(0);
      } else {
        const plusDI = (smoothedPlusDM[i] / tr) * 100;
        const minusDI = (smoothedMinusDM[i] / tr) * 100;
        
        plusDIValues.push(plusDI);
        minusDIValues.push(minusDI);

        // DX = |+DI - (-DI)| / (+DI + (-DI)) * 100
        const diSum = plusDI + minusDI;
        const dx = diSum === 0 ? 0 : (Math.abs(plusDI - minusDI) / diSum) * 100;
        dxValues.push(dx);
      }
    }

    // Calculate ADX using Wilder's Smoothing on DX
    const adxValues = this.wildersSmoothing(dxValues, period);

    // Build the output arrays with proper null padding
    for (let i = 0; i < prices.length; i++) {
      // Need at least 'period' data points before we have valid +DI/-DI
      if (i < period) {
        this.dmiData.plusDI.push(null);
        this.dmiData.minusDI.push(null);
        this.dmiData.adx.push(null);
      } else {
        const diIndex = i - period;
        
        if (diIndex < plusDIValues.length) {
          this.dmiData.plusDI.push(plusDIValues[diIndex]);
          this.dmiData.minusDI.push(minusDIValues[diIndex]);
          
          // ADX requires additional smoothing period
          // ADX starts after period * 2 - 1 data points
          if (i < period * 2 - 1 || diIndex >= adxValues.length) {
            this.dmiData.adx.push(null);
          } else {
            const adxIndex = diIndex - (period - 1);
            if (adxIndex >= 0 && adxIndex < adxValues.length) {
              this.dmiData.adx.push(adxValues[adxIndex]);
            } else {
              this.dmiData.adx.push(null);
            }
          }
        } else {
          this.dmiData.plusDI.push(null);
          this.dmiData.minusDI.push(null);
          this.dmiData.adx.push(null);
        }
      }
    }

    this.emitDmiInfo();
  }

  /**
   * Wilder's Smoothing (as used in thinkorswim)
   * 
   * Formula:
   * - First smoothed value = SUM of first N values / N
   * - Subsequent values = (Previous Smoothed × (N-1) + Current Value) / N
   * 
   * This is equivalent to: Previous + (Current - Previous) / N
   * Or: Previous × (1 - 1/N) + Current × (1/N)
   */
  private wildersSmoothing(values: number[], period: number): number[] {
    if (values.length < period) {
      return [];
    }

    const smoothed: number[] = [];
    
    // First smoothed value: average of first 'period' values
    let sum = 0;
    for (let i = 0; i < period; i++) {
      sum += values[i];
    }
    smoothed.push(sum / period);

    // Subsequent values use Wilder's formula
    for (let i = period; i < values.length; i++) {
      const prevSmoothed = smoothed[smoothed.length - 1];
      // Wilder's smoothing: (Previous × (period - 1) + Current) / period
      const newSmoothed = (prevSmoothed * (period - 1) + values[i]) / period;
      smoothed.push(newSmoothed);
    }

    return smoothed;
  }

  private createChart(): void {
    if (this.dmiChart) {
      this.dmiChart.destroy();
    }

    if (!this.dmiCanvas || !this.dmiCanvas.nativeElement) {
      console.warn('DMI canvas not available');
      return;
    }

    if (this.dmiData.plusDI.length === 0) {
      return;
    }

    const dmiConfig: ChartConfiguration = {
      type: 'line',
      data: {
        labels: this.dates.map((date: string) => new Date(date).toLocaleDateString()),
        datasets: [
          {
            label: 'DI+',
            data: this.dmiData.plusDI,
            borderColor: '#00bcd4',  // Cyan/teal color like thinkorswim
            backgroundColor: 'rgba(0, 188, 212, 0.1)',
            borderWidth: 1.5,
            fill: false,
            tension: 0.2,
            pointRadius: 0,
            pointHoverRadius: 4,
            order: 1
          },
          {
            label: 'DI-',
            data: this.dmiData.minusDI,
            borderColor: '#ff5252',  // Red color like thinkorswim
            backgroundColor: 'rgba(255, 82, 82, 0.1)',
            borderWidth: 1.5,
            fill: false,
            tension: 0.2,
            pointRadius: 0,
            pointHoverRadius: 4,
            order: 2
          },
          {
            label: 'ADX',
            data: this.dmiData.adx,
            borderColor: '#ffeb3b',  // Yellow/gold color like thinkorswim
            backgroundColor: 'rgba(255, 235, 59, 0.1)',
            borderWidth: 2,
            fill: false,
            tension: 0.2,
            pointRadius: 0,
            pointHoverRadius: 4,
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
            position: 'top' as const,
            labels: {
              usePointStyle: true,
              padding: 15
            }
          },
          title: {
            display: false
          },
          tooltip: {
            mode: 'index',
            intersect: false,
            callbacks: {
              label: (context) => {
                const value = context.parsed.y;
                if (value === null) return '';
                return `${context.dataset.label}: ${value.toFixed(2)}`;
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
              text: 'DMI Values'
            },
            min: 0,
            max: 100,
            grid: {
              color: 'rgba(0,0,0,0.1)'
            },
            ticks: {
              callback: function(value) {
                return typeof value === 'number' ? value.toFixed(0) : value;
              }
            }
          }
        },
        interaction: {
          mode: 'index',
          intersect: false
        }
      }
    };

    this.dmiChart = new Chart(this.dmiCanvas.nativeElement, dmiConfig);
  }

  private emitDmiInfo(): void {
    const info = this.getDMIInfo();
    this.dmiInfoChange.emit(info);
  }

  getDMIInfo(): string {
    if (!this.dmiData || this.dmiData.plusDI.length === 0) {
      return 'N/A';
    }

    const validPlusDI = this.dmiData.plusDI.filter((v): v is number => v !== null);
    const validMinusDI = this.dmiData.minusDI.filter((v): v is number => v !== null);
    const validADX = this.dmiData.adx.filter((v): v is number => v !== null);

    if (validPlusDI.length === 0 || validMinusDI.length === 0) {
      return 'N/A';
    }

    const currentPlusDI = validPlusDI[validPlusDI.length - 1];
    const currentMinusDI = validMinusDI[validMinusDI.length - 1];
    const currentADX = validADX.length > 0 ? validADX[validADX.length - 1] : 0;

    const plusDIValue = currentPlusDI.toFixed(1);
    const minusDIValue = currentMinusDI.toFixed(1);
    const adxValue = currentADX.toFixed(1);

    let trend = 'Neutral';
    let strength = 'Weak';
    
    if (currentPlusDI > currentMinusDI) {
      trend = 'Bullish';
    } else if (currentMinusDI > currentPlusDI) {
      trend = 'Bearish';
    }

    // ADX interpretation (thinkorswim standard)
    // < 20: Weak or absent trend
    // 20-25: Emerging trend
    // 25-50: Strong trend
    // 50-75: Very strong trend
    // > 75: Extremely strong trend
    if (currentADX >= 50) {
      strength = 'Very Strong';
    } else if (currentADX >= 25) {
      strength = 'Strong';
    } else if (currentADX >= 20) {
      strength = 'Moderate';
    }

    return `DI+: ${plusDIValue} | DI-: ${minusDIValue} | ADX: ${adxValue} | ${trend} (${strength})`;
  }

  ngOnDestroy(): void {
    if (this.dmiChart) {
      this.dmiChart.destroy();
      this.dmiChart = null;
    }
  }
}

