import { useMemo, useState } from "react";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";
import { supabase } from "@/integrations/supabase/client";
import { searchTomTomPharmacies, TomTomPharmacy } from "@/lib/tomtom";

const SEARCH_RADIUS_METERS = 5000;

type CustomPharmacy = {
  tomtom_id: string;
  whatsapp: string | null;
};

type FarmaciaProxima = TomTomPharmacy & {
  tomtomId: string;
  whatsapp?: string;
};

function formatDistance(distanceMeters?: number): string {
  if (distanceMeters == null || distanceMeters < 0) return "Distância não disponível";
  return `${(distanceMeters / 1000).toFixed(1)} km`;
}

function normalizeWhatsApp(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/[^0-9]/g, "");
  return digits.length > 0 ? digits : null;
}

function getWhatsAppUrl(whatsAppValue: string | null | undefined): string | null {
  const normalized = normalizeWhatsApp(whatsAppValue);
  if (!normalized) return null;
  return `https://wa.me/${normalized}`;
}

async function requestLocationPermission(): Promise<"granted" | "denied" | "prompt"> {
  if (Capacitor.getPlatform() === "web") {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      throw new Error("Geolocalização não disponível no navegador.");
    }
    return "granted";
  }

  const current = await Geolocation.checkPermissions();
  if (current.location === "granted") {
    return current.location;
  }

  const requested = await Geolocation.requestPermissions();
  return requested.location;
}

export function FarmaciasProximas() {
  const [farmacias, setFarmacias] = useState<FarmaciaProxima[]>([]);
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const summary = useMemo(() => {
    if (loading) return "Buscando farmácias…";
    if (error) return "Ocorreu um erro ao buscar as farmácias.";
    if (!farmacias.length) return "Nenhuma farmácia encontrada ainda.";
    return `Encontradas ${farmacias.length} farmácias em até ${(SEARCH_RADIUS_METERS / 1000).toFixed(0)} km.`;
  }, [farmacias.length, error, loading]);

  async function getCurrentLocation() {
    const permission = await requestLocationPermission();

    if (permission !== "granted") {
      throw new Error("Permissão de localização não concedida.");
    }

    if (Capacitor.getPlatform() === "web") {
      return new Promise<{ lat: number; lon: number }>((resolve, reject) => {
        if (typeof navigator === "undefined" || !navigator.geolocation) {
          return reject(new Error("Geolocalização não disponível no navegador."));
        }

        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve({
              lat: position.coords.latitude,
              lon: position.coords.longitude,
            });
          },
          (error) => {
            reject(new Error(`Falha ao obter localização: ${error.message}`));
          },
          {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 60000,
          }
        );
      });
    }

    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 60000,
    });

    return {
      lat: position.coords.latitude,
      lon: position.coords.longitude,
    };
  }

  async function handleSearch() {
    setError(null);
    setLoading(true);

    try {
      const currentLocation = await getCurrentLocation();
      setLocation(currentLocation);

      const tomtomResults = await searchTomTomPharmacies(
        currentLocation.lat,
        currentLocation.lon,
        30,
        SEARCH_RADIUS_METERS
      );

      const tomtomIds = tomtomResults.map((item) => item.id);
      let customRecords: CustomPharmacy[] = [];

      if (tomtomIds.length) {
        const { data, error: supabaseError } = await supabase
          .from("farmacias_customizadas")
          .select("tomtom_id, whatsapp")
          .in("tomtom_id", tomtomIds);

        if (supabaseError) {
          throw new Error(`Erro Supabase: ${supabaseError.message}`);
        }

        customRecords = data as CustomPharmacy[];
      }

      const customMap = new Map(customRecords.map((record) => [record.tomtom_id, record.whatsapp]));

      const merged = tomtomResults.map((item) => ({
        ...item,
        tomtomId: item.id,
        whatsapp: customMap.get(item.id) ?? item.phone,
      }));

      setFarmacias(merged);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setFarmacias([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleOpenWhatsApp(phone: string | undefined) {
    const url = getWhatsAppUrl(phone);
    if (!url) return;

    try {
      await Browser.open({ url, windowName: "_system" });
    } catch {
      if (typeof window !== "undefined") {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Farmácias Próximas</h1>
        <p className="text-muted-foreground mt-1">
          Busque farmácias a até 5 km usando sua localização e obtenha números de WhatsApp customizados.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-[auto_1fr] items-end">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <p className="text-sm font-medium">Raio de busca</p>
          <p className="text-sm text-muted-foreground mt-1">5 km</p>
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={handleSearch}
            disabled={loading}
            className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-primary/40"
          >
            {loading ? "Carregando localização…" : "Buscar farmácias"}
          </button>
          <p className="text-sm text-muted-foreground">
            Localização atual: {location ? `${location.lat.toFixed(5)}, ${location.lon.toFixed(5)}` : "não definida"}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">{summary}</p>
      </div>

      {error ? (
        <div className="rounded-2xl border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          Erro: {error}
        </div>
      ) : null}

      <div className="space-y-4">
        {farmacias.map((farmacia) => {
          const whatsappUrl = getWhatsAppUrl(farmacia.whatsapp);
          return (
            <div key={farmacia.tomtomId} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold">{farmacia.name}</h2>
                    <span className="rounded-full bg-muted px-2 py-1 text-[11px] font-medium text-foreground/70">
                      {formatDistance(farmacia.distanceMeters)}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">{farmacia.address}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">ID TomTom</p>
                  <p className="text-xs text-muted-foreground/80 break-all">{farmacia.tomtomId}</p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Número WhatsApp</p>
                  <p className="text-sm text-muted-foreground">
                    {farmacia.whatsapp ? farmacia.whatsapp : "Nenhum número disponível"}
                  </p>
                </div>

                <button
                  type="button"
                  disabled={!whatsappUrl}
                  onClick={() => handleOpenWhatsApp(farmacia.whatsapp)}
                  className="inline-flex h-11 items-center justify-center rounded-xl bg-emerald-500 px-4 text-sm font-medium text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-foreground/10 disabled:text-muted-foreground"
                >
                  {whatsappUrl ? "Chamar no WhatsApp" : "Sem WhatsApp"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
