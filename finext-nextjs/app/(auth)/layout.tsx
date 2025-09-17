"use client";

import React from "react";
import { Box } from "@mui/material";
import { useTheme } from "@mui/material/styles";

interface AuthLayoutProps {
  children: React.ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  // Lệch tâm sang trái
  const centerX = "42%";
  const centerY = "52%";

  const layers = isDark
    ? {
        // ===== DARK MODE =====
        base: "linear-gradient(180deg, #0B0718 0%, #120A28 40%, #160D33 100%)",
        before: `
          radial-gradient(
            circle at ${centerX} ${centerY},
            rgba(178,130,255,0.70) 0%,
            rgba(158,110,255,0.46) 12%,
            rgba(118,80,230,0.28) 22%,
            rgba(82,50,190,0.16) 30%,
            rgba(52,30,130,0.10) 38%,
            rgba(32,20,90,0.06) 44%,
            rgba(22,14,60,0.03) 50%,
            rgba(14,9,36,0.00) 58%
          )
        `,
        after: `
          radial-gradient(
            circle at ${centerX} ${centerY},
            rgba(0,0,0,0) 45%,
            rgba(8,5,16,0.30) 70%,
            rgba(6,4,12,0.55) 100%
          ),
          radial-gradient(
            circle at ${centerX} ${centerY},
            rgba(110,70,220,0.10) 0%,
            rgba(110,70,220,0.00) 60%
          )
        `,
        blurPx: 36,
      }
    : {
        // ===== LIGHT MODE (tím đậm hơn) =====
        base: "linear-gradient(180deg, #ECE9FF 0%, #E5E0FF 40%, #DCD6FF 100%)",
        before: `
          radial-gradient(
            circle at ${centerX} ${centerY},
            rgba(150, 90, 245, 0.55) 0%,
            rgba(130, 75, 230, 0.34) 14%,
            rgba(110, 65, 210, 0.22) 24%,
            rgba(90, 55, 185, 0.14) 34%,
            rgba(70, 45, 160, 0.10) 42%,
            rgba(60, 40, 140, 0.06) 50%,
            rgba(50, 35, 120, 0.04) 58%,
            rgba(50, 35, 120, 0.00) 66%
          )
        `,
        after: `
          radial-gradient(
            circle at ${centerX} ${centerY},
            rgba(0,0,0,0) 55%,
            rgba(0,0,0,0.10) 85%,
            rgba(0,0,0,0.16) 100%
          ),
          radial-gradient(
            circle at ${centerX} ${centerY},
            rgba(100,60,200,0.10) 0%,
            rgba(100,60,200,0.00) 60%
          )
        `,
        blurPx: 28,
      };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        width: "100%",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: 2,

        // Nền chính
        background: layers.base,

        // Glow ở tâm
        "&::before": {
          content: '""',
          position: "absolute",
          inset: "-15%",
          pointerEvents: "none",
          background: layers.before,
          filter: `blur(${layers.blurPx}px)`,
          zIndex: 1,
        },

        // Vignette mép
        "&::after": {
          content: '""',
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background: layers.after,
          zIndex: 1,
        },
      }}
    >
      <Box
        sx={{
          width: "100%",
          maxWidth: 400,
          position: "relative",
          zIndex: 2,
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
