import React, { useState } from "react";
import { renderCertificatePNG, downloadDataUrl } from "../lib/certificate";

type Props = {
  open: boolean;
  onClose: () => void;
  data: {
    name: string;
    bib: string;
    gender: string;
    category: string;
    finishTimeRaw: string;
    totalTimeDisplay: string;
    checkpointTimes: string[];
    overallRank: number | null;
    genderRank: number | null;
    categoryRank: number | null;
  } | null;
};

function onlyTime(raw: string) {
  const m = raw.match(/(\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?)/);
  if (!m) return raw;
  let t = m[1];
  if (t.includes(".")) {
    const [hhmmss, frac] = t.split(".");
    t = `${hhmmss}.${frac.padEnd(3, "0").slice(0, 3)}`;
  } else {
    t = `${t}.000`;
  }
  return t;
}

export default function ParticipantModal({ open, onClose, data }: Props) {
  const [downloading, setDownloading] = useState(false);

  if (!open || !data) return null;

  const cp =
    data.checkpointTimes.length > 0
      ? data.checkpointTimes.map(onlyTime).join(", ")
      : "-";

  const onDownloadCert = async () => {
    try {
      setDownloading(true);
      const png = await renderCertificatePNG({
        name: data.name,
        bib: data.bib,
        gender: data.gender,
        category: data.category,
        finishTime: data.finishTimeRaw,
        totalTimeDisplay: data.totalTimeDisplay,
        overallRank: data.overallRank,
        genderRank: data.genderRank,
        categoryRank: data.categoryRank,
      });
      downloadDataUrl(png, `IMR2025_${data.bib || "BIB"}_certificate.png`);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Participant Detail</div>
          <button className="btn ghost" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="modal-grid">
          <div className="modal-item">
            <div className="label">Nama</div>
            <div className="value">{data.name || "-"}</div>
          </div>

          <div className="modal-item">
            <div className="label">NO BIB</div>
            <div className="value mono">{data.bib || "-"}</div>
          </div>

          <div className="modal-item">
            <div className="label">Gender</div>
            <div className="value">{data.gender || "-"}</div>
          </div>

          <div className="modal-item">
            <div className="label">Kategori Lari</div>
            <div className="value">{data.category || "-"}</div>
          </div>

          <div className="modal-item">
            <div className="label">Finish Time</div>
            <div className="value mono">{data.finishTimeRaw || "-"}</div>
          </div>

          <div className="modal-item">
            <div className="label">Total Time</div>
            <div className="value mono strong">
              {data.totalTimeDisplay || "-"}
            </div>
          </div>

          <div className="modal-item modal-wide">
            <div className="label">Checkpoint Time</div>
            <div className="value mono">{cp}</div>
          </div>

          <div className="modal-item">
            <div className="label">Overall Rank</div>
            <div className="value">{data.overallRank ?? "-"}</div>
          </div>

          <div className="modal-item">
            <div className="label">Gender Rank</div>
            <div className="value">{data.genderRank ?? "-"}</div>
          </div>

          <div className="modal-item">
            <div className="label">Category Rank</div>
            <div className="value">{data.categoryRank ?? "-"}</div>
          </div>
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
          <button
            className="btn"
            onClick={onDownloadCert}
            disabled={downloading}
          >
            {downloading ? "Rendering…" : "Download E-Certificate (9:16)"}
          </button>
          <div className="subtle" style={{ alignSelf: "center" }}>
            PNG siap IG Stories
          </div>
        </div>
      </div>
    </div>
  );
}
