import React from 'react';
import { Box, Container } from '@mui/material';
import RegisterForm from '../components/RegisterForm';

export default function RegisterPage() {
    return (
        <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
            <RegisterForm />
        </Box>
    );
}