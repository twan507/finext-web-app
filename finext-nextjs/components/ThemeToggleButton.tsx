'use client';

import React, { useState, useEffect } from 'react';
import { useTheme as useNextTheme } from 'next-themes';
import {
  IconButton,
  Tooltip,
  Skeleton,
  ListItemButton, // Thêm import
  ListItemIcon,   // Thêm import
  ListItemText    // Thêm import
} from '@mui/material';
import styles from './ThemeToggleButton.module.css';

// Tách SVG ra một component riêng và cho phép nhận prop `isDark` để quản lý animation
const SunMoonIcon = ({ isDark }: { isDark: boolean }) => (
  <div className={`${styles.themeToggle} ${isDark ? styles.isDark : ''}`}>
    <div className={styles.sunMoonContainer}>
      {/* SVG content không đổi, bạn giữ nguyên SVG của mình ở đây */}
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <mask id="moon-mask">
          <rect x="0" y="0" width="100%" height="100%" fill="white"></rect>
          <circle cx="16" cy="5" r="8" fill="black"></circle>
        </mask>
        <circle className={styles.sunMoon} cx="12" cy="12" r="8" mask="url(#moon-mask)" fill="currentColor"></circle>
        <g>
          <path className={styles.sunRay} stroke="currentColor" strokeWidth="2" d="M12 2V4"></path>
          <path className={`${styles.sunRay} ${styles.sunRay2}`} stroke="currentColor" strokeWidth="2" d="M19.07 4.93L17.66 6.34"></path>
          <path className={`${styles.sunRay} ${styles.sunRay3}`} stroke="currentColor" strokeWidth="2" d="M22 12H20"></path>
          <path className={`${styles.sunRay} ${styles.sunRay4}`} stroke="currentColor" strokeWidth="2" d="M19.07 19.07L17.66 17.66"></path>
          <path className={`${styles.sunRay} ${styles.sunRay5}`} stroke="currentColor" strokeWidth="2" d="M12 22V20"></path>
          <path className={`${styles.sunRay} ${styles.sunRay6}`} stroke="currentColor" strokeWidth="2" d="M4.93 19.07L6.34 17.66"></path>
          <path className={`${styles.sunRay} ${styles.sunRay7}`} stroke="currentColor" strokeWidth="2" d="M2 12H4"></path>
          <path className={`${styles.sunRay} ${styles.sunRay8}`} stroke="currentColor" strokeWidth="2" d="M4.93 4.93L6.34 6.34"></path>
        </g>
      </svg>
    </div>
  </div>
);

interface ThemeToggleButtonProps {
  variant?: 'icon' | 'full';
}

const ThemeToggleButton: React.FC<ThemeToggleButtonProps> = ({ variant = 'icon' }) => {
  const { theme, setTheme, resolvedTheme } = useNextTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const handleThemeChange = () => {
    const currentActualTheme = theme === 'system' ? resolvedTheme : theme;
    setTheme(currentActualTheme === 'light' ? 'dark' : 'light');
  };

  if (!mounted) {
    if (variant === 'full') return <Skeleton variant="rounded" width="100%" height={44} />;
    return <Skeleton variant="circular" width={40} height={40} />;
  }

  const isCurrentlyDark = resolvedTheme === 'dark';
  const tooltipText = isCurrentlyDark ? 'Chuyển chế độ sáng' : 'Chuyển chế độ tối';

  // Dạng nút dài, có cấu trúc ListItemButton hoàn chỉnh
  if (variant === 'full') {
    return (
      <ListItemButton
        onClick={handleThemeChange}
        sx={{
          px: 1.25,
          py: 1.25,
          borderRadius: '8px',
          color: 'text.secondary',
          '&:hover': {
            backgroundColor: (theme) => theme.palette.action.hover,
            color: 'text.primary'
          }
        }}
      >
        <ListItemIcon sx={{ minWidth: 32, color: 'inherit' }}>
          <SunMoonIcon isDark={isCurrentlyDark} />
        </ListItemIcon>
        <ListItemText
          primary={tooltipText}
          primaryTypographyProps={{ variant: 'body2' }}
        />
      </ListItemButton>
    );
  }

  // Dạng chỉ có icon (mặc định)
  return (
    <Tooltip title={tooltipText}>
      <IconButton onClick={handleThemeChange} color="inherit" sx={{ mr: 1 }}>
        <SunMoonIcon isDark={isCurrentlyDark} />
      </IconButton>
    </Tooltip>
  );
};

export default ThemeToggleButton;