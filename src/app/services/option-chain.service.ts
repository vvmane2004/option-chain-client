import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { retry, catchError, timeout } from 'rxjs/operators';
import { 
  Sp500Company, 
  Expiration, 
  OptionChainOpenInterest, 
  OptionChainVolume, 
  OptionChainIV, 
  OptionChainDelta, 
  OptionChainGamma, 
  OptionChainTheta, 
  OptionChainUnderlyingPrice,
  OptionChainPremium 
} from '../interfaces/option-chain.interface';

@Injectable({
  providedIn: 'root'
})
export class OptionChainService {
  // Use HTTP - API will redirect to HTTPS and handle CORS properly
  private readonly apiBaseUrl = 'http://localhost:5277/api/OptionChain';

  constructor(private http: HttpClient) { }

  // Helper method for error handling
  private handleError(error: any, operation: string) {
    console.error(`❌ ${operation} failed:`, error);
    return throwError(() => new Error(`${operation} failed: ${error.message || 'Unknown error'}`));
  }

  // Get all available symbols (SP500 companies)
  getSymbols(): Observable<Sp500Company[]> {
    console.log('🔍 Fetching symbols from:', `${this.apiBaseUrl}/optionchain_symbols`);
    
    return this.http.get<Sp500Company[]>(`${this.apiBaseUrl}/optionchain_symbols`)
      .pipe(
        timeout(10000), // 10 second timeout
        retry(2), // Retry up to 2 times
        catchError(error => this.handleError(error, 'getSymbols'))
      );
  }

  // Get expirations for a specific symbol
  getExpirations(symbol: string, show: string = 'All'): Observable<Expiration[]> {
    const params = new HttpParams()
      .set('symbol', symbol)
      .set('show', show);
    
    console.log('🔍 Fetching expirations for symbol:', symbol);
    
    return this.http.get<Expiration[]>(`${this.apiBaseUrl}/optionchain_expirations`, { params })
      .pipe(
        timeout(10000),
        retry(2),
        catchError(error => this.handleError(error, 'getExpirations'))
      );
  }

  // Get option chain open interest data
  getOpenInterest(symbol: string, expiration: string, side: string): Observable<OptionChainOpenInterest[]> {
    const params = new HttpParams()
      .set('symbol', symbol)
      .set('expiration', expiration)
      .set('side', side);
    return this.http.get<OptionChainOpenInterest[]>(`${this.apiBaseUrl}/optionchain_openinterest`, { params })
      .pipe(
        timeout(10000),
        retry(2),
        catchError(error => this.handleError(error, 'getOpenInterest'))
      );
  }

  // Get option chain volume data
  getVolume(symbol: string, expiration: string, side: string): Observable<OptionChainVolume[]> {
    const params = new HttpParams()
      .set('symbol', symbol)
      .set('expiration', expiration)
      .set('side', side);
    return this.http.get<OptionChainVolume[]>(`${this.apiBaseUrl}/optionchain_volume`, { params })
      .pipe(
        timeout(10000),
        retry(2),
        catchError(error => this.handleError(error, 'getVolume'))
      );
  }

  // Get option chain IV data
  getIV(symbol: string, expiration: string, side: string): Observable<OptionChainIV[]> {
    const params = new HttpParams()
      .set('symbol', symbol)
      .set('expiration', expiration)
      .set('side', side);
    return this.http.get<OptionChainIV[]>(`${this.apiBaseUrl}/optionchain_iv`, { params })
      .pipe(
        timeout(10000),
        retry(2),
        catchError(error => this.handleError(error, 'getIV'))
      );
  }

  // Get option chain delta data
  getDelta(symbol: string, expiration: string, side: string): Observable<OptionChainDelta[]> {
    const params = new HttpParams()
      .set('symbol', symbol)
      .set('expiration', expiration)
      .set('side', side);
    return this.http.get<OptionChainDelta[]>(`${this.apiBaseUrl}/optionchain_delta`, { params })
      .pipe(
        timeout(10000),
        retry(2),
        catchError(error => this.handleError(error, 'getDelta'))
      );
  }

  // Get option chain gamma data
  getGamma(symbol: string, expiration: string, side: string): Observable<OptionChainGamma[]> {
    const params = new HttpParams()
      .set('symbol', symbol)
      .set('expiration', expiration)
      .set('side', side);
    return this.http.get<OptionChainGamma[]>(`${this.apiBaseUrl}/optionchain_gamma`, { params })
      .pipe(
        timeout(10000),
        retry(2),
        catchError(error => this.handleError(error, 'getGamma'))
      );
  }

  // Get option chain theta data
  getTheta(symbol: string, expiration: string, side: string): Observable<OptionChainTheta[]> {
    const params = new HttpParams()
      .set('symbol', symbol)
      .set('expiration', expiration)
      .set('side', side);
    return this.http.get<OptionChainTheta[]>(`${this.apiBaseUrl}/optionchain_theta`, { params })
      .pipe(
        timeout(10000),
        retry(2),
        catchError(error => this.handleError(error, 'getTheta'))
      );
  }

  // Get option chain underlying price data
  getUnderlyingPrice(symbol: string, expiration: string, side: string): Observable<OptionChainUnderlyingPrice[]> {
    const params = new HttpParams()
      .set('symbol', symbol)
      .set('expiration', expiration)
      .set('side', side);
    return this.http.get<OptionChainUnderlyingPrice[]>(`${this.apiBaseUrl}/optionchain_underlyingprice`, { params })
      .pipe(
        timeout(10000),
        retry(2),
        catchError(error => this.handleError(error, 'getUnderlyingPrice'))
      );
  }

  // Get option chain premium data
  getPremium(symbol: string, expiration: string, side: string): Observable<OptionChainPremium[]> {
    const params = new HttpParams()
      .set('symbol', symbol)
      .set('expiration', expiration)
      .set('side', side);
    return this.http.get<OptionChainPremium[]>(`${this.apiBaseUrl}/optionchain_premium`, { params })
      .pipe(
        timeout(10000),
        retry(2),
        catchError(error => this.handleError(error, 'getPremium'))
      );
  }

} 