import { Shimmer } from "@/components/loading/shimmer";

export default function AssetDetailLoading() {
  return (
    <div className="flex flex-col gap-6" role="status">
      <span className="sr-only">Carregando</span>
      <div className="flex flex-col gap-3.5">
        <Shimmer className="h-5 w-40" />
        <Shimmer className="h-5 w-48" />
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0 flex-1 space-y-3">
            <Shimmer className="h-6 w-48" />
            <Shimmer className="h-8 w-2/3 max-w-xl" />
            <Shimmer className="h-4 w-64" />
          </div>
          <Shimmer className="h-11 w-28 rounded-[10px]" />
        </div>
      </div>
      <section className="rounded-[14px] border border-[#14233a]/12 bg-white p-6" aria-hidden>
        <Shimmer className="h-5 w-36" />
        <div className="mt-5 grid grid-cols-2 gap-4 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Shimmer key={index} className="h-24 rounded-xl" />
          ))}
        </div>
      </section>
      <div className="flex flex-wrap items-start gap-6">
        <section className="min-w-0 flex-[2] basis-[560px] rounded-[14px] border border-[#14233a]/12 bg-white p-6" aria-hidden>
          <Shimmer className="h-5 w-48" />
          <Shimmer className="mt-4 h-4 w-full" />
          <Shimmer className="mt-3 h-4 w-5/6" />
          <Shimmer className="mt-3 h-4 w-2/3" />
        </section>
        <section className="min-w-0 flex-1 basis-[320px] rounded-[14px] border border-[#14233a]/12 bg-white p-6" aria-hidden>
          <Shimmer className="h-5 w-28" />
          <Shimmer className="mt-4 h-4 w-full" />
          <Shimmer className="mt-3 h-4 w-4/5" />
          <Shimmer className="mt-3 h-4 w-3/5" />
        </section>
      </div>
    </div>
  );
}
