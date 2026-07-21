'use client';

import { Box } from '@mui/material';
import { GuideHero } from '../components/GuideLayoutBlocks';
import { spacing } from 'theme/tokens';
import PhaseGuide from './PhaseGuide';
import AiAssistantGuide from './AiAssistantGuide';
import MacroDataGuide from './MacroDataGuide';

export default function ToolsDataContent() {
  return (
    <Box sx={{ py: spacing.xs }}>
      <GuideHero
        icon="mdi:toolbox-outline"
        title="Công cụ và dữ liệu"
        subtitle="Ba tính năng giúp bạn nhìn xa hơn bảng giá: nhận biết giai đoạn thị trường để canh nhịp, hỏi đáp nhanh cùng Trợ lý Finext AI, và theo dõi dữ liệu vĩ mô, quốc tế cùng hàng hoá. Mở từng mục bên dưới để xem hướng dẫn kèm biểu đồ minh hoạ."
        highlights={[
          { icon: 'mdi:sine-wave', label: 'Giai đoạn thị trường' },
          { icon: 'mdi:robot-outline', label: 'Trợ lý Finext AI' },
          { icon: 'mdi:earth', label: 'Dữ liệu vĩ mô và quốc tế' },
        ]}
      />
      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
        <PhaseGuide />
        <AiAssistantGuide />
        <MacroDataGuide />
      </Box>
    </Box>
  );
}
