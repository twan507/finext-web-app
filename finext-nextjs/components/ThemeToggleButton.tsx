'use client';

import React, { useState, useEffect } from 'react';
import { useTheme as useNextTheme } from 'next-themes';
import { IconButton, Tooltip, Skeleton } from '@mui/material';
import styles from './ThemeToggleButton.module.css'; // Import CSS module

// Tách SVG ra một component riêng cho sạch sẽ
const SunMoonIcon = () => (
  <div className={styles.themeToggle}>
    <div className={styles.sunMoonContainer}>
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <mask id="moon-mask">
          <rect x="0" y="0" width="100%" height="100%" fill="white"></rect>
          <circle cx="16" cy="5" r="8" fill="black"></circle>
        </mask>
        <circle
          className={styles.sunMoon}
          cx="12"
          cy="12"
          r="8"
          mask="url(#moon-mask)"
          fill="currentColor"
        ></circle>
        <g>
          <path
            className={styles.sunRay}
            stroke="currentColor"
            strokeWidth="2"
            d="M12 2V4"
          ></path>
          <path
            className={`${styles.sunRay} ${styles.sunRay2}`}
            stroke="currentColor"
            strokeWidth="2"
            d="M19.07 4.93L17.66 6.34"
          ></path>
          <path
            className={`${styles.sunRay} ${styles.sunRay3}`}
            stroke="currentColor"
            strokeWidth="2"
            d="M22 12H20"
          ></path>
          <path
            className={`${styles.sunRay} ${styles.sunRay4}`}
            stroke="currentColor"
            strokeWidth="2"
            d="M19.07 19.07L17.66 17.66"
          ></path>
          <path
            className={`${styles.sunRay} ${styles.sunRay5}`}
            stroke="currentColor"
            strokeWidth="2"
            d="M12 22V20"
          ></path>
          <path
            className={`${styles.sunRay} ${styles.sunRay6}`}
            stroke="currentColor"
            strokeWidth="2"
            d="M4.93 19.07L6.34 17.66"
          ></path>
          <path
            className={`${styles.sunRay} ${styles.sunRay7}`}
            stroke="currentColor"
            strokeWidth="2"
            d="M2 12H4"
          ></path>
          <path
            className={`${styles.sunRay} ${styles.sunRay8}`}
            stroke="currentColor"
            strokeWidth="2"
            d="M4.93 4.93L6.34 6.34"
          ></path>
        </g>
      </svg>
    </div>
  </div>
);

const ThemeToggleButton: React.FC = () => {
  const { theme, setTheme, resolvedTheme } = useNextTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleThemeChange = () => {
    const currentActualTheme = theme === 'system' ? resolvedTheme : theme;
    setTheme(currentActualTheme === 'light' ? 'dark' : 'light');
  };

  if (!mounted) {
    return <Skeleton variant="circular" width={40} height={40} sx={{ mr: 1 }} />;
  }

  const isCurrentlyDark = resolvedTheme === 'dark';

  // Tooltip sẽ thay đổi tùy theo theme hiện tại để có trải nghiệm tốt hơn
  const getThemeTooltip = () => {
    return isCurrentlyDark ? 'Chế độ sáng' : 'Chế độ tối';
  };

  return (
    <Tooltip title={getThemeTooltip()}>
      {/* - Vẫn dùng IconButton của MUI để giữ sự đồng nhất.
        - Thêm class CSS module vào IconButton.
        - Dựa vào `isCurrentlyDark` để thêm class .isDark, kích hoạt animation.
      */}
      <IconButton
        sx={{ mr: 1 }}
        onClick={handleThemeChange}
        color="inherit"
        className={`${isCurrentlyDark ? styles.isDark : ''}`} // Thêm class isDark khi ở chế độ tối
      >
        <SunMoonIcon />
      </IconButton>
    </Tooltip>
  );
};

export default ThemeToggleButton;