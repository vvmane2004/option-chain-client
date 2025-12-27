import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil, catchError, of } from 'rxjs';
import { LeftColumnComponent } from '../../components/left-column/left-column.component';
import { RightColumnComponent } from '../../components/right-column/right-column.component';
import { OptionChainService } from '../../services/option-chain.service';
import { Sp500Company, Expiration } from '../../interfaces/option-chain.interface';
import { DropdownOption } from '../../components/searchable-dropdown/searchable-dropdown.component';
import { formatExpirationDate, isExpired } from '../../utils/date.utils';

@Component({
  selector: 'app-main-page',
  standalone: true,
  imports: [CommonModule, FormsModule, LeftColumnComponent, RightColumnComponent],
  templateUrl: './main-page.component.html',
  styleUrl: './main-page.component.scss'
})
export class MainPageComponent implements OnInit, OnDestroy {
  symbols: DropdownOption[] = [];
  expirations: DropdownOption[] = [];
  selectedSymbol: string | null = null;
  selectedExpiration: string | null = null;
  selectedDatapoint: string | null = null;
  loadingSymbols = false;
  loadingExpirations = false;
  loadingData = false;
  loadingInfo = false;
  errorMessage: string | null = null;
  optionChainData: any = null;
  leftColumnCollapsed = false;
  chartLoadTrigger = false;

  private destroy$ = new Subject<void>();

  constructor(private optionChainService: OptionChainService) {}

  ngOnInit() {
    this.loadSymbols();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSymbolChange(symbol: string | null) {
    this.selectedSymbol = symbol;
    this.selectedExpiration = null;
    this.expirations = [];
    this.optionChainData = null;
    
    if (symbol) {
      this.loadExpirations(symbol);
    }
  }

  onExpirationChange(expiration: string | null) {
    this.selectedExpiration = expiration;
    this.selectedDatapoint = null; // Reset datapoint when expiration changes
    if (expiration && this.selectedSymbol) {
      this.loadOptionChainData();
    }
  }

  onDatapointChange(datapoint: string | null) {
    this.selectedDatapoint = datapoint;
    // You can add logic here to update charts based on the selected datapoint
    console.log('Selected datapoint:', datapoint);
  }

  onClearSelections() {
    this.selectedSymbol = null;
    this.selectedExpiration = null;
    this.selectedDatapoint = null;
    this.expirations = [];
    this.optionChainData = null;
    this.errorMessage = null;
  }

  onLoadInfo() {
    if (this.selectedSymbol && this.selectedExpiration && 
        (this.selectedDatapoint === 'open_interest' || this.selectedDatapoint === 'underlying_price' || this.selectedDatapoint === 'premium' || this.selectedDatapoint === 'volume')) {
      this.loadingInfo = true;
      // Toggle the trigger to cause chart components to reload
      this.chartLoadTrigger = !this.chartLoadTrigger;
      // Reset loading state after a short delay
      setTimeout(() => {
        this.loadingInfo = false;
      }, 1000);
    }
  }

  onLeftColumnCollapseChange(collapsed: boolean) {
    this.leftColumnCollapsed = collapsed;
  }

  private loadSymbols() {
    this.loadingSymbols = true;
    this.errorMessage = null;

    this.optionChainService.getSymbols()
      .pipe(
        takeUntil(this.destroy$),
        catchError(error => {
          console.error('Error loading symbols:', error);
          this.errorMessage = 'Failed to load symbols. Please try again.';
          return of([]);
        })
      )
      .subscribe(symbols => {
        this.symbols = symbols.map(symbol => ({
          id: symbol.id,
          value: symbol.symbol,
          label: `${symbol.symbol} - ${symbol.company_name}`
        }));
        this.loadingSymbols = false;
      });
  }

  private loadExpirations(symbol: string) {
    this.loadingExpirations = true;
    this.errorMessage = null;

    this.optionChainService.getExpirations(symbol)
      .pipe(
        takeUntil(this.destroy$),
        catchError(error => {
          console.error('Error loading expirations:', error);
          this.errorMessage = 'Failed to load expirations. Please try again.';
          return of([]);
        })
      )
      .subscribe(expirations => {
        this.expirations = expirations
          .filter(exp => exp.expirationdate) // Filter out undefined expiration dates
          .map(exp => {
            // Format the date to show only the date part in a user-friendly format
            const formattedDate = formatExpirationDate(exp.expirationdate!, 'short');
            const isExpiredDate = isExpired(exp.expirationdate!);
            
            return {
              id: exp.id,
              value: exp.expirationdate!,
              label: isExpiredDate ? `${formattedDate} (Expired)` : formattedDate
            };
          })
          .sort((a, b) => {
            // Sort by date, expired dates last
            const dateA = new Date(a.value);
            const dateB = new Date(b.value);
            const isExpiredA = isExpired(a.value);
            const isExpiredB = isExpired(b.value);
            
            // Put expired dates at the end
            if (isExpiredA && !isExpiredB) return 1;
            if (!isExpiredA && isExpiredB) return -1;
            
            // Sort by date (ascending for valid dates, descending for expired)
            if (isExpiredA && isExpiredB) {
              return dateB.getTime() - dateA.getTime(); // Most recently expired first
            } else {
              return dateA.getTime() - dateB.getTime(); // Earliest valid date first
            }
          });
        
        this.loadingExpirations = false;
      });
  }

  private loadOptionChainData() {
    if (!this.selectedSymbol || !this.selectedExpiration) return;

    this.loadingData = true;
    this.errorMessage = null;

    // For now, we'll just simulate loading data
    // In the future, you can call actual API methods here
    setTimeout(() => {
      this.optionChainData = {
        symbol: this.selectedSymbol,
        expiration: this.selectedExpiration,
        timestamp: new Date().toISOString()
      };
      this.loadingData = false;
    }, 1000);
  }

} 