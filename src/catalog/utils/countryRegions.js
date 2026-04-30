import { ANGOLA_PROVINCES } from "./angolaRegions.js";

const COUNTRY_REGION_CONFIG = [
  {
    value: "Angola",
    label: "Angola",
    regionLabel: "Provincia",
    regions: ANGOLA_PROVINCES,
  },
  {
    value: "Brasil",
    label: "Brasil",
    regionLabel: "Estado",
    regions: [
      "Acre",
      "Alagoas",
      "Amapa",
      "Amazonas",
      "Bahia",
      "Ceara",
      "Distrito Federal",
      "Espirito Santo",
      "Goias",
      "Maranhao",
      "Mato Grosso",
      "Mato Grosso do Sul",
      "Minas Gerais",
      "Para",
      "Paraiba",
      "Parana",
      "Pernambuco",
      "Piaui",
      "Rio de Janeiro",
      "Rio Grande do Norte",
      "Rio Grande do Sul",
      "Rondonia",
      "Roraima",
      "Santa Catarina",
      "Sao Paulo",
      "Sergipe",
      "Tocantins",
    ],
  },
  {
    value: "Portugal",
    label: "Portugal",
    regionLabel: "Distrito / Regiao",
    regions: [
      "Aveiro",
      "Acores",
      "Beja",
      "Braga",
      "Braganca",
      "Castelo Branco",
      "Coimbra",
      "Evora",
      "Faro",
      "Guarda",
      "Leiria",
      "Lisboa",
      "Madeira",
      "Portalegre",
      "Porto",
      "Santarem",
      "Setubal",
      "Viana do Castelo",
      "Vila Real",
      "Viseu",
    ],
  },
  {
    value: "Mocambique",
    label: "Mocambique",
    regionLabel: "Provincia",
    regions: [
      "Cabo Delgado",
      "Gaza",
      "Inhambane",
      "Manica",
      "Maputo",
      "Maputo Cidade",
      "Nampula",
      "Niassa",
      "Sofala",
      "Tete",
      "Zambezia",
    ],
  },
  {
    value: "Namibia",
    label: "Namibia",
    regionLabel: "Regiao",
    regions: [
      "Erongo",
      "Hardap",
      "Karas",
      "Kavango East",
      "Kavango West",
      "Khomas",
      "Kunene",
      "Ohangwena",
      "Omaheke",
      "Omusati",
      "Oshana",
      "Oshikoto",
      "Otjozondjupa",
      "Zambezi",
    ],
  },
  {
    value: "Africa do Sul",
    label: "Africa do Sul",
    regionLabel: "Provincia",
    regions: [
      "Eastern Cape",
      "Free State",
      "Gauteng",
      "KwaZulu-Natal",
      "Limpopo",
      "Mpumalanga",
      "North West",
      "Northern Cape",
      "Western Cape",
    ],
  },
  {
    value: "Estados Unidos",
    label: "Estados Unidos",
    regionLabel: "Estado",
    regions: [
      "Alabama",
      "Alaska",
      "Arizona",
      "Arkansas",
      "California",
      "Colorado",
      "Connecticut",
      "Delaware",
      "District of Columbia",
      "Florida",
      "Georgia",
      "Hawaii",
      "Idaho",
      "Illinois",
      "Indiana",
      "Iowa",
      "Kansas",
      "Kentucky",
      "Louisiana",
      "Maine",
      "Maryland",
      "Massachusetts",
      "Michigan",
      "Minnesota",
      "Mississippi",
      "Missouri",
      "Montana",
      "Nebraska",
      "Nevada",
      "New Hampshire",
      "New Jersey",
      "New Mexico",
      "New York",
      "North Carolina",
      "North Dakota",
      "Ohio",
      "Oklahoma",
      "Oregon",
      "Pennsylvania",
      "Rhode Island",
      "South Carolina",
      "South Dakota",
      "Tennessee",
      "Texas",
      "Utah",
      "Vermont",
      "Virginia",
      "Washington",
      "West Virginia",
      "Wisconsin",
      "Wyoming",
    ],
  },
];

export const COUNTRY_OPTIONS = COUNTRY_REGION_CONFIG.map(({ value, label }) => ({ value, label }));

function normalizeCountryKey(value) {
  return String(value || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function getCountryConfig(country) {
  const countryKey = normalizeCountryKey(country);
  return COUNTRY_REGION_CONFIG.find((entry) => normalizeCountryKey(entry.value) === countryKey) || null;
}

export function getCanonicalCountry(country) {
  return getCountryConfig(country)?.value || String(country || "").trim();
}

export function isPresetCountry(country) {
  return Boolean(getCountryConfig(country));
}

export function getCountryRegions(country) {
  return getCountryConfig(country)?.regions || [];
}

export function getCountryRegionLabel(country) {
  return getCountryConfig(country)?.regionLabel || "Cidade / Municipio";
}
