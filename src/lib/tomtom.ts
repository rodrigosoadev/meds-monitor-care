export type TomTomPharmacy = {
  id: string;
  name: string;
  address: string;
  phone?: string;
  position: {
    lat: number;
    lon: number;
  };
  distanceMeters?: number;
};

const TOMTOM_API_KEY = import.meta.env.VITE_TOMTOM_API_KEY;

function getTomTomApiKey() {
  if (!TOMTOM_API_KEY) {
    throw new Error(
      "Missing TomTom API key. Add VITE_TOMTOM_API_KEY to your .env or environment variables."
    );
  }

  return TOMTOM_API_KEY;
}

export async function searchTomTomPharmacies(
  lat: number,
  lon: number,
  limit = 20,
  radius = 10000
): Promise<TomTomPharmacy[]> {
  const key = getTomTomApiKey();
  const url = new URL("https://api.tomtom.com/search/2/search/pharmacy.json");

  url.searchParams.set("key", key);
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lon));
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("radius", String(radius));
  url.searchParams.set("countrySet", "BR");
  url.searchParams.set("language", "pt-BR");

  const response = await fetch(url.toString());

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`TomTom API error: ${response.status} ${response.statusText} - ${text}`);
  }

  const data = await response.json();

  if (!Array.isArray(data.results)) {
    throw new Error("Unexpected response format from TomTom API.");
  }

  return data.results.map((item: any) => ({
    id: item.id ?? `${item.position?.lat}-${item.position?.lon}`,
    name: item.poi?.name ?? "Farmácia",
    address: item.address?.freeformAddress ?? item.address?.streetAddress ?? "Endereço não disponível",
    phone: item.poi?.phone ?? undefined,
    position: {
      lat: item.position?.lat,
      lon: item.position?.lon,
    },
    distanceMeters: typeof item.dist === "number" ? item.dist : undefined,
  }));
}
