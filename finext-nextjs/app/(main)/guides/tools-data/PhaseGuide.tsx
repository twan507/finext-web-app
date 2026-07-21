'use client';

import { Typography } from '@mui/material';
import GuideAccordion from '../components/GuideAccordion';
import GuideSubAccordion from '../components/GuideSubAccordion';
import { bodyTextSx, InfoBox } from '../components/GuideBlocks';
import { FeatureGrid, FeatureGridItem } from '../components/GuideLayoutBlocks';
import GuidePriceChart from '../components/charts/GuidePriceChart';

export default function PhaseGuide() {
  return (
    <GuideAccordion title="Giai đoạn thị trường" icon="mdi:sine-wave" defaultExpanded>
      <Typography sx={bodyTextSx} paragraph>
        Giai đoạn thị trường trả lời một câu hỏi lớn: lúc này thị trường đang ở pha nào
        và nên mạnh dạn hay thận trọng? Hệ thống theo dõi diễn biến chung, xếp thị trường
        vào một trong bốn trạng thái và gợi ý tỷ trọng cổ phiếu nên nắm giữ — giúp bạn
        canh nhịp mua bán theo bức tranh tổng thể thay vì cảm tính.
      </Typography>

      <InfoBox icon="mdi:gesture-tap-button" variant="tip">
        Mở tính năng bằng nút tròn phát sáng ở giữa thanh điều hướng dưới màn hình (trên
        điện thoại) hoặc biểu tượng phát sáng trên thanh điều hướng (trên máy tính). Chỉ
        cần đăng nhập là xem được phần phân tích thị trường.
      </InfoBox>

      <GuideSubAccordion title="Bốn trạng thái thị trường" icon="mdi:shape-outline">
        <InfoBox icon="mdi:palette-outline">
          Mỗi trạng thái có màu và ký hiệu riêng để nhận ra chỉ trong một cái liếc. Dải
          nhỏ trên bảng còn ghi lại trạng thái của 10 phiên gần nhất, cho thấy thị trường
          vừa đi qua chuỗi tăng, giảm hay giằng co.
        </InfoBox>
        <FeatureGrid columns={2}>
          <FeatureGridItem icon="mdi:trending-up" title="Tăng giá (▲)">
            Xu hướng đi lên chiếm ưu thế — giai đoạn thuận lợi để cân nhắc nâng tỷ trọng
            cổ phiếu.
          </FeatureGridItem>
          <FeatureGridItem icon="mdi:trending-down" title="Giảm giá (▼)">
            Xu hướng đi xuống — ưu tiên phòng thủ, giữ nhiều tiền mặt hơn để bảo toàn vốn.
          </FeatureGridItem>
          <FeatureGridItem icon="mdi:swap-horizontal" title="Đi ngang (↔)">
            Thị trường giằng co không rõ hướng — thường là lúc nên kiên nhẫn quan sát, hạn
            chế giao dịch dồn dập.
          </FeatureGridItem>
          <FeatureGridItem icon="mdi:sync" title="Chuyển pha (⇄)">
            Giai đoạn giao thời giữa hai xu hướng — cần theo dõi sát vì thị trường có thể
            sớm đổi chiều.
          </FeatureGridItem>
        </FeatureGrid>
      </GuideSubAccordion>

      <GuideSubAccordion title="Bảng tóm tắt nhanh" icon="mdi:speedometer">
        <InfoBox icon="mdi:speedometer">
          Ngay đầu trang là ba ô tóm tắt: trạng thái thị trường hiện tại, tỷ trọng nắm giữ
          gợi ý (phần còn lại là tiền mặt), và cường độ thị trường — thước đo cho biết động
          lực đang nghiêng về phía tăng hay giảm, mạnh hay yếu.
        </InfoBox>
      </GuideSubAccordion>

      <GuideSubAccordion title="Diễn biến chỉ số theo giai đoạn" icon="mdi:chart-line" lazyMount>
        <InfoBox icon="mdi:chart-line">
          Biểu đồ chính vẽ lại diễn biến chỉ số Finext qua thời gian, tô màu theo từng giai
          đoạn để bạn thấy rõ thị trường đã chuyển pha ở những mốc nào. Bên dưới là phần
          nhận định phiên do Finext AI tổng hợp, diễn giải vì sao thị trường đang ở trạng
          thái hiện tại. Biểu đồ dưới đây dùng dữ liệu minh hoạ để bạn hình dung thao tác.
        </InfoBox>
        <GuidePriceChart />
      </GuideSubAccordion>

      <GuideSubAccordion title="Danh mục đầu tư mẫu" icon="mdi:briefcase-outline">
        <InfoBox icon="mdi:briefcase-outline" variant="note">
          Ngoài phân tích thị trường, tính năng còn có các danh mục mẫu do Finext vận hành
          theo từng khẩu vị rủi ro: cổ phiếu đang nắm giữ, cổ phiếu tiềm năng chờ vào, sổ
          lệnh và hiệu suất so với thị trường chung. Phần này yêu cầu gói hội viên phù hợp.
        </InfoBox>
        <FeatureGrid columns={3}>
          <FeatureGridItem icon="mdi:shield-outline" title="Phòng Thủ">
            Ưu tiên an toàn và ổn định, phù hợp nhà đầu tư thận trọng.
          </FeatureGridItem>
          <FeatureGridItem icon="mdi:rocket-launch-outline" title="Mạo Hiểm">
            Chấp nhận biến động cao hơn để tìm cơ hội tăng trưởng mạnh.
          </FeatureGridItem>
          <FeatureGridItem icon="mdi:waves" title="Sóng Ngành">
            Bám theo dòng tiền luân chuyển giữa các ngành đang dẫn dắt.
          </FeatureGridItem>
        </FeatureGrid>
      </GuideSubAccordion>
    </GuideAccordion>
  );
}
