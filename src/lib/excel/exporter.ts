import ExcelJS from "exceljs";

export interface ExcelColumnSpec {
  header: string;
  key: string;
  width?: number;
  isCurrency?: boolean;
}

export async function buildExcelReportBuffer(params: {
  sheetName: string;
  title: string;
  subtitle?: string;
  columns: readonly ExcelColumnSpec[];
  rows: ReadonlyArray<Record<string, string | number | null | undefined>>;
}): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "DCMS ERP";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(params.sheetName.slice(0, 31));

  sheet.addRow([params.title]);
  sheet.getRow(1).font = { bold: true, size: 13 };
  if (params.subtitle) {
    sheet.addRow([params.subtitle]);
    sheet.getRow(2).font = { italic: true, size: 10, color: { argb: "FF475569" } };
  }
  sheet.addRow([]);

  const headerRowIndex = sheet.rowCount + 1;
  sheet.columns = params.columns.map((col) => ({
    key: col.key,
    width: col.width ?? 20,
  }));

  const headerRow = sheet.addRow(params.columns.map((c) => c.header));
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1B365D" },
  };

  for (const rowData of params.rows) {
    const values = params.columns.map((col) => {
      const raw = rowData[col.key];
      if (col.isCurrency && raw !== null && raw !== undefined && raw !== "") {
        const parsed = Number(raw);
        return Number.isFinite(parsed) ? parsed : raw;
      }
      return raw ?? "";
    });
    const added = sheet.addRow(values);
    params.columns.forEach((col, idx) => {
      if (col.isCurrency) {
        added.getCell(idx + 1).numFmt = '"₹"#,##0.00';
      }
    });
  }

  sheet.views = [{ state: "frozen", ySplit: headerRowIndex }];
  const out = await workbook.xlsx.writeBuffer();
  return Buffer.from(out);
}

