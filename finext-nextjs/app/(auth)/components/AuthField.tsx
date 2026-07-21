'use client';

import React from 'react';
import TextField from '@mui/material/TextField';
import type { TextFieldProps } from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import Visibility from '@mui/icons-material/VisibilityOutlined';
import VisibilityOff from '@mui/icons-material/VisibilityOffOutlined';
import { borderRadius, shadows, shadowsDark, durations, easings } from 'theme/tokens';

type AuthFieldProps = Omit<TextFieldProps, 'variant'> & {
    /** Bật nút hiện/ẩn mật khẩu (dùng InputAdornment chuẩn thay vì IconButton absolute). */
    passwordToggle?: boolean;
    showPassword?: boolean;
    onTogglePassword?: () => void;
};

/**
 * Input filled-glass dùng chung: nền kính mờ nhẹ, focus-ring tím (shadows.input),
 * nút hiện/ẩn mật khẩu qua InputAdornment (bỏ magic-number top:'27px'/'50%').
 */
export default function AuthField({
    passwordToggle = false,
    showPassword = false,
    onTogglePassword,
    type,
    InputProps,
    sx,
    ...rest
}: AuthFieldProps) {
    const resolvedType = passwordToggle ? (showPassword ? 'text' : 'password') : type;

    const endAdornment = passwordToggle ? (
        <InputAdornment position="end">
            <IconButton
                aria-label="đổi hiển thị mật khẩu"
                onClick={onTogglePassword}
                onMouseDown={(e) => e.preventDefault()}
                edge="end"
                tabIndex={-1}
                size="small"
                sx={(theme) => ({ color: theme.palette.text.secondary })}
            >
                {showPassword ? <Visibility fontSize="small" /> : <VisibilityOff fontSize="small" />}
            </IconButton>
        </InputAdornment>
    ) : undefined;

    return (
        <TextField
            {...rest}
            type={resolvedType}
            variant="outlined"
            fullWidth
            InputProps={{ ...InputProps, ...(endAdornment ? { endAdornment } : {}) }}
            sx={[
                (theme) => {
                    const isDark = theme.palette.mode === 'dark';
                    return {
                        '& .MuiOutlinedInput-root': {
                            borderRadius: `${borderRadius.md}px`,
                            backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.55)',
                            transition: `box-shadow ${durations.fast} ${easings.smooth}, background-color ${durations.fast} ${easings.smooth}`,
                            '&:hover': {
                                backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.7)',
                            },
                            '&.Mui-focused': {
                                backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.8)',
                                boxShadow: isDark ? shadowsDark.input : shadows.input,
                            },
                        },
                    };
                },
                ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
            ]}
        />
    );
}
