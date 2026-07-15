'use client';

import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from '@mui/material';
import { getResponsiveFontSize, fontWeight } from 'theme/tokens';

// 3 điểm NĐ 13/2023: dữ liệu dùng để trả lời · không tư vấn cá nhân hoá · AI có thể sai.
const POINTS = [
  'Dữ liệu bạn nhập chỉ dùng để trả lời câu hỏi của bạn trong cuộc trò chuyện này.',
  'Đây là thông tin tham khảo, không phải tư vấn đầu tư cá nhân hoá.',
  'AI có thể đưa ra thông tin chưa chính xác — hãy tự kiểm chứng số liệu quan trọng.'
];

// Non-dismissable: KHÔNG truyền onClose (chặn click backdrop) + disableEscapeKeyDown (chặn Esc).
export default function ConsentModal({ open, onAccept }: { open: boolean; onAccept: () => void }) {
  return (
    <Dialog open={open} disableEscapeKeyDown maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: fontWeight.bold }}>Trước khi bắt đầu</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ mt: 0.5 }}>
          {POINTS.map((p, i) => (
            <Stack key={i} direction="row" spacing={1.25} alignItems="flex-start">
              <Box sx={{ mt: '7px', width: 6, height: 6, borderRadius: '50%', bgcolor: 'primary.main', flexShrink: 0 }} />
              <Typography sx={{ fontSize: getResponsiveFontSize('sm'), color: 'text.secondary', lineHeight: 1.6 }}>{p}</Typography>
            </Stack>
          ))}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button variant="contained" fullWidth onClick={onAccept}>
          Tôi đồng ý
        </Button>
      </DialogActions>
    </Dialog>
  );
}
