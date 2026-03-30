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

export default function PrivacyPolicyContent() {
  const theme = useTheme();

  return (
    <Box sx={{ maxWidth: 860, mx: 'auto', px: { xs: 2, md: 3 }, py: { xs: 4, md: 6 } }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5 }}>
        <Icon
          icon="mdi:shield-lock-outline"
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
          Chính sách bảo mật
        </Typography>
      </Box>

      <Divider sx={{ mb: 4 }} />

      <Section title="1. Giới thiệu">
        Finext (&quot;chúng tôi&quot;, &quot;nền tảng&quot;) coi trọng và bảo vệ quyền riêng tư và
        thông tin cá nhân của người dùng. Chính sách bảo mật này giải thích cách chúng tôi thu
        thập, sử dụng, lưu trữ và bảo vệ dữ liệu của bạn khi sử dụng nền tảng phân tích chứng
        khoán Finext.
        <br /><br />
        Bằng việc sử dụng nền tảng Finext, bạn đồng ý với các điều khoản được mô tả trong
        chính sách này.
      </Section>

      <Section title="2. Thông tin chúng tôi thu thập">
        <strong>2.1. Thông tin bạn cung cấp trực tiếp:</strong>
        <ul>
          <li>Họ tên, địa chỉ email khi đăng ký tài khoản</li>
          <li>Mật khẩu (được mã hóa và lưu trữ an toàn)</li>
          <li>Thông tin hồ sơ cá nhân bạn tự cập nhật</li>
          <li>Thông tin tài khoản Google nếu bạn chọn đăng nhập bằng Google OAuth</li>
        </ul>
        <strong>2.2. Thông tin thu thập tự động:</strong>
        <ul>
          <li>Dữ liệu phiên đăng nhập (session) và token xác thực</li>
          <li>Danh mục cổ phiếu theo dõi (watchlist) và tùy chọn hiển thị</li>
          <li>Thông tin gói đăng ký và lịch sử giao dịch trên nền tảng</li>
          <li>Thông tin thiết bị, trình duyệt, địa chỉ IP và hành vi sử dụng</li>
        </ul>
      </Section>

      <Section title="3. Mục đích sử dụng thông tin">
        Chúng tôi sử dụng thông tin thu thập được cho các mục đích sau:
        <ul>
          <li>Cung cấp và duy trì nền tảng phân tích chứng khoán</li>
          <li>Xác thực danh tính và quản lý phiên đăng nhập</li>
          <li>Cá nhân hóa trải nghiệm: hiển thị dữ liệu thị trường, biểu đồ và báo cáo phù hợp</li>
          <li>Quản lý gói đăng ký và quyền truy cập tính năng</li>
          <li>Gửi thông báo quan trọng về tài khoản hoặc thay đổi nền tảng</li>
          <li>Cải thiện chất lượng sản phẩm và trải nghiệm người dùng</li>
          <li>Phát hiện và ngăn chặn các hành vi gian lận, truy cập trái phép</li>
        </ul>
      </Section>

      <Section title="4. Bảo mật dữ liệu">
        Chúng tôi áp dụng các biện pháp bảo mật tiêu chuẩn ngành để bảo vệ dữ liệu của bạn:
        <ul>
          <li>Mật khẩu được mã hóa bằng thuật toán băm một chiều (bcrypt), không lưu trữ dạng
            thuần văn bản</li>
          <li>Xác thực bằng JWT (JSON Web Token) với cơ chế refresh token an toàn</li>
          <li>Truyền tải dữ liệu qua giao thức HTTPS được mã hóa TLS</li>
          <li>Hạn chế quyền truy cập dữ liệu theo nguyên tắc tối thiểu (least privilege)</li>
          <li>Giám sát phiên đăng nhập và hỗ trợ người dùng quản lý các phiên hoạt động</li>
        </ul>
        Mặc dù chúng tôi nỗ lực tối đa, không có hệ thống nào đảm bảo an toàn tuyệt đối 100%.
        Chúng tôi khuyến khích bạn sử dụng mật khẩu mạnh và không chia sẻ thông tin đăng nhập.
      </Section>

      <Section title="5. Chia sẻ thông tin với bên thứ ba">
        Finext <strong>không bán, cho thuê hoặc trao đổi</strong> thông tin cá nhân của bạn cho bên
        thứ ba vì mục đích thương mại. Chúng tôi chỉ chia sẻ thông tin trong các trường hợp sau:
        <ul>
          <li>
            <strong>Nhà cung cấp dịch vụ:</strong> Google (xác thực OAuth) — chỉ nhận thông tin
            cần thiết để xác minh danh tính
          </li>
          <li>
            <strong>Yêu cầu pháp lý:</strong> Khi được cơ quan có thẩm quyền yêu cầu theo quy
            định pháp luật Việt Nam
          </li>
          <li>
            <strong>Bảo vệ quyền lợi:</strong> Để phát hiện, ngăn chặn gian lận hoặc bảo vệ an
            toàn hệ thống
          </li>
        </ul>
      </Section>

      <Section title="6. Lưu trữ và thời hạn giữ dữ liệu">
        <ul>
          <li>Dữ liệu tài khoản được lưu trữ trong suốt thời gian bạn sử dụng nền tảng</li>
          <li>Khi bạn yêu cầu xóa tài khoản, chúng tôi sẽ xóa hoặc ẩn danh hóa dữ liệu cá nhân
            trong vòng 30 ngày làm việc</li>
          <li>Một số dữ liệu có thể được giữ lại để tuân thủ nghĩa vụ pháp lý hoặc giải quyết
            tranh chấp</li>
        </ul>
      </Section>

      <Section title="7. Cookie và công nghệ theo dõi">
        Finext sử dụng cookie và các công nghệ tương tự để:
        <ul>
          <li>Duy trì phiên đăng nhập và trạng thái xác thực</li>
          <li>Lưu tùy chọn giao diện (chế độ sáng/tối, ngôn ngữ)</li>
          <li>Phân tích hành vi sử dụng nhằm cải thiện nền tảng</li>
        </ul>
        Bạn có thể quản lý cookie thông qua cài đặt trình duyệt. Tuy nhiên, việc tắt cookie có
        thể ảnh hưởng đến trải nghiệm sử dụng.
      </Section>

      <Section title="8. Quyền của người dùng">
        Bạn có quyền:
        <ul>
          <li>Truy cập và xem lại thông tin cá nhân đã cung cấp</li>
          <li>Chỉnh sửa, cập nhật thông tin hồ sơ bất kỳ lúc nào</li>
          <li>Thay đổi mật khẩu và quản lý các phiên đăng nhập</li>
          <li>Yêu cầu xóa tài khoản và dữ liệu cá nhân</li>
          <li>Từ chối nhận thông báo tiếp thị (nếu có)</li>
        </ul>
        Để thực hiện các quyền trên, vui lòng liên hệ chúng tôi qua mục Hỗ trợ.
      </Section>

      <Section title="9. Thay đổi chính sách">
        Chúng tôi có thể cập nhật chính sách bảo mật này theo thời gian. Mọi thay đổi quan trọng
        sẽ được thông báo qua email hoặc thông báo trên nền tảng. Việc tiếp tục sử dụng nền tảng
        sau khi chính sách được cập nhật đồng nghĩa với việc bạn chấp nhận các thay đổi đó.
      </Section>

      <Section title="10. Liên hệ">
        Nếu bạn có câu hỏi hoặc thắc mắc về chính sách bảo mật, vui lòng liên hệ:
        <ul>
          <li><strong>Nền tảng:</strong> Finext — Your Next FInancial Step</li>
          <li><strong>Email:</strong> finext.vn@gmail.com</li>
        </ul>
      </Section>
    </Box>
  );
}
