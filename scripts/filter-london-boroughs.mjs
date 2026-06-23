// Extract London boroughs from the ONS Local Authority District GeoJSON.
// The ONS geometry can be in British National Grid coordinates (EPSG:27700),
// but Azure Maps expects longitude/latitude coordinates (EPSG:4326).
// Therefore, this script filters London boroughs and converts their geometry
// to EPSG:4326 before writing public/data/london-boroughs.geojson.
//
// ONSのLocal Authority District GeoJSONからLondon boroughのみを抽出する。
// ONSの境界データのgeometryは、British National Grid座標系（EPSG:27700）で
// 保持されている場合がある。
// 一方、Azure Mapsではlongitude/latitude形式（EPSG:4326）の座標が必要となる。
// そのため、このスクリプトではLondon boroughのみを抽出し、geometry座標を
// EPSG:4326へ変換したうえで public/data/london-boroughs.geojson に出力する。

import fs from "fs";
import proj4 from "proj4";

const inputPath = "data/raw/local-authority-districts-dec-2025-uk-bgc.geojson";
const outputPath = "public/data/london-boroughs.geojson";

proj4.defs(
  "EPSG:27700",
  "+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +ellps=airy +towgs84=446.448,-125.157,542.06,0.1502,0.247,0.8421,-20.4894 +units=m +no_defs"
);

const geojson = JSON.parse(fs.readFileSync(inputPath, "utf8"));

function isLikelyBritishNationalGrid(position) {
  const [x, y] = position;
  return Math.abs(x) > 180 || Math.abs(y) > 90;
}

function convertPosition(position) {
  if (!Array.isArray(position) || position.length < 2) {
    return position;
  }

  const [x, y] = position;

  if (typeof x !== "number" || typeof y !== "number") {
    return position;
  }

  if (!isLikelyBritishNationalGrid(position)) {
    return position;
  }

  const [longitude, latitude] = proj4("EPSG:27700", "EPSG:4326", [x, y]);

  return [longitude, latitude];
}

function convertCoordinates(coordinates) {
  if (!Array.isArray(coordinates)) {
    return coordinates;
  }

  if (typeof coordinates[0] === "number") {
    return convertPosition(coordinates);
  }

  return coordinates.map(convertCoordinates);
}

function convertGeometry(geometry) {
  if (!geometry || !geometry.coordinates) {
    return geometry;
  }

  return {
    ...geometry,
    coordinates: convertCoordinates(geometry.coordinates),
  };
}

const filteredFeatures = geojson.features
  .filter((feature) => {
    const props = feature.properties ?? {};

    const code =
      props.LAD25CD ??
      props.LAD24CD ??
      props.LAD23CD ??
      props.LADCD ??
      "";

    return typeof code === "string" && code.startsWith("E09");
  })
  .map((feature) => ({
    ...feature,
    geometry: convertGeometry(feature.geometry),
  }));

const output = {
  type: "FeatureCollection",
  name: "London boroughs",
  source: "Office for National Statistics",
  licence: "Open Government Licence v3.0",
  contains: "OS data © Crown copyright and database right 2025",
  features: filteredFeatures,
};

fs.writeFileSync(outputPath, JSON.stringify(output));

console.log(`Created: ${outputPath}`);
console.log(`Features: ${filteredFeatures.length}`);

let firstCoordinate = output.features[0]?.geometry?.coordinates;
while (Array.isArray(firstCoordinate?.[0])) {
  firstCoordinate = firstCoordinate[0];
}

console.log("First coordinate:", firstCoordinate);
