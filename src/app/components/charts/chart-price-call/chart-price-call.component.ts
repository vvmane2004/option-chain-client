import { Component, Input, OnInit, OnChanges, SimpleChanges, ViewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';
import { OptionChainService } from '../../../services/option-chain.service';
import { OptionChainUnderlyingPrice } from '../../../interfaces/option-chain.interface';

Chart.register(...registerables, zoomPlugin);

@Component({
  selector: 'app-chart-price-call',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './chart-price-call.component.html',
  styleUrl: './chart-price-call.component.scss'
})
export class ChartPriceCallComponent implements OnInit, OnChanges, AfterViewInit, OnDestroy {
  @Input() symbol: string | null = null;
  @Input() expiration: string | null = null;
  @Input() loadTrigger: boolean = false;
  
  @ViewChild('chartCanvas', { static: false }) chartCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('rsiCanvas', { static: false }) rsiCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('macdCanvas', { static: false }) macdCanvas!: ElementRef<HTMLCanvasElement>;
  
  chart: Chart | null = null;
  rsiChart: Chart | null = null;
  macdChart: Chart | null = null;
  loading = false;
  error: string | null = null;
  data: OptionChainUnderlyingPrice[] = [];
  rsiData: number[] = [];
  macdData: { macd: number[], signal: number[], histogram: number[] } = { macd: [], signal: [], histogram: [] };

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

    this.optionChainService.getUnderlyingPrice(this.symbol, this.expiration, 'call')
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
        borderColor: '#22c55e',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        borderWidth: 3,
        fill: false,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6,
        order: 1
      }
    ];

    // Add Bollinger Bands for calls
    const bollingerBands = this.calculateBollingerBands(priceData, 20, 2);
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
    const keltnerChannels = this.calculateKeltnerChannels(priceData, 20, 2);
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
        borderDash: [5, 5] // Dashed line to distinguish from Bollinger Bands
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
        borderDash: [5, 5] // Dashed line to distinguish from Bollinger Bands
      }
    );

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
            text: `${this.symbol} - CALL Underlying Price with Bollinger Bands & Keltner Channels`,
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

    // Create RSI chart
    this.calculateRSI(priceData, 14);
    setTimeout(() => this.createRSIChart(), 100);

    // Create MACD chart
    this.calculateMACD(priceData, 12, 26, 9);
    setTimeout(() => this.createMACDChart(), 200);
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

  private calculateBollingerBands(prices: number[], period: number, standardDeviations: number): { upperBand: number[], middleBand: number[], lowerBand: number[] } {
    const upperBand: number[] = [];
    const middleBand: number[] = [];
    const lowerBand: number[] = [];

    for (let i = 0; i < prices.length; i++) {
      if (i < period - 1) {
        // Not enough data points for the period
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
        // Not enough data points for the period
        upperBand.push(null as any);
        middleBand.push(null as any);
        lowerBand.push(null as any);
      } else {
        const slice = prices.slice(i - period + 1, i + 1);
        
        // Calculate Simple Moving Average (middle band)
        const sma = slice.reduce((sum, price) => sum + price, 0) / period;
        middleBand.push(sma);

        // Calculate Average True Range (ATR) - simplified using price differences
        const trueRanges: number[] = [];
        for (let j = 1; j < slice.length; j++) {
          const tr = Math.abs(slice[j] - slice[j - 1]);
          trueRanges.push(tr);
        }
        const atr = trueRanges.reduce((sum, tr) => sum + tr, 0) / trueRanges.length;

        // Calculate Keltner Channels
        const upper = sma + (multiplier * atr);
        const lower = sma - (multiplier * atr);

        upperBand.push(upper);
        lowerBand.push(lower);
      }
    }

    return { upperBand, middleBand, lowerBand };
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

    const groupedData = this.groupDataByDate();
    const dates = Object.keys(groupedData).sort();

    const rsiConfig: ChartConfiguration = {
      type: 'line',
      data: {
        labels: dates.map((date: string) => new Date(date).toLocaleDateString()),
        datasets: [{
          label: 'RSI (14)',
          data: this.rsiData,
          borderColor: '#8b5cf6',
          backgroundColor: 'rgba(139, 92, 246, 0.1)',
          borderWidth: 2,
          fill: false,
          tension: 0.4,
          pointRadius: 2,
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
              if (value >= 70) return '#ef4444'; // Overbought - red
              if (value <= 30) return '#22c55e'; // Oversold - green
              return '#8b5cf6'; // Neutral - purple
            },
            borderColor: (context: any) => {
              const value = context.parsed.y;
              if (value === null) return 'rgba(128, 128, 128, 0.8)';
              if (value >= 70) return '#dc2626';
              if (value <= 30) return '#16a34a';
              return '#7c3aed';
            }
          }
        }
      }
    };

    this.rsiChart = new Chart(this.rsiCanvas.nativeElement, rsiConfig);
  }

  private createMACDChart(): void {
    if (this.macdChart) {
      this.macdChart.destroy();
    }

    if (!this.macdData || !this.macdCanvas || !this.macdCanvas.nativeElement) {
      console.warn('MACD canvas or data not available');
      return;
    }

    const groupedData = this.groupDataByDate();
    const dates = Object.keys(groupedData).sort();

    const macdConfig: ChartConfiguration = {
      type: 'line',
      data: {
        labels: dates.map((date: string) => new Date(date).toLocaleDateString()),
        datasets: [
          {
            label: 'MACD Line',
            data: this.macdData.macd,
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            borderWidth: 2,
            fill: false,
            tension: 0.4,
            pointRadius: 2,
            pointHoverRadius: 4,
            order: 1
          },
          {
            label: 'Signal Line',
            data: this.macdData.signal,
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

  private clearChart(): void {
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
    if (this.rsiChart) {
      this.rsiChart.destroy();
      this.rsiChart = null;
    }
    if (this.macdChart) {
      this.macdChart.destroy();
      this.macdChart = null;
    }
    this.rsiData = [];
    this.macdData = { macd: [], signal: [], histogram: [] };
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

  getBollingerBandsInfo(): string {
    if (!this.data || this.data.length === 0) {
      return 'N/A';
    }

    const groupedData = this.groupDataByDate();
    const dates = Object.keys(groupedData).sort();
    const priceData = dates.map(date => groupedData[date].avgPrice);
    const bollingerBands = this.calculateBollingerBands(priceData, 20, 2);

    const lastIndex = bollingerBands.upperBand.length - 1;
    if (lastIndex >= 0 && bollingerBands.upperBand[lastIndex] !== null) {
      const upper = bollingerBands.upperBand[lastIndex]!.toFixed(2);
      const middle = bollingerBands.middleBand[lastIndex]!.toFixed(2);
      const lower = bollingerBands.lowerBand[lastIndex]!.toFixed(2);
      return `Upper: $${upper} | Middle: $${middle} | Lower: $${lower}`;
    }

    return 'N/A';
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
    if (currentRSI >= 70) {
      status = 'Overbought';
    } else if (currentRSI <= 30) {
      status = 'Oversold';
    }

    return `Current: ${rsiValue}% | Status: ${status}`;
  }

  getKeltnerChannelsInfo(): string {
    if (!this.data || this.data.length === 0) {
      return 'N/A';
    }

    const groupedData = this.groupDataByDate();
    const dates = Object.keys(groupedData).sort();
    const priceData = dates.map(date => groupedData[date].avgPrice);
    const keltnerChannels = this.calculateKeltnerChannels(priceData, 20, 2);

    const lastIndex = keltnerChannels.upperBand.length - 1;
    if (lastIndex >= 0 && keltnerChannels.upperBand[lastIndex] !== null) {
      const upper = keltnerChannels.upperBand[lastIndex]!.toFixed(2);
      const lower = keltnerChannels.lowerBand[lastIndex]!.toFixed(2);
      return `Upper: $${upper} | Lower: $${lower}`;
    }

    return 'N/A';
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

  ngOnDestroy(): void {
    this.clearChart();
  }
}