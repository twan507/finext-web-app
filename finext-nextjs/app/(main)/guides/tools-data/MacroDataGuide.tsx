'use client';

import { Typography } from '@mui/material';
import GuideAccordion from '../components/GuideAccordion';
import GuideSubAccordion from '../components/GuideSubAccordion';
import { bodyTextSx, InfoBox, Callout } from '../components/GuideBlocks';
import { FeatureGrid, FeatureGridItem } from '../components/GuideLayoutBlocks';
import GuidePriceChart from '../components/charts/GuidePriceChart';

export default function MacroDataGuide() {
  return (
    <GuideAccordion title="Dữ liệu vĩ mô, quốc tế và hàng hoá" icon="mdi:earth">
      <Typography sx={bodyTextSx} paragraph>
        Giá cổ phiếu không vận động một mình — chúng chịu ảnh hưởng từ lãi suất, tỷ giá,
        diễn biến chứng khoán thế giới và giá hàng hoá. Ba trang dữ liệu này cho bạn bức
        tranh nền rộng hơn thị trường trong nước, tất cả đều xem được miễn phí và mở từ
        menu chính.
      </Typography>

      <GuideSubAccordion title="Cách xem chung cho cả ba trang" icon="mdi:gesture-tap" lazyMount>
        <InfoBox icon="mdi:gesture-tap">
          Cả ba trang dùng chung một cách xem quen thuộc: chọn nhóm dữ liệu ở hàng thẻ,
          bảng bên dưới liệt kê các chỉ tiêu của nhóm đó. Bấm vào một dòng bất kỳ, biểu đồ
          diễn biến theo thời gian của chỉ tiêu sẽ hiện lên ở phía trên để bạn xem xu hướng
          dài hạn. Biểu đồ dưới đây minh hoạ dạng đồ thị bạn sẽ thấy.
        </InfoBox>
        <GuidePriceChart />
      </GuideSubAccordion>

      <GuideSubAccordion title="Ba nhóm dữ liệu" icon="mdi:view-grid-outline">
        <FeatureGrid columns={3}>
          <FeatureGridItem icon="mdi:bank-outline" title="Kinh tế vĩ mô">
            Dữ liệu kinh tế trong nước: tăng trưởng, lạm phát, lãi suất tiền tệ và tỷ giá
            đồng Việt Nam.
          </FeatureGridItem>
          <FeatureGridItem icon="mdi:earth" title="Tài chính quốc tế">
            Chứng khoán thế giới, ngoại hối, trái phiếu và tiền mã hoá — nhịp đập của dòng
            vốn toàn cầu.
          </FeatureGridItem>
          <FeatureGridItem icon="mdi:oil" title="Thị trường hàng hoá">
            Giá kim loại, năng lượng, hoá chất và nông sản — nguyên liệu đầu vào của nhiều
            ngành sản xuất.
          </FeatureGridItem>
        </FeatureGrid>
      </GuideSubAccordion>

      <Callout icon="mdi:link-variant" title="Vì sao nên theo dõi những dữ liệu này?">
        Các diễn biến vĩ mô và hàng hoá thường đi trước biến động của cổ phiếu liên quan.
        Ví dụ giá thép nhích lên có thể báo hiệu cho nhóm thép và xây dựng; giá dầu tăng
        thường liên quan đến nhóm dầu khí; còn lãi suất và tỷ giá tác động đến gần như cả
        thị trường. Nắm bối cảnh nền giúp bạn hiểu vì sao một ngành đang mạnh hay yếu.
      </Callout>
    </GuideAccordion>
  );
}
