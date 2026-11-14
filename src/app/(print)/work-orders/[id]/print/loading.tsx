export default function WorkOrderPrintLoading() {
  return (
    <div className="grid min-h-screen place-items-center bg-[#eef0f3]" role="status" aria-live="polite">
      <span className="sr-only">Gerando relatório</span>
      <span className="size-11 animate-spin rounded-full border-4 border-[#e6e8ec] border-t-[#1e3a5f]" />
    </div>
  );
}
