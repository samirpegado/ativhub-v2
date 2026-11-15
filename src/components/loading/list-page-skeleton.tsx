import type { ReactNode } from "react";
import { TableSkeleton } from "@/components/loading/table-skeleton";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const cardClass =
  "items-stretch overflow-hidden py-4 shadow-[0px_2px_3px_rgba(159,162,191,0.18),0px_1px_1px_rgba(159,162,191,0.32)]";

export function ListPageSkeleton({
  toolbar,
  filters,
  columns,
}: {
  toolbar?: ReactNode;
  filters?: ReactNode;
  columns?: number;
}) {
  return (
    <div className="space-y-3">
      {toolbar}
      <Card className={cardClass}>
        {filters ? <div className="flex flex-wrap items-center gap-2 px-4 pb-3">{filters}</div> : null}
        {filters ? <Separator /> : null}
        <TableSkeleton columns={columns} />
      </Card>
    </div>
  );
}
