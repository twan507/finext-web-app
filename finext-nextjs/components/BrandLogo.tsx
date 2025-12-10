import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Typography, Box, useTheme } from '@mui/material';

interface BrandLogoProps {
    href?: string;
    showText?: boolean;
    imageSize?: number;
    textSize?: string | number;
    gap?: number;
    className?: string;
    // Color overlay options
    useColorOverlay?: boolean;
    overlayColor?: string; // 'white', 'black', or custom color
    // Legacy prop for backward compatibility
    size?: number;
}

const BrandLogo: React.FC<BrandLogoProps> = ({
    href = '/',
    showText = true,
    imageSize,
    textSize,
    gap = 8,
    className,
    useColorOverlay = false,
    overlayColor,
    size = 24, // fallback for legacy compatibility
}) => {
    const theme = useTheme();
    // Use imageSize if provided, otherwise fall back to size prop
    const finalImageSize = imageSize || size;

    // Determine overlay filter based on theme and props
    const getOverlayFilter = () => {
        if (!useColorOverlay) return undefined;

        if (overlayColor === 'white') {
            return 'brightness(0) invert(1)'; // Makes image white
        } else if (overlayColor === 'black') {
            return 'brightness(0)'; // Makes image black
        } else if (overlayColor) {
            // For custom colors - you can extend this for more complex filters
            return undefined;
        }

        // Theme-responsive: black for light theme, white for dark theme
        return theme.palette.mode === 'dark'
            ? 'brightness(0) invert(1)' // White for dark theme
            : 'brightness(0)'; // Black for light theme
    };

    const logoImage = (
        <Box
            sx={{
                display: 'inline-block',
                filter: getOverlayFilter(),
                transform: 'translateY(-1px)', // Dịch ảnh lên 1px
            }}
        >
            <Image
                src="/finext-icon-trans.png"
                alt="Finext Logo"
                width={finalImageSize}
                height={finalImageSize}
                style={{
                    display: 'block',
                    width: finalImageSize,
                    height: 'auto'
                }}
            />
        </Box>
    );

    return (
        <Link
            href={href}
            style={{
                textDecoration: 'none',
                color: 'inherit',
                display: 'flex',
                alignItems: 'center',
                gap: gap,
            }}
            className={className}
        >
            {logoImage}
            {showText && (
                <Typography
                    variant="logo"
                    sx={{
                        letterSpacing: 0.5,
                        fontSize: textSize || undefined, // Override font size if provided
                    }}
                >
                    Finext
                </Typography>
            )}
        </Link>
    );
}; export default BrandLogo;