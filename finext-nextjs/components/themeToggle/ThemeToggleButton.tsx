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
const SunMoonIcon = ({ isDark, uniqueId }: { isDark: boolean; uniqueId: string }) => (
  <div className={`${styles.themeToggle} ${isDark ? styles.isDark : ''}`} aria-hidden="true">
    <div className={styles.sunMoonContainer}>
      {/* SVG content với unique mask ID */}
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
        <mask id={`moon-mask-${uniqueId}`}>
          <rect x="0" y="0" width="100%" height="100%" fill="white"></rect>
          <circle cx="16" cy="5" r="8" fill="black"></circle>
        </mask>
        <circle className={styles.sunMoon} cx="12" cy="12" r="8" mask={`url(#moon-mask-${uniqueId})`} fill="currentColor"></circle>
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
  compact?: boolean;
}

const ThemeToggleButton: React.FC<ThemeToggleButtonProps> = ({ variant = 'icon', compact = false }) => {
  const { theme, setTheme, resolvedTheme } = useNextTheme();
  const [mounted, setMounted] = useState(false);

  const [uniqueId] = useState(() => Math.random().toString(36).substr(2, 9));

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

  if (variant === 'full') {
    return (
      <ListItemButton
        onClick={handleThemeChange}
        aria-label={tooltipText}
        role="button"
        sx={{
          py: compact ? 1 : undefined,
          borderRadius: compact ? '6px' : '8px',
          color: 'text.secondary',
          '&:hover': {
            backgroundColor: (theme) => theme.palette.action.hover,
            color: 'text.primary'
          }
        }}
      >
        <ListItemIcon sx={{
          minWidth: compact ? 32 : 36,
          color: isCurrentlyDark ? 'text.primary' : 'text.secondary',
          '& .themeToggle': {
            transform: compact ? 'scale(0.9)' : 'scale(1)',
          }
        }}>
          <SunMoonIcon isDark={isCurrentlyDark} uniqueId={uniqueId} />
        </ListItemIcon>
        <ListItemText
          primary={tooltipText}
          primaryTypographyProps={{ fontSize: compact ? '0.9rem' : undefined }}
        />
      </ListItemButton>
    );
  }

  return (
    <Tooltip title={tooltipText}>
      <IconButton
        onClick={handleThemeChange}
        aria-label={tooltipText}
        sx={{
          mr: 1,
          color: isCurrentlyDark ? 'text.primary' : 'text.secondary'
        }}
      >
        <SunMoonIcon isDark={isCurrentlyDark} uniqueId={uniqueId} />
      </IconButton>
    </Tooltip>
  );
};

export default ThemeToggleButton;