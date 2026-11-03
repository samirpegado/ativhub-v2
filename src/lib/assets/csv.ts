import { ASSET_STATUSES, assetStatusLabel } from "@/lib/assets/status";
import { parseBrlAmount } from "@/lib/money/brl";

export const ASSET_CSV_HEADERS = [
  "id",
  "nome",
  "status",
  "localizacao",
  "categoria",
  "local_instalacao",
  "modelo",
  "fabricante",
  "numero_serie",
  "codigo_barras",
  "potencia",
  "custo_aquisicao",
  "em_servico_desde",
  "fim_garantia",
  "descricao",
  "informacoes_adicionais",
] as const;

export type AssetCsvRow = {
  line: number;
  customId: string | null;
  name: string;
  status: string;
  locationName: string;
  categoryName: string | null;
  area: string | null;
  model: string | null;
  manufacturer: string | null;
  serialNumber: string | null;
  barCode: string | null;
  power: string | null;
  acquisitionCost: number | null;
  inServiceDate: string | null;
  warrantyExpirationDate: string | null;
  description: string | null;
  additionalInfos: string | null;
};

const TEMPLATE = [
  ASSET_CSV_HEADERS.join(";"),
  [
    "",
    "Ar condicionado do salão",
    "Operacional",
    "Sede",
    "Refrigeração",
    "Bloco A",
    "Split 12k",
    "Marca",
    "SN-100",
    "",
    "12000 BTU",
    "3500.00",
    "2024-01-15",
    "",
    "",
    "",
  ].join(";"),
].join("\n");

export function assetCsvTemplate() {
  return `\uFEFF${TEMPLATE}\n`;
}

function csvCell(value: string | number | null | undefined) {
  const text = value == null ? "" : String(value);
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  if (/[;"\n\r]/.test(safe)) return `"${safe.replaceAll('"', '""')}"`;
  return safe;
}

export function assetsToCsv(
  rows: {
    customId: string | null;
    name: string;
    status: string;
    locationName: string | null;
    categoryName: string | null;
    area: string | null;
    model: string | null;
    manufacturer: string | null;
    serialNumber: string | null;
    barCode: string | null;
    power: string | null;
    acquisitionCost: number | null;
    inServiceDate: string | null;
    warrantyExpirationDate: string | null;
    description: string | null;
    additionalInfos: string | null;
  }[],
) {
  const lines = rows.map((row) =>
    [
      row.customId,
      row.name,
      assetStatusLabel(row.status),
      row.locationName,
      row.categoryName,
      row.area,
      row.model,
      row.manufacturer,
      row.serialNumber,
      row.barCode,
      row.power,
      row.acquisitionCost == null ? "" : row.acquisitionCost.toFixed(2),
      row.inServiceDate,
      row.warrantyExpirationDate,
      row.description,
      row.additionalInfos,
    ]
      .map(csvCell)
      .join(";"),
  );
  return `\uFEFF${[ASSET_CSV_HEADERS.join(";"), ...lines].join("\n")}\n`;
}

export function parseCsvTable(input: string) {
  const text = input.replace(/^\uFEFF/, "");
  const headerLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter =
    (headerLine.match(/;/g)?.length ?? 0) >= (headerLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function blank(value: string | undefined) {
  const text = value?.trim() ?? "";
  return text ? text : null;
}

function parseDateCell(value: string | null) {
  if (!value) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  const date = iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : br ? `${br[3]}-${br[2]}-${br[1]}` : null;
  if (!date || Number.isNaN(new Date(`${date}T00:00:00`).getTime())) {
    throw new Error("Data inválida. Use AAAA-MM-DD.");
  }
  return date;
}

function parseStatus(value: string | null) {
  if (!value) return "OPERATIONAL";
  const found = ASSET_STATUSES.find(
    (item) =>
      item.value.toLowerCase() === value.toLowerCase() ||
      item.label.toLowerCase() === value.toLowerCase(),
  );
  if (!found) throw new Error("Status inválido.");
  return found.value;
}

export function readAssetCsv(input: string): { rows: AssetCsvRow[]; errors: { line: number; message: string }[] } {
  const table = parseCsvTable(input);
  const header = (table[0] ?? []).map((cell) => cell.trim().toLowerCase());
  if (!header.includes("nome") || !header.includes("localizacao")) {
    return { rows: [], errors: [{ line: 1, message: "O arquivo precisa das colunas nome e localizacao." }] };
  }
  const index = new Map(header.map((name, position) => [name, position]));
  const cell = (row: string[], name: string) => blank(row[index.get(name) ?? -1]);
  const rows: AssetCsvRow[] = [];
  const errors: { line: number; message: string }[] = [];

  table.slice(1).forEach((raw, offset) => {
    const line = offset + 2;
    if (raw.every((item) => !item.trim())) return;
    try {
      const name = cell(raw, "nome");
      const locationName = cell(raw, "localizacao");
      if (!name) throw new Error("Informe o nome.");
      if (name.length > 160) throw new Error("O nome deve ter no máximo 160 caracteres.");
      if (!locationName) throw new Error("Informe a localização.");
      const description = cell(raw, "descricao");
      const additional = cell(raw, "informacoes_adicionais");
      const area = cell(raw, "local_instalacao");
      if ((description?.length ?? 0) > 2000 || (additional?.length ?? 0) > 2000) {
        throw new Error("A descrição deve ter no máximo 2000 caracteres.");
      }
      if ((area?.length ?? 0) > 120) throw new Error("O local de instalação deve ter no máximo 120 caracteres.");
      rows.push({
        line,
        customId: cell(raw, "id"),
        name,
        status: parseStatus(cell(raw, "status")),
        locationName,
        categoryName: cell(raw, "categoria"),
        area,
        model: cell(raw, "modelo"),
        manufacturer: cell(raw, "fabricante"),
        serialNumber: cell(raw, "numero_serie"),
        barCode: cell(raw, "codigo_barras"),
        power: cell(raw, "potencia"),
        acquisitionCost: parseBrlAmount(cell(raw, "custo_aquisicao")),
        inServiceDate: parseDateCell(cell(raw, "em_servico_desde")),
        warrantyExpirationDate: parseDateCell(cell(raw, "fim_garantia")),
        description,
        additionalInfos: additional,
      });
    } catch (error) {
      errors.push({
        line,
        message: error instanceof Error ? error.message : "Linha inválida.",
      });
    }
  });

  return { rows, errors };
}
