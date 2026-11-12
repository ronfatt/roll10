"use client";

import { useMemo } from "react";
import { generateQrMatrix } from "@/lib/usdt/qr";

export function QrCodeSvg({
  value,
  size = 168,
  label = "USDT Deposit Address QR",
}: {
  value: string;
  size?: number;
  label?: string;
}) {
  const pathD = useMemo(() => {
    const matrix = generateQrMatrix(value);
    const parts: string[] = [];
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (matrix[r][c]) {
          parts.push(`M${c},${r}h1v1h-1z`);
        }
      }
    }
    return parts.join("");
  }, [value]);

  // 29x29 modules + 2-module quiet zone each side = 33x33 viewBox
  return (
    <div
      className="inline-flex items-center justify-center rounded-2xl bg-white p-2.5 shadow-inner"
      aria-label={label}
    >
      <svg
        width={size}
        height={size}
        viewBox="-2 -2 33 33"
        shapeRendering="crispEdges"
        role="img"
        aria-label={label}
      >
        <rect x="-2" y="-2" width="33" height="33" fill="#FFFFFF" />
        <path d={pathD} fill="#08090B" />
      </svg>
    </div>
  );
}
