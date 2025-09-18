'use client';

import React from 'react';
import Box from '@mui/material/Box';

import SignInForm from '../components/LoginForm';

export default function SignInPage() {
  return (
    <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
      <SignInForm />
    </Box>
  );
}