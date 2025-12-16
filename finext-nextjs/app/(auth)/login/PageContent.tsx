'use client';

import React from 'react';
import Box from '@mui/material/Box';

import SignInForm from '../components/LoginForm';

export default function PageContent() {
  return (
    <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
      <SignInForm />
    </Box>
  );
}