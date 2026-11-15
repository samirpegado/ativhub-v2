import { Shimmer } from "@/components/loading/shimmer";

export default function PreventiveDetailLoading() {
  return (
    <div className="space-y-6" role="status">
      <span className="sr-only">Carregando</span>
      <div className="flex flex-col gap-3.5">
        <Shimmer className="h-5 w-52" />
        <Shimmer className="h-8 w-2/3 max-w-xl" />
        <Shimmer className="h-4 w-80" />
        <div className="flex justify-end gap-2.5">
          <Shimmer className="h-11 w-24 rounded-[10px]" />
          <Shimmer className="h-11 w-24 rounded-[10px]" />
        </div>
      </div>
      <section className="rounded-[14px] border border-[#14233a]/12 bg-white p-4 sm:p-6" aria-hidden>
        <Shimmer className="h-5 w-32" />
        <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Shimmer key={index} className="h-20 rounded-xl" />
          ))}
        </div>
      </section>
      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-0 flex-[2] basis-[560px] flex-col gap-5">
          {Array.from({ length: 2 }, (_, index) => (
            <section key={index} className="rounded-[14px] border border-[#14233a]/12 bg-white p-6" aria-hidden>
              <Shimmer className="h-5 w-28" />
              <Shimmer className="mt-4 h-4 w-full" />
              <Shimmer className="mt-3 h-4 w-4/5" />
            </section>
          ))}
        </div>
        <section className="min-w-0 flex-1 basis-[320px] rounded-[14px] border border-[#14233a]/12 bg-white p-6" aria-hidden>
          <Shimmer className="h-5 w-24" />
          <Shimmer className="mt-4 h-4 w-full" />
          <Shimmer className="mt-3 h-4 w-3/5" />
        </section>
      </div>
    </div>
  );
}
