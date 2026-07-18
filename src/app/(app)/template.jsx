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
  
  // Hanya trigger animasi jika pathname atau filter utama berubah. 
  // Ini mencegah animasi terpanggil saat mengetik di pencarian.
  const filter = searchParams.get("filter") || "";
  const animationKey = `${pathname}?filter=${filter}`;

  useGSAP(() => {
    document.body.style.overflowX = 'hidden'; // Keep horizontal hidden to prevent horizontal shake
    document.body.style.overflowY = 'hidden';

    gsap.fromTo(containerRef.current, 
      { 
        opacity: 0, 
        y: 20, 
        scale: 0.98
      },
      {
        y: 0,
        scale: 1,
        opacity: 1,
        duration: 0.6,
        ease: "power3.out",
        clearProps: "all",
        onComplete: () => {
          document.body.style.overflowY = 'auto';
        }
      }
    );
  }, { scope: containerRef, dependencies: [animationKey] });

  return (
    <div ref={containerRef} className="h-full">
      {children}
    </div>
  );
}
