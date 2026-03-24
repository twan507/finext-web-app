'use client';

import { Box, Typography, useTheme, Divider } from '@mui/material';
import { Icon } from '@iconify/react';
import { getResponsiveFontSize, fontWeight, spacing } from 'theme/tokens';

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

function Section({ title, children }: SectionProps) {
  const theme = useTheme();
  return (
    <Box sx={{ mb: 4 }}>
      <Typography
        sx={{
          fontSize: getResponsiveFontSize('h4'),
          fontWeight: fontWeight.semibold,
          color: theme.palette.text.primary,
          mb: 1.5,
        }}
      >
        {title}
      </Typography>
      <Typography
        component="div"
        sx={{
          fontSize: getResponsiveFontSize('md'),
          color: theme.palette.text.secondary,
          lineHeight: 1.8,
          '& ul': { pl: 3, my: 1 },
          '& li': { mb: 0.5 },
        }}
      >
        {children}
      </Typography>
    </Box>
  );
}

export default function ContentPolicyContent() {
  const theme = useTheme();

  return (
    <Box sx={{ maxWidth: 860, mx: 'auto', px: { xs: 2, md: 3 }, py: { xs: 4, md: 6 } }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5 }}>
        <Icon
          icon="mdi:text-box-check-outline"
          width={36}
          height={36}
          color={theme.palette.primary.main}
        />
        <Typography
          sx={{
            fontSize: getResponsiveFontSize('h2'),
            fontWeight: fontWeight.bold,
            color: theme.palette.text.primary,
          }}
        >
          Chính sách nội dung
        </Typography>
      </Box>

      <Divider sx={{ mb: 4 }} />

      <Section title="1. Phạm vi áp dụng">
        Chính sách nội dung này quy định các tiêu chuẩn về nội dung được đăng tải, hiển thị và
        phân phối trên nền tảng Finext, bao gồm nhưng không giới hạn:
        <ul>
          <li>Báo cáo phân tích thị trường và tin tức chứng khoán</li>
          <li>Dữ liệu phân tích nhóm ngành, phân tích kỹ thuật và phân tích cơ bản</li>
          <li>Biểu đồ, chỉ số tài chính và bộ lọc cổ phiếu</li>
          <li>Nội dung giáo dục trong mục Finext Learning</li>
        </ul>
      </Section>

      <Section title="2. Nguồn gốc và tính chính xác của dữ liệu">
        <strong>2.1. Dữ liệu thị trường:</strong>
        <ul>
          <li>Dữ liệu giá cổ phiếu, chỉ số (VNINDEX, VN30, HNX, UPCOM...) được tổng hợp từ các
            nguồn công khai và đối tác cung cấp dữ liệu tài chính</li>
          <li>Dữ liệu có thể có độ trễ nhất định so với thời gian thực tùy thuộc vào gói dịch vụ</li>
          <li>Finext nỗ lực đảm bảo tính chính xác nhưng không chịu trách nhiệm cho sai sót từ
            nguồn cung cấp bên thứ ba</li>
        </ul>
        <strong>2.2. Nội dung phân tích:</strong>
        <ul>
          <li>Các báo cáo, bài phân tích mang tính tham khảo và giáo dục</li>
          <li>Không cấu thành lời khuyên đầu tư, khuyến nghị mua/bán chứng khoán cụ thể</li>
          <li>Người dùng cần tự đánh giá và chịu trách nhiệm cho quyết định đầu tư của mình</li>
        </ul>
      </Section>

      <Section title="3. Tiêu chuẩn nội dung">
        Mọi nội dung trên Finext phải tuân thủ các tiêu chuẩn sau:
        <ul>
          <li><strong>Trung thực:</strong> Dựa trên dữ liệu thực tế, không bịa đặt hoặc xuyên
            tạc thông tin tài chính</li>
          <li><strong>Khách quan:</strong> Trình bày đa chiều, không thiên vị hay cố ý dẫn dắt
            người đọc theo một hướng đầu tư cụ thể</li>
          <li><strong>Rõ ràng:</strong> Phân biệt giữa thông tin thực tế (fact) và quan điểm phân
            tích (opinion)</li>
          <li><strong>Hợp pháp:</strong> Tuân thủ quy định của Ủy ban Chứng khoán Nhà nước (SSC)
            và pháp luật Việt Nam về thông tin trên thị trường chứng khoán</li>
        </ul>
      </Section>

      <Section title="4. Nội dung bị nghiêm cấm">
        Các nội dung sau đây bị nghiêm cấm trên nền tảng Finext:
        <ul>
          <li>Thao túng thị trường: tung tin đồn, thông tin sai lệch nhằm tác động đến giá chứng
            khoán</li>
          <li>Giao dịch nội gián: tiết lộ hoặc sử dụng thông tin nội bộ chưa được công bố</li>
          <li>Lừa đảo tài chính: cam kết lợi nhuận, đảm bảo kết quả đầu tư, hoặc quảng bá các
            mô hình đầu tư đa cấp</li>
          <li>Sao chép vi phạm: sử dụng nội dung có bản quyền của bên thứ ba mà không được phép</li>
          <li>Quảng cáo trái phép: quảng bá sản phẩm/dịch vụ tài chính không được cấp phép hoạt
            động tại Việt Nam</li>
          <li>Nội dung vi phạm pháp luật Việt Nam hoặc đạo đức xã hội</li>
        </ul>
      </Section>

      <Section title="5. Sở hữu trí tuệ">
        <ul>
          <li>Toàn bộ nội dung do Finext tạo ra (báo cáo, phân tích, giao diện, biểu đồ, thuật
            toán lọc cổ phiếu) thuộc quyền sở hữu trí tuệ của Finext</li>
          <li>Người dùng được phép sử dụng nội dung cho mục đích cá nhân, phi thương mại</li>
          <li>Nghiêm cấm sao chép, phân phối lại, hoặc sử dụng nội dung Finext cho mục đích
            thương mại khi chưa được sự đồng ý bằng văn bản</li>
          <li>Dữ liệu thị trường từ nguồn bên thứ ba tuân theo điều khoản bản quyền của nhà cung
            cấp tương ứng</li>
        </ul>
      </Section>

      <Section title="6. Quyền truy cập nội dung">
        <ul>
          <li>Một số nội dung và tính năng có thể yêu cầu gói đăng ký trả phí</li>
          <li>Finext có quyền điều chỉnh phạm vi nội dung miễn phí và trả phí theo từng thời kỳ</li>
          <li>Người dùng không được chia sẻ tài khoản hoặc cung cấp quyền truy cập nội dung trả
            phí cho bên thứ ba</li>
        </ul>
      </Section>

      <Section title="7. Cập nhật và gỡ bỏ nội dung">
        <ul>
          <li>Finext có quyền chỉnh sửa, cập nhật hoặc gỡ bỏ bất kỳ nội dung nào không còn phù
            hợp hoặc vi phạm chính sách</li>
          <li>Dữ liệu lịch sử có thể được điều chỉnh khi nguồn dữ liệu gốc phát hành bản
            cập nhật hoặc đính chính</li>
          <li>Nếu bạn phát hiện nội dung vi phạm, vui lòng báo cáo qua mục Hỗ trợ để chúng tôi
            xem xét và xử lý kịp thời</li>
        </ul>
      </Section>

      <Section title="8. Liên hệ">
        Mọi thắc mắc về chính sách nội dung, vui lòng liên hệ:
        <ul>
          <li><strong>Nền tảng:</strong> Finext — Your Next FInancial Step</li>
          <li><strong>Email:</strong> finext.vn@gmail.com</li>
        </ul>
      </Section>
    </Box>
  );
}
