'use client';

import React, { useState, useEffect } from 'react';
import { useTheme as useNextTheme } from 'next-themes';
import { IconButton, Tooltip, Skeleton } from '@mui/material';
import {
  Brightness2 as DarkModeIcon, // Dark mode icon
  LightMode as LightModeIcon, // Light mode icon
} from '@mui/icons-material';

const ThemeToggleButton: React.FC = () => {
  // `theme` stores the user's explicit choice ('light', 'dark') or 'system'
  // `setTheme` updates this choice
  // `resolvedTheme` is what's actually active ('light' or 'dark'), after 'system' is resolved
  const { theme, setTheme, resolvedTheme } = useNextTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleThemeChange = () => {
    // Toggle between 'light' and 'dark'
    // If current theme is 'system', treat resolvedTheme as the current for toggle
    const currentActualTheme = theme === 'system' ? resolvedTheme : theme;
    setTheme(currentActualTheme === 'light' ? 'dark' : 'light');
  };

  if (!mounted) {
    // Render a skeleton or null during server-side rendering or before hydration
    return <Skeleton variant="circular" width={40} height={40} sx={{ mr: 1 }} />;
  }

  // Determine which icon to show based on the *resolved* theme
  // This ensures the icon matches what the user actually sees
  const isCurrentlyDark = resolvedTheme === 'dark';

  const getThemeTooltip = () => {
    return "Chế độ sáng tôi";
  };

  return (
    <Tooltip title={getThemeTooltip()}>
      <IconButton sx={{ mr: 1 }} onClick={handleThemeChange} color="inherit">
        {isCurrentlyDark ? <DarkModeIcon fontSize="small"/> : <LightModeIcon fontSize="small"/>}
      </IconButton>
    </Tooltip>
  );
};

export default ThemeToggleButton;
