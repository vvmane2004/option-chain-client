import { Component, Input, OnInit, OnChanges, SimpleChanges, ViewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';
import { OptionChainService } from '../../../services/option-chain.service';
import { OptionChainUnderlyingPrice } from '../../../interfaces/option-chain.interface';

Chart.register(...registerables, zoomPlugin);

@Component({
  selector: 'app-chart-price-put',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './chart-price-put.component.html',
  styleUrl: './chart-price-put.component.scss'
})
export class ChartPricePutComponent implements OnInit, OnChanges, AfterViewInit, OnDestroy {
  @Input() symbol: string | null = null;
  @Input() expiration: string | null = null;
  @Input() loadTrigger: boolean = false;
  
  @ViewChild('chartCanvas', { static: false }) chartCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('histogramCanvas', { static: false }) histogramCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('dmiCanvas', { static: false }) dmiCanvas!: ElementRef<HTMLCanvasElement>;
  
  chart: Chart | null = null;
  histogramChart: Chart | null = null;
  dmiChart: Chart | null = null;
  loading = false;
  error: string | null = null;
  data: OptionChainUnderlyingPrice[] = [];
  ttmSqueezeData: any = null;
  demandSupplyZones: { demand: any[], supply: any[] } = { demand: [], supply: [] };
  dmiData: { plusDI: number[], minusDI: number[], adx: number[] } = { plusDI: [], minusDI: [], adx: [] };

  constructor(private optionChainService: OptionChainService) {}

  ngOnInit(): void {
    // Don't auto-load on init, wait for loadTrigger
  }

  ngAfterViewInit(): void {
    // View is ready
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['loadTrigger'] && this.loadTrigger) {
      setTimeout(() => this.loadData(), 0);
    }
  }

  loadData(): void {
    if (!this.symbol || !this.expiration) {
      this.clearChart();
      return;
    }

    this.loading = true;
    this.error = null;

    this.optionChainService.getUnderlyingPrice(this.symbol, this.expiration, 'put')
      .subscribe({
        next: (data) => {
          this.data = data;
          this.createChart();
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading underlying price data:', error);
          this.error = 'Failed to load underlying price data';
          this.loading = false;
          this.clearChart();
        }
      });
  }

  private createChart(): void {
    if (this.chart) {
      this.chart.destroy();
    }

    if (!this.data || this.data.length === 0) {
      return;
    }

    if (!this.chartCanvas || !this.chartCanvas.nativeElement) {
      console.warn('Canvas element not available yet, retrying...');
      setTimeout(() => this.createChart(), 100);
      return;
    }

    const groupedData = this.groupDataByDate();
    const dates = Object.keys(groupedData).sort();
    const priceData = dates.map(date => groupedData[date].avgPrice);

    const datasets: any[] = [
      {
        label: 'Underlying Price',
        data: priceData,
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderWidth: 3,
        fill: false,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6,
        order: 1
      }
    ];

    // Add TTM Squeeze for puts
    const ttmSqueeze = this.calculateTTMSqueeze(priceData, 20, 1.5, 2.0);
    
    // Add Keltner Channels (TTM Squeeze bands)
    datasets.push(
      {
        label: 'TTM Squeeze Upper (KC)',
        data: ttmSqueeze.upperBand,
        borderColor: '#06b6d4',
        backgroundColor: 'rgba(6, 182, 212, 0.1)',
        borderWidth: 1,
        fill: false,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 0,
        order: 3
      },
      {
        label: 'TTM Squeeze Lower (KC)',
        data: ttmSqueeze.lowerBand,
        borderColor: '#06b6d4',
        backgroundColor: 'rgba(6, 182, 212, 0.1)',
        borderWidth: 1,
        fill: false,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 0,
        order: 3
      }
    );

    // Store TTM Squeeze data for histogram
    this.ttmSqueezeData = ttmSqueeze;

    // Calculate Demand and Supply zones BEFORE creating the chart
    this.calculateDemandSupplyZones(priceData, dates);

    // Add Demand and Supply zones as horizontal lines
    this.addDemandSupplyZonesToChart(datasets, dates);

    const config: ChartConfiguration = {
      type: 'line',
      data: {
        labels: dates.map((date: string) => new Date(date).toLocaleDateString()),
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
            text: `${this.symbol} - PUT Underlying Price with TTM Squeeze`,
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

    // Create TTM Squeeze histogram
    if (this.ttmSqueezeData) {
      setTimeout(() => this.createHistogramChart(), 100);
    }

    // Calculate and create DMI chart
    this.calculateDMI(priceData, 14);
    setTimeout(() => this.createDMIChart(), 300);
  }

  private createHistogramChart(): void {
    if (this.histogramChart) {
      this.histogramChart.destroy();
    }

    if (!this.ttmSqueezeData || !this.histogramCanvas || !this.histogramCanvas.nativeElement) {
      console.warn('Histogram canvas or TTM Squeeze data not available');
      return;
    }

    const groupedData = this.groupDataByDate();
    const dates = Object.keys(groupedData).sort();

    const histogramConfig: ChartConfiguration = {
      type: 'bar',
      data: {
        labels: dates.map((date: string) => new Date(date).toLocaleDateString()),
        datasets: [{
          label: 'TTM Squeeze Momentum',
          data: this.ttmSqueezeData.histogram,
          backgroundColor: this.ttmSqueezeData.histogram.map((value: number) => {
            if (value === null) return 'rgba(128, 128, 128, 0.3)';
            return value > 0 ? 'rgba(34, 197, 94, 0.8)' : 'rgba(239, 68, 68, 0.8)';
          }),
          borderColor: this.ttmSqueezeData.histogram.map((value: number) => {
            if (value === null) return 'rgba(128, 128, 128, 0.5)';
            return value > 0 ? 'rgba(34, 197, 94, 1)' : 'rgba(239, 68, 68, 1)';
          }),
          borderWidth: 1,
          borderSkipped: false,
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

  private calculateTTMSqueeze(prices: number[], period: number, kcMultiplier: number, bbMultiplier: number): { 
    upperBand: number[], 
    lowerBand: number[], 
    momentum: number[], 
    squeeze: boolean[],
    histogram: number[]
  } {
    const upperBand: number[] = [];
    const lowerBand: number[] = [];
    const momentum: number[] = [];
    const squeeze: boolean[] = [];
    const histogram: number[] = [];

    for (let i = 0; i < prices.length; i++) {
      if (i < period - 1) {
        // Not enough data points for the period
        upperBand.push(null as any);
        lowerBand.push(null as any);
        momentum.push(null as any);
        squeeze.push(false);
        histogram.push(null as any);
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

        // TTM Squeeze Momentum: Difference between BB and KC
        const bbWidth = bbUpper - bbLower;
        const kcWidth = kcUpper - kcLower;
        const squeezeMomentum = bbWidth - kcWidth;
        momentum.push(squeezeMomentum);

        // Determine if in squeeze (BB inside KC)
        const isInSqueeze = bbUpper < kcUpper && bbLower > kcLower;
        squeeze.push(isInSqueeze);

        // TTM Squeeze Histogram: Shows momentum with color coding
        // Positive = green, Negative = red, Zero line = gray
        histogram.push(squeezeMomentum);
      }
    }

    return { upperBand, lowerBand, momentum, squeeze, histogram };
  }

  private calculateDemandSupplyZones(prices: number[], dates: string[]): void {
    this.demandSupplyZones = { demand: [], supply: [] };
    
    if (prices.length < 10) {
      return; // Need minimum data for zone calculation
    }

    const lookbackPeriod = 5; // Look back 5 periods for zone identification
    const minZoneStrength = 2; // Minimum touches to form a zone

    // Find swing highs and lows
    const swingPoints: { index: number, price: number, type: 'high' | 'low' }[] = [];
    
    for (let i = lookbackPeriod; i < prices.length - lookbackPeriod; i++) {
      const currentPrice = prices[i];
      let isSwingHigh = true;
      let isSwingLow = true;

      // Check if it's a swing high
      for (let j = i - lookbackPeriod; j <= i + lookbackPeriod; j++) {
        if (j !== i && prices[j] >= currentPrice) {
          isSwingHigh = false;
          break;
        }
      }

      // Check if it's a swing low
      for (let j = i - lookbackPeriod; j <= i + lookbackPeriod; j++) {
        if (j !== i && prices[j] <= currentPrice) {
          isSwingLow = false;
          break;
        }
      }

      if (isSwingHigh) {
        swingPoints.push({ index: i, price: currentPrice, type: 'high' });
      } else if (isSwingLow) {
        swingPoints.push({ index: i, price: currentPrice, type: 'low' });
      }
    }

    // Group nearby swing points to form zones
    const tolerance = 0.02; // 2% tolerance for zone grouping
    const demandZones: { price: number, touches: number, startDate: string, endDate: string }[] = [];
    const supplyZones: { price: number, touches: number, startDate: string, endDate: string }[] = [];

    // Process swing lows (demand zones)
    const swingLows = swingPoints.filter(p => p.type === 'low');
    for (let i = 0; i < swingLows.length; i++) {
      const currentLow = swingLows[i];
      let zoneFound = false;

      // Check if this low is near an existing demand zone
      for (let j = 0; j < demandZones.length; j++) {
        const zone = demandZones[j];
        const priceDiff = Math.abs(currentLow.price - zone.price) / zone.price;
        
        if (priceDiff <= tolerance) {
          zone.touches++;
          zone.endDate = dates[currentLow.index];
          zoneFound = true;
          break;
        }
      }

      // Create new demand zone if not found
      if (!zoneFound) {
        demandZones.push({
          price: currentLow.price,
          touches: 1,
          startDate: dates[currentLow.index],
          endDate: dates[currentLow.index]
        });
      }
    }

    // Process swing highs (supply zones)
    const swingHighs = swingPoints.filter(p => p.type === 'high');
    for (let i = 0; i < swingHighs.length; i++) {
      const currentHigh = swingHighs[i];
      let zoneFound = false;

      // Check if this high is near an existing supply zone
      for (let j = 0; j < supplyZones.length; j++) {
        const zone = supplyZones[j];
        const priceDiff = Math.abs(currentHigh.price - zone.price) / zone.price;
        
        if (priceDiff <= tolerance) {
          zone.touches++;
          zone.endDate = dates[currentHigh.index];
          zoneFound = true;
          break;
        }
      }

      // Create new supply zone if not found
      if (!zoneFound) {
        supplyZones.push({
          price: currentHigh.price,
          touches: 1,
          startDate: dates[currentHigh.index],
          endDate: dates[currentHigh.index]
        });
      }
    }

    // Filter zones by minimum strength and sort by recency
    this.demandSupplyZones.demand = demandZones
      .filter(zone => zone.touches >= minZoneStrength)
      .sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime())
      .slice(0, 5); // Show only top 5 most recent demand zones

    this.demandSupplyZones.supply = supplyZones
      .filter(zone => zone.touches >= minZoneStrength)
      .sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime())
      .slice(0, 5); // Show only top 5 most recent supply zones

    // Debug logging
    console.log('Demand zones found:', this.demandSupplyZones.demand.length);
    console.log('Supply zones found:', this.demandSupplyZones.supply.length);
    if (this.demandSupplyZones.demand.length > 0) {
      console.log('Strongest demand zone:', this.demandSupplyZones.demand[0]);
    }
    if (this.demandSupplyZones.supply.length > 0) {
      console.log('Strongest supply zone:', this.demandSupplyZones.supply[0]);
    }
  }

  private addDemandSupplyZonesToChart(datasets: any[], dates: string[]): void {
    // Add Demand zones (green horizontal lines with fill)
    this.demandSupplyZones.demand.forEach((zone, index) => {
      datasets.push({
        label: `Demand Zone ${index + 1} (${zone.touches} touches)`,
        data: new Array(dates.length).fill(zone.price),
        borderColor: '#22c55e',
        backgroundColor: 'rgba(34, 197, 94, 0.2)',
        borderWidth: 3,
        fill: '+1',
        tension: 0,
        pointRadius: 0,
        pointHoverRadius: 0,
        order: 10 + index,
        borderDash: [8, 4],
        borderCapStyle: 'round'
      });
    });

    // Add Supply zones (red horizontal lines with fill)
    this.demandSupplyZones.supply.forEach((zone, index) => {
      datasets.push({
        label: `Supply Zone ${index + 1} (${zone.touches} touches)`,
        data: new Array(dates.length).fill(zone.price),
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
        borderWidth: 3,
        fill: '-1',
        tension: 0,
        pointRadius: 0,
        pointHoverRadius: 0,
        order: 20 + index,
        borderDash: [8, 4],
        borderCapStyle: 'round'
      });
    });
  }

  private calculateDMI(prices: number[], period: number): void {
    this.dmiData = { plusDI: [], minusDI: [], adx: [] };
    
    if (prices.length < period + 1) {
      // Not enough data for DMI calculation
      for (let i = 0; i < prices.length; i++) {
        this.dmiData.plusDI.push(null as any);
        this.dmiData.minusDI.push(null as any);
        this.dmiData.adx.push(null as any);
      }
      return;
    }

    // Calculate True Range (TR) for each period
    const trueRanges: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      const high = prices[i];
      const low = prices[i];
      const prevClose = prices[i - 1];
      
      const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );
      trueRanges.push(tr);
    }

    // Calculate Directional Movement
    const plusDM: number[] = [];
    const minusDM: number[] = [];
    
    for (let i = 1; i < prices.length; i++) {
      const highDiff = prices[i] - prices[i - 1];
      const lowDiff = prices[i - 1] - prices[i];
      
      if (highDiff > lowDiff && highDiff > 0) {
        plusDM.push(highDiff);
        minusDM.push(0);
      } else if (lowDiff > highDiff && lowDiff > 0) {
        plusDM.push(0);
        minusDM.push(lowDiff);
      } else {
        plusDM.push(0);
        minusDM.push(0);
      }
    }

    // Calculate smoothed values using Wilder's smoothing
    const smoothedTR = this.calculateWilderSmoothing(trueRanges, period);
    const smoothedPlusDM = this.calculateWilderSmoothing(plusDM, period);
    const smoothedMinusDM = this.calculateWilderSmoothing(minusDM, period);

    // Calculate +DI and -DI
    for (let i = 0; i < prices.length; i++) {
      if (i < period) {
        this.dmiData.plusDI.push(null as any);
        this.dmiData.minusDI.push(null as any);
        this.dmiData.adx.push(null as any);
      } else {
        const plusDI = (smoothedPlusDM[i - period] / smoothedTR[i - period]) * 100;
        const minusDI = (smoothedMinusDM[i - period] / smoothedTR[i - period]) * 100;
        
        this.dmiData.plusDI.push(plusDI);
        this.dmiData.minusDI.push(minusDI);

        // Calculate DX (Directional Index)
        const dx = Math.abs(plusDI - minusDI) / (plusDI + minusDI) * 100;
        
        if (i < period * 2 - 1) {
          this.dmiData.adx.push(null as any);
        } else {
          // Calculate ADX (Average Directional Index)
          const adxValues = this.dmiData.adx.filter(val => val !== null);
          if (adxValues.length === 0) {
            // First ADX value is the average of the first period DX values
            let sum = 0;
            let count = 0;
            for (let j = i - period + 1; j <= i; j++) {
              if (j >= period && j < this.dmiData.plusDI.length) {
                const plusDIVal = this.dmiData.plusDI[j];
                const minusDIVal = this.dmiData.minusDI[j];
                if (plusDIVal !== null && minusDIVal !== null) {
                  const dxVal = Math.abs(plusDIVal - minusDIVal) / (plusDIVal + minusDIVal) * 100;
                  sum += dxVal;
                  count++;
                }
              }
            }
            this.dmiData.adx.push(count > 0 ? sum / count : null as any);
          } else {
            // Subsequent ADX values use Wilder's smoothing
            const prevADX = adxValues[adxValues.length - 1];
            const newADX = ((prevADX * (period - 1)) + dx) / period;
            this.dmiData.adx.push(newADX);
          }
        }
      }
    }
  }

  private calculateWilderSmoothing(values: number[], period: number): number[] {
    const smoothed: number[] = [];
    
    // First smoothed value is the sum of the first period values
    let sum = 0;
    for (let i = 0; i < period && i < values.length; i++) {
      sum += values[i];
    }
    smoothed.push(sum / Math.min(period, values.length));

    // Subsequent values use Wilder's smoothing formula
    for (let i = period; i < values.length; i++) {
      const newValue = (smoothed[smoothed.length - 1] * (period - 1) + values[i]) / period;
      smoothed.push(newValue);
    }

    return smoothed;
  }

  private createDMIChart(): void {
    if (this.dmiChart) {
      this.dmiChart.destroy();
    }

    if (!this.dmiData || !this.dmiCanvas || !this.dmiCanvas.nativeElement) {
      console.warn('DMI canvas or data not available');
      return;
    }

    const groupedData = this.groupDataByDate();
    const dates = Object.keys(groupedData).sort();

    const dmiConfig: ChartConfiguration = {
      type: 'line',
      data: {
        labels: dates.map((date: string) => new Date(date).toLocaleDateString()),
        datasets: [
          {
            label: '+DI (Positive Directional Indicator)',
            data: this.dmiData.plusDI,
            borderColor: '#22c55e',
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            borderWidth: 2,
            fill: false,
            tension: 0.4,
            pointRadius: 2,
            pointHoverRadius: 4,
            order: 1
          },
          {
            label: '-DI (Negative Directional Indicator)',
            data: this.dmiData.minusDI,
            borderColor: '#ef4444',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            borderWidth: 2,
            fill: false,
            tension: 0.4,
            pointRadius: 2,
            pointHoverRadius: 4,
            order: 2
          },
          {
            label: 'ADX (Average Directional Index)',
            data: this.dmiData.adx,
            borderColor: '#8b5cf6',
            backgroundColor: 'rgba(139, 92, 246, 0.1)',
            borderWidth: 3,
            fill: false,
            tension: 0.4,
            pointRadius: 2,
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
              text: 'DMI Values'
            },
            min: 0,
            max: 100,
            grid: {
              color: 'rgba(0,0,0,0.1)'
            },
            ticks: {
              callback: function(value) {
                return typeof value === 'number' ? value.toFixed(1) + '%' : value;
              }
            }
          }
        },
        elements: {
          point: {
            backgroundColor: (context: any) => {
              const datasetIndex = context.datasetIndex;
              const value = context.parsed.y;
              if (value === null) return 'rgba(128, 128, 128, 0.5)';
              
              if (datasetIndex === 0) return '#22c55e'; // +DI - green
              if (datasetIndex === 1) return '#ef4444'; // -DI - red
              if (datasetIndex === 2) {
                // ADX - purple, but darker for strong trends
                return value >= 25 ? '#7c3aed' : '#a78bfa';
              }
              return '#8b5cf6';
            },
            borderColor: (context: any) => {
              const datasetIndex = context.datasetIndex;
              const value = context.parsed.y;
              if (value === null) return 'rgba(128, 128, 128, 0.8)';
              
              if (datasetIndex === 0) return '#16a34a'; // +DI - darker green
              if (datasetIndex === 1) return '#dc2626'; // -DI - darker red
              if (datasetIndex === 2) {
                // ADX - darker purple for strong trends
                return value >= 25 ? '#6d28d9' : '#8b5cf6';
              }
              return '#7c3aed';
            }
          }
        }
      }
    };

    this.dmiChart = new Chart(this.dmiCanvas.nativeElement, dmiConfig);
  }

  private clearChart(): void {
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
    if (this.histogramChart) {
      this.histogramChart.destroy();
      this.histogramChart = null;
    }
    if (this.dmiChart) {
      this.dmiChart.destroy();
      this.dmiChart = null;
    }
    this.ttmSqueezeData = null;
    this.demandSupplyZones = { demand: [], supply: [] };
    this.dmiData = { plusDI: [], minusDI: [], adx: [] };
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

  getTTMSqueezeInfo(): string {
    if (!this.data || this.data.length === 0 || !this.ttmSqueezeData) {
      return 'N/A';
    }

    // Get the latest valid TTM Squeeze values
    const lastIndex = this.ttmSqueezeData.upperBand.length - 1;
    if (lastIndex >= 0 && this.ttmSqueezeData.upperBand[lastIndex] !== null) {
      const upper = this.ttmSqueezeData.upperBand[lastIndex]!.toFixed(2);
      const lower = this.ttmSqueezeData.lowerBand[lastIndex]!.toFixed(2);
      const momentum = this.ttmSqueezeData.momentum[lastIndex]!.toFixed(2);
      const isInSqueeze = this.ttmSqueezeData.squeeze[lastIndex];
      const squeezeStatus = isInSqueeze ? 'IN SQUEEZE' : 'NO SQUEEZE';
      return `Upper: $${upper} | Lower: $${lower} | Momentum: ${momentum} | Status: ${squeezeStatus}`;
    }

    return 'N/A';
  }

  getDemandSupplyZonesInfo(): string {
    if (!this.demandSupplyZones || (this.demandSupplyZones.demand.length === 0 && this.demandSupplyZones.supply.length === 0)) {
      return 'N/A';
    }

    const demandCount = this.demandSupplyZones.demand.length;
    const supplyCount = this.demandSupplyZones.supply.length;
    
    let info = `Demand: ${demandCount} zones | Supply: ${supplyCount} zones`;
    
    if (demandCount > 0) {
      const strongestDemand = this.demandSupplyZones.demand[0];
      info += ` | Strongest Demand: $${strongestDemand.price.toFixed(2)} (${strongestDemand.touches} touches)`;
    }
    
    if (supplyCount > 0) {
      const strongestSupply = this.demandSupplyZones.supply[0];
      info += ` | Strongest Supply: $${strongestSupply.price.toFixed(2)} (${strongestSupply.touches} touches)`;
    }

    return info;
  }

  getDMIInfo(): string {
    if (!this.dmiData || this.dmiData.plusDI.length === 0) {
      return 'N/A';
    }

    const validPlusDI = this.dmiData.plusDI.filter(value => value !== null);
    const validMinusDI = this.dmiData.minusDI.filter(value => value !== null);
    const validADX = this.dmiData.adx.filter(value => value !== null);

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

    if (currentADX >= 25) {
      strength = 'Strong';
    } else if (currentADX >= 20) {
      strength = 'Moderate';
    }

    return `+DI: ${plusDIValue}% | -DI: ${minusDIValue}% | ADX: ${adxValue}% | ${trend} (${strength})`;
  }

  ngOnDestroy(): void {
    this.clearChart();
  }
}