export type CertData = {
    name: string;
    bib: string;
    gender: string;
    category: string;
    finishTime: string;
    totalTimeDisplay: string; // formatted / DNF / DSQ
    overallRank?: number | null;
    genderRank?: number | null;
    categoryRank?: number | null;
  };
  
  export async function renderCertificatePNG(data: CertData): Promise<string> {
    const W = 1080;
    const H = 1920; // 9:16 IG Stories
  
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d")!;
    if (!ctx) throw new Error("Canvas not supported");
  
    // background base
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);
  
    // ✅ background image: gunakan IMR-CERTI.png di root CodeSandbox
    try {
      const bg = await loadImage("/IMR-CERTI.png");
      ctx.drawImage(bg, 0, 0, W, H);
    } catch {
      // kalau belum ada / gagal load, abaikan saja
    }
  
    const centerX = W / 2;
  
    const drawCenter = (
      text: string,
      y: number,
      size = 56,
      color = "#0f172a"
    ) => {
      ctx.font = `700 ${size}px Roboto, sans-serif`;
      ctx.fillStyle = color;
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(text, centerX, y);
    };
  
    // ===== TITLE & NAME =====
    drawCenter("E-Certificate Finisher", 280, 56, "#1e293b");
  
    drawCenter(data.name || "-", 500, 80, "#0f172a");
  
    ctx.font = `700 42px Roboto, sans-serif`;
    ctx.fillStyle = "#334155";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(`BIB: ${data.bib || "-"}`, centerX, 590);
  
    // ===== TABLE CENTERED =====
    const rows: Array<[string, string]> = [
      ["Gender", data.gender || "-"],
      ["Category", data.category || "-"],
      ["Finish Time", data.finishTime || "-"],
      ["Total Time", data.totalTimeDisplay || "-"],
      ["Overall Rank", String(data.overallRank ?? "-")],
      ["Gender Rank", String(data.genderRank ?? "-")],
      ["Category Rank", String(data.categoryRank ?? "-")]
    ];
  
    const tableY = 740;
    const tableRowH = 80;
  
    const tableBottomY = drawCenteredTable(ctx, {
      y: tableY,
      w: 820,
      rowH: tableRowH,
      rows
    });
  
    // ===== FOOTER “Timing by IZT…” tepat di bawah tabel =====
    const footerY = Math.min(tableBottomY + 80, H - 120);
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.font = `700 32px Roboto, sans-serif`;
    ctx.fillStyle = "#64748b";
    ctx.fillText("Timing by IZT Race Technology", centerX, footerY);
  
    return canvas.toDataURL("image/png");
  }
  
  // ---------- helpers ----------
  function drawCenteredTable(
    ctx: CanvasRenderingContext2D,
    opts: { y: number; w: number; rowH: number; rows: Array<[string, string]> }
  ): number {
    const { y, w, rowH, rows } = opts;
    const W = ctx.canvas.width;
    const x = (W - w) / 2;
    const h = rowH * rows.length;
    const r = 16;
  
    // container background
    roundRect(ctx, x, y, w, h, r);
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#e2e8f0";
    ctx.stroke();
  
    for (let i = 0; i < rows.length; i++) {
      const ry = y + i * rowH;
  
      // zebra background
      if (i % 2 === 1) {
        ctx.fillStyle = "rgba(241,245,249,0.9)";
        ctx.fillRect(x, ry, w, rowH);
      }
  
      // horizontal separator
      if (i > 0) {
        ctx.beginPath();
        ctx.moveTo(x, ry);
        ctx.lineTo(x + w, ry);
        ctx.strokeStyle = "#e2e8f0";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
  
      const [label, value] = rows[i];
      ctx.font = `700 36px Roboto, sans-serif`;
      ctx.fillStyle = "#0f172a";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${label}: ${value}`, x + w / 2, ry + rowH / 2);
    }
  
    return y + h;
  }
  
  function roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }
  
  async function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }
  
  export function downloadDataUrl(dataUrl: string, filename: string) {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  
