import { Component, Input, OnInit, OnChanges, SimpleChanges, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';
import { OptionChainService } from '../../../services/option-chain.service';
import { OptionChainPremium } from '../../../interfaces/option-chain.interface';

Chart.register(...registerables, zoomPlugin);

@Component({
  selector: 'app-chart-premium',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './chart-premium.component.html',
  styleUrl: './chart-premium.component.scss'
})
export class ChartPremiumComponent implements OnInit, OnChanges, AfterViewInit {
  @Input() symbol: string | null = null;
  @Input() expiration: string | null = null;
  @Input() side: string | null = null;
  @Input() loadTrigger: boolean = false;
  
  @ViewChild('chartCanvas', { static: false }) chartCanvas!: ElementRef<HTMLCanvasElement>;
  
  chart: Chart | null = null;
  loading = false;
  error: string | null = null;
  data: OptionChainPremium[] = [];

  constructor(private optionChainService: OptionChainService) {}

  ngOnInit(): void {
    // Don't auto-load on init, wait for loadTrigger
  }

  ngAfterViewInit(): void {
    // View is now initialized, canvas should be available
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['loadTrigger'] && this.loadTrigger) {
      // Use setTimeout to ensure view is updated
      setTimeout(() => this.loadData(), 0);
    }
  }

  loadData(): void {
    if (!this.symbol || !this.expiration || !this.side) {
      this.clearChart();
      return;
    }

    this.loading = true;
    this.error = null;

    this.optionChainService.getPremium(this.symbol, this.expiration, this.side)
      .subscribe({
        next: (data) => {
          this.data = data;
          this.createChart();
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading premium data:', error);
          this.error = 'Failed to load premium data';
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

    // Check if canvas element is available
    if (!this.chartCanvas || !this.chartCanvas.nativeElement) {
      console.warn('Canvas element not available yet, retrying...');
      // Retry after a short delay
      setTimeout(() => this.createChart(), 100);
      return;
    }

    // Group data by strike and date
    const strikeData = this.groupDataByStrikeAndDate();
    
    const dates = this.getUniqueDates().sort();
    const datasets = this.createStrikeDatasets(strikeData, dates);

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
            text: `${this.symbol} - ${this.side?.toUpperCase()} Premium by Strike`,
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
              text: 'Premium ($)'
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

  private groupDataByStrikeAndDate(): { [strike: number]: { [date: string]: number } } {
    const grouped: { [strike: number]: { [date: string]: number } } = {};

    this.data.forEach(item => {
      if (item.imported_date && item.mid !== undefined && item.strike !== undefined) {
        const strike = item.strike;
        const date = item.imported_date;
        
        if (!grouped[strike]) {
          grouped[strike] = {};
        }
        grouped[strike][date] = item.mid;
      }
    });

    return grouped;
  }

  private getUniqueDates(): string[] {
    const dates = new Set<string>();
    this.data.forEach(item => {
      if (item.imported_date) {
        dates.add(item.imported_date);
      }
    });
    return Array.from(dates);
  }

  private createStrikeDatasets(strikeData: { [strike: number]: { [date: string]: number } }, dates: string[]): any[] {
    const datasets: any[] = [];
    const strikes = Object.keys(strikeData).map(Number).sort((a, b) => a - b);
    
    // Generate colors for different strikes
    const colors = this.generateColors(strikes.length);
    
    strikes.forEach((strike, index) => {
      const strikeDataForStrike = strikeData[strike];
      const data = dates.map(date => strikeDataForStrike[date] || null);
      
      datasets.push({
        label: `Strike $${strike}`,
        data: data,
        borderColor: colors[index],
        backgroundColor: colors[index] + '20', // Add transparency
        borderWidth: 2,
        fill: false,
        tension: 0.4,
        pointRadius: 3,
        pointHoverRadius: 5
      });
    });

    return datasets;
  }

  private generateColors(count: number): string[] {
    const colors = [
      '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
      '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#6366f1',
      '#14b8a6', '#f43f5e', '#8b5cf6', '#06b6d4', '#84cc16'
    ];
    
    // If we need more colors than available, generate additional ones
    const result = [...colors];
    for (let i = colors.length; i < count; i++) {
      const hue = (i * 137.5) % 360; // Golden angle approximation
      result.push(`hsl(${hue}, 70%, 50%)`);
    }
    
    return result.slice(0, count);
  }

  private clearChart(): void {
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
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

  getStrikeCount(): number {
    if (!this.data || this.data.length === 0) {
      return 0;
    }

    const strikes = new Set<number>();
    this.data.forEach(item => {
      if (item.strike !== undefined) {
        strikes.add(item.strike);
      }
    });

    return strikes.size;
  }

  getPremiumRange(): string {
    if (!this.data || this.data.length === 0) {
      return 'N/A';
    }

    const premiums = this.data
      .map(item => item.mid)
      .filter(premium => premium !== undefined)
      .sort((a, b) => a! - b!);

    if (premiums.length === 0) {
      return 'N/A';
    }

    const minPremium = premiums[0]!.toFixed(2);
    const maxPremium = premiums[premiums.length - 1]!.toFixed(2);

    return minPremium === maxPremium ? `$${minPremium}` : `$${minPremium} - $${maxPremium}`;
  }

  ngOnDestroy(): void {
    this.clearChart();
  }
}
