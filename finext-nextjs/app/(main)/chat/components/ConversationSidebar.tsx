'use client';

import { useState } from 'react';
import type { KeyboardEvent, MouseEvent } from 'react';
import { Box, IconButton, Menu, MenuItem, Skeleton, SvgIcon, TextField, Typography, alpha, useTheme } from '@mui/material';
import type { SvgIconProps } from '@mui/material';
import {
  AddCommentOutlined,
  ChevronLeftOutlined,
  ChevronRightOutlined,
  DeleteOutlineOutlined,
  DriveFileRenameOutline,
  MoreHoriz,
} from '@mui/icons-material';
import { getResponsiveFontSize, fontWeight, borderRadius, transitions, getGlassCard } from 'theme/tokens';
import type { Conversation } from '../../../../hooks/useChatStore';

interface ConversationSidebarProps {
  conversations: Conversation[];
  activeId: string;
  collapsed: boolean;
  loading?: boolean;
  onNew: () => void;
  onSelect: (id: string) => void;
  onToggle: () => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string) => void;
  onRename: (id: string, title: string) => void;
}

// Ghim NGHIÊNG sẵn kiểu ChatGPT (MUI không có pin nghiêng) — pin thin-stroke (Lucide), vẽ nghiêng trong SVG.
const TILT = 'rotate(38 12 12)';
const STROKE_SX = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

function PinTiltIcon(props: SvgIconProps) {
  return (
    <SvgIcon viewBox="0 0 24 24" {...props} sx={{ ...STROKE_SX, ...props.sx }}>
      <g transform={TILT}>
        <path d="M12 17v5" />
        <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />
      </g>
    </SvgIcon>
  );
}

// Bỏ ghim = pin nghiêng + gạch chéo (kiểu ChatGPT pin-off).
function PinTiltOffIcon(props: SvgIconProps) {
  return (
    <SvgIcon viewBox="0 0 24 24" {...props} sx={{ ...STROKE_SX, ...props.sx }}>
      <g transform={TILT}>
        <path d="M12 17v5" />
        <path d="M15 9.34V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H7.89" />
        <path d="M9 9v1.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h11" />
      </g>
      <path d="m3 3 18 18" />
    </SvgIcon>
  );
}

export default function ConversationSidebar({ conversations, activeId, collapsed, loading, onNew, onSelect, onToggle, onDelete, onTogglePin, onRename }: ConversationSidebarProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  // Glass card CHUẨN dự án (theme/tokens getGlassCard) — dùng chung cho panel + menu.
  const glass = getGlassCard(isDark);
  const glassFill = { background: glass.background, backdropFilter: glass.backdropFilter, WebkitBackdropFilter: glass.WebkitBackdropFilter };

  // Menu "⋯" (Đổi tên / Xoá) + đổi tên inline.
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const openMenu = (e: MouseEvent<HTMLElement>, id: string) => {
    e.stopPropagation();
    setMenuAnchor(e.currentTarget);
    setMenuId(id);
  };
  const closeMenu = () => {
    setMenuAnchor(null);
    setMenuId(null);
  };
  const startRename = () => {
    const c = conversations.find((x) => x.id === menuId);
    if (c) {
      setRenamingId(c.id);
      setDraft(c.title);
    }
    closeMenu();
  };
  const commitRename = (id: string) => {
    const t = draft.trim();
    if (t) onRename(id, t);
    setRenamingId(null);
    setDraft('');
  };
  const onRenameKey = (e: KeyboardEvent<HTMLInputElement>, id: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitRename(id);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setRenamingId(null);
      setDraft('');
    }
  };

  if (collapsed) {
    return (
      <Box
        sx={{
          width: 52,
          flexShrink: 0,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 1,
          py: 1.5,
          borderRight: `1px solid ${theme.palette.divider}`,
          ...glassFill
        }}
      >
        <IconButton size="small" onClick={onToggle} aria-label="Mở panel lịch sử">
          <ChevronRightOutlined fontSize="small" />
        </IconButton>
        <IconButton size="small" onClick={onNew} aria-label="Cuộc trò chuyện mới">
          <AddCommentOutlined fontSize="small" />
        </IconButton>
      </Box>
    );
  }

  // CHỈ hiện hội thoại đã lưu (serverId != null) — chat mới chưa gửi gì thì ẩn (owner: chưa nói gì thì đừng hiện).
  // Chỉ 2 nhóm: "Đã ghim" ở ĐẦU + "Gần đây" (mọi hội thoại chưa ghim). Giữ thứ tự newest-first từ store.
  const visible = conversations.filter((c) => c.serverId);
  const pinnedItems = visible.filter((c) => c.pinned);
  const unpinned = visible.filter((c) => !c.pinned);
  const groups: { label: string; items: Conversation[] }[] = [
    ...(pinnedItems.length ? [{ label: 'Đã ghim', items: pinnedItems }] : []),
    ...(unpinned.length ? [{ label: 'Gần đây', items: unpinned }] : []),
  ];

  return (
    <Box
      sx={{
        width: 272,
        flexShrink: 0,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRight: `1px solid ${theme.palette.divider}`,
        ...glassFill
      }}
    >
      <Box sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box
          component="button"
          onClick={onNew}
          sx={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            cursor: 'pointer',
            font: 'inherit',
            px: 1.5,
            py: 1,
            borderRadius: `${borderRadius.md}px`,
            border: `1px solid ${theme.palette.divider}`,
            bgcolor: 'transparent',
            color: 'text.primary',
            fontSize: getResponsiveFontSize('sm'),
            fontWeight: fontWeight.medium,
            transition: transitions.colors,
            '&:hover': { borderColor: alpha(theme.palette.primary.main, 0.5), color: 'primary.main' }
          }}
        >
          <AddCommentOutlined sx={{ fontSize: 18 }} />
          Cuộc trò chuyện mới
        </Box>
        <IconButton size="small" onClick={onToggle} aria-label="Thu gọn panel">
          <ChevronLeftOutlined fontSize="small" />
        </IconButton>
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: 1, pb: 1 }}>
        {groups.map((g) => (
          <Box key={g.label} sx={{ mb: 1 }}>
            <Typography sx={{ px: 1, py: 0.75, fontSize: '11px', fontWeight: fontWeight.semibold, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'text.secondary' }}>
              {g.label}
            </Typography>
            {g.items.map((c) => {
              const active = c.id === activeId;
              const menuOpen = menuId === c.id;
              if (renamingId === c.id) {
                return (
                  <Box key={c.id} sx={{ px: 1.25, py: 0.4, mb: 0.25 }}>
                    <TextField
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => onRenameKey(e as KeyboardEvent<HTMLInputElement>, c.id)}
                      onBlur={() => commitRename(c.id)}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                      fullWidth
                      variant="standard"
                      InputProps={{ disableUnderline: false, sx: { fontSize: getResponsiveFontSize('sm') } }}
                    />
                  </Box>
                );
              }
              return (
                <Box
                  key={c.id}
                  onClick={() => onSelect(c.id)}
                  title={c.title}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.25,
                    px: 1.25,
                    py: 0.85,
                    mb: 0.25,
                    borderRadius: `${borderRadius.sm}px`,
                    cursor: 'pointer',
                    color: active ? 'text.primary' : 'text.secondary',
                    bgcolor: active ? alpha(theme.palette.primary.main, 0.14) : 'transparent',
                    transition: transitions.colors,
                    '&:hover': { bgcolor: active ? alpha(theme.palette.primary.main, 0.14) : alpha(theme.palette.text.primary, 0.04) },
                    '&:hover .conv-act': { opacity: 1 }
                  }}
                >
                  <Box sx={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: getResponsiveFontSize('sm') }}>
                    {c.title}
                  </Box>
                  {/* Ghim/Bỏ ghim nhanh — hiện khi hover, KHÔNG tô màu (owner) */}
                  <IconButton
                    className="conv-act"
                    size="small"
                    aria-label={c.pinned ? 'Bỏ ghim' : 'Ghim hội thoại'}
                    onClick={(e) => {
                      e.stopPropagation();
                      onTogglePin(c.id);
                    }}
                    sx={{ flexShrink: 0, p: 0.25, color: 'text.secondary', opacity: 0, transition: transitions.colors, '&:hover': { color: 'text.primary' } }}
                  >
                    {c.pinned ? <PinTiltOffIcon sx={{ fontSize: 16 }} /> : <PinTiltIcon sx={{ fontSize: 16 }} />}
                  </IconButton>
                  {/* Nút ⋯ → menu Đổi tên / Xoá */}
                  <IconButton
                    className="conv-act"
                    size="small"
                    aria-label="Tùy chọn hội thoại"
                    onClick={(e) => openMenu(e, c.id)}
                    sx={{ flexShrink: 0, p: 0.25, color: 'text.secondary', opacity: menuOpen ? 1 : 0, transition: transitions.colors, '&:hover': { color: 'text.primary' } }}
                  >
                    <MoreHoriz sx={{ fontSize: 18 }} />
                  </IconButton>
                </Box>
              );
            })}
          </Box>
        ))}

        {loading && (
          <Box sx={{ px: 1, pt: 0.5 }}>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} variant="rounded" height={30} sx={{ mb: 0.75, borderRadius: `${borderRadius.sm}px` }} />
            ))}
          </Box>
        )}
      </Box>

      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={closeMenu}
        onClick={(e) => e.stopPropagation()}
        slotProps={{
          paper: {
            elevation: 0,
            sx: {
              ...glass, // glass card CHUẨN dự án (viền mảnh, blur 50, shadow mềm)
              mt: 0.5,
              minWidth: 156,
              borderRadius: 3,
              '& .MuiList-root': { py: 0.5 }
            }
          }
        }}
      >
        <MenuItem onClick={startRename} sx={{ fontSize: getResponsiveFontSize('sm'), gap: 1, py: 0.6, px: 1.5, mx: 0.5, borderRadius: 1.5 }}>
          <DriveFileRenameOutline sx={{ fontSize: 17 }} /> Đổi tên
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (menuId) onDelete(menuId);
            closeMenu();
          }}
          sx={{ fontSize: getResponsiveFontSize('sm'), gap: 1, py: 0.6, px: 1.5, mx: 0.5, borderRadius: 1.5, color: 'error.main' }}
        >
          <DeleteOutlineOutlined sx={{ fontSize: 17 }} /> Xoá
        </MenuItem>
      </Menu>
    </Box>
  );
}
