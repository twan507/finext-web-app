'use client';

import React from 'react';
import Collapse from '@mui/material/Collapse';
import Alert from '@mui/material/Alert';
import type { AlertColor } from '@mui/material/Alert';

interface AuthAlertProps {
    open: boolean;
    severity?: AlertColor;
    children?: React.ReactNode;
}

/**
 * Slot thông báo lỗi/thành công có Collapse animate → hiện/ẩn mượt, KHÔNG gây
 * nhảy layout đột ngột cho các field bên dưới. Auto-dismiss vẫn do parent quản lý.
 */
export default function AuthAlert({ open, severity = 'error', children }: AuthAlertProps) {
    return (
        <Collapse in={open} unmountOnExit>
            <Alert severity={severity} sx={{ width: '100%', mb: 1.5 }}>
                {children}
            </Alert>
        </Collapse>
    );
}
