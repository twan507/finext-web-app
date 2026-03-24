'use client';

import { Box, Typography, useTheme, Divider, alpha } from '@mui/material';
import { Icon } from '@iconify/react';
import { getResponsiveFontSize, fontWeight, spacing, borderRadius } from 'theme/tokens';

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

export default function DisclaimerContent() {
  const theme = useTheme();

  return (
    <Box sx={{ maxWidth: 860, mx: 'auto', px: { xs: 2, md: 3 }, py: { xs: 4, md: 6 } }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5 }}>
        <Icon
          icon="mdi:alert-circle-outline"
          width={36}
          height={36}
          color={theme.palette.warning.main}
        />
        <Typography
          sx={{
            fontSize: getResponsiveFontSize('h2'),
            fontWeight: fontWeight.bold,
            color: theme.palette.text.primary,
          }}
        >
          Tuyên bố trách nhiệm
        </Typography>
      </Box>

      <Divider sx={{ mb: 4 }} />

      {/* Important notice box */}
      <Box
        sx={{
          p: 3,
          mb: 4,
          borderRadius: borderRadius.md / 8,
          border: `1px solid ${theme.palette.warning.main}`,
          bgcolor: alpha(theme.palette.warning.main, 0.06),
        }}
      >
        <Typography
          sx={{
            fontSize: getResponsiveFontSize('md'),
            fontWeight: fontWeight.semibold,
            color: theme.palette.warning.main,
            mb: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <Icon icon="mdi:information-outline" width={20} height={20} />
          Lưu ý quan trọng
        </Typography>
        <Typography
          sx={{
            fontSize: getResponsiveFontSize('md'),
            color: theme.palette.text.secondary,
            lineHeight: 1.8,
          }}
        >
          Finext là nền tảng cung cấp công cụ phân tích và dữ liệu chứng khoán mang tính chất
          tham khảo. Finext <strong>không phải</strong> là công ty chứng khoán, tổ chức tư vấn đầu
          tư, hoặc quỹ quản lý tài sản. Mọi thông tin trên nền tảng không cấu thành lời khuyên
          đầu tư hay khuyến nghị giao dịch.
        </Typography>
      </Box>

      <Section title="1. Không phải khuyến nghị đầu tư">
        Toàn bộ nội dung trên Finext — bao gồm báo cáo phân tích, dữ liệu nhóm ngành, tín hiệu
        kỹ thuật, bộ lọc cổ phiếu và nội dung giáo dục — được cung cấp{' '}
        <strong>chỉ nhằm mục đích thông tin và tham khảo</strong>.
        <br /><br />
        Cụ thể, Finext không:
        <ul>
          <li>Đưa ra khuyến nghị mua, bán, hoặc nắm giữ bất kỳ chứng khoán cụ thể nào</li>
          <li>Cam kết hoặc đảm bảo bất kỳ kết quả đầu tư hay mức lợi nhuận nào</li>
          <li>Cung cấp dịch vụ tư vấn đầu tư cá nhân</li>
          <li>Thay thế vai trò của các tổ chức tư vấn tài chính được cấp phép</li>
        </ul>
      </Section>

      <Section title="2. Rủi ro đầu tư">
        Đầu tư chứng khoán luôn tiềm ẩn rủi ro. Bạn cần nhận thức rằng:
        <ul>
          <li>Giá trị chứng khoán có thể tăng hoặc giảm, bạn có thể mất một phần hoặc toàn bộ
            vốn đầu tư</li>
          <li>Hiệu suất trong quá khứ không phải là chỉ báo đáng tin cậy cho kết quả tương lai</li>
          <li>Các chỉ số phân tích kỹ thuật, phân tích cơ bản hay dòng tiền đều là công cụ tham
            khảo, không phải yếu tố dự đoán chắc chắn</li>
          <li>Thị trường chứng khoán chịu ảnh hưởng bởi nhiều yếu tố kinh tế vĩ mô, chính trị
            và tâm lý thị trường mà không một mô hình nào có thể dự báo hoàn toàn</li>
        </ul>
        <strong>Bạn cần tự chịu trách nhiệm hoàn toàn cho mọi quyết định đầu tư của mình.</strong>
      </Section>

      <Section title="3. Tính chính xác của thông tin">
        <ul>
          <li>Finext nỗ lực cung cấp dữ liệu chính xác và kịp thời từ các nguồn đáng tin cậy</li>
          <li>Tuy nhiên, chúng tôi không đảm bảo tính chính xác, đầy đủ hoặc cập nhật tức thời
            của mọi thông tin</li>
          <li>Dữ liệu thị trường có thể có độ trễ tùy thuộc vào nguồn cung cấp và gói dịch vụ</li>
          <li>Sai sót kỹ thuật, lỗi hệ thống hoặc gián đoạn dịch vụ có thể xảy ra mà không có
            thông báo trước</li>
          <li>Người dùng nên đối chiếu với nhiều nguồn thông tin trước khi ra quyết định</li>
        </ul>
      </Section>

      <Section title="4. Giới hạn trách nhiệm">
        Trong phạm vi tối đa được pháp luật cho phép, Finext không chịu trách nhiệm về:
        <ul>
          <li>Bất kỳ tổn thất tài chính nào phát sinh từ việc sử dụng hoặc tin tưởng vào thông
            tin trên nền tảng</li>
          <li>Thiệt hại trực tiếp, gián tiếp, ngẫu nhiên hoặc hậu quả liên quan đến quyết định
            đầu tư</li>
          <li>Gián đoạn dịch vụ, lỗi kỹ thuật hoặc mất dữ liệu do nguyên nhân ngoài tầm kiểm
            soát</li>
          <li>Hành động của bên thứ ba, bao gồm nhà cung cấp dữ liệu và dịch vụ liên kết</li>
        </ul>
      </Section>

      <Section title="5. Nội dung giáo dục">
        Các tài liệu trong mục Finext Learning (phân tích kỹ thuật, phân tích cơ bản, phân tích
        dòng tiền) được cung cấp nhằm mục đích giáo dục và nâng cao kiến thức tài chính:
        <ul>
          <li>Không phải là hướng dẫn giao dịch cụ thể hay chiến lược đầu tư được khuyến nghị</li>
          <li>Các ví dụ minh họa sử dụng dữ liệu lịch sử và không phản ánh điều kiện thị trường
            hiện tại</li>
          <li>Người dùng cần tìm hiểu thêm và tham khảo ý kiến chuyên gia trước khi áp dụng</li>
        </ul>
      </Section>

      <Section title="6. Tuân thủ pháp luật">
        <ul>
          <li>Người dùng có trách nhiệm tuân thủ pháp luật Việt Nam về chứng khoán và thị trường
            vốn, bao gồm Luật Chứng khoán 2019 và các văn bản hướng dẫn</li>
          <li>Finext hoạt động theo quy định pháp luật Việt Nam. Mọi tranh chấp sẽ được giải
            quyết theo luật pháp Việt Nam</li>
          <li>Người dùng ngoài Việt Nam cần tự xác minh tính hợp pháp của việc truy cập và sử
            dụng dữ liệu chứng khoán Việt Nam tại quốc gia của mình</li>
        </ul>
      </Section>

      <Section title="7. Khuyến nghị cho người dùng">
        Chúng tôi khuyến nghị bạn:
        <ul>
          <li>Tự trang bị kiến thức tài chính và hiểu rõ mức độ chấp nhận rủi ro của bản thân</li>
          <li>Tham khảo ý kiến từ tổ chức tư vấn đầu tư được cấp phép trước khi đưa ra quyết
            định quan trọng</li>
          <li>Không đầu tư bằng tiền bạn không sẵn sàng chấp nhận mất</li>
          <li>Đa dạng hóa danh mục đầu tư để giảm thiểu rủi ro</li>
          <li>Sử dụng Finext như một công cụ hỗ trợ ra quyết định, không phải nguồn duy nhất</li>
        </ul>
      </Section>

      <Section title="8. Liên hệ">
        Nếu bạn có thắc mắc về tuyên bố trách nhiệm này, vui lòng liên hệ:
        <ul>
          <li><strong>Nền tảng:</strong> Finext — Your Next FInancial Step</li>
          <li><strong>Email:</strong> finext.vn@gmail.com</li>
        </ul>
      </Section>
    </Box>
  );
}
