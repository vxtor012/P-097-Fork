"use client";

import { useState, useEffect } from "react";
import type { VehicleKey } from "@/lib/vehicle-data";

/** Quy ước: frontend/public/cars/<model viết thường>/<id màu>.png  vd: public/cars/vf6/white.png */
export const carImagePath = (model: VehicleKey, colorId: string) => `/cars/${model.toLowerCase()}/${colorId}.png`;

interface Props {
  model: VehicleKey;
  colorId: string;
  alt: string;
  className?: string;
  imageUrl?: string;
  /** Chiều rộng tối đa (px). Khung luôn tỉ lệ 16:9, ảnh co vừa khung (object-fit: contain). */
  maxWidth?: number;
}

export function CarImage({ model, colorId, alt, className = "", maxWidth, imageUrl }: Props) {
  const defaultWhite = `/cars/${model.toLowerCase()}/white.png`;
  const initialSrc = imageUrl || carImagePath(model, colorId);
  const [currentSrc, setCurrentSrc] = useState(initialSrc);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setCurrentSrc(imageUrl || carImagePath(model, colorId));
    setHasError(false);
  }, [imageUrl, model, colorId]);

  const box: React.CSSProperties = { width: "100%", maxWidth, aspectRatio: "16 / 9" };

  const handleError = () => {
    if (currentSrc !== defaultWhite) {
      setCurrentSrc(defaultWhite);
    } else {
      setHasError(true);
    }
  };

  if (hasError) {
    return (
      <div className={`grid place-items-center rounded-2xl bg-slate-200/60 p-4 text-center text-xs text-slate-500 ${className}`} style={box}>
        <span>VinFast {alt}</span>
      </div>
    );
  }

  return (
    <div className={className} style={box}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={currentSrc}
        alt={alt}
        onError={handleError}
        style={{ width: "100%", height: "100%", objectFit: "contain" }}
      />
    </div>
  );
}

