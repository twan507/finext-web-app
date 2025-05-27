// finext-nextjs/components/FeatureGuard.tsx
'use client';

import React from 'react';
import { useAuth } from 'components/AuthProvider';
import { Box, Tooltip, Typography } from '@mui/material'; // Thêm Tooltip và Typography

interface FeatureGuardProps {
  requires: string;
  children: React.ReactElement; // Bắt buộc children là một ReactElement để có thể clone
  dummyComponent?: React.ReactNode;
  hideWhenDisabled?: boolean; // Tùy chọn để ẩn hoàn toàn
  tooltipMessage?: string; // Tùy chọn để hiển thị tooltip khi disabled
}

const FeatureGuard: React.FC<FeatureGuardProps> = ({
  requires,
  children,
  dummyComponent,
  hideWhenDisabled = false,
  tooltipMessage = "Bạn không có quyền sử dụng tính năng này.",
}) => {
  const { hasFeature, loading } = useAuth();

  if (loading) {
    // Bạn có thể trả về một placeholder hoặc null khi đang loading
    return null;
  }

  const canAccess = hasFeature(requires);

  if (canAccess) {
    return children;
  }

  if (hideWhenDisabled) {
      return null;
  }

  if (dummyComponent) {
    return <>{dummyComponent}</>;
  }

  // Nếu không có dummyComponent, thử disable children và thêm tooltip
  // Chỉ hoạt động tốt nếu children là component chấp nhận prop 'disabled' (như Button)
  const isMuiComponent = React.isValidElement(children) && 
    children.type && 
    (
      (typeof children.type === 'function' && (children.type as any).muiName) ||
      (children.props && typeof children.props === 'object' && children.props !== null && 'disabled' in children.props)
    );

  if (isMuiComponent) {
      const disabledChild = React.cloneElement(
        children,
        { disabled: true } as Partial<React.ComponentProps<any>>
      );
      return (
          <Tooltip title={tooltipMessage}>
              <Box component="span" sx={{ cursor: 'not-allowed', display: 'inline-block' }}>
                  {disabledChild}
              </Box>
          </Tooltip>
      );
  }


  // Nếu không có quyền và không có dummy, hoặc không thể disable children -> không render gì cả
  return null;
};

export default FeatureGuard;