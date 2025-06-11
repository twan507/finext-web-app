// finext-nextjs/app/(dashboard)/page.tsx
'use client';

import React from 'react';
import {
  Box, Typography, Paper, Grid, Link as MuiLink, Avatar, List, ListItem, ListItemAvatar, ListItemText,
  ToggleButton, ToggleButtonGroup, useTheme
} from '@mui/material';
import {
  LocalAtm as RevenueIcon,
  PeopleOutline as AccountsIcon,
  ShoppingCartOutlined as OrdersIcon,
  TrendingUp as ConversionIcon,
  AddShoppingCart as NewOrderIcon,
  PersonAddAlt1Outlined as NewUserIcon,
  MailOutline as SupportTicketIcon,
  ReceiptLongOutlined as InvoicePaidIcon,
} from '@mui/icons-material';

// Dummy Data (Giữ nguyên)
const kpiData = [
  { title: "Total Revenue", value: "$24,780", change: "+12.5%", changeColorKey: "success.main", icon: <RevenueIcon /> },
  { title: "Total Accounts", value: "1,842", change: "+8.2%", changeColorKey: "success.main", icon: <AccountsIcon /> },
  { title: "New Orders", value: "327", change: "+3.1%", changeColorKey: "success.main", icon: <OrdersIcon /> },
  { title: "Conversion Rate", value: "3.6%", change: "-0.8%", changeColorKey: "error.main", icon: <ConversionIcon /> },
];

const recentActivityData = [
  { icon: <NewUserIcon />, text: "<strong>John Smith</strong> created a new account", time: "2 hours ago" },
  { icon: <NewOrderIcon />, text: "New order <strong>#ORD-4829</strong> was placed", time: "4 hours ago" },
  { icon: <SupportTicketIcon />, text: "<strong>Sarah Johnson</strong> sent a support ticket", time: "1 day ago" },
  { icon: <InvoicePaidIcon />, text: "Invoice <strong>#INV-2948</strong> was paid", time: "2 days ago" },
];

const DashboardHomePage: React.FC = () => {
  const theme = useTheme();
  const [revenueChartPeriod, setRevenueChartPeriod] = React.useState('Monthly');
  const [userGrowthChartPeriod, setUserGrowthChartPeriod] = React.useState('Monthly');

  const handleChartPeriodChange = (
    event: React.MouseEvent<HTMLElement>,
    newPeriod: string | null,
    setter: React.Dispatch<React.SetStateAction<string>>
  ) => {
    if (newPeriod !== null) {
      setter(newPeriod);
    }
  };

  // Style chung cho các card
  const cardHoverStyles = {
    transition: theme.transitions.create(['transform', 'box-shadow'], {
      duration: theme.transitions.duration.short, // 'all 0.2s ease'
    }),
    '&:hover': {
      transform: 'translateY(-2px)',
      boxShadow: theme.shadows[3], // Tăng nhẹ shadow khi hover
    },
  };

  return (
    <Box>
      {/* Page Header */}
      <Box sx={{ mb: theme.spacing(3) }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 600, mb: 0.5, color: 'text.primary' }}>
          Dashboard Overview
        </Typography>
      </Box>

      {/* KPI Cards */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}> {/* Tăng spacing một chút giữa các thẻ */}
        {kpiData.map((kpi, index) => (
          <Grid size={{ xs: 12, sm: 6, md: 3 }} key={index}>
            <Paper
              variant="outlined"
              sx={{
                p: 2.5,
                borderRadius: theme.shape.borderRadius, // Sử dụng theme.shape.borderRadius
                borderColor: theme.palette.divider,
                height: '100%', // Đảm bảo các card có chiều cao bằng nhau nếu cần
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                ...cardHoverStyles, // Áp dụng hiệu ứng hover
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                <Box>
                  <Typography sx={{ color: 'text.secondary', fontSize: '0.875rem', fontWeight: 500 }}>
                    {kpi.title}
                  </Typography>
                  <Typography variant="h5" component="h3" sx={{ fontWeight: 700, mt: 0.5, color: 'text.primary' }}>
                    {kpi.value}
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: theme.palette.mode === 'light' ? theme.palette.grey[100] : theme.palette.grey[800], color: 'text.secondary' }}>
                  {kpi.icon}
                </Avatar>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Typography sx={{ color: kpi.changeColorKey, fontSize: '0.875rem', fontWeight: 500 }}>
                  {kpi.change}
                </Typography>
                <Typography sx={{ color: 'text.disabled', fontSize: '0.75rem', ml: 1 }}>
                  vs last month
                </Typography>
              </Box>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* Charts Section - Sửa layout thành 2 cột */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        {/* Revenue Chart Card */}
        <Grid size={{ xs: 12, lg: 6 }}> {/* lg={6} để chiếm 50% trên màn hình lớn */}
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: theme.shape.borderRadius, borderColor: theme.palette.divider, ...cardHoverStyles }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" component="h3" sx={{ fontWeight: 600, color: 'text.primary' }}>
                Revenue Overview
              </Typography>
              <ToggleButtonGroup
                value={revenueChartPeriod}
                exclusive
                onChange={(event, newPeriod) => handleChartPeriodChange(event, newPeriod, setRevenueChartPeriod)}
                aria-label="Revenue chart period"
                size="small"
              >
                {['Monthly', 'Quarterly', 'Yearly'].map((period) => (
                  <ToggleButton
                    key={period}
                    value={period}
                    aria-label={period}
                    sx={{
                      borderRadius: '20px !important', // Ghi đè border-radius của ToggleButton
                      px: 1.5, py: 0.5, fontSize: '0.75rem',
                      border: 'none',
                      textTransform: 'none',
                      color: 'text.secondary',
                      '&.Mui-selected': {
                        bgcolor: theme.palette.action.selected, // Sử dụng màu action.selected của theme
                        color: 'text.primary',
                        fontWeight: 500,
                        '&:hover': {
                          bgcolor: theme.palette.action.hover, //
                        }
                      },
                      '&:hover': {
                        bgcolor: theme.palette.action.hover,
                      }
                    }}
                  >
                    {period}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Box>
            <Box sx={{
              height: 300, width: '100%',
              bgcolor: theme.palette.mode === 'light' ? theme.palette.grey[50] : theme.palette.grey[800], // Phù hợp với theme
              borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'text.disabled'
            }}>
              Revenue chart would appear here
            </Box>
          </Paper>
        </Grid>

        {/* User Growth Chart Card */}
        <Grid size={{ xs: 12, lg: 6 }}> {/* lg={6} để chiếm 50% trên màn hình lớn */}
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: theme.shape.borderRadius, borderColor: theme.palette.divider, ...cardHoverStyles }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" component="h3" sx={{ fontWeight: 600, color: 'text.primary' }}>
                User Growth
              </Typography>
              <ToggleButtonGroup
                value={userGrowthChartPeriod}
                exclusive
                onChange={(event, newPeriod) => handleChartPeriodChange(event, newPeriod, setUserGrowthChartPeriod)}
                aria-label="User growth chart period"
                size="small"
              >
                {['Monthly', 'Quarterly', 'Yearly'].map((period) => (
                  <ToggleButton
                    key={period}
                    value={period}
                    aria-label={period}
                    sx={{
                      borderRadius: '20px !important',
                      px: 1.5, py: 0.5, fontSize: '0.75rem',
                      border: 'none',
                      textTransform: 'none',
                      color: 'text.secondary',
                      '&.Mui-selected': {
                        bgcolor: theme.palette.action.selected,
                        color: 'text.primary',
                        fontWeight: 500,
                        '&:hover': {
                          bgcolor: theme.palette.action.hover,
                        }
                      },
                      '&:hover': {
                        bgcolor: theme.palette.action.hover,
                      }
                    }}
                  >
                    {period}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Box>
            <Box sx={{
              height: 300, width: '100%',
              bgcolor: theme.palette.mode === 'light' ? theme.palette.grey[50] : theme.palette.grey[800],
              borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'text.disabled'
            }}>
              User growth chart would appear here
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default DashboardHomePage;