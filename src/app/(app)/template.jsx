"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { usePathname, useSearchParams } from "next/navigation";

// Mendaftarkan plugin (meski kita pakai inti gsap di sini)
gsap.registerPlugin(useGSAP);

export default function AppTemplate({ children }) {
  const containerRef = useRef(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useGSAP(() => {
    document.body.style.overflowX = 'hidden'; // Keep horizontal hidden to prevent horizontal shake
    document.body.style.overflowY = 'hidden';

    gsap.fromTo(containerRef.current, 
      { 
        opacity: 0, 
        y: 40, 
        scale: 0.96,
        filter: "blur(12px)"
      },
      {
        y: 0,
        scale: 1,
        opacity: 1,
        filter: "blur(0px)",
        duration: 0.85,
        ease: "expo.out",
        clearProps: "all",
        onComplete: () => {
          document.body.style.overflowY = 'auto';
        }
      }
    );
  }, { scope: containerRef, dependencies: [pathname, searchParams] });

  return (
    <div ref={containerRef} className="h-full">
      {children}
    </div>
  );
}
