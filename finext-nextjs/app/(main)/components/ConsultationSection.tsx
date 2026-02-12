'use client';

import { Box, Typography, Button, Grid, useTheme } from '@mui/material';
import Image from 'next/image';
import { borderRadius, fontWeight, getResponsiveFontSize, getGlowButton } from 'theme/tokens';

export default function ConsultationSection() {
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";

    const centerX = "85%";
    const centerY = "50%";

    const layers = isDark
        ? {
            base: "linear-gradient(180deg, #0B0718 0%, #120A28 100%)",
            before: `radial-gradient(circle at ${centerX} ${centerY}, rgba(178,130,255,0.70) 0%, rgba(158,110,255,0.46) 12%, rgba(118,80,230,0.28) 22%, rgba(82,50,190,0.16) 30%, rgba(52,30,130,0.10) 38%, rgba(32,20,90,0.06) 44%, rgba(22,14,60,0.03) 50%, rgba(14,9,36,0.00) 58%)`,
            border: 'rgba(255, 255, 255, 0.08)'
        }
        : {
            base: "linear-gradient(180deg, #F4F0FF 0%, #EBE5FF 100%)",
            before: `radial-gradient(circle at ${centerX} ${centerY}, rgba(150, 90, 245, 0.45) 0%, rgba(130, 75, 230, 0.28) 14%, rgba(110, 65, 210, 0.18) 24%, rgba(90, 55, 185, 0.12) 34%, rgba(70, 45, 160, 0.08) 42%, rgba(60, 40, 140, 0.05) 50%, rgba(50, 35, 120, 0.03) 58%, rgba(50, 35, 120, 0.00) 66%)`,
            border: 'rgba(139, 92, 246, 0.15)'
        };

    return (
        <Box
            sx={{
                position: 'relative',
                overflow: 'hidden',
                background: layers.base,
                width: '100%',
                py: { xs: 6, md: 8 },
                "&::before": {
                    content: '""',
                    position: "absolute",
                    inset: 0,
                    pointerEvents: "none",
                    background: layers.before,
                    filter: `blur(40px)`,
                    zIndex: 0,
                },
            }}
        >
            <Box sx={{ maxWidth: 1400, mx: 'auto', px: { xs: 2.5, md: 4, lg: 6 }, position: 'relative', zIndex: 1 }}>
                <Grid container alignItems="center" spacing={{ xs: 4, md: 4 }}>
                    <Grid size={{ xs: 12, md: 6 }} sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: { xs: 'center', md: 'flex-start' },
                        textAlign: { xs: 'center', md: 'left' }
                    }}>
                        <Typography
                            variant="h2"
                            sx={{
                                fontWeight: fontWeight.bold,
                                fontSize: getResponsiveFontSize('h3'),
                                mb: 2,
                                lineHeight: { xs: 1.3, md: 1.2 },
                                color: theme.palette.text.primary,
                                maxWidth: '600px'
                            }}
                        >
                            Mở tài khoản chứng khoán và nhận tư vấn 1:1 từ chuyên gia
                        </Typography>
                        <Typography
                            variant="body1"
                            sx={{
                                mb: 4,
                                fontSize: getResponsiveFontSize('md'),
                                maxWidth: '550px',
                                lineHeight: 1.6,
                                color: theme.palette.text.secondary,
                                mx: { xs: 'auto', md: 0 }
                            }}
                        >
                            Đừng bỏ lỡ cơ hội gia tăng tài sản nhờ những quyết định đầu tư kịp thời và phương pháp quản lý danh mục bài bản, hiệu quả.
                        </Typography>
                        <Button
                            variant="contained"
                            size="large"
                            sx={{
                                py: { xs: 1.25, md: 1.5 },
                                px: { xs: 3, md: 4 },
                                borderRadius: `${borderRadius.md}px`,
                                fontWeight: fontWeight.semibold,
                                fontSize: getResponsiveFontSize('md'),
                                textTransform: 'none',
                                ...getGlowButton(isDark),
                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                width: { xs: '100%', sm: 'auto' }
                            }}
                        >
                            Mở tài khoản chứng khoán
                        </Button>
                    </Grid>

                    <Grid size={{ xs: 12, md: 6 }} sx={{
                        display: 'flex',
                        justifyContent: { xs: 'center', md: 'flex-end' },
                        position: 'relative'
                    }}>
                        <Box sx={{
                            position: 'relative',
                            width: '100%',
                            maxWidth: { xs: 320, md: 500 },
                            aspectRatio: '16/9',
                        }}>
                            <Image
                                src="/banner.png"
                                alt="Finext Consultation"
                                fill
                                style={{
                                    objectFit: 'contain',
                                    filter: 'drop-shadow(0 20px 40px rgba(0,0,0,0.15))'
                                }}
                            />
                        </Box>
                    </Grid>
                </Grid>
            </Box>
        </Box>
    );
}
