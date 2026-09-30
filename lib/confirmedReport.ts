import { supabase } from "@/lib/supabase";

// Hidden report behind the footer logo (components/SiteFooter.tsx). The key
// ships in the client bundle: it only keeps guests from downloading the
// list by accident, it isn't access control.
const REPORT_KEY = "cumple2026";
const FILE_NAME = "confirmados-aparta-shower.xlsx";
const TITLE = "Confirmados — Aparta Shower Cumpleañero";

const ORANGE = "FFF7A531";
const BLACK = "FF111111";
const WHITE = "FFFFFFFF";
const ZEBRA = "FFF3F3F3";

export async function downloadConfirmedReport() {
  const key = window.prompt("Clave:");
  // Wrong or cancelled: close silently, nothing that hints at what this is.
  if (key !== REPORT_KEY) return;

  try {
    const { data, error } = await supabase
      .from("rsvps")
      .select("nombre, utensilio")
      .eq("asistencia", true)
      .order("created_at", { ascending: true })
      .abortSignal(AbortSignal.timeout(12_000));
    if (error) throw error;

    const rows = (data ?? []).map((r) => [r.nombre ?? "", r.utensilio || "—"]);

    // Loaded on demand: exceljs is heavy and only this hidden path needs it.
    const { default: ExcelJS } = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Confirmados");

    const fill = (argb: string) =>
      ({ type: "pattern", pattern: "solid", fgColor: { argb } }) as const;
    const thin = { style: "thin", color: { argb: "FFBFBFBF" } } as const;
    const border = { top: thin, left: thin, bottom: thin, right: thin };

    // Row 1: title across both columns.
    sheet.mergeCells("A1:B1");
    const title = sheet.getCell("A1");
    title.value = TITLE;
    title.font = { bold: true, size: 16, color: { argb: WHITE } };
    title.fill = fill(ORANGE);
    title.alignment = { vertical: "middle", horizontal: "center" };
    sheet.getRow(1).height = 32;

    // Row 2: column headers.
    const header = sheet.addRow(["Nombre", "Qué va a traer"]);
    header.height = 22;
    header.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: WHITE } };
      cell.fill = fill(BLACK);
      cell.border = border;
      cell.alignment = { vertical: "middle" };
    });

    // Data rows, zebra-striped.
    rows.forEach((values, i) => {
      const row = sheet.addRow(values);
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.border = border;
        cell.fill = fill(i % 2 === 0 ? WHITE : ZEBRA);
      });
    });

    // Total, across both columns.
    const total = sheet.addRow([`Total confirmados: ${rows.length}`]);
    sheet.mergeCells(total.number, 1, total.number, 2);
    total.getCell(1).font = { bold: true };

    // Column widths from the longest header/value (the merged title and
    // total rows don't count — they span both columns).
    [0, 1].forEach((col) => {
      const longest = Math.max(
        ...[["Nombre", "Qué va a traer"], ...rows].map((r) => String(r[col]).length)
      );
      sheet.getColumn(col + 1).width = Math.min(Math.max(longest + 4, 14), 60);
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = FILE_NAME;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Give the browser a moment to start the download before revoking.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (err) {
    console.error(err);
    window.alert("No se pudo generar el reporte. Intenta de nuevo.");
  }
}
