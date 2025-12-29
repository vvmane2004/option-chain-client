import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { formatExpirationDate } from '../../utils/date.utils';
import { ChartOpeninterestComponent } from '../charts/chart-openinterest/chart-openinterest.component';
import { ChartPriceContainer1Component } from '../charts/chart-price-container-1/chart-price-container-1.component';
import { ChartPriceContainer2Component } from '../charts/chart-price-container-2/chart-price-container-2.component';
import { ChartPremiumComponent } from '../charts/chart-premium/chart-premium.component';
import { ChartVolumeComponent } from '../charts/chart-volume/chart-volume.component';


@Component({
  selector: 'app-right-column',
  standalone: true,
  imports: [CommonModule, ChartOpeninterestComponent, ChartPriceContainer1Component, ChartPriceContainer2Component, ChartPremiumComponent, ChartVolumeComponent],
  templateUrl: './right-column.component.html',
  styleUrl: './right-column.component.scss'
})
export class RightColumnComponent {
  @Input() selectedSymbol: string | null = null;
  @Input() selectedExpiration: string | null = null;
  @Input() selectedDatapoint: string | null = null;
  @Input() loadingData = false;
  @Input() optionChainData: any = null;
  @Input() chartLoadTrigger = false;

  get hasSelection(): boolean {
    return !!(this.selectedSymbol && this.selectedExpiration);
  }

  get showWelcomeMessage(): boolean {
    return !this.hasSelection;
  }

  get showDataArea(): boolean {
    return this.hasSelection;
  }

  getFormattedExpiration(): string {
    if (!this.selectedExpiration) return '';
    return formatExpirationDate(this.selectedExpiration, 'medium');
  }

  get showOpenInterestCharts(): boolean {
    return this.hasSelection && this.selectedDatapoint === 'open_interest';
  }

  get showPriceCharts(): boolean {
    return this.hasSelection && this.selectedDatapoint === 'underlying_price';
  }

  get showPremiumCharts(): boolean {
    return this.hasSelection && this.selectedDatapoint === 'premium';
  }

  get showVolumeCharts(): boolean {
    return this.hasSelection && this.selectedDatapoint === 'volume';
  }
} 