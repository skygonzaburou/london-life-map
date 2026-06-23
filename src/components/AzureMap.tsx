"use client";

import * as atlas from "azure-maps-control";
import { useEffect, useMemo, useRef, useState } from "react";

type BoroughFeature = {
  type: "Feature";
  properties: Record<string, unknown>;
  geometry: unknown;
};

type BoroughFeatureCollection = {
  type: "FeatureCollection";
  features: BoroughFeature[];
  [key: string]: unknown;
};

type RentRecord = {
  timePeriod: string;
  areaCode: string;
  areaName: string;
  regionOrCountryName: string;
  annualChange: number | null;
  rentalPrice: number | null;
};

type RentData = {
  source: string;
  licence: string;
  latestPeriod: string | null;
  availablePeriods: string[];
  records: RentRecord[];
};

type RentBand = {
  id: string;
  label: string;
  upperLimit: number | null;
  color: string;
};

const NO_DATA_BAND: RentBand = {
  id: "no-data",
  label: "No data",
  upperLimit: null,
  color: "#d1d5db",
};

const RENT_BANDS: RentBand[] = [
  NO_DATA_BAND,
  {
    id: "le-1000",
    label: "£1,000 or less",
    upperLimit: 1000,
    color: "#ecfdf5",
  },
  {
    id: "1001-1250",
    label: "£1,001 - £1,250",
    upperLimit: 1250,
    color: "#d1fae5",
  },
  {
    id: "1251-1500",
    label: "£1,251 - £1,500",
    upperLimit: 1500,
    color: "#a7f3d0",
  },
  {
    id: "1501-1750",
    label: "£1,501 - £1,750",
    upperLimit: 1750,
    color: "#6ee7b7",
  },
  {
    id: "1751-2000",
    label: "£1,751 - £2,000",
    upperLimit: 2000,
    color: "#fde68a",
  },
  {
    id: "2001-2250",
    label: "£2,001 - £2,250",
    upperLimit: 2250,
    color: "#fcd34d",
  },
  {
    id: "2251-2500",
    label: "£2,251 - £2,500",
    upperLimit: 2500,
    color: "#fbbf24",
  },
  {
    id: "2501-2750",
    label: "£2,501 - £2,750",
    upperLimit: 2750,
    color: "#f59e0b",
  },
  {
    id: "2751-3000",
    label: "£2,751 - £3,000",
    upperLimit: 3000,
    color: "#fb923c",
  },
  {
    id: "3001-3250",
    label: "£3,001 - £3,250",
    upperLimit: 3250,
    color: "#f97316",
  },
  {
    id: "3251-3500",
    label: "£3,251 - £3,500",
    upperLimit: 3500,
    color: "#ef4444",
  },
  {
    id: "3501-3750",
    label: "£3,501 - £3,750",
    upperLimit: 3750,
    color: "#dc2626",
  },
  {
    id: "3751-4000",
    label: "£3,751 - £4,000",
    upperLimit: 4000,
    color: "#b91c1c",
  },
  {
    id: "gt-4000",
    label: "Over £4,000",
    upperLimit: Infinity,
    color: "#7f1d1d",
  },
];

function getRentBand(rentalPrice: number | null | undefined): RentBand {
  if (rentalPrice === null || rentalPrice === undefined) {
    return NO_DATA_BAND;
  }

  return (
    RENT_BANDS.find((band) => {
      if (band.id === "no-data" || band.upperLimit === null) {
        return false;
      }

      return rentalPrice <= band.upperLimit;
    }) ?? RENT_BANDS[RENT_BANDS.length - 1]
  );
}

function getBoroughAreaCode(properties: Record<string, unknown>): string {
  return String(
    properties.LAD25CD ??
      properties.LAD24CD ??
      properties.LAD23CD ??
      properties.LADCD ??
      ""
  ).trim();
}

function getBoroughName(
  properties: Record<string, unknown>,
  rentRecord?: RentRecord
): string {
  return String(
    properties.LAD25NM ??
      properties.LAD24NM ??
      properties.LAD23NM ??
      properties.LADNM ??
      rentRecord?.areaName ??
      ""
  ).trim();
}

function buildRentLookup(records: RentRecord[], selectedPeriod: string) {
  const lookup = new Map<string, RentRecord>();

  records
    .filter((record) => record.timePeriod === selectedPeriod)
    .forEach((record) => {
      lookup.set(record.areaCode, record);
    });

  return lookup;
}

function buildRentGeoJson(
  boroughGeoJson: BoroughFeatureCollection,
  rentData: RentData,
  selectedPeriod: string
): BoroughFeatureCollection {
  const rentLookup = buildRentLookup(rentData.records, selectedPeriod);

  const features = boroughGeoJson.features.map((feature) => {
    const originalProperties = feature.properties ?? {};
    const areaCode = getBoroughAreaCode(originalProperties);
    const rentRecord = rentLookup.get(areaCode);
    const rentBand = getRentBand(rentRecord?.rentalPrice);

    return {
      ...feature,
      properties: {
        ...originalProperties,
        areaCode,
        areaName: getBoroughName(originalProperties, rentRecord),
        selectedPeriod,
        rentalPrice: rentRecord?.rentalPrice ?? null,
        annualChange: rentRecord?.annualChange ?? null,
        rentBandId: rentBand.id,
        rentBandLabel: rentBand.label,
        fillColor: rentBand.color,
      },
    };
  });

  return {
    ...boroughGeoJson,
    features,
  };
}

export default function AzureMap() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<atlas.Map | null>(null);
  const dataSourceRef = useRef<atlas.source.DataSource | null>(null);

  const [isMapReady, setIsMapReady] = useState(false);
  const [boroughGeoJson, setBoroughGeoJson] =
    useState<BoroughFeatureCollection | null>(null);
  const [rentData, setRentData] = useState<RentData | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedPeriodRecords = useMemo(() => {
    if (!rentData || !selectedPeriod) {
      return [];
    }

    return rentData.records.filter(
      (record) => record.timePeriod === selectedPeriod
    );
  }, [rentData, selectedPeriod]);

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_AZURE_MAPS_KEY;

    if (!key) {
      setErrorMessage("NEXT_PUBLIC_AZURE_MAPS_KEY is not set.");
      return;
    }

    if (!mapContainerRef.current || mapRef.current) {
      return;
    }

    const map = new atlas.Map(mapContainerRef.current, {
      center: [-0.1278, 51.5074],
      zoom: 9,
      view: "Auto",
      style: "road",
      authOptions: {
        authType: atlas.AuthenticationType.subscriptionKey,
        subscriptionKey: key,
      },
    });

    mapRef.current = map;

    map.events.add("ready", () => {
      const dataSource = new atlas.source.DataSource("london-boroughs");
      dataSourceRef.current = dataSource;
      map.sources.add(dataSource);

      const polygonLayer = new atlas.layer.PolygonLayer(
        dataSource,
        "london-borough-polygons",
        {
          fillColor: ["get", "fillColor"] as unknown as string,
          fillOpacity: 0.75,
        }
      );

      const lineLayer = new atlas.layer.LineLayer(
        dataSource,
        "london-borough-lines",
        {
          strokeColor: "#1f2937",
          strokeWidth: 1,
        }
      );

      map.layers.add([polygonLayer, lineLayer]);
      setIsMapReady(true);
    });

    return () => {
      map.dispose();
      mapRef.current = null;
      dataSourceRef.current = null;
    };
  }, []);

  useEffect(() => {
    async function loadData() {
      try {
        const [boroughResponse, rentResponse] = await Promise.all([
          fetch("/data/london-boroughs.geojson"),
          fetch("/data/london-rents.json"),
        ]);

        if (!boroughResponse.ok) {
          throw new Error(
            `Failed to load borough GeoJSON: ${boroughResponse.status}`
          );
        }

        if (!rentResponse.ok) {
          throw new Error(`Failed to load rent data: ${rentResponse.status}`);
        }

        const boroughData =
          (await boroughResponse.json()) as BoroughFeatureCollection;
        const rentJson = (await rentResponse.json()) as RentData;

        setBoroughGeoJson(boroughData);
        setRentData(rentJson);
        setSelectedPeriod(
          rentJson.latestPeriod ??
            rentJson.availablePeriods[rentJson.availablePeriods.length - 1] ??
            ""
        );
      } catch (error) {
        console.error(error);
        setErrorMessage("Failed to load map data.");
      }
    }

    loadData();
  }, []);

  useEffect(() => {
    const dataSource = dataSourceRef.current;

    if (
      !isMapReady ||
      !dataSource ||
      !boroughGeoJson ||
      !rentData ||
      !selectedPeriod
    ) {
      return;
    }

    const rentGeoJson = buildRentGeoJson(
      boroughGeoJson,
      rentData,
      selectedPeriod
    );

    dataSource.clear();
    dataSource.add(rentGeoJson.features as never);
  }, [isMapReady, boroughGeoJson, rentData, selectedPeriod]);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "320px minmax(0, 1fr)",
        gap: "1rem",
        alignItems: "stretch",
      }}
    >
      <aside
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
          minHeight: "75vh",
        }}
      >
        <section
          style={{
            padding: "1rem",
            border: "1px solid #e5e7eb",
            borderRadius: "12px",
            background: "#ffffff",
            color: "#111827",
          }}
        >
          <h3
            style={{
              margin: "0 0 0.75rem",
              fontSize: "1rem",
            }}
          >
            Rent period
          </h3>

          <select
            id="rent-period"
            value={selectedPeriod}
            onChange={(event) => setSelectedPeriod(event.target.value)}
            disabled={!rentData}
            style={{
              width: "100%",
              padding: "0.5rem 0.6rem",
              borderRadius: "8px",
              border: "1px solid #d1d5db",
              background: "#ffffff",
              color: "#111827",
            }}
          >
            {(rentData?.availablePeriods ?? [])
              .slice()
              .reverse()
              .map((period) => (
                <option key={period} value={period}>
                  {period}
                </option>
              ))}
          </select>

          <p
            style={{
              margin: "0.75rem 0 0",
              fontSize: "0.85rem",
              color: "#4b5563",
            }}
          >
            Areas with rent data:{" "}
            <strong style={{ color: "#111827" }}>
              {selectedPeriodRecords.length}
            </strong>
          </p>
        </section>

        <section
          style={{
            padding: "1rem",
            border: "1px solid #e5e7eb",
            borderRadius: "12px",
            background: "#ffffff",
            color: "#111827",
            minHeight: "180px",
          }}
        >
          <h3
            style={{
              margin: "0 0 0.75rem",
              fontSize: "1rem",
            }}
          >
            Rent trend
          </h3>

          <p
            style={{
              margin: 0,
              fontSize: "0.85rem",
              color: "#6b7280",
              lineHeight: 1.5,
            }}
          >
            Select a borough on the map to show its rent trend here.
          </p>

          <p
            style={{
              margin: "0.75rem 0 0",
              fontSize: "0.8rem",
              color: "#9ca3af",
              lineHeight: 1.5,
            }}
          >
            This panel will be implemented in Step 14.
          </p>
        </section>

        <section
          style={{
            padding: "1rem",
            border: "1px solid #e5e7eb",
            borderRadius: "12px",
            background: "#ffffff",
            color: "#111827",
            flex: 1,
          }}
        >
          <h3
            style={{
              margin: "0 0 0.75rem",
              fontSize: "1rem",
            }}
          >
            Rent range
          </h3>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.45rem",
              fontSize: "0.82rem",
            }}
          >
            {RENT_BANDS.map((band) => (
              <div
                key={band.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                }}
              >
                <span
                  style={{
                    width: "16px",
                    height: "16px",
                    background: band.color,
                    border: "1px solid #9ca3af",
                    display: "inline-block",
                    flexShrink: 0,
                  }}
                />
                <span>{band.label}</span>
              </div>
            ))}
          </div>
        </section>
      </aside>

      <section>
        {errorMessage && (
          <p
            style={{
              color: "#b91c1c",
              fontWeight: 600,
            }}
          >
            {errorMessage}
          </p>
        )}

        <div
          ref={mapContainerRef}
          style={{
            width: "100%",
            height: "75vh",
            border: "1px solid #ddd",
            borderRadius: "12px",
            overflow: "hidden",
          }}
        />
      </section>
    </div>
  );
}