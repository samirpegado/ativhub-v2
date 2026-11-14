import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function asRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function address(value: unknown) {
  const row = asRecord(value) ?? {};
  return {
    postalCode: text(row.postalCode),
    street: text(row.street),
    number: text(row.number),
    complement: text(row.complement),
    neighborhood: text(row.neighborhood),
    city: text(row.city),
    state: text(row.state),
  };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Método inválido." }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json({ error: "Função sem configuração." }, 500);

  let body: { id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Dados inválidos." }, 400);
  }
  const id = body.id?.trim() ?? "";
  if (!UUID.test(id)) return json({ error: "Ordem inválida." }, 400);

  const db = createClient(url, serviceKey);
  const { data: order } = await db
    .from("work_order")
    .select(
      "id, custom_id, title, description, status, priority, type, due_date, billing_mode, service_amount, customer_id, location_id, asset_id, tenant_id, archived",
    )
    .eq("id", id)
    .maybeSingle();
  if (!order || order.archived) return json({ error: "Ordem não encontrada." }, 404);

  const [{ data: tenant }, { data: location }, { data: asset }, { data: tasks }, { data: labors }, { data: parts }, { data: files }] =
    await Promise.all([
      db.from("tenant").select("name, logo_url, settings").eq("id", order.tenant_id).maybeSingle(),
      order.location_id
        ? db
            .from("location")
            .select("name, postal_code, street, number, complement, neighborhood, city, state, address, customer_id")
            .eq("id", order.location_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      order.asset_id
        ? db
            .from("asset")
            .select(
              "custom_id, name, description, status, model, manufacturer, serial_number, bar_code, power, area, acquisition_cost, in_service_date, warranty_expiration_date, additional_infos, category:category_id(name)",
            )
            .eq("id", order.asset_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      db
        .from("task")
        .select("label, task_type, value, comment, executed_at, order_index")
        .eq("work_order_id", order.id)
        .order("order_index"),
      db
        .from("labor")
        .select("duration_seconds, hourly_rate, logged, tracked_at, started_at, membership:membership_id(first_name, last_name)")
        .eq("work_order_id", order.id),
      db
        .from("work_order_part")
        .select("quantity, part:part_id(name, unit, cost)")
        .eq("work_order_id", order.id),
      db
        .from("file")
        .select("name, url")
        .eq("entity_type", "WORK_ORDER")
        .eq("entity_id", order.id),
    ]);

  const customerId = location?.customer_id ?? order.customer_id;
  const { data: customer } = customerId
    ? await db
        .from("customer")
        .select("name, phone, email, customer_type, description, tax_id, is_internal")
        .eq("id", customerId)
        .maybeSingle()
    : { data: null };

  const settings = asRecord(tenant?.settings);
  const paths = [
    ...(tenant?.logo_url ? [tenant.logo_url] : []),
    ...(files ?? []).map((file) => file.url).filter((path): path is string => Boolean(path)),
  ];
  const signed = new Map<string, string>();
  if (paths.length > 0) {
    const { data: links } = await db.storage.from("attachments").createSignedUrls([...new Set(paths)], 60 * 60);
    for (const link of links ?? []) {
      if (link.path && link.signedUrl) signed.set(link.path, link.signedUrl);
    }
  }

  const category = asset?.category;
  const categoryName = Array.isArray(category) ? category[0]?.name ?? null : category?.name ?? null;

  return json({
    order: {
      customId: order.custom_id,
      title: order.title,
      description: order.description,
      status: order.status,
      priority: order.priority,
      type: order.type,
      dueDate: order.due_date,
      billingMode: order.billing_mode,
      serviceAmount: order.service_amount,
    },
    company: {
      name: tenant?.name ?? "",
      phone: text(settings?.phone),
      website: text(settings?.website),
      logoUrl: tenant?.logo_url ? (signed.get(tenant.logo_url) ?? null) : null,
      address: address(settings?.address),
    },
    customer: customer && !customer.is_internal
      ? {
          name: customer.name,
          type: customer.customer_type,
          taxId: customer.tax_id,
          phone: customer.phone,
          email: customer.email,
          description: customer.description,
        }
      : null,
    location: location
      ? {
          name: location.name,
          postalCode: location.postal_code ?? "",
          street: location.street ?? "",
          number: location.number ?? "",
          complement: location.complement ?? "",
          neighborhood: location.neighborhood ?? "",
          city: location.city ?? "",
          state: location.state ?? "",
          address: location.address,
        }
      : null,
    asset: asset
      ? {
          name: asset.name,
          code: asset.custom_id,
          status: asset.status,
          category: categoryName,
          manufacturer: asset.manufacturer,
          model: asset.model,
          serial: asset.serial_number,
          barcode: asset.bar_code,
          power: asset.power,
          area: asset.area,
          inService: asset.in_service_date,
          warranty: asset.warranty_expiration_date,
          cost: asset.acquisition_cost,
          description: asset.description,
          extra: asset.additional_infos,
        }
      : null,
    tasks: (tasks ?? []).map((task) => ({
      label: task.label,
      taskType: task.task_type,
      value: task.value,
      comment: task.comment,
      executedAt: task.executed_at,
    })),
    labors: (labors ?? []).flatMap((labor) => {
      if (labor.logged && !labor.started_at && !(labor.duration_seconds > 0)) return [];
      const person = Array.isArray(labor.membership) ? labor.membership[0] : labor.membership;
      const author = [person?.first_name, person?.last_name].filter(Boolean).join(" ").trim() || "Usuário";
      return [{
        durationSeconds: labor.duration_seconds ?? 0,
        hourlyRate: labor.hourly_rate,
        workedOn: labor.logged ? labor.tracked_at : labor.started_at,
        fromTimer: labor.logged === true,
        author,
      }];
    }),
    parts: (parts ?? []).map((line) => {
      const part = Array.isArray(line.part) ? line.part[0] : line.part;
      return {
        name: part?.name ?? "Peça",
        unit: part?.unit ?? null,
        cost: Number(part?.cost ?? 0),
        quantity: Number(line.quantity ?? 0),
      };
    }),
    files: (files ?? []).map((file) => ({
      name: file.name,
      url: file.url ? (signed.get(file.url) ?? "") : "",
    })),
  });
});
