export interface Sp500Company {
  id: number;
  symbol?: string;
  company_name?: string;
  sector?: string;
  subsector?: string;
  last_updated?: string;
  import_ohlc?: boolean;
  import_oc?: boolean;
  is_active?: boolean;
}

export interface Expiration {
  id: number;
  symbol_id: number;
  symbol?: string;
  expirationdate?: string;
  last_updated?: string;
  is_active?: boolean;
}

export interface OptionChainOpenInterest {
  id: number;
  symbol?: string;
  expiration?: string;
  side?: string;
  strike?: number;
  open_interest?: number;
  imported_date?: string;
  last_updated?: string;
}

export interface OptionChainVolume {
  id: number;
  symbol?: string;
  expiration?: string;
  side?: string;
  strike?: number;
  volume?: number;
  imported_date?: string;
  last_updated?: string;
}

export interface OptionChainIV {
  id: number;
  symbol?: string;
  expiration?: string;
  side?: string;
  strike?: number;
  iv?: number;
  last_updated?: string;
}

export interface OptionChainDelta {
  id: number;
  symbol?: string;
  expiration?: string;
  side?: string;
  strike?: number;
  delta?: number;
  last_updated?: string;
}

export interface OptionChainGamma {
  id: number;
  symbol?: string;
  expiration?: string;
  side?: string;
  strike?: number;
  gamma?: number;
  last_updated?: string;
}

export interface OptionChainTheta {
  id: number;
  symbol?: string;
  expiration?: string;
  side?: string;
  strike?: number;
  theta?: number;
  last_updated?: string;
}

export interface OptionChainUnderlyingPrice {
  id: number;
  symbol?: string;
  expiration?: string;
  side?: string;
  underlying_price?: number;
  imported_date?: string;
  last_updated?: string;
}

export interface OptionChainPremium {
  id: number;
  symbol?: string;
  expiration?: string;
  side?: string;
  strike?: number;
  mid?: number;
  imported_date?: string;
  last_updated?: string;
} 