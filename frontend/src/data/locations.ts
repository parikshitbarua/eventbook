export interface City {
  name: string;
  id: string;
}

export interface State {
  name: string;
  id: string;
  cities: City[];
}

export interface Country {
  name: string;
  id: string;
  states: State[];
}

export const locationData: Country[] = [
  {
    name: 'United States',
    id: 'US',
    states: [
      {
        name: 'California',
        id: 'CA',
        cities: [
          { name: 'Los Angeles', id: 'LA' },
          { name: 'San Francisco', id: 'SF' },
          { name: 'San Diego', id: 'SD' },
          { name: 'Sacramento', id: 'SAC' },
          { name: 'Oakland', id: 'OAK' },
        ],
      },
      {
        name: 'New York',
        id: 'NY',
        cities: [
          { name: 'New York City', id: 'NYC' },
          { name: 'Buffalo', id: 'BUF' },
          { name: 'Rochester', id: 'ROC' },
          { name: 'Syracuse', id: 'SYR' },
          { name: 'Albany', id: 'ALB' },
        ],
      },
      {
        name: 'Texas',
        id: 'TX',
        cities: [
          { name: 'Houston', id: 'HOU' },
          { name: 'Dallas', id: 'DAL' },
          { name: 'Austin', id: 'AUS' },
          { name: 'San Antonio', id: 'SA' },
          { name: 'Fort Worth', id: 'FW' },
        ],
      },
      {
        name: 'Florida',
        id: 'FL',
        cities: [
          { name: 'Miami', id: 'MIA' },
          { name: 'Orlando', id: 'ORL' },
          { name: 'Tampa', id: 'TAM' },
          { name: 'Jacksonville', id: 'JAX' },
          { name: 'Fort Lauderdale', id: 'FTL' },
        ],
      },
    ],
  },
  {
    name: 'United Kingdom',
    id: 'UK',
    states: [
      {
        name: 'England',
        id: 'ENG',
        cities: [
          { name: 'London', id: 'LON' },
          { name: 'Manchester', id: 'MAN' },
          { name: 'Birmingham', id: 'BIR' },
          { name: 'Liverpool', id: 'LIV' },
          { name: 'Leeds', id: 'LEE' },
        ],
      },
      {
        name: 'Scotland',
        id: 'SCO',
        cities: [
          { name: 'Edinburgh', id: 'EDI' },
          { name: 'Glasgow', id: 'GLA' },
          { name: 'Aberdeen', id: 'ABE' },
          { name: 'Dundee', id: 'DUN' },
        ],
      },
    ],
  },
  {
    name: 'Canada',
    id: 'CA',
    states: [
      {
        name: 'Ontario',
        id: 'ON',
        cities: [
          { name: 'Toronto', id: 'TOR' },
          { name: 'Ottawa', id: 'OTT' },
          { name: 'Hamilton', id: 'HAM' },
          { name: 'London', id: 'LON' },
        ],
      },
      {
        name: 'British Columbia',
        id: 'BC',
        cities: [
          { name: 'Vancouver', id: 'VAN' },
          { name: 'Victoria', id: 'VIC' },
          { name: 'Surrey', id: 'SUR' },
        ],
      },
    ],
  },
  {
    name: 'India',
    id: 'IN',
    states: [
      {
        name: 'Maharashtra',
        id: 'MH',
        cities: [
          { name: 'Mumbai', id: 'MUM' },
          { name: 'Pune', id: 'PUN' },
          { name: 'Nagpur', id: 'NAG' },
          { name: 'Nashik', id: 'NAS' },
        ],
      },
      {
        name: 'Karnataka',
        id: 'KA',
        cities: [
          { name: 'Bangalore', id: 'BAN' },
          { name: 'Mysore', id: 'MYS' },
          { name: 'Hubli', id: 'HUB' },
        ],
      },
      {
        name: 'Delhi',
        id: 'DL',
        cities: [
          { name: 'New Delhi', id: 'NDL' },
          { name: 'Delhi', id: 'DEL' },
        ],
      },
    ],
  },
];

export const getStatesForCountry = (countryId: string): State[] => {
  const country = locationData.find((c) => c.id === countryId);
  return country ? country.states : [];
};

export const getCitiesForState = (
  countryId: string,
  stateId: string,
): City[] => {
  const country = locationData.find((c) => c.id === countryId);
  if (!country) return [];

  const state = country.states.find((s) => s.id === stateId);
  return state ? state.cities : [];
};
