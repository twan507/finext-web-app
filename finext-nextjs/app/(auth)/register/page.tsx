import type { Metadata } from 'next';
import { Box } from '@mui/material';
import RegisterForm from '../components/RegisterForm';

export const metadata: Metadata = {
  title: 'Đăng ký',
  description: 'Tạo tài khoản Finext miễn phí để bắt đầu phân tích và theo dõi thị trường chứng khoán.',
  openGraph: {
    title: 'Đăng ký | Finext',
    description: 'Tạo tài khoản Finext miễn phí để bắt đầu phân tích và theo dõi thị trường chứng khoán.',
  },
};

export default function RegisterPage() {
    return (
        <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
            <RegisterForm />
        </Box>
    );
}