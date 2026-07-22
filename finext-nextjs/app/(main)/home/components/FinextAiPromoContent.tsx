'use client';

import { useState } from 'react';
import { Box, Typography } from '@mui/material';
import { AutoAwesomeRounded } from '@mui/icons-material';
import { getResponsiveFontSize, fontWeight } from 'theme/tokens';
import Composer from 'app/(main)/chat/components/Composer';
import SuggestedQuestions from 'app/(main)/chat/components/SuggestedQuestions';

const TITLE = 'Giới thiệu Finext AI';
const INTRO = 'Trợ lý phân tích được xây dựng trên nền dữ liệu thị trường sâu rộng và triết lý đầu tư theo dòng tiền của Finext.';

/**
 * Nội dung popup: tiêu đề lớn → 1 dòng giới thiệu → composer thật (kiểu /chat) → dãy câu hỏi gợi ý.
 * `questions` do popup fetch SẴN trước khi hiện (usePromoGate) rồi bơm xuống → khu gợi ý không nhảy vào sau.
 */
export default function FinextAiPromoContent({ onSubmit, questions }: { onSubmit: (t: string) => void; questions: string[] }) {
  // Chip "Suy nghĩ sâu" chỉ để trông y hệt /chat; ở popup không stream nên state cục bộ là đủ.
  const [thinking, setThinking] = useState(false);

  return (
    <Box sx={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: { xs: 2, sm: 2.5 } }}>
      <Box sx={{ textAlign: 'center' }}>
        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <AutoAwesomeRounded sx={{ fontSize: { xs: 26, sm: 32 }, color: 'primary.main' }} />
          <Typography component="h2" sx={{ fontSize: { xs: '1.5rem', sm: '2rem' }, fontWeight: fontWeight.bold, color: 'text.primary', lineHeight: 1.15 }}>
            {TITLE}
          </Typography>
        </Box>
        <Typography sx={{ fontSize: getResponsiveFontSize('md'), color: 'text.secondary', lineHeight: 1.55, maxWidth: 540, mx: 'auto' }}>
          {INTRO}
        </Typography>
      </Box>

      {/* Composer thật (mode empty-state của /chat): input căn giữa dọc chuẩn, nút gửi cùng style. */}
      <Box sx={{ width: '100%' }}>
        <Composer
          centered
          glowSize="soft"
          disabled={false}
          streaming={false}
          onSend={onSubmit}
          onStop={() => {}}
          thinking={thinking}
          onToggleThinking={() => setThinking((v) => !v)}
        />
      </Box>

      {/* Đúng component SuggestedQuestions của /chat; bấm một câu = bàn giao sang /chat như composer. */}
      {questions.length > 0 && (
        <Box sx={{ width: '100%', px: { xs: 2, md: 3 }, boxSizing: 'border-box' }}>
          <SuggestedQuestions questions={questions} onPick={onSubmit} />
        </Box>
      )}
    </Box>
  );
}
