"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

const PAGE_WIDTH = 800;

export function WorkOrderPrintSheet({
  workOrderId,
  children,
}: {
  workOrderId: string;
  children: ReactNode;
}) {
  const pageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState(0);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(
        { type: "work-order-print-ready", id: workOrderId },
        window.location.origin,
      );
    }
    const fit = () => {
      const page = pageRef.current;
      if (!page) return;
      const next = Math.min(1, (window.innerWidth - 32) / PAGE_WIDTH);
      setScale(next);
      setHeight(page.offsetHeight);
    };
    fit();
    const observer = new ResizeObserver(fit);
    if (pageRef.current) observer.observe(pageRef.current);
    window.addEventListener("resize", fit);
    const before = () => setPrinting(true);
    const after = () => setPrinting(false);
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", fit);
      window.removeEventListener("beforeprint", before);
      window.removeEventListener("afterprint", after);
    };
  }, [workOrderId]);

  return (
    <div className="os-stage">
      <style>{PRINT_CSS}</style>
      <button type="button" className="os-toolbar" onClick={() => window.print()}>
        Imprimir
      </button>
      <div
        className="os-clip"
        style={printing ? undefined : { width: PAGE_WIDTH * scale, height: height ? height * scale : undefined }}
      >
        <div
          ref={pageRef}
          className="os-scale"
          style={printing ? undefined : { width: PAGE_WIDTH, transform: `scale(${scale})`, transformOrigin: "top left" }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

const PRINT_CSS = `
.os-stage{min-height:100vh;background:#eef0f3;padding:24px 0 48px;display:flex;justify-content:center}
.os-toolbar{position:fixed;top:16px;right:16px;z-index:20;border:0;border-radius:8px;background:#1e3a5f;color:#fff;font:600 14px/1 -apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;padding:12px 18px;cursor:pointer}
.os-clip{overflow:hidden}
.page{width:800px;background:#fff;padding:44px 48px;border-radius:6px;color:#1a1f2b;font:14px/1.5 -apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
.page *{box-sizing:border-box}
.page h1{font-size:22px;line-height:1.25;margin:0 0 6px}
.page h2{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#6b7280;margin:0 0 10px;font-weight:700}
.page section{margin-top:34px}
.page .title-block{margin-top:26px}
.page .muted{color:#6b7280}
.page .small{font-size:12px}
.page .right{text-align:right}
.page .num{font-variant-numeric:tabular-nums}
.page .top{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;padding-bottom:22px;border-bottom:1px solid #e6e8ec}
.page .brand{display:flex;gap:14px;align-items:center}
.page .brand svg,.page .brand img{width:44px;height:44px;flex:none;border-radius:10px;object-fit:contain}
.page .brand b{display:block;font-size:15px}
.page .brand span{display:block;font-size:12px;color:#6b7280;line-height:1.45}
.page .brand a{color:inherit;text-decoration:none}
.page .os-id{text-align:right;white-space:nowrap}
.page .os-id small{display:block;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#6b7280}
.page .os-id strong{font-size:22px;color:#1e3a5f;letter-spacing:.01em}
.page .lead{margin:0}
.page .meta{display:flex;flex-wrap:wrap;gap:6px 18px;margin:10px 0 12px;font-size:13px}
.page .tag{display:inline-flex;align-items:center;gap:6px;font-weight:600}
.page .dot{width:8px;height:8px;border-radius:50%;background:currentColor}
.page .ok{color:#15803d}
.page .warn{color:#b45309}
.page .bad{color:#b91c1c}
.page .info{color:#2563eb}
.page .gray{color:#6b7280}
.page .facts{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin:22px 0 0;padding:16px 0;border-top:1px solid #e6e8ec;border-bottom:1px solid #e6e8ec}
.page .facts dt,.page .grid dt{font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.06em}
.page .facts dd{margin:2px 0 0;font-weight:700;font-size:15px}
.page .facts dd small{display:block;font-weight:400;font-size:12px;color:#6b7280}
.page .cols{display:grid;grid-template-columns:1fr 1fr;gap:32px}
.page .cols p{margin:0 0 2px}
.page .note{margin-top:6px}
.page .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px 24px;margin:0}
.page .grid dd{margin:1px 0 0}
.page .grid .span{grid-column:1/-1}
.page .asset-head{display:flex;align-items:baseline;gap:12px;margin-bottom:14px}
.page .asset-head b{font-size:16px}
.page table{width:100%;border-collapse:collapse}
.page th{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;font-weight:600;text-align:left;padding:0 8px 8px 0;border-bottom:1px solid #1a1f2b}
.page td{padding:10px 8px 10px 0;border-bottom:1px solid #e6e8ec;vertical-align:top}
.page th.right,.page td.right{padding-right:0}
.page tr.pending td{color:#6b7280}
.page td .type{display:block;font-size:12px;color:#6b7280}
.page tfoot td{border-bottom:0;font-weight:700;padding-top:12px}
.page tr{break-inside:avoid}
.page th.task{width:34%}
.page th.answer{width:26%}
.page th.when{width:112px}
.page .total{margin-left:auto;width:300px}
.page .total div{display:flex;justify-content:space-between;gap:16px;padding:5px 0}
.page .total .grand{border-top:2px solid #1a1f2b;margin-top:6px;padding-top:12px;font-size:20px;font-weight:800;color:#1e3a5f}
.page .gallery{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.page .gallery figure{margin:0;break-inside:avoid}
.page .gallery img{display:block;width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:6px;border:1px solid #e6e8ec}
.page footer{margin-top:36px;text-align:center;font-size:11px;color:#6b7280}
@media print{
  @page{size:A4;margin:14mm}
  .os-stage{display:block;min-height:0;padding:0;background:#fff}
  .os-toolbar{display:none !important}
  .os-clip{width:auto !important;height:auto !important;overflow:visible !important}
  .os-scale{width:auto !important;transform:none !important}
  .page{width:auto;margin:0;padding:0;border-radius:0}
  .page section{break-inside:avoid-page}
}
`;
