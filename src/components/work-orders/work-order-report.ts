import { formatQuantity } from "@/lib/inventory/format";
import { formatBrl } from "@/lib/money/brl";
import { partsTotal, serviceCharge } from "@/lib/work-orders/billing";
import type { WorkOrderActivity } from "@/lib/work-orders/activity";
import { formatDuration } from "@/lib/work-orders/activity";
import type { WorkOrderRecord } from "@/lib/work-orders/queries";
import { taskAnswerLabel } from "@/lib/work-orders/tasks";
import {
  workOrderPriorityLabel,
  workOrderStatusLabel,
} from "@/lib/work-orders/status";

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

export function printWorkOrderReport(
  order: WorkOrderRecord,
  activity: WorkOrderActivity,
  logoUrl: string | null,
) {
  const service = serviceCharge(order, activity);
  const partsCost = partsTotal(activity.parts);
  const rows = [
    ["Status", workOrderStatusLabel(order.status)],
    ["Prioridade", workOrderPriorityLabel(order.priority)],
    ["Vencimento", formatWhen(order.dueDate)],
    ["Localização", order.locationName ?? "—"],
    ["Ativo", order.assetName ?? "—"],
    ["Trabalhador", order.primaryUserName ?? "—"],
    [
      "Responsáveis",
      order.assignees.map((person) => person.name).join(", ") || "—",
    ],
  ];

  const tasks = order.tasks
    .map(
      (task) =>
        `<li>${escapeHtml(task.label)}: <strong>${escapeHtml(taskAnswerLabel(task))}</strong></li>`,
    )
    .join("");
  const parts = activity.parts
    .map(
      (part) =>
        `<li>${escapeHtml(part.name)} — ${escapeHtml(formatQuantity(part.quantity, part.unit))} — ${escapeHtml(formatBrl(part.cost * part.quantity))}</li>`,
    )
    .join("");
  const labors = activity.labors
    .map(
      (labor) =>
        `<li>${escapeHtml(formatDay(labor.workedOn))} — ${escapeHtml(formatDuration(labor.durationSeconds))} — ${escapeHtml(labor.author)}</li>`,
    )
    .join("");
  const updates = activity.updates
    .map(
      (update) =>
        `<li><strong>${escapeHtml(update.author)}</strong> · ${escapeHtml(formatWhen(update.createdAt))}<br>${escapeHtml(update.body)}</li>`,
    )
    .join("");
  const files = activity.files
    .map((file) => `<li>${escapeHtml(file.name)}</li>`)
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
  ${
    logoUrl
      ? `<img src="${escapeHtml(logoUrl)}" alt="Logo" style="max-height:64px;max-width:180px;object-fit:contain" />`
      : "<p>AtivHub</p>"
  }
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
  ${
    order.billingMode === "NONE"
      ? ""
      : `<h2>Cobrança</h2>
  <p>Serviço: ${escapeHtml(formatBrl(service))}</p>
  <p>Peças: ${escapeHtml(formatBrl(partsCost))}</p>
  <p><strong>Total: ${escapeHtml(formatBrl(service + partsCost))}</strong></p>`
  }
  <h2>Mão de obra</h2>
  ${labors ? `<ul>${labors}</ul>` : "<p>Nenhum tempo lançado.</p>"}
  <p>Temporizador: ${escapeHtml(formatDuration(activity.timer?.durationSeconds ?? 0))}</p>
  <h2>Atualizações</h2>
  ${updates ? `<ul>${updates}</ul>` : "<p>Nenhuma atualização.</p>"}
  <h2>Arquivos</h2>
  ${files ? `<ul>${files}</ul>` : "<p>Nenhum arquivo.</p>"}
</body>
</html>`);
}
