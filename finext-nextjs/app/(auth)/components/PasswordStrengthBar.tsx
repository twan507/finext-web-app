'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type { Theme } from '@mui/material/styles';
import { borderRadius, fontWeight, getResponsiveFontSize, durations, easings } from 'theme/tokens';

interface PasswordStrengthBarProps {
    password: string;
}

/** Điểm 0-4: độ dài >=8, có chữ + số, có ký tự đặc biệt, độ dài >=12. */
function scorePassword(password: string): number {
    if (!password) return 0;
    let score = 0;
    if (password.length >= 8) score += 1;
    if (/[a-zA-Z]/.test(password) && /\d/.test(password)) score += 1;
    if (/[^a-zA-Z0-9]/.test(password)) score += 1;
    if (password.length >= 12) score += 1;
    return score;
}

const LEVELS: { label: string; color: (t: Theme) => string }[] = [
    { label: 'Rất yếu', color: (t) => t.palette.error.main },
    { label: 'Yếu', color: (t) => t.palette.error.main },
    { label: 'Trung bình', color: (t) => t.palette.warning.main },
    { label: 'Khá', color: (t) => t.palette.success.light },
    { label: 'Mạnh', color: (t) => t.palette.success.main },
];

/** Thanh đo độ mạnh mật khẩu gọn, dùng màu theme (error/warning/success). */
export default function PasswordStrengthBar({ password }: PasswordStrengthBarProps) {
    if (!password) return null;
    const score = scorePassword(password);
    const level = LEVELS[score];
    const filled = Math.max(score, 1);

    return (
        <Box sx={{ mt: 0.75, mb: 0.5 }}>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
                {[0, 1, 2, 3].map((i) => (
                    <Box
                        key={i}
                        sx={(theme) => ({
                            flex: 1,
                            height: 4,
                            borderRadius: `${borderRadius.xs}px`,
                            transition: `background-color ${durations.normal} ${easings.smooth}`,
                            backgroundColor:
                                i < filled
                                    ? level.color(theme)
                                    : theme.palette.mode === 'dark'
                                        ? 'rgba(255,255,255,0.12)'
                                        : 'rgba(0,0,0,0.1)',
                        })}
                    />
                ))}
            </Box>
            <Typography
                sx={(theme) => ({
                    mt: 0.5,
                    fontSize: getResponsiveFontSize('xxs'),
                    fontWeight: fontWeight.medium,
                    color: level.color(theme),
                })}
            >
                Độ mạnh mật khẩu: {level.label}
            </Typography>
        </Box>
    );
}
