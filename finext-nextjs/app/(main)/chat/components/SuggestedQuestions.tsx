'use client';

import { Box, ButtonBase, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import ArrowOutwardRounded from '@mui/icons-material/ArrowOutwardRounded';
import { getResponsiveFontSize } from 'theme/tokens';

// Câu hỏi gợi ý dưới ô nhập, chỉ hiện khi hội thoại còn rỗng. Bấm là gửi luôn.
export default function SuggestedQuestions({
    questions,
    disabled,
    onPick,
}: {
    questions: string[];
    disabled?: boolean;
    onPick: (q: string) => void;
}) {
    if (!questions.length) return null;

    return (
        <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
            {questions.map((q) => (
                <ButtonBase
                    key={q}
                    disabled={disabled}
                    onClick={() => onPick(q)}
                    sx={(t) => ({
                        justifyContent: 'space-between',
                        gap: 1.5,
                        px: 1.5,
                        py: 1.25,
                        borderRadius: 1,
                        textAlign: 'left',
                        color: 'text.secondary',
                        borderBottom: `1px solid ${alpha(t.palette.divider, 0.6)}`,
                        transition: 'background-color .2s, color .2s',
                        '&:last-of-type': { borderBottom: 'none' },
                        '&:hover': { backgroundColor: alpha(t.palette.primary.main, 0.06), color: 'text.primary' },
                        '&.Mui-disabled': { opacity: 0.5 },
                    })}
                >
                    <Typography sx={{ fontSize: getResponsiveFontSize('sm') }}>{q}</Typography>
                    <ArrowOutwardRounded sx={{ fontSize: 16, opacity: 0.5, flexShrink: 0 }} />
                </ButtonBase>
            ))}
        </Box>
    );
}
