// finext-nextjs/app/admin/watchlists/components/CreateWatchlistModal.tsx
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

interface CreateWatchlistModalProps {
    open: boolean;
    onClose: () => void;
    onWatchlistCreated: () => void;
}

const CreateWatchlistModal: React.FC<CreateWatchlistModalProps> = ({
    open,
    onClose,
    onWatchlistCreated
}) => {
    const handleCreate = () => {
        // TODO: Implement create watchlist functionality
        console.log('Create watchlist functionality will be implemented later');
        onWatchlistCreated();
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
                Tạo Watchlist Mới
            </DialogTitle>
            <DialogContent>
                <Typography variant="body1" color="text.secondary">
                    Chức năng tạo watchlist mới sẽ được triển khai sau...
                </Typography>
            </DialogContent>
            <DialogActions sx={{ p: 3, gap: 1 }}>
                <Button
                    onClick={onClose}
                    variant="outlined"
                >
                    Hủy
                </Button>
                <Button
                    onClick={handleCreate}
                    variant="contained"
                    color="primary"
                >
                    Tạo Watchlist
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default CreateWatchlistModal;
