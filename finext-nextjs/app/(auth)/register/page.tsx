import type { Metadata } from 'next';
import { Box } from '@mui/material';
import RegisterForm from '../components/RegisterForm';

export const metadata: Metadata = {
  title: 'Đăng ký',
};

export default function RegisterPage() {
    return (
        <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
            <RegisterForm />
        </Box>
    );
}