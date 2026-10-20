import { requireTenant } from "@/lib/auth/current-user";
import { relationName } from "@/lib/forms/parse";
import { signStoragePath } from "@/lib/storage/signed-url";
import { isTaskType, type WorkOrderTask } from "@/lib/work-orders/tasks";

export type WorkOrderPerson = {
  id: string;
  name: string;
  imageUrl: string | null;
};

export type WorkOrderRecord = {
  id: string;
  customId: string | null;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  estimatedStartDate: string | null;
  estimatedDuration: number | null;
  requiredSignature: boolean;
  locationId: string | null;
  locationName: string | null;
  assetId: string | null;
  assetName: string | null;
  teamId: string | null;
  primaryUserId: string | null;
  primaryUserName: string | null;
  primaryUser: WorkOrderPerson | null;
  assignees: WorkOrderPerson[];
  categoryId: string | null;
  assigneeIds: string[];
  tasks: WorkOrderTask[];
  firstTimeToReact: string | null;
};

export type CategoryOption = { id: string; name: string };

function personName(
  value:
    | { first_name: string; last_name: string }
    | { first_name: string; last_name: string }[]
    | null,
) {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row) return null;
  return [row.first_name, row.last_name].filter(Boolean).join(" ") || null;
}

export async function listWorkOrderCategories() {
  const { supabase } = await requireTenant();
  const { data, error } = await supabase
    .from("category")
    .select("id, name")
    .eq("type", "WORK_ORDER")
    .order("name");

  if (error) throw new Error("Não foi possível carregar as categorias.");
  return (data ?? []) satisfies CategoryOption[];
}

export async function listWorkOrders() {
  const { supabase } = await requireTenant();
  const [orders, assignees, tasks] = await Promise.all([
    supabase
      .from("work_order")
      .select(
        "id, custom_id, title, description, status, priority, due_date, estimated_start_date, estimated_duration, required_signature, location_id, asset_id, team_id, primary_user_id, category_id, first_time_to_react, location:location_id(name), asset:asset_id(name), primary_user:primary_user_id(first_name, last_name)",
      )
      .eq("archived", false)
      .order("created_at", { ascending: false }),
    supabase.from("work_order_assignee").select("work_order_id, membership_id"),
    supabase
      .from("task")
      .select(
        "work_order_id, label, task_type, options, order_index",
      )
      .order("order_index"),
  ]);

  if (orders.error || assignees.error || tasks.error) {
    throw new Error("Não foi possível carregar as ordens de serviço.");
  }

  const memberIds = [
    ...new Set(
      [
        ...(orders.data ?? []).map((row) => row.primary_user_id),
        ...(assignees.data ?? []).map((item) => item.membership_id),
      ].filter((id): id is string => Boolean(id)),
    ),
  ];
  const { data: members, error: membersError } = memberIds.length
    ? await supabase
        .from("membership")
        .select("id, first_name, last_name, image_url")
        .in("id", memberIds)
    : { data: [], error: null };

  if (membersError) {
    throw new Error("Não foi possível carregar as ordens de serviço.");
  }

  const imageUrls = await Promise.all(
    (members ?? []).map((member) => signStoragePath(supabase, member.image_url)),
  );
  const people = new Map<string, WorkOrderPerson>(
    (members ?? []).map((member, index) => [
      member.id,
      {
        id: member.id,
        name: [member.first_name, member.last_name].filter(Boolean).join(" "),
        imageUrl: imageUrls[index] ?? null,
      },
    ]),
  );

  return (orders.data ?? []).map((row) => ({
    id: row.id,
    customId: row.custom_id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    dueDate: row.due_date,
    estimatedStartDate: row.estimated_start_date,
    estimatedDuration: row.estimated_duration,
    requiredSignature: row.required_signature,
    locationId: row.location_id,
    locationName: relationName(
      row.location as { name: string } | { name: string }[] | null,
    ),
    assetId: row.asset_id,
    assetName: relationName(
      row.asset as { name: string } | { name: string }[] | null,
    ),
    teamId: row.team_id,
    primaryUserId: row.primary_user_id,
    primaryUserName:
      (row.primary_user_id ? people.get(row.primary_user_id)?.name : null) ??
      personName(row.primary_user),
    primaryUser: row.primary_user_id
      ? (people.get(row.primary_user_id) ?? null)
      : null,
    categoryId: row.category_id,
    firstTimeToReact: row.first_time_to_react,
    assigneeIds: (assignees.data ?? [])
      .filter((item) => item.work_order_id === row.id)
      .map((item) => item.membership_id),
    assignees: (assignees.data ?? [])
      .filter((item) => item.work_order_id === row.id)
      .map((item) => people.get(item.membership_id))
      .filter((person): person is WorkOrderPerson => Boolean(person)),
    tasks: (tasks.data ?? [])
      .filter((item) => item.work_order_id === row.id)
      .sort((a, b) => a.order_index - b.order_index)
      .map((item) => ({
        label: item.label,
        taskType: isTaskType(item.task_type) ? item.task_type : "SUBTASK",
        options: Array.isArray(item.options)
          ? item.options.filter((option): option is string => typeof option === "string")
          : [],
      })),
  })) satisfies WorkOrderRecord[];
}
