'use client';

import React from 'react';
import { Chip, ChipProps } from '@mui/material';
import { useLicenseColors } from '../hooks/useLicenseColors';

interface LicenseChipProps extends Omit<ChipProps, 'label' | 'color'> {
    licenseKey: string;
    /** Override displayed text. Defaults to licenseKey. */
    label?: React.ReactNode;
    /** When false, render chip in muted default style (ignores license color). */
    isActive?: boolean;
}

const LicenseChip: React.FC<LicenseChipProps> = ({
    licenseKey,
    label,
    isActive = true,
    size = 'small',
    variant = 'outlined',
    sx,
    ...rest
}) => {
    const colorMap = useLicenseColors();
    const color = isActive ? colorMap.get(licenseKey) : undefined;

    return (
        <Chip
            label={label ?? licenseKey}
            size={size}
            variant={variant}
            sx={{
                ...(color && {
                    backgroundColor: color,
                    color: 'white',
                    borderColor: color,
                    '&:hover': {
                        backgroundColor: color,
                        opacity: 0.85,
                    },
                }),
                ...sx,
            }}
            {...rest}
        />
    );
};

export default LicenseChip;
