"use client";

import { useEffect, useState } from "react";
import { isMobile, isNativeShell } from "@/lib/app/is-mobile";

export function useNativeShell() {
  const [native, setNative] = useState(isMobile);

  useEffect(() => {
    setNative(isNativeShell());
  }, []);

  return native;
}
