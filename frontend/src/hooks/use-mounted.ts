import { useEffect, useState } from "react";

/** True after the first client render — used to skip SSR for date/time-dependent UI. */
export function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
