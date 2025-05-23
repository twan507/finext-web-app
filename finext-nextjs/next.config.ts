/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
        // search: '' // Thuộc tính search không được hỗ trợ trong Next.js 13+ cho remotePatterns, bạn có thể bỏ nó đi.
                       // Nếu bạn cần kiểm soát query params, hãy dùng pathname.
      },
      {
        protocol: 'https',
        hostname: '*.public.blob.vercel-storage.com',
        // search: ''
      }
    ]
  }
};

export default nextConfig;