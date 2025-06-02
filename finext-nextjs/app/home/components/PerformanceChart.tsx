import React from 'react';

const PerformanceChart = () => {
  return (
    <div 
      className="chart-placeholder" 
      style={{ 
        height: '200px', // Giữ lại chiều cao từ HTML gốc
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '1px dashed var(--gray-700)',
        backgroundColor: 'var(--gray-800)',
        color: 'var(--gray-400)',
        fontSize: '1.2rem',
        marginTop: '1rem' // Thêm khoảng cách nếu cần
      }}
    >
      Performance Chart
    </div>
  );
};

export default PerformanceChart;