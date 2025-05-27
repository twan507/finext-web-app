// finext-nextjs/app/(dashboard)/page.tsx
'use client';

import React from 'react';
// Sử dụng import Grid cụ thể hơn để đảm bảo
import Grid from '@mui/material/Grid';
import { Box, Typography, Container, Paper, Link as MuiLink, Button } from '@mui/material'; // THÊM Button
import { Home as HomeIcon, ShowChart as ShowChartIcon, People as PeopleIcon, VpnKey as VpnKeyIcon, Security as SecurityIcon, CloudUpload as CloudUploadIcon } from '@mui/icons-material'; // THÊM CloudUploadIcon
import Breadcrumbs from '@mui/material/Breadcrumbs';
import FeatureGuard from 'components/FeatureGuard'; // THÊM IMPORT

const DashboardHomePage: React.FC = () => {
  return (
    <Container maxWidth={false} sx={{ p: '0 !important' }}>
      <Box sx={{ mb: 3 }}>
        <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 2 }}>
          <MuiLink underline="hover" color="inherit" href="/" sx={{ display: 'flex', alignItems: 'center' }}>
            <HomeIcon sx={{ mr: 0.5 }} fontSize="inherit" />
            Dashboard
          </MuiLink>
          <Typography color="text.primary">Overview</Typography>
        </Breadcrumbs>
        <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1 }}>
          Dashboard Overview
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Welcome to the Finext Admin Dashboard. Here's a quick overview of your application.
        </Typography>
      </Box>

      <Grid container spacing={3}> {/* Grid container */}
        {/* Dummy Card 1 */}
        <Grid size={{ xs: 12, md: 6, lg: 3 }}>
          <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', height: 180, borderRadius: '12px' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <PeopleIcon color="primary" sx={{ mr: 1 }} />
              <Typography variant="h6" component="h2">
                Total Users
              </Typography>
            </Box>
            <Typography component="p" variant="h4">
              1,234
            </Typography>
            <Typography color="text.secondary" sx={{ flexGrow: 1 }}>
              Active users in the system.
            </Typography>
            <MuiLink href="/users" color="primary">
              View Users
            </MuiLink>
          </Paper>
        </Grid>

        {/* Dummy Card 2 - BẢO VỆ BẰNG FEATURE GUARD */}
        <Grid size={{ xs: 12, md: 6, lg: 3 }}>
          <FeatureGuard requires="view_advanced_chart">
            <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', height: 180, borderRadius: '12px' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <ShowChartIcon color="secondary" sx={{ mr: 1 }} />
                  <Typography variant="h6" component="h2">
                    Advanced Sales
                  </Typography>
                </Box>
                <Typography component="p" variant="h4">
                  $5,678
                </Typography>
                <Typography color="text.secondary" sx={{ flexGrow: 1 }}>
                  Advanced revenue data.
                </Typography>
                <MuiLink href="#" color="secondary">
                  View Advanced Reports
                </MuiLink>
            </Paper>
          </FeatureGuard>
           {/* Bạn có thể thêm dummyComponent hoặc để nó ẩn nếu không có quyền */}
        </Grid>

        {/* Dummy Card 3 */}
        <Grid size={{ xs: 12, md: 6, lg: 3 }}>
          <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', height: 180, borderRadius: '12px' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <VpnKeyIcon sx={{ mr: 1, color: 'success.main' }} />
              <Typography variant="h6" component="h2">
                Active Roles
              </Typography>
            </Box>
            <Typography component="p" variant="h4">
              5
            </Typography>
            <Typography color="text.secondary" sx={{ flexGrow: 1 }}>
              Configured user roles.
            </Typography>
            <MuiLink href="/roles" sx={{ color: 'success.main' }}>
              Manage Roles
            </MuiLink>
          </Paper>
        </Grid>

        {/* Dummy Card 4 */}
        <Grid size={{ xs: 12, md: 6, lg: 3 }}>
          <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', height: 180, borderRadius: '12px' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <SecurityIcon sx={{ mr: 1, color: 'warning.main' }} />
              <Typography variant="h6" component="h2">
                Permissions
              </Typography>
            </Box>
            <Typography component="p" variant="h4">
              25
            </Typography>
            <Typography color="text.secondary" sx={{ flexGrow: 1 }}>
              Defined system permissions.
            </Typography>
            <MuiLink href="/permissions" sx={{ color: 'warning.main' }}>
              View Permissions
            </MuiLink>
          </Paper>
        </Grid>
      </Grid>

      <Paper sx={{ mt: 3, p: 3, borderRadius: '12px' }}>
        <Typography variant="h5" gutterBottom>
          Recent Activity
        </Typography>
        <Typography>
          - User 'john.doe@example.com' logged in.
        </Typography>
        <Typography>
          - New role 'Editor' was created.
        </Typography>
        <Typography>
          - System maintenance scheduled for tomorrow.
        </Typography>
         {/* THÊM NÚT ĐƯỢC BẢO VỆ */}
        <Box sx={{ mt: 2 }}>
            <FeatureGuard requires="export_data">
                <Button variant="contained" startIcon={<CloudUploadIcon />}>
                    Export All Data
                </Button>
            </FeatureGuard>
            {/* Thêm một nút khác, nhưng hiển thị disabled nếu không có quyền */}
             <FeatureGuard
                requires="api_access"
                tooltipMessage="Nâng cấp lên gói Premium để truy cập API"
             >
                <Button variant="outlined" sx={{ ml: 2 }}>
                    Access API Docs
                </Button>
            </FeatureGuard>
        </Box>
      </Paper>
    </Container>
  );
};

export default DashboardHomePage;