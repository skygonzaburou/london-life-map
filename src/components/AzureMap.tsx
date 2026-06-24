"use client";

import * as atlas from "azure-maps-control";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

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

type RentTrendPoint = {
  timePeriod: string;
  rentalPrice: number;
};

type RentTrendTooltipProps = {
  active?: boolean;
  payload?: {
    value?: number | string;
  }[];
  label?: string;
};

function formatPounds(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "No data";
  }

  return `£${value.toLocaleString("en-GB")}`;
}

function formatAnnualChange(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "No data";
  }

  return `${value.toFixed(1)}%`;
}

function RentTrendTooltip({
  active,
  payload,
  label,
}: RentTrendTooltipProps) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const rawValue = payload[0]?.value;
  const value =
    typeof rawValue === "number" ? rawValue : Number(rawValue ?? NaN);

  return (
    <div
      style={{
        padding: "0.6rem 0.75rem",
        background: "#ffffff",
        border: "1px solid #d1d5db",
        borderRadius: "8px",
        color: "#111827",
        fontSize: "0.85rem",
      }}
    >
      <div style={{ color: "#6b7280", marginBottom: "0.25rem" }}>
        {label}
      </div>
      <strong>{Number.isFinite(value) ? formatPounds(value) : "No data"}</strong>
    </div>
  );
}

function getShapeProperties(shape: unknown): Record<string, unknown> {
  if (!shape || typeof shape !== "object") {
    return {};
  }

  const possibleShape = shape as {
    getProperties?: () => unknown;
    properties?: unknown;
  };

  const propertiesFromMethod = possibleShape.getProperties?.();

  if (
    propertiesFromMethod &&
    typeof propertiesFromMethod === "object" &&
    !Array.isArray(propertiesFromMethod)
  ) {
    return propertiesFromMethod as Record<string, unknown>;
  }

  if (
    possibleShape.properties &&
    typeof possibleShape.properties === "object" &&
    !Array.isArray(possibleShape.properties)
  ) {
    return possibleShape.properties as Record<string, unknown>;
  }

  return {};
}

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
  const [selectedAreaCode, setSelectedAreaCode] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedPeriodRecords = useMemo(() => {
    if (!rentData || !selectedPeriod) {
      return [];
    }

    return rentData.records.filter(
      (record) => record.timePeriod === selectedPeriod
    );
  }, [rentData, selectedPeriod]);

  const selectedCurrentRecord = useMemo(() => {
    if (!selectedAreaCode || !selectedPeriod) {
      return null;
    }
  
    return (
      selectedPeriodRecords.find(
        (record) => record.areaCode === selectedAreaCode
      ) ?? null
    );
  }, [selectedAreaCode, selectedPeriod, selectedPeriodRecords]);
  
  const selectedBoroughName = useMemo(() => {
    if (!selectedAreaCode) {
      return "";
    }
  
    const feature = boroughGeoJson?.features.find((feature) => {
      return getBoroughAreaCode(feature.properties ?? {}) === selectedAreaCode;
    });
  
    const fallbackRentRecord = rentData?.records.find(
      (record) => record.areaCode === selectedAreaCode
    );
  
    return getBoroughName(
      feature?.properties ?? {},
      selectedCurrentRecord ?? fallbackRentRecord
    );
  }, [boroughGeoJson, rentData, selectedAreaCode, selectedCurrentRecord]);
  
  const selectedRentHistory = useMemo<RentTrendPoint[]>(() => {
    if (!rentData || !selectedAreaCode) {
      return [];
    }
  
    return rentData.records
      .filter((record) => {
        return (
          record.areaCode === selectedAreaCode &&
          record.rentalPrice !== null
        );
      })
      .map((record) => ({
        timePeriod: record.timePeriod,
        rentalPrice: record.rentalPrice as number,
      }));
  }, [rentData, selectedAreaCode]);

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
      map.events.add("click", polygonLayer, (event) => {
        const mapEvent = event as atlas.MapMouseEvent & {
          shapes?: unknown[];
        };
      
        const shape = mapEvent.shapes?.[0];
        const properties = getShapeProperties(shape);
      
        const areaCode = String(
          properties.areaCode ??
            properties.LAD25CD ??
            properties.LAD24CD ??
            properties.LAD23CD ??
            properties.LADCD ??
            ""
        ).trim();
      
        if (areaCode) {
          setSelectedAreaCode(areaCode);
        }
      });
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
    <div className="rent-map-feature">
      <div className="rent-period-bar">
        <div className="rent-period-control">
          <label htmlFor="rent-period">Rent period</label>
  
          <select
            id="rent-period"
            className="form-select"
            value={selectedPeriod}
            onChange={(event) => setSelectedPeriod(event.target.value)}
            disabled={!rentData}
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
        </div>
  
        <div className="rent-period-meta">
          Areas with rent data:{" "}
          <strong style={{ color: "var(--text)" }}>
            {selectedPeriodRecords.length}
          </strong>
        </div>
      </div>
  
      <div className="rent-map-layout">
        <section className="app-card rent-range-panel">
          <h3
            style={{
              margin: "0 0 0.75rem",
              fontSize: "1rem",
            }}
          >
            Rent range
          </h3>
  
          <div className="rent-range-list">
            {RENT_BANDS.map((band) => (
              <div key={band.id} className="rent-range-item">
                <span
                  className="rent-range-color"
                  style={{
                    background: band.color,
                  }}
                />
                <span>{band.label}</span>
              </div>
            ))}
          </div>
        </section>
  
        <section className="app-card rent-trend-panel">
          <h3
            style={{
              margin: "0 0 0.75rem",
              fontSize: "1rem",
            }}
          >
            Rent trend
          </h3>
  
          {!selectedAreaCode ? (
            <p
              style={{
                margin: 0,
                fontSize: "0.85rem",
                color: "var(--muted)",
                lineHeight: 1.5,
              }}
            >
              Select a borough on the map to show its rent trend here.
            </p>
          ) : (
            <>
              <div style={{ marginBottom: "0.75rem" }}>
                <div
                  style={{
                    fontWeight: 700,
                    marginBottom: "0.35rem",
                  }}
                >
                  {selectedBoroughName || selectedAreaCode}
                </div>
  
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr",
                    gap: "0.35rem",
                    fontSize: "0.85rem",
                    color: "var(--muted)",
                  }}
                >
                  <div>
                    Selected period:{" "}
                    <strong style={{ color: "var(--text)" }}>
                      {selectedPeriod}
                    </strong>
                  </div>
  
                  <div>
                    Rent:{" "}
                    <strong style={{ color: "var(--text)" }}>
                      {formatPounds(selectedCurrentRecord?.rentalPrice)}
                    </strong>
                  </div>
  
                  <div>
                    Annual change:{" "}
                    <strong style={{ color: "var(--text)" }}>
                      {formatAnnualChange(selectedCurrentRecord?.annualChange)}
                    </strong>
                  </div>
                </div>
              </div>
  
              {selectedRentHistory.length > 0 ? (
                <div style={{ width: "100%", height: "320px" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={selectedRentHistory}
                      margin={{
                        top: 10,
                        right: 10,
                        left: 0,
                        bottom: 0,
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="timePeriod"
                        tick={{ fontSize: 10 }}
                        minTickGap={28}
                      />
                      <YAxis
                        width={52}
                        tick={{ fontSize: 10 }}
                        tickFormatter={(value) =>
                          `£${Number(value).toLocaleString("en-GB")}`
                        }
                      />
                      <Tooltip content={<RentTrendTooltip />} />
                      <Line
                        type="monotone"
                        dataKey="rentalPrice"
                        name="Rent"
                        stroke="#60a5fa"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p
                  style={{
                    margin: 0,
                    fontSize: "0.85rem",
                    color: "var(--muted)",
                    lineHeight: 1.5,
                  }}
                >
                  No rent trend data is available for this area.
                </p>
              )}
            </>
          )}
        </section>
  
        <section className="map-panel">
          {errorMessage && (
            <p
              style={{
                color: "var(--danger)",
                fontWeight: 600,
                marginTop: 0,
              }}
            >
              {errorMessage}
            </p>
          )}
  
          <div ref={mapContainerRef} className="map-container" />
        </section>
      </div>
    </div>
  );
}