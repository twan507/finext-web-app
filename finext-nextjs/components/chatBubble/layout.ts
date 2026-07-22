import { layoutTokens } from 'theme/tokens';
import { MOBILE_BAR_HEIGHT } from '@/components/layout/mobileBarStore';

// Toạ độ dùng chung cho nút tròn, cửa sổ chat và bong bóng mời chat.
// Tất cả nằm GÓC PHẢI DƯỚI.
//
// Trên mobile phải cao hơn thanh điều hướng đáy để không bị che — nhưng thanh đó TỰ ẨN
// khi cuộn xuống và không render trên /chat. Vì vậy khoảng chừa là ĐỘNG: các hàm dưới
// nhận `barOffset` (MOBILE_BAR_HEIGHT khi thanh đang hiện, 0 khi đã thụt/không có) để
// bong bóng trồi thụt cùng nhịp với thanh thay vì treo lơ lửng.
const GAP = 12;

export const FAB_SIZE = 56;

// Khớp transition của MobileBottomBar (0.35s cùng easing) để hai thứ đi cùng nhau.
export const BAR_SYNC_TRANSITION = 'bottom 350ms cubic-bezier(0.4, 0, 0.2, 1)';

export const fabPosition = (barOffset: number) =>
  ({
    right: { xs: '12px', sm: '24px' },
    bottom: { xs: `${barOffset + GAP}px`, sm: '24px' },
  }) as const;

export const panelPosition = (barOffset: number) =>
  ({
    left: { xs: '8px', sm: 'auto' },
    right: { xs: '8px', sm: '24px' },
    top: { xs: `${layoutTokens.appBarHeight + 8}px`, sm: 'auto' },
    bottom: { xs: `${barOffset + 8}px`, sm: '24px' },
  }) as const;

// Mọc lên ngay phía trên nút tròn, thẳng hàng mép phải với nút.
export const teaserPosition = (barOffset: number) =>
  ({
    right: { xs: '12px', sm: '24px' },
    bottom: { xs: `${barOffset + GAP + FAB_SIZE + GAP}px`, sm: `${24 + FAB_SIZE + GAP}px` },
  }) as const;
