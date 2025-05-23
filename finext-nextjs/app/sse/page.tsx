// finext-nextjs/app/stock-stream/page.tsx
'use client';

import React, { useEffect, useState, useRef } from 'react';
import {
  Box, Typography, Container, Paper, List, ListItem, ListItemText,
  CircularProgress, Alert, Chip, TextField, Button
  // Bỏ Autocomplete, MenuItem, Select, FormControl, InputLabel nếu không dùng đến nữa
} from '@mui/material';
// import Grid from '@mui/material/Unstable_Grid2'; // Nếu bạn đã dùng Grid2
import { ShowChart as ShowChartIcon, PlayArrow as PlayArrowIcon, Stop as StopIcon } from '@mui/icons-material';

interface StreamedData {
  _id?: string;
  [key: string]: any;
}

// Bỏ availableFilters vì chúng ta sẽ nhập tự do

const StockStreamPage: React.FC = () => {
  const [data, setData] = useState<StreamedData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [collectionName, setCollectionName] = useState('eod_index'); // Mặc định
  const [filterName, setFilterName] = useState('only_spot'); // Mặc định cho eod_index

  const eventSourceRef = useRef<EventSource | null>(null);

  const startStreaming = () => {
      if (eventSourceRef.current) {
          eventSourceRef.current.close();
      }
      setData([]);
      setError(null);

      const baseUrl = process.env.NEXT_PUBLIC_FASTAPI_BASE_URL;
      if (!baseUrl) {
          setError("Chưa cấu hình NEXT_PUBLIC_FASTAPI_BASE_URL trong .env");
          return;
      }
      if (!collectionName.trim()) {
          setError("Vui lòng nhập tên Collection.");
          return;
      }

      let sseUrl = `${baseUrl}/sse/stream/${collectionName.trim()}`;
      const queryParams = new URLSearchParams();

      if (filterName.trim()) { // Chỉ thêm nếu filterName có giá trị
          queryParams.append('filter_name', filterName.trim());
      }

      if (queryParams.toString()) {
        sseUrl += `?${queryParams.toString()}`;
      }

      console.log(`Đang cố gắng kết nối đến SSE tại: ${sseUrl}`);
      const es = new EventSource(sseUrl);
      eventSourceRef.current = es;

      es.onopen = () => {
          console.log("Kết nối SSE đã mở!");
          setError(null);
          setIsConnected(true);
      };

      es.onmessage = (event) => {
          try {
              const eventData = JSON.parse(event.data);
              if (eventData.error) {
                   setError(`Lỗi từ Server: ${eventData.error}`);
                   if (eventSourceRef.current) eventSourceRef.current.close();
                   setIsConnected(false);
              } else {
                  setData(Array.isArray(eventData) ? eventData : [eventData]);
              }
          } catch (e) {
               console.error("Lỗi parse dữ liệu SSE:", event.data, e);
               setError("Lỗi xử lý dữ liệu nhận được.");
          }
      };

      es.onerror = (err) => {
          console.error("Lỗi EventSource:", err);
          setError("Kết nối SSE bị lỗi hoặc bị đóng.");
          setIsConnected(false);
          if (eventSourceRef.current) eventSourceRef.current.close();
      };
  };

  const stopStreaming = () => {
      if (eventSourceRef.current) {
          eventSourceRef.current.close();
          setIsConnected(false);
          console.log("Đã ngắt kết nối thủ công.");
      }
  };

  useEffect(() => {
      return () => {
          if (eventSourceRef.current) {
              eventSourceRef.current.close();
          }
      };
  }, []);

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

        {/* --- SỬA ĐỔI CÁC Ô INPUT --- */}
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2, mb: 3, alignItems: {md: 'flex-end'} }}>
            <TextField
                label="Tên Collection"
                value={collectionName}
                onChange={(e) => setCollectionName(e.target.value)}
                variant="outlined"
                size="small"
                disabled={isConnected}
                fullWidth // Thêm fullWidth để nó chiếm không gian
                sx={{ flexGrow: 1.5 }} // Điều chỉnh flexGrow nếu cần
            />

            <TextField
                label="Tên Bộ Lọc (ví dụ: only_spot)"
                value={filterName}
                onChange={(e) => setFilterName(e.target.value)}
                variant="outlined"
                size="small"
                disabled={isConnected}
                fullWidth // Thêm fullWidth
                sx={{ flexGrow: 1.5 }} // Điều chỉnh flexGrow nếu cần
            />
            
             <Box sx={{ display: 'flex', gap: 1, flexDirection: {xs: 'row', md: 'column'}, minWidth: {xs: '100%', md: '120px'} , flexGrow:1}}>
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
        {/* --- KẾT THÚC SỬA ĐỔI --- */}


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