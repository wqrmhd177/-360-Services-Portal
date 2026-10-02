"use client";

import { useEffect, useState } from "react";

/** Tailwind `lg` breakpoint — matches filter sheets and layout drawer. */
export function useIsLgUp(): boolean {
  const [isLgUp, setIsLgUp] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsLgUp(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return isLgUp;
}
