import React from 'react';

const HeroChart = () => {
  return (
    <div 
      className="chart-placeholder" 
      style={{ 
        height: '280px', // Giữ lại chiều cao từ HTML gốc
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '1px dashed var(--gray-700)', // Đường viền để dễ nhìn
        backgroundColor: 'var(--gray-800)', // Màu nền nhẹ
        color: 'var(--gray-400)',
        fontSize: '1.5rem'
      }}
    >
      Hero Chart
    </div>
  );
};

export default HeroChart;