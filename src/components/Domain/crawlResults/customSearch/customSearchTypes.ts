export interface CustomSearchConfigItem {
  id: string;
  name: string;
  query: string;
  selectorType: string;
  resultType: string;
  attribute?: string;
}

export interface CustomSearchRow {
  key: string;
  url: string;
  search: CustomSearchConfigItem;
  value: string;
  match: string;
  status: string;
}
