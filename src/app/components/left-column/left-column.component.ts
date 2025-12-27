import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SearchableDropdownComponent, DropdownOption } from '../searchable-dropdown/searchable-dropdown.component';
import { Sp500Company, Expiration } from '../../interfaces/option-chain.interface';

@Component({
  selector: 'app-left-column',
  standalone: true,
  imports: [CommonModule, FormsModule, SearchableDropdownComponent],
  templateUrl: './left-column.component.html',
  styleUrl: './left-column.component.scss'
})
export class LeftColumnComponent {
  @Input() symbols: DropdownOption[] = [];
  @Input() expirations: DropdownOption[] = [];
  @Input() loadingSymbols = false;
  @Input() loadingExpirations = false;
  @Input() loadingInfo = false;
  @Input() selectedSymbol: string | null = null;
  @Input() selectedExpiration: string | null = null;
  @Input() selectedDatapoint: string | null = null;
  @Input() errorMessage: string | null = null;

  @Output() symbolChange = new EventEmitter<string | null>();
  @Output() expirationChange = new EventEmitter<string | null>();
  @Output() datapointChange = new EventEmitter<string | null>();
  @Output() clearSelections = new EventEmitter<void>();
  @Output() loadInfo = new EventEmitter<void>();
  @Output() collapseChange = new EventEmitter<boolean>();

  collapsed = false;

  // Datapoint options
  datapoints: DropdownOption[] = [
    { id: 'open_interest', value: 'open_interest', label: 'Open Interest' },
    { id: 'premium', value: 'premium', label: 'Premium' },
    { id: 'underlying_price', value: 'underlying_price', label: 'Underlying Price' },
    { id: 'volume', value: 'volume', label: 'Volume' },
    { id: 'delta', value: 'delta', label: 'Delta' },
    { id: 'gamma', value: 'gamma', label: 'Gamma' }
  ];

  onSymbolChange(symbol: string | null) {
    this.symbolChange.emit(symbol);
  }

  onExpirationChange(expiration: string | null) {
    this.expirationChange.emit(expiration);
  }

  onDatapointChange(datapoint: string | null) {
    this.datapointChange.emit(datapoint);
  }

  onClearSelections() {
    this.clearSelections.emit();
  }

  onLoadInfo() {
    this.loadInfo.emit();
  }

  toggleCollapse() {
    this.collapsed = !this.collapsed;
    this.collapseChange.emit(this.collapsed);
  }

  getDatapointLabel(value: string | null): string {
    if (!value) return '';
    const datapoint = this.datapoints.find(dp => dp.value === value);
    return datapoint ? datapoint.label : value;
  }
} 