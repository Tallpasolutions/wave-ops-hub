import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import * as XLSX from "xlsx";

// ── Tipos de entrada ──────────────────────────────────────────────────────────

export type TechSummary = {
  nome: string;
  visitas: number;
  totalAPagar: number;
};

export type VisitDetail = {
  osNum: number;
  data: string;
  finalidade: string | null;
  sucesso: string;
  valor: number;
};

export type TechWithDetails = TechSummary & {
  visitDetails: VisitDetail[];
};

export type ClosingInfo = {
  periodo: string;
  periodoLabel: string;
  status: string;
  aprovadoEm: string | null;
  aprovadoPorNome: string | null;
  totalAPagar: number;
  totalReceitaUnetvale: number;
  margem: number;
  totalVisitas: number;
};

// ── Formatação ────────────────────────────────────────────────────────────────

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatPct(margem: number, receita: number): string {
  if (receita === 0) return "0%";
  return `${((margem / receita) * 100).toFixed(1)}%`;
}

// ── Excel ─────────────────────────────────────────────────────────────────────

export function generateExcelReport(
  closing: ClosingInfo,
  techsWithDetails: TechWithDetails[],
  tenantNome: string,
): Buffer {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Consolidado por técnico
  const sheet1Data = [
    [`Fechamento ${tenantNome} — ${closing.periodoLabel}`],
    [],
    ["Técnico", "Visitas", "Total a Pagar"],
    ...techsWithDetails.map((t) => [t.nome, t.visitas, t.totalAPagar]),
    [],
    ["TOTAIS", closing.totalVisitas, closing.totalAPagar],
    [],
    ["Receita Unetvale", "", closing.totalReceitaUnetvale],
    ["Margem bruta", "", closing.margem],
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(sheet1Data);
  XLSX.utils.book_append_sheet(wb, ws1, "Consolidado");

  // Sheet 2: Detalhe por visita
  const sheet2Rows: unknown[][] = [
    ["Técnico", "OS", "Data", "Finalidade", "Sucesso", "Valor (R$)"],
  ];
  for (const tech of techsWithDetails) {
    for (const v of tech.visitDetails) {
      sheet2Rows.push([
        tech.nome,
        v.osNum,
        v.data,
        v.finalidade ?? "—",
        v.sucesso,
        v.valor,
      ]);
    }
  }
  const ws2 = XLSX.utils.aoa_to_sheet(sheet2Rows);
  XLSX.utils.book_append_sheet(wb, ws2, "Detalhe por Visita");

  // Sheet 3: Resumo financeiro
  const sheet3Data = [
    ["Resumo Financeiro"],
    [],
    ["Total a Pagar", closing.totalAPagar],
    ["Receita Unetvale", closing.totalReceitaUnetvale],
    ["Margem Bruta", closing.margem],
    [
      "Margem %",
      formatPct(closing.margem, closing.totalReceitaUnetvale),
    ],
    ["Total Visitas", closing.totalVisitas],
  ];
  const ws3 = XLSX.utils.aoa_to_sheet(sheet3Data);
  XLSX.utils.book_append_sheet(wb, ws3, "Resumo Financeiro");

  const rawBuffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return Buffer.from(rawBuffer);
}

// ── PDF Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    padding: 40,
    color: "#1a1a1a",
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 10,
    color: "#555",
    marginBottom: 2,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "#777",
    marginBottom: 6,
  },
  table: {
    width: "100%",
  },
  tableRow: {
    flexDirection: "row",
    borderBottom: "0.5px solid #e0e0e0",
    paddingVertical: 5,
  },
  tableHeader: {
    flexDirection: "row",
    borderBottom: "1px solid #333",
    paddingBottom: 5,
    marginBottom: 2,
  },
  col1: { flex: 3 },
  col2: { flex: 1, textAlign: "right" },
  col3: { flex: 1.5, textAlign: "right" },
  headerText: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#444",
  },
  kpiRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  kpiBox: {
    flex: 1,
    border: "0.5px solid #ddd",
    borderRadius: 4,
    padding: 8,
  },
  kpiLabel: {
    fontSize: 8,
    color: "#777",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  kpiValue: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 8,
    color: "#aaa",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  signatureBox: {
    marginTop: 40,
    borderTop: "1px solid #999",
    paddingTop: 6,
    width: 220,
    fontSize: 9,
    color: "#555",
  },
});

// ── PDF Consolidado ───────────────────────────────────────────────────────────

function ConsolidatedPdfDocument({
  closing,
  techs,
  tenantNome,
}: {
  closing: ClosingInfo;
  techs: TechWithDetails[];
  tenantNome: string;
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>
            Fechamento — {closing.periodoLabel}
          </Text>
          <Text style={styles.subtitle}>{tenantNome}</Text>
          {closing.aprovadoEm && (
            <Text style={styles.subtitle}>
              Aprovado em {closing.aprovadoEm}
              {closing.aprovadoPorNome ? ` por ${closing.aprovadoPorNome}` : ""}
            </Text>
          )}
        </View>

        {/* KPIs */}
        <View style={styles.kpiRow}>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>Total a Pagar</Text>
            <Text style={styles.kpiValue}>{formatBRL(closing.totalAPagar)}</Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>Receita Unetvale</Text>
            <Text style={styles.kpiValue}>
              {formatBRL(closing.totalReceitaUnetvale)}
            </Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>
              Margem ({formatPct(closing.margem, closing.totalReceitaUnetvale)})
            </Text>
            <Text style={styles.kpiValue}>{formatBRL(closing.margem)}</Text>
          </View>
        </View>

        {/* Tabela por técnico */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Distribuição por Técnico ({techs.length})
          </Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.col1, styles.headerText]}>Técnico</Text>
              <Text style={[styles.col2, styles.headerText]}>Visitas</Text>
              <Text style={[styles.col3, styles.headerText]}>Total a Pagar</Text>
            </View>
            {techs.map((t, i) => (
              <View key={i} style={styles.tableRow}>
                <Text style={styles.col1}>{t.nome}</Text>
                <Text style={styles.col2}>{t.visitas}</Text>
                <Text style={styles.col3}>{formatBRL(t.totalAPagar)}</Text>
              </View>
            ))}
            <View style={[styles.tableRow, { borderBottom: "none" }]}>
              <Text style={[styles.col1, { fontFamily: "Helvetica-Bold" }]}>
                TOTAL
              </Text>
              <Text style={[styles.col2, { fontFamily: "Helvetica-Bold" }]}>
                {closing.totalVisitas}
              </Text>
              <Text style={[styles.col3, { fontFamily: "Helvetica-Bold" }]}>
                {formatBRL(closing.totalAPagar)}
              </Text>
            </View>
          </View>
        </View>

        {/* Rodapé */}
        <View style={styles.footer} fixed>
          <Text>Tallpa Solutions — uso interno</Text>
          <Text>
            {new Date().toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })}
          </Text>
        </View>
      </Page>
    </Document>
  );
}

export async function generatePdfReport(
  closing: ClosingInfo,
  techs: TechWithDetails[],
  tenantNome: string,
): Promise<Buffer> {
  return renderToBuffer(
    <ConsolidatedPdfDocument
      closing={closing}
      techs={techs}
      tenantNome={tenantNome}
    />,
  );
}

// ── PDF Individual por Técnico ────────────────────────────────────────────────

function TechnicianPdfDocument({
  tech,
  closing,
  tenantNome,
}: {
  tech: TechWithDetails;
  closing: ClosingInfo;
  tenantNome: string;
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Recibo de Pagamento</Text>
          <Text style={styles.subtitle}>{tenantNome}</Text>
          <Text style={styles.subtitle}>Período: {closing.periodoLabel}</Text>
          <Text style={styles.subtitle}>Técnico: {tech.nome}</Text>
        </View>

        {/* Tabela de visitas */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Visitas ({tech.visitDetails.length})
          </Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[{ flex: 1 }, styles.headerText]}>OS</Text>
              <Text style={[{ flex: 1 }, styles.headerText]}>Data</Text>
              <Text style={[{ flex: 2 }, styles.headerText]}>Finalidade</Text>
              <Text style={[{ flex: 1 }, styles.headerText]}>Sucesso</Text>
              <Text style={[{ flex: 1.2, textAlign: "right" }, styles.headerText]}>
                Valor
              </Text>
            </View>
            {tech.visitDetails.map((v, i) => (
              <View key={i} style={styles.tableRow}>
                <Text style={{ flex: 1 }}>{v.osNum}</Text>
                <Text style={{ flex: 1 }}>{v.data}</Text>
                <Text style={{ flex: 2 }}>{v.finalidade ?? "—"}</Text>
                <Text style={{ flex: 1 }}>{v.sucesso}</Text>
                <Text style={{ flex: 1.2, textAlign: "right" }}>
                  {formatBRL(v.valor)}
                </Text>
              </View>
            ))}
            <View style={[styles.tableRow, { borderBottom: "none", marginTop: 4 }]}>
              <Text style={{ flex: 5, fontFamily: "Helvetica-Bold" }}>
                Total a Receber
              </Text>
              <Text
                style={{
                  flex: 1.2,
                  textAlign: "right",
                  fontFamily: "Helvetica-Bold",
                }}
              >
                {formatBRL(tech.totalAPagar)}
              </Text>
            </View>
          </View>
        </View>

        {/* Assinatura */}
        <View style={styles.signatureBox}>
          <Text>Assinatura do Técnico</Text>
        </View>

        {/* Rodapé */}
        <View style={styles.footer} fixed>
          <Text>Tallpa Solutions — uso interno</Text>
          <Text>
            {new Date().toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })}
          </Text>
        </View>
      </Page>
    </Document>
  );
}

export async function generateTechnicianPdf(
  tech: TechWithDetails,
  closing: ClosingInfo,
  tenantNome: string,
): Promise<Buffer> {
  return renderToBuffer(
    <TechnicianPdfDocument
      tech={tech}
      closing={closing}
      tenantNome={tenantNome}
    />,
  );
}
