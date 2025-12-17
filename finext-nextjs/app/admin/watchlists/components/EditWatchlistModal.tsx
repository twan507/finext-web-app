// finext-nextjs/app/admin/watchlists/components/EditWatchlistModal.tsx
'use client';

import React from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Typography
} from '@mui/material';
import { WatchlistPublicAdmin } from '../PageContent';

interface EditWatchlistModalProps {
    open: boolean;
    onClose: () => void;
    onWatchlistUpdated: () => void;
    watchlist: WatchlistPublicAdmin | null;
}

const EditWatchlistModal: React.FC<EditWatchlistModalProps> = ({
    open,
    onClose,
    onWatchlistUpdated,
    watchlist
}) => {
    const handleUpdate = () => {
        // TODO: Implement update watchlist functionality
        console.log('Update watchlist functionality will be implemented later', watchlist);
        onWatchlistUpdated();
        onClose();
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="md"
            fullWidth
        >
            <DialogTitle>
                Chỉnh sửa Watchlist: {watchlist?.name}
            </DialogTitle>
            <DialogContent>
                <Typography variant="body1" color="text.secondary">
                    Chức năng chỉnh sửa watchlist sẽ được triển khai sau...
                </Typography>
                {watchlist && (
                    <Typography variant="body2" sx={{ mt: 2 }}>
                        ID: {watchlist.id}<br />
                        Tên: {watchlist.name}<br />
                        Người dùng: {watchlist.user_email || watchlist.user_id}<br />
                        Số mã CK: {watchlist.stock_symbols.length}
                    </Typography>
                )}
            </DialogContent>
            <DialogActions sx={{ p: 3, gap: 1 }}>
                <Button
                    onClick={onClose}
                    variant="outlined"
                >
                    Hủy
                </Button>
                <Button
                    onClick={handleUpdate}
                    variant="contained"
                    color="primary"
                >
                    Cập nhật
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default EditWatchlistModal;
