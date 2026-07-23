'use client';

// Thanh phân trang danh mục dùng CHUNG cho /watchlist, /chart, /portfolio (đồng bộ UI):
// tabs kéo-thả sắp xếp + "+ Trang mới" + (tùy chọn) nút khóa/mở chỉnh sửa (readOnly) ở bên trái.
import { useMemo } from 'react';
import { Box, IconButton, Tooltip, useTheme } from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import LockOpenOutlinedIcon from '@mui/icons-material/LockOpenOutlined';
import { DndContext, PointerSensor, rectIntersection, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { borderRadius, getResponsiveFontSize, fontWeight } from 'theme/tokens';
import type { PageMapping } from './pageReorder';

function SortablePageTab({ page, isActive, isDark, onClick }: { page: number; isActive: boolean; isDark: boolean; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `page-${page}` });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <Box
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      sx={{
        px: 1, py: 0.25,
        borderRadius: `${borderRadius.sm}px`,
        cursor: 'pointer',
        fontSize: getResponsiveFontSize('xs'),
        fontWeight: isActive ? fontWeight.semibold : fontWeight.medium,
        color: isActive ? 'primary.main' : 'text.secondary',
        bgcolor: isActive ? (isDark ? 'rgba(99,102,241,0.14)' : 'rgba(99,102,241,0.08)') : 'transparent',
        border: `1px solid ${isActive ? 'rgba(99,102,241,0.4)' : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)')}`,
        transition: 'all 0.15s',
        userSelect: 'none',
        '&:hover': { color: 'primary.main', borderColor: 'rgba(99,102,241,0.4)' },
      }}
    >
      Trang {page}
    </Box>
  );
}

interface PageTabsProps {
  pages: number[];
  currentPage: number;
  onSelectPage: (p: number) => void;
  canAddPage: boolean; // bật nút "+ Trang mới" (chỉ khi trang hiện tại đã có WL — tránh trang rỗng liên tiếp)
  onReorderPages: (mapping: PageMapping[]) => void;
  readOnly?: boolean;
  onToggleReadOnly?: () => void; // có → hiện nút khóa/mở (dùng ở /watchlist, /chart); không → ẩn (dùng ở /portfolio)
  sx?: object;
}

export default function PageTabs({ pages, currentPage, onSelectPage, canAddPage, onReorderPages, readOnly, onToggleReadOnly, sx }: PageTabsProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  // useMemo BẮT BUỘC: /watchlist + /chart re-render mỗi nhịp SSE — mảng items mới sẽ reset SortableContext giữa lúc kéo.
  const sortableIds = useMemo(() => pages.map((p) => `page-${p}`), [pages]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sortableIds.indexOf(active.id as string);
    const newIndex = sortableIds.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(pages, oldIndex, newIndex);
    const mapping: PageMapping[] = [];
    reordered.forEach((oldPageNum, idx) => {
      const np = idx + 1;
      if (oldPageNum !== np) mapping.push({ old_page: oldPageNum, new_page: np });
    });
    onReorderPages(mapping);
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap', ...sx }}>
      {onToggleReadOnly && (
        <Tooltip title={readOnly ? 'Mở chỉnh sửa' : 'Khóa chỉnh sửa'}>
          <IconButton size="small" onClick={onToggleReadOnly} sx={{ color: readOnly ? 'primary.main' : 'text.disabled', p: 0.5 }}>
            {readOnly ? <LockOutlinedIcon sx={{ fontSize: 17 }} /> : <LockOpenOutlinedIcon sx={{ fontSize: 17 }} />}
          </IconButton>
        </Tooltip>
      )}
      <DndContext sensors={sensors} collisionDetection={rectIntersection} onDragEnd={handleDragEnd}>
        <SortableContext items={sortableIds} strategy={horizontalListSortingStrategy}>
          {pages.map((p) => (
            <SortablePageTab key={p} page={p} isActive={currentPage === p} isDark={isDark} onClick={() => onSelectPage(p)} />
          ))}
        </SortableContext>
      </DndContext>
      <Box
        onClick={() => { if (canAddPage) onSelectPage(Math.max(...pages) + 1); }}
        sx={{
          px: 1, py: 0.25,
          borderRadius: `${borderRadius.sm}px`,
          cursor: canAddPage ? 'pointer' : 'not-allowed',
          fontSize: getResponsiveFontSize('xs'),
          color: canAddPage ? 'text.disabled' : (isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'),
          border: `1px dashed ${canAddPage ? (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)') : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)')}`,
          transition: 'all 0.15s',
          userSelect: 'none',
          opacity: canAddPage ? 1 : 0.6,
          ...(canAddPage && { '&:hover': { color: 'text.secondary', borderColor: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)' } }),
        }}
      >
        + Trang mới
      </Box>
    </Box>
  );
}
