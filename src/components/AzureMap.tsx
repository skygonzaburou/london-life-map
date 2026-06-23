"use client";

import * as atlas from "azure-maps-control";
import { useEffect, useRef } from "react";

export default function AzureMap() {
  const mapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_AZURE_MAPS_KEY;

    if (!key) {
      console.error("NEXT_PUBLIC_AZURE_MAPS_KEY is not set.");
      return;
    }

    if (!mapRef.current) {
      return;
    }

    const map = new atlas.Map(mapRef.current, {
      center: [-0.1278, 51.5074],
      zoom: 9,
      view: "Auto",
      authOptions: {
        authType: atlas.AuthenticationType.subscriptionKey,
        subscriptionKey: key,
      },
    });

    map.events.add("ready", async () => {
      try {
        const response = await fetch("/data/london-boroughs.geojson");

        if (!response.ok) {
          throw new Error(`Failed to load GeoJSON: ${response.status}`);
        }

        const geojson = await response.json();

        console.log("GeoJSON loaded:", geojson);
        console.log("Feature count:", geojson.features?.length);
        console.log("First feature properties:", geojson.features?.[0]?.properties);

        const dataSource = new atlas.source.DataSource("london-boroughs");
        map.sources.add(dataSource);

        dataSource.add(geojson.features);

        const polygonLayer = new atlas.layer.PolygonLayer(
          dataSource,
          "london-borough-polygons",
          {
            fillColor: "rgba(37, 99, 235, 0.18)",
            fillOpacity: 0.5,
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

        console.log("London borough layers added.");
      } catch (error) {
        console.error("Failed to load London borough boundaries:", error);
      }
    });

    return () => {
      map.dispose();
    };
  }, []);

  return (
    <div
      ref={mapRef}
      style={{
        width: "100%",
        height: "75vh",
        border: "1px solid #ddd",
        borderRadius: "12px",
        overflow: "hidden",
      }}
    />
  );
}