import { formatQuantity } from "@/lib/inventory/format";
import { formatBrl } from "@/lib/money/brl";
import type { PublicReport } from "@/lib/requests/public";
import { formatDuration } from "@/lib/work-orders/activity";
import {
  workOrderPriorityLabel,
  workOrderStatusLabel,
  workOrderTypeLabel,
} from "@/lib/work-orders/status";
import { isTaskType, taskAnswerLabel } from "@/lib/work-orders/tasks";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatWhen(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function formatDay(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(date);
}

function answerLabel(task: PublicReport["tasks"][number]) {
  if (!isTaskType(task.taskType)) return task.value ?? "—";
  return taskAnswerLabel({ taskType: task.taskType, value: task.value });
}

function printHtml(html: string) {
  const frame = document.createElement("iframe");
  frame.setAttribute("title", "Relatório da ordem de serviço");
  frame.style.position = "fixed";
  frame.style.left = "-10000px";
  frame.style.top = "0";
  frame.style.width = "210mm";
  frame.style.height = "297mm";
  frame.style.border = "0";
  document.body.appendChild(frame);

  const win = frame.contentWindow;
  const doc = win?.document;
  if (!win || !doc) {
    frame.remove();
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  window.setTimeout(() => {
    win.focus();
    win.print();
    win.addEventListener("afterprint", () => frame.remove(), { once: true });
  }, 250);
}

export function printPublicWorkOrderReport(report: PublicReport) {
  const { order } = report;
  const partsCost = report.parts.reduce((sum, part) => sum + part.cost * part.quantity, 0);
  const hours = report.labors.reduce((sum, labor) => sum + labor.durationSeconds / 3600, 0);
  const laborCost = report.labors.reduce(
    (sum, labor) => sum + (labor.durationSeconds / 3600) * (labor.hourlyRate ?? 0),
    0,
  );
  const service =
    order.billingMode === "FIXED"
      ? order.serviceAmount ?? 0
      : order.billingMode === "HOURLY" && order.serviceAmount != null
        ? Math.round(hours * order.serviceAmount * 100) / 100
        : laborCost;
  const rows = [
    ["Empresa", report.companyName || "—"],
    ...(order.customerName
      ? [["Cliente", [order.customerName, order.customerPhone].filter(Boolean).join(" · ")]]
      : []),
    ["Tipo", workOrderTypeLabel(order.type)],
    ["Status", workOrderStatusLabel(order.status)],
    ["Prioridade", workOrderPriorityLabel(order.priority)],
    ["Conclusão", formatWhen(order.completedOn)],
    ["Vencimento", formatWhen(order.dueDate)],
    ["Localização", order.locationName ?? "—"],
    ["Ativo", order.assetName ?? "—"],
    ["Responsáveis", order.assignees.join(", ") || "—"],
  ];
  const tasks = report.tasks
    .map(
      (task) =>
        `<li>${escapeHtml(task.label)}: <strong>${escapeHtml(answerLabel(task))}</strong></li>`,
    )
    .join("");
  const parts = report.parts
    .map(
      (part) =>
        `<li>${escapeHtml(part.name)} — ${escapeHtml(formatQuantity(part.quantity, part.unit))} — ${escapeHtml(formatBrl(part.cost * part.quantity))}</li>`,
    )
    .join("");
  const labors = report.labors
    .map((labor) => {
      const rate = labor.hourlyRate == null ? "" : ` — ${formatBrl(labor.hourlyRate)}/h`;
      return `<li>${escapeHtml(formatDay(labor.workedOn))} — ${escapeHtml(formatDuration(labor.durationSeconds))} — ${escapeHtml(labor.author)}${escapeHtml(rate)}</li>`;
    })
    .join("");
  const timeline = report.tasks
    .filter((task) => task.executedAt)
    .map((task) => {
      const comment = task.comment ? ` — ${task.comment}` : "";
      return `<li>${escapeHtml(formatWhen(task.executedAt))} — ${escapeHtml(task.label)}: ${escapeHtml(answerLabel(task))}${escapeHtml(comment)}</li>`;
    })
    .join("");

  printHtml(`<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(order.customId ?? "OS")} — ${escapeHtml(order.title)}</title>
  <style>
    body { font-family: sans-serif; color: #172033; margin: 32px; }
    h1 { font-size: 22px; margin: 0 0 4px; }
    h2 { font-size: 14px; margin: 24px 0 8px; }
    p, li { font-size: 13px; line-height: 1.45; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 6px 8px; border-bottom: 1px solid #e6e8ef; vertical-align: top; }
    td:first-child { width: 160px; color: #5c6578; }
    ul { padding-left: 18px; }
  </style>
</head>
<body>
  <p>${escapeHtml(report.companyName)}</p>
  <h1>${escapeHtml(order.customId ? `${order.customId} · ` : "")}${escapeHtml(order.title)}</h1>
  <p>${escapeHtml(order.description ?? "")}</p>
  <table>
    ${rows
      .map(
        ([label, value]) =>
          `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(value)}</td></tr>`,
      )
      .join("")}
  </table>
  <h2>Tarefas</h2>
  ${tasks ? `<ul>${tasks}</ul>` : "<p>Nenhuma tarefa.</p>"}
  <h2>Peças</h2>
  ${parts ? `<ul>${parts}</ul>` : "<p>Nenhuma peça.</p>"}
  <h2>Mão de obra</h2>
  ${labors ? `<ul>${labors}</ul>` : "<p>Nenhum tempo lançado.</p>"}
  <h2>Custos</h2>
  <p>Peças: ${escapeHtml(formatBrl(partsCost))}</p>
  <p>Mão de obra: ${escapeHtml(formatBrl(laborCost))}</p>
  ${
    order.billingMode === "FIXED"
      ? `<p>Serviço cobrado: ${escapeHtml(formatBrl(service))}</p>`
      : ""
  }
  <p><strong>Total: ${escapeHtml(formatBrl(partsCost + service))}</strong></p>
  <h2>Timeline</h2>
  ${timeline ? `<ul>${timeline}</ul>` : "<p>Nenhuma execução registrada.</p>"}
</body>
</html>`);
}
