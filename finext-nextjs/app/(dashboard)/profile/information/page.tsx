'use client';

import React, { useState } from 'react';
import { Box, Typography, Button, TextField, Avatar, Chip, Link, InputAdornment } from '@mui/material';
import { WarningAmber } from '@mui/icons-material';

export default function InformationPage() {
    const [displayName, setDisplayName] = useState('Thái');
    // Giả sử đây là dữ liệu người dùng lấy từ API
    const user = {
        email: 't.july5th@gmail.com',
        phone: '******3888',
    };

    return (
        <Box sx={{ maxWidth: 700, color: 'text.primary' }}>
            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
                <Avatar sx={{ width: 64, height: 64, mr: 2, bgcolor: '#F59E0B', fontSize: '2rem' }}>
                    👨‍🌾
                </Avatar>
                <Box>
                    <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold' }}>
                        {displayName}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, mt: 0.5, alignItems: 'center' }}>
                        <Chip label="BASIC" color="warning" size="small" sx={{ fontWeight: 'bold' }} />
                        <Typography variant="body2" sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center' }}>
                            <Box component="span" sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'text.secondary', mr: 1 }} />
                            Chưa tích hợp
                        </Typography>
                    </Box>
                </Box>
            </Box>

            {/* Form */}
            <Box component="form" noValidate>
                <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>Tên hiển thị</Typography>
                <TextField
                    fullWidth
                    variant="filled"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    sx={{ mb: 3 }}
                />

                <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>Email</Typography>
                <TextField
                    fullWidth
                    variant="filled"
                    value={user.email}
                    disabled
                    InputProps={{
                        endAdornment: (
                            <InputAdornment position="end" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Link href="#" sx={{ fontWeight: 'medium' }}>Xác thực</Link>
                                <WarningAmber color="warning" />
                            </InputAdornment>
                        )
                    }}
                    sx={{ mb: 3 }}
                />

                <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>Số điện thoại</Typography>
                <TextField
                    fullWidth
                    variant="filled"
                    value={user.phone}
                    disabled
                    sx={{ mb: 3 }}
                />


                <Button variant="contained" size="large" sx={{ mt: 2, px: 4, borderRadius: 2 }}>
                    Cập nhật thông tin
                </Button>
            </Box>
        </Box>
    );
}