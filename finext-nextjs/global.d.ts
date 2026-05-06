// Type declarations cho side-effect CSS imports (vd: import './globals.css').
// Next.js handle CSS qua build pipeline, nhưng TypeScript strict mode cần khai báo này.
declare module '*.css';
