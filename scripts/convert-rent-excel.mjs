import fs from "fs";
import path from "path";
import xlsx from "xlsx";

const inputPath = "data/raw/datadownload.xlsx";
const outputPath = "public/data/london-rents.json";

const workbook = xlsx.readFile(inputPath);

const uses1904DateSystem = workbook.Workbook?.WBProps?.date1904 === true;

function normalizeHeader(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function findDataSheet(workbook) {
  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];

    const rows = xlsx.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: null,
      raw: true,
    });

    const headerRowIndex = rows.findIndex((row) => {
      const headers = row.map(normalizeHeader);

      return (
        headers.includes("Time period") &&
        headers.includes("Area code") &&
        headers.includes("Area name") &&
        headers.includes("Rental price")
      );
    });

    if (headerRowIndex >= 0) {
      return {
        sheetName,
        worksheet,
        headerRowIndex,
      };
    }
  }

  throw new Error(
    "Could not find a worksheet with Time period, Area code, Area name and Rental price columns."
  );
}

function toNumber(value) {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    value === "[x]" ||
    value === "[z]"
  ) {
    return null;
  }

  const normalized = String(value)
    .replace(/,/g, "")
    .replace(/%/g, "")
    .trim();

  const numberValue = Number(normalized);

  return Number.isFinite(numberValue) ? numberValue : null;
}

function excelSerialDateToYearMonth(serial) {
// Convert Excel serial date to YYYY-MM.
// Excel files can use either the 1900 date system or the 1904 date system.
// This ONS workbook uses the 1904 date system, so the date system must be
// detected from the workbook before converting serial values.
//
// Excelの日付シリアル値をYYYY-MM形式に変換する。
// Excelファイルには1900 date systemと1904 date systemの2種類がある。
// 今回のONS Excelは1904 date systemを使っているため、
// Workbookの設定から日付基準を判定してから変換する。
  const baseDate = uses1904DateSystem
    ? new Date(Date.UTC(1904, 0, 1))
    : new Date(Date.UTC(1899, 11, 30));

  const date = new Date(
    baseDate.getTime() + Math.round(serial) * 86400 * 1000
  );

  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");

  return `${year}-${month}`;
}

function toTimePeriod(value) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  if (typeof value === "number") {
    return excelSerialDateToYearMonth(value);
  }

  if (value instanceof Date) {
    const year = value.getUTCFullYear();
    const month = String(value.getUTCMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
  }

  const text = String(value).trim();

  const match = text.match(/^(\d{4})[-/](\d{1,2})$/);
  if (match) {
    const year = match[1];
    const month = String(Number(match[2])).padStart(2, "0");
    return `${year}-${month}`;
  }

  return text;
}

function getPeriodSortKey(period) {
  const match = String(period).match(/^(\d{4})-(\d{2})$/);

  if (!match) {
    return String(period);
  }

  return Number(`${match[1]}${match[2]}`);
}

function getValue(row, possibleColumnNames) {
  for (const columnName of possibleColumnNames) {
    if (Object.prototype.hasOwnProperty.call(row, columnName)) {
      return row[columnName];
    }
  }

  return null;
}

const { sheetName, worksheet, headerRowIndex } = findDataSheet(workbook);

// The correct ONS workbook currently stores the data in "Table 1".
// The header row is detected dynamically instead of hard-coding the sheet name
// or row number, so that minor future layout changes are easier to handle.
//
// 現在のONS Excelでは、データは "Table 1" シートに格納されている。
// ただし、将来のレイアウト変更に備えて、シート名や行番号を固定せず、
// 必要な列名を含むヘッダー行を自動検出する。
const rows = xlsx.utils.sheet_to_json(worksheet, {
  defval: null,
  raw: true,
  range: headerRowIndex,
});

// Convert Excel rows into a cleaner JSON structure.
// Only London boroughs and City of London are kept.
// Their area codes start with "E09".
//
// Excel行をアプリで扱いやすいJSON形式に変換する。
// London boroughおよびCity of Londonのみを対象とする。
// これらのArea codeは "E09" で始まる。
const records = rows
  .map((row) => {
    const timePeriod = toTimePeriod(getValue(row, ["Time period"]));
    const areaCode = String(getValue(row, ["Area code"]) ?? "").trim();
    const areaName = String(getValue(row, ["Area name"]) ?? "").trim();
    const regionOrCountryName = String(
      getValue(row, ["Region or country name"]) ?? ""
    ).trim();

    return {
      timePeriod,
      areaCode,
      areaName,
      regionOrCountryName,
      annualChange: toNumber(getValue(row, ["Annual change"])),
      rentalPrice: toNumber(getValue(row, ["Rental price", "Rental price (£)"])),
    };
  })
  .filter((record) => {
    return (
      record.areaCode.startsWith("E09") &&
      record.timePeriod !== "" &&
      record.areaName !== "" &&
      record.rentalPrice !== null
    );
  })
  .sort((a, b) => {
    const keyA = getPeriodSortKey(a.timePeriod);
    const keyB = getPeriodSortKey(b.timePeriod);

    if (keyA > keyB) return 1;
    if (keyA < keyB) return -1;

    return a.areaName.localeCompare(b.areaName);
  });

const availablePeriods = Array.from(
  new Set(records.map((record) => record.timePeriod))
).sort((a, b) => {
  const keyA = getPeriodSortKey(a);
  const keyB = getPeriodSortKey(b);

  if (keyA > keyB) return 1;
  if (keyA < keyB) return -1;

  return 0;
});

const latestPeriod = availablePeriods[availablePeriods.length - 1] ?? null;

const latestRecords = records.filter(
  (record) => record.timePeriod === latestPeriod
);

const output = {
  source: "Office for National Statistics",
  licence: "Open Government Licence v3.0",
  generatedAt: new Date().toISOString(),
  sheetName,
  headerRow: headerRowIndex + 1,
  latestPeriod,
  availablePeriods,
  records,
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), "utf8");

console.log(`Created: ${outputPath}`);
console.log(`Sheet: ${sheetName}`);
console.log(`Header row: ${headerRowIndex + 1}`);
console.log(`Date system: ${uses1904DateSystem ? "1904" : "1900"}`);
console.log(`Rows read from Excel: ${rows.length}`);
console.log(`Records: ${records.length}`);
console.log(`Periods: ${availablePeriods.length}`);
console.log(`Latest period: ${latestPeriod}`);
console.log(`Latest period records: ${latestRecords.length}`);
console.log("First record:", records[0]);
console.log("Latest record sample:", latestRecords[0]);

if (latestRecords.length !== 32) {
  console.warn(
    `Warning: latest period records is ${latestRecords.length}, expected 32 for London borough rental data.`
  );
}