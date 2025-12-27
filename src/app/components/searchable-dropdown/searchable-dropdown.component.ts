import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil, debounceTime, distinctUntilChanged } from 'rxjs';

export interface DropdownOption {
  id: number | string;
  label: string;
  value: any;
}

@Component({
  selector: 'app-searchable-dropdown',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './searchable-dropdown.component.html',
  styleUrl: './searchable-dropdown.component.scss'
})
export class SearchableDropdownComponent implements OnInit, OnDestroy {
  @Input() options: DropdownOption[] = [];
  @Input() placeholder: string = 'Select an option...';
  @Input() label: string = '';
  @Input() disabled: boolean = false;
  @Input() loading: boolean = false;
  @Input() selectedValue: any = null;
  
  @Output() selectionChange = new EventEmitter<any>();
  @Output() searchChange = new EventEmitter<string>();

  filteredOptions: DropdownOption[] = [];
  searchTerm: string = '';
  isOpen: boolean = false;
  private destroy$ = new Subject<void>();
  private searchSubject = new Subject<string>();

  ngOnInit() {
    this.filteredOptions = [...this.options];
    
    // Setup search debouncing
    this.searchSubject.pipe(
      takeUntil(this.destroy$),
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(searchTerm => {
      this.searchChange.emit(searchTerm);
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSearchChange(searchTerm: string) {
    this.searchTerm = searchTerm;
    this.searchSubject.next(searchTerm);
    this.filterOptions();
  }

  filterOptions() {
    if (!this.searchTerm.trim()) {
      this.filteredOptions = [...this.options];
    } else {
      this.filteredOptions = this.options.filter(option =>
        option.label.toLowerCase().includes(this.searchTerm.toLowerCase())
      );
    }
  }

  selectOption(option: DropdownOption) {
    this.selectedValue = option.value;
    this.searchTerm = option.label;
    this.selectionChange.emit(option.value);
    this.isOpen = false;
  }

  toggleDropdown() {
    if (!this.disabled) {
      this.isOpen = !this.isOpen;
      if (this.isOpen) {
        this.filterOptions();
      }
    }
  }

  onBlur() {
    // Delay closing to allow for option selection
    setTimeout(() => {
      this.isOpen = false;
    }, 200);
  }

  onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      if (this.isOpen) {
        this.isOpen = false;
      } else if (this.selectedValue) {
        this.clearSelection();
      }
      event.preventDefault();
    }
  }

  getSelectedLabel(): string {
    if (!this.selectedValue) return '';
    const selectedOption = this.options.find(option => option.value === this.selectedValue);
    return selectedOption ? selectedOption.label : '';
  }

  clearSelection() {
    this.selectedValue = null;
    this.searchTerm = '';
    this.selectionChange.emit(null);
  }
} 