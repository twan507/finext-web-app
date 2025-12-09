// finext-nextjs/app/sse/page.tsx (Ví dụ đã tái cấu trúc)
'use client';

import React, { useEffect, useState, useRef } from 'react';
import {
    Box, Typography, Container, Paper, List, ListItem, ListItemText,
    CircularProgress, Alert, Chip, TextField, Button
} from '@mui/material';
import { ShowChart as ShowChartIcon, PlayArrow as PlayArrowIcon, Stop as StopIcon } from '@mui/icons-material';

// --- THÊM IMPORT ---
import { ISseConnection, ISseRequest, SseError } from 'services/core/types'; // Đường dẫn đến types
import { sseClient } from 'services/sseClient';

interface StreamedData {
    _id?: string;
    [key: string]: any;
}

const StockStreamPage: React.FC = () => {
    const [data, setData] = useState<StreamedData[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [collectionName, setCollectionName] = useState('today_index');
    const [filterName, setFilterName] = useState('only_spot');

    // --- THAY THẾ eventSourceRef BẰNG sseConnectionRef ---
    const sseConnectionRef = useRef<ISseConnection | null>(null);

    const startStreaming = () => {
        // --- Đóng kết nối cũ nếu có ---
        if (sseConnectionRef.current) {
            sseConnectionRef.current.close();
            sseConnectionRef.current = null;
        }

        setData([]);
        setError(null);

        if (!collectionName.trim()) {
            setError("Vui lòng nhập tên Collection.");
            return;
        }

        // --- Tạo ISseRequest ---
        const requestProps: ISseRequest = {
            url: `/api/v1/sse/stream/${collectionName.trim()}`,
            queryParams: filterName.trim() ? { filter_name: filterName.trim() } : {}
        };

        console.log(`Đang cố gắng kết nối đến SSE...`);

        // --- Gọi sseClient ---
        sseConnectionRef.current = sseClient<StreamedData[]>(requestProps, {
            onOpen: () => {
                console.log("Kết nối SSE đã mở!");
                setError(null);
                setIsConnected(true);
            },
            onData: (receivedData) => {
                // Server trả về mảng, nên ta set trực tiếp
                setData(Array.isArray(receivedData) ? receivedData : [receivedData]);
            },
            onError: (sseError: SseError) => {
                console.error("Lỗi SSE Client:", sseError);
                setError(`Lỗi SSE: ${sseError.message}`);
                setIsConnected(false);
                // Không cần đóng ở đây vì sseClient tự xử lý hoặc đã đóng
            },
            onClose: () => {
                console.log("Kết nối SSE đã đóng.");
                setIsConnected(false);
                sseConnectionRef.current = null; // Dọn dẹp ref
            }
        });
    };

    const stopStreaming = () => {
        // --- Gọi hàm close từ ISseConnection ---
        if (sseConnectionRef.current) {
            sseConnectionRef.current.close();
            // Callback onClose sẽ tự động set isConnected = false
        }
    };

    // --- useEffect để dọn dẹp khi unmount ---
    useEffect(() => {
        return () => {
            if (sseConnectionRef.current) {
                sseConnectionRef.current.close();
            }
        };
    }, []);

    // --- Phần JSX giữ nguyên (không cần thay đổi) ---
    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
            <Paper sx={{ p: 3, borderRadius: '12px' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                    <ShowChartIcon sx={{ mr: 1, color: 'primary.main' }} />
                    <Typography variant="h5" component="h1" sx={{ fontWeight: 'bold' }}>
                        SSE Stream (Bộ lọc đặt tên)
                    </Typography>
                    <Chip
                        label={isConnected ? "Đã kết nối" : "Đã ngắt"}
                        color={isConnected ? "success" : "error"}
                        size="small"
                        sx={{ ml: 2 }}
                    />
                </Box>

                <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2, mb: 3, alignItems: { md: 'flex-end' } }}>
                    <TextField
                        label="Tên Collection"
                        value={collectionName}
                        onChange={(e) => setCollectionName(e.target.value)}
                        variant="outlined"
                        size="small"
                        disabled={isConnected}
                        fullWidth
                        sx={{ flexGrow: 1.5 }}
                    />

                    <TextField
                        label="Tên Bộ Lọc (ví dụ: only_spot)"
                        value={filterName}
                        onChange={(e) => setFilterName(e.target.value)}
                        variant="outlined"
                        size="small"
                        disabled={isConnected}
                        fullWidth
                        sx={{ flexGrow: 1.5 }}
                    />

                    <Box sx={{ display: 'flex', gap: 1, flexDirection: { xs: 'row', md: 'column' }, minWidth: { xs: '100%', md: '120px' }, flexGrow: 1 }}>
                        <Button
                            variant="contained"
                            onClick={startStreaming}
                            disabled={isConnected}
                            startIcon={<PlayArrowIcon />}
                            fullWidth
                        >
                            Bắt đầu
                        </Button>
                        <Button
                            variant="outlined"
                            color="error"
                            onClick={stopStreaming}
                            disabled={!isConnected}
                            startIcon={<StopIcon />}
                            fullWidth
                        >
                            Dừng
                        </Button>
                    </Box>
                </Box>

                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

                <Typography variant="h6" sx={{ mb: 1 }}>Dữ liệu nhận được (tối đa 20 bản ghi mới nhất):</Typography>
                <Paper variant="outlined" sx={{ p: 2, minHeight: 300, maxHeight: 500, overflowY: 'auto', bgcolor: 'background.default' }}>
                    {isConnected && data.length === 0 && !error && (
                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 5 }}>
                            <CircularProgress sx={{ mr: 2 }} />
                            <Typography color="text.secondary">Đang chờ dữ liệu...</Typography>
                        </Box>
                    )}
                    {!isConnected && data.length === 0 && !error && (
                        <Typography color="text.secondary">Nhập Collection/Filter và nhấn "Bắt đầu".</Typography>
                    )}
                    <List dense>
                        {data.map((item, index) => (
                            <ListItem key={item._id || index} divider>
                                <ListItemText
                                    primary={
                                        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                                            {JSON.stringify(item, null, 2)}
                                        </pre>
                                    }
                                />
                            </ListItem>
                        ))}
                    </List>
                </Paper>
            </Paper>
        </Container>
    );
};

export default StockStreamPage;