/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',

  // Experimental optimizations
  experimental: {
    // Tối ưu package imports cho MUI và các thư viện lớn
    optimizePackageImports: ['@mui/material', '@mui/icons-material', '@iconify/react', 'date-fns'],
  },

  // Configure DevTools position
  devIndicators: {
    appIsrStatus: false,
    buildActivity: true,
    position: 'bottom-right',
  },

  images: {
    // Định dạng ảnh tối ưu
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.public.blob.vercel-storage.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        // Fixed: hostname không được chứa protocol
        protocol: 'https',
        hostname: '6aa6ced0145a5c1793ce63571c9c2799.r2.cloudflarestorage.com',
        port: '',
        pathname: '/**',
      }
    ]
  }
};

export default nextConfig;