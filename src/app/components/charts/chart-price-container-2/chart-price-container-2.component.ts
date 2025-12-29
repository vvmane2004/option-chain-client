import { Component, Input, OnInit, OnChanges, SimpleChanges, ViewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';
import { OptionChainService } from '../../../services/option-chain.service';
import { OptionChainUnderlyingPrice } from '../../../interfaces/option-chain.interface';
import { ChartDmiComponent } from '../chart-dmi/chart-dmi.component';
import { ChartTtmSqueezeComponent, TTMSqueezeData } from '../chart-ttm-squeeze/chart-ttm-squeeze.component';

Chart.register(...registerables, zoomPlugin);

@Component({
  selector: 'app-chart-price-container-2',
  standalone: true,
  imports: [CommonModule, ChartDmiComponent, ChartTtmSqueezeComponent],
  templateUrl: './chart-price-container-2.component.html',
  styleUrl: './chart-price-container-2.component.scss'
})
export class ChartPriceContainer2Component implements OnInit, OnChanges, AfterViewInit, OnDestroy {
  @Input() symbol: string | null = null;
  @Input() expiration: string | null = null;
  @Input() loadTrigger: boolean = false;
  
  @ViewChild('chartCanvas', { static: false }) chartCanvas!: ElementRef<HTMLCanvasElement>;
  
  chart: Chart | null = null;
  loading = false;
  error: string | null = null;
  data: OptionChainUnderlyingPrice[] = [];
  ttmSqueezeData: TTMSqueezeData | null = null;
  demandSupplyZones: { demand: any[], supply: any[] } = { demand: [], supply: [] };
  
  // Expose data for child components
  priceData: number[] = [];
  chartDates: string[] = [];
  dmiInfo: string = 'N/A';
  ttmSqueezeInfo: string = 'N/A';

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
    const priceDataArr = dates.map(date => groupedData[date].avgPrice);
    
    // Expose data for child components
    this.priceData = priceDataArr;
    this.chartDates = dates;

    const datasets: any[] = [
      {
        label: 'Underlying Price',
        data: priceDataArr,
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderWidth: 1,
        fill: false,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 2,
        order: 1
      }
    ];

    // Add TTM Squeeze for puts
    const ttmSqueeze = this.calculateTTMSqueeze(priceDataArr, 20, 1.5, 2.0);
    
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
    this.calculateDemandSupplyZones(priceDataArr, dates);

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
    histogram: number[],
    barColors: string[]
  } {
    const upperBand: number[] = [];
    const lowerBand: number[] = [];
    const momentum: number[] = [];
    const squeeze: boolean[] = [];
    const histogram: number[] = [];
    const barColors: string[] = [];

    // First pass: calculate raw momentum values
    const rawMomentum: (number | null)[] = [];

    for (let i = 0; i < prices.length; i++) {
      if (i < period - 1) {
        // Not enough data points for the period
        upperBand.push(null as any);
        lowerBand.push(null as any);
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
        const val = prices[i] - midpoint;

        // For linear regression, we need a series of values
        // Build the value series for this lookback window
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
        momentum.push(null as any);
        histogram.push(null as any);
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

    return { upperBand, lowerBand, momentum, squeeze, histogram, barColors };
  }

  // Linear Regression - returns the endpoint value of the regression line
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

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Return the value at the last point (endpoint of regression line)
    return intercept + slope * (n - 1);
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
        borderWidth: 1,
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
        borderWidth: 1,
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

  private clearChart(): void {
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
    this.ttmSqueezeData = null;
    this.demandSupplyZones = { demand: [], supply: [] };
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

  onTtmSqueezeInfoChange(info: string): void {
    this.ttmSqueezeInfo = info;
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

  onDmiInfoChange(info: string): void {
    this.dmiInfo = info;
  }

  ngOnDestroy(): void {
    this.clearChart();
  }
}

