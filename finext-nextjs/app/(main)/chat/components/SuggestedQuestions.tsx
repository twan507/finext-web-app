'use client';

import { Box, ButtonBase, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
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
        <Box
            role="group"
            aria-label="Câu hỏi gợi ý"
            sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 0.5 }}
        >
            {questions.map((q) => (
                <ButtonBase
                    key={q}
                    type="button"
                    disabled={disabled}
                    onClick={() => onPick(q)}
                    sx={(t) => ({
                        width: '100%',
                        minHeight: 44,
                        justifyContent: 'flex-start',
                        px: 2.5,
                        py: 0.9,
                        borderRadius: 2,
                        textAlign: 'left',
                        color: 'text.secondary',
                        backgroundColor: 'transparent',
                        transition: 'background-color .18s ease',
                        '&:hover': {
                            backgroundColor: alpha(t.palette.primary.main, t.palette.mode === 'dark' ? 0.1 : 0.055),
                        },
                        '&:focus-visible, &.Mui-focusVisible': {
                            outline: `2px solid ${alpha(t.palette.primary.main, 0.65)}`,
                            outlineOffset: '2px',
                            backgroundColor: alpha(t.palette.primary.main, 0.08),
                        },
                        '&.Mui-disabled': { opacity: 0.45 },
                    })}
                >
                    <Typography
                        component="span"
                        sx={{ fontSize: getResponsiveFontSize('sm'), fontWeight: 500, lineHeight: 1.45 }}
                    >
                        {q}
                    </Typography>
                </ButtonBase>
            ))}
        </Box>
    );
}
