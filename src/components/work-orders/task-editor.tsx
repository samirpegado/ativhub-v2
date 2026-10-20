"use client";

import { useState } from "react";
import { GripVertical, Plus, X } from "lucide-react";
import { saveChecklist } from "@/app/(app)/work-orders/checklist-actions";
import { FormDialog } from "@/components/forms/form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import type { ChecklistRecord } from "@/lib/checklists/queries";
import {
  TASK_TYPES,
  parseTaskList,
  taskTypeLabel,
  type TaskType,
  type WorkOrderTask,
} from "@/lib/work-orders/tasks";
import { cn } from "@/lib/utils";

type DraftTask = WorkOrderTask & { key: string };

const SUBTASK_OPTIONS = ["Aberto", "Em andamento", "Em espera", "Concluído"];
const INSPECTION_OPTIONS = ["Aprovado", "Atenção", "Reprovado"];

function draftFrom(task: WorkOrderTask): DraftTask {
  return { ...task, key: crypto.randomUUID(), options: [...task.options] };
}

function blankTask(): DraftTask {
  return {
    key: crypto.randomUUID(),
    label: "",
    taskType: "TEXT",
    options: ["", ""],
  };
}

export function TaskEditor({
  tasks,
  checklists,
  onChange,
}: {
  tasks: WorkOrderTask[];
  checklists: ChecklistRecord[];
  onChange: (tasks: WorkOrderTask[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [draft, setDraft] = useState<DraftTask[]>([]);
  const [lists, setLists] = useState(checklists);
  const [showLists, setShowLists] = useState(false);
  const [showSave, setShowSave] = useState(false);
  const [listName, setListName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);

  function openEditor() {
    setDraft(tasks.map(draftFrom));
    setLists(checklists);
    setTab("edit");
    setShowLists(false);
    setShowSave(false);
    setListName("");
    setError(null);
    setNotice(null);
    setOpen(true);
  }

  function update(key: string, patch: Partial<DraftTask>) {
    setDraft((current) =>
      current.map((task) => (task.key === key ? { ...task, ...patch } : task)),
    );
  }

  function validatedDraft() {
    return parseTaskList(
      draft.map((task) => ({
        label: task.label,
        taskType: task.taskType,
        options: task.options,
      })),
    );
  }

  function save() {
    try {
      onChange(validatedDraft());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Tarefas inválidas.");
      return;
    }
    setOpen(false);
  }

  function useChecklist(id: string) {
    const list = lists.find((item) => item.id === id);
    if (!list) return;
    setDraft((current) => [...current, ...list.tasks.map(draftFrom)]);
    setNotice(`Tarefas de “${list.name}” adicionadas a esta ordem.`);
    setError(null);
  }

  async function storeList() {
    setSaving(true);
    setError(null);
    setNotice(null);
    let current: WorkOrderTask[];
    try {
      current = validatedDraft();
    } catch (caught) {
      setSaving(false);
      setError(caught instanceof Error ? caught.message : "Tarefas inválidas.");
      return;
    }
    const result = await saveChecklist(listName, current);
    setSaving(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setLists((currentLists) =>
      [...currentLists, { id: result.id, name: result.name, tasks: result.tasks }].sort((a, b) =>
        a.name.localeCompare(b.name, "pt-BR"),
      ),
    );
    setListName("");
    setShowSave(false);
    setNotice("Lista salva. Ela pode ser usada em outras ordens.");
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= draft.length || from === to) return;
    setDraft((current) => {
      const next = [...current];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  }

  return (
    <>
      <div className="space-y-2">
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma tarefa adicionada.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {tasks.map((task, index) => (
              <li key={`${task.label}-${index}`} className="flex items-center justify-between gap-3">
                <span className="truncate font-medium">{task.label}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {taskTypeLabel(task.taskType)}
                </span>
              </li>
            ))}
          </ul>
        )}
        <Button type="button" variant="outline" className="h-9" onClick={openEditor}>
          <Plus />
          {tasks.length ? "Editar tarefas" : "Adicionar tarefas"}
        </Button>
      </div>

      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title="Adicionar tarefas"
        description="As tarefas pertencem a esta ordem. Uma lista salva pode ser reutilizada em outras."
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex w-fit gap-1 rounded-lg bg-muted p-1">
              <TabButton active={tab === "edit"} onClick={() => setTab("edit")}>
                Editar
              </TabButton>
              <TabButton active={tab === "preview"} onClick={() => setTab("preview")}>
                Pré-visualização
              </TabButton>
            </div>
            <div className="flex flex-wrap gap-1">
              <Button
                type="button"
                variant="ghost"
                className="text-primary"
                onClick={() => setDraft((current) => [...current, blankTask()])}
              >
                <Plus />
                Tarefa
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="text-primary"
                onClick={() => setShowLists((value) => !value)}
              >
                <Plus />
                Lista de verificação
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="text-primary"
                onClick={() => setShowSave((value) => !value)}
              >
                Salvar lista
              </Button>
            </div>
          </div>

          {showLists ? (
            <NativeSelect
              className="h-9"
              defaultValue=""
              onChange={(event) => {
                useChecklist(event.target.value);
                event.target.value = "";
              }}
            >
              <option value="">Selecionar lista de verificação</option>
              {lists.map((list) => (
                <option key={list.id} value={list.id}>
                  {list.name}
                </option>
              ))}
            </NativeSelect>
          ) : null}

          {showSave ? (
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={listName}
                placeholder="Nome da lista"
                className="h-9 max-w-xs"
                onChange={(event) => setListName(event.target.value)}
              />
              <Button
                type="button"
                className="h-9"
                disabled={saving}
                onClick={storeList}
              >
                {saving ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          ) : null}

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {notice ? <p className="text-sm text-muted-foreground">{notice}</p> : null}

          {tab === "edit" ? (
            <div className="space-y-2">
              {draft.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Adicione uma tarefa ou escolha uma lista já salva.
                </p>
              ) : (
                draft.map((task, index) => (
                  <TaskRow
                    key={task.key}
                    task={task}
                    dragging={dragging === index}
                    onDragStart={() => setDragging(index)}
                    onDrop={() => {
                      if (dragging !== null) move(dragging, index);
                      setDragging(null);
                    }}
                    onChange={(patch) => update(task.key, patch)}
                    onRemove={() =>
                      setDraft((current) => current.filter((item) => item.key !== task.key))
                    }
                  />
                ))
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {draft.map((task) => (
                <TaskPreview key={task.key} task={task} />
              ))}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" className="h-9" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" className="h-9 font-semibold" onClick={save}>
              Adicionar tarefas
            </Button>
          </div>
        </div>
      </FormDialog>
    </>
  );
}

function TaskRow({
  task,
  dragging,
  onDragStart,
  onDrop,
  onChange,
  onRemove,
}: {
  task: DraftTask;
  dragging: boolean;
  onDragStart: () => void;
  onDrop: () => void;
  onChange: (patch: Partial<DraftTask>) => void;
  onRemove: () => void;
}) {
  return (
    <div
      className={cn("rounded-lg border p-2", dragging && "bg-muted")}
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          draggable
          aria-label="Reordenar tarefa"
          className="cursor-grab text-muted-foreground"
          onDragStart={onDragStart}
        >
          <GripVertical className="size-4" />
        </button>
        <Input
          value={task.label}
          placeholder="Nome da tarefa"
          className="h-9"
          onChange={(event) => onChange({ label: event.target.value })}
        />
        <NativeSelect
          className="h-9 max-w-44"
          value={task.taskType}
          onChange={(event) => onChange({ taskType: event.target.value as TaskType })}
        >
          {TASK_TYPES.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </NativeSelect>
        <button
          type="button"
          className="text-destructive"
          aria-label="Remover tarefa"
          onClick={onRemove}
        >
          <X className="size-4" />
        </button>
      </div>

      {task.taskType === "MULTIPLE" ? (
        <div className="mt-2 space-y-2 pl-6">
          {task.options.map((option, index) => (
            <div key={index} className="flex items-center gap-2">
              <Input
                value={option}
                placeholder={`Opção ${index + 1}`}
                className="h-9"
                onChange={(event) => {
                  const options = [...task.options];
                  options[index] = event.target.value;
                  onChange({ options });
                }}
              />
              {task.options.length > 2 ? (
                <button
                  type="button"
                  className="text-destructive"
                  aria-label="Remover opção"
                  onClick={() =>
                    onChange({ options: task.options.filter((_, item) => item !== index) })
                  }
                >
                  <X className="size-4" />
                </button>
              ) : null}
            </div>
          ))}
          <Button
            type="button"
            variant="ghost"
            className="h-8 text-primary"
            onClick={() => onChange({ options: [...task.options, ""] })}
          >
            <Plus />
            Opção
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function TaskPreview({ task }: { task: DraftTask }) {
  const options =
    task.taskType === "SUBTASK"
      ? SUBTASK_OPTIONS
      : task.taskType === "INSPECTION"
        ? INSPECTION_OPTIONS
        : task.options.filter(Boolean);

  return (
    <div className="rounded-lg bg-muted/60 p-3">
      <p className="font-semibold">{task.label || "Nome da tarefa"}</p>
      {task.taskType === "TEXT" || task.taskType === "NUMBER" ? (
        <Input
          disabled
          type={task.taskType === "NUMBER" ? "number" : "text"}
          placeholder="Valor"
          className="mt-2 h-9 bg-background"
        />
      ) : (
        <NativeSelect disabled className="mt-2 h-9 bg-background" defaultValue={options[0] ?? ""}>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </NativeSelect>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      className={cn(
        "h-8 px-3",
        active && "bg-background text-foreground shadow-sm hover:bg-background",
      )}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
