import { layoutTokens } from 'theme/tokens';

// Toạ độ dùng chung cho nút tròn, cửa sổ chat và bong bóng mời chat.
// Tất cả nằm GÓC PHẢI DƯỚI. Trên mobile phải cao hơn thanh điều hướng đáy
// (BAR_HEIGHT = 56 trong MobileBottomBar) để không bị che.
const MOBILE_BAR = 56;
const GAP = 12;

export const FAB_SIZE = 56;

export const fabPosition = {
  right: { xs: '12px', sm: '24px' },
  bottom: { xs: `${MOBILE_BAR + GAP}px`, sm: '24px' },
} as const;

export const panelPosition = {
  left: { xs: '8px', sm: 'auto' },
  right: { xs: '8px', sm: '24px' },
  top: { xs: `${layoutTokens.appBarHeight + 8}px`, sm: 'auto' },
  bottom: { xs: `${MOBILE_BAR + 8}px`, sm: '24px' },
} as const;

// Mọc lên ngay phía trên nút tròn, thẳng hàng mép phải với nút.
export const teaserPosition = {
  right: { xs: '12px', sm: '24px' },
  bottom: { xs: `${MOBILE_BAR + GAP + FAB_SIZE + GAP}px`, sm: `${24 + FAB_SIZE + GAP}px` },
} as const;
