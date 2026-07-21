'use client';

import { Typography } from '@mui/material';
import GuideAccordion from '../components/GuideAccordion';
import GuideSubAccordion from '../components/GuideSubAccordion';
import { bodyTextSx, InfoBox, Step, Callout } from '../components/GuideBlocks';
import { FeatureGrid, FeatureGridItem } from '../components/GuideLayoutBlocks';
import GuideFlowChart from '../components/charts/GuideFlowChart';

export default function AiAssistantGuide() {
  return (
    <GuideAccordion title="Trợ lý Finext AI" icon="ic:round-auto-awesome">
      <Typography sx={bodyTextSx} paragraph>
        Finext AI là trợ lý trò chuyện giúp bạn hỏi đáp về thị trường, cổ phiếu và nhóm
        ngành bằng tiếng Việt tự nhiên. Thay vì tự mở nhiều bảng để tra cứu, bạn chỉ cần
        hỏi — trợ lý tự tìm trong dữ liệu của Finext rồi trả lời gọn gàng, kèm biểu đồ khi
        cần. Mở bằng bong bóng chat "Finext AI" ở góc dưới bên phải, hoặc vào trang trò
        chuyện đầy đủ để xem lại lịch sử các cuộc hỏi đáp.
      </Typography>

      <GuideSubAccordion title="Hỏi gì được?" icon="mdi:help-circle-outline">
        <InfoBox icon="mdi:help-circle-outline">
          Trợ lý mạnh nhất ở các câu hỏi dựa trên số liệu và dữ kiện thị trường. Vài nhóm
          câu hỏi thường gặp:
        </InfoBox>
        <FeatureGrid columns={2}>
          <FeatureGridItem icon="mdi:magnify" title="Tra cứu cổ phiếu">
            "Chỉ số P/E của FPT hiện bao nhiêu?", "Doanh thu quý gần nhất của HPG thế nào?"
          </FeatureGridItem>
          <FeatureGridItem icon="mdi:podium" title="So sánh và xếp hạng">
            "Top 5 cổ phiếu ngân hàng dòng tiền mạnh nhất tuần", "So sánh MWG với FRT".
          </FeatureGridItem>
          <FeatureGridItem icon="mdi:earth" title="Bối cảnh ngành, thị trường">
            "Ngành nào đang thu hút dòng tiền hôm nay?", "Thị trường đang ở giai đoạn nào?"
          </FeatureGridItem>
          <FeatureGridItem icon="mdi:bookmark-outline" title="Danh sách theo dõi">
            "Các mã trong watchlist của tôi hôm nay biến động ra sao?"
          </FeatureGridItem>
        </FeatureGrid>
      </GuideSubAccordion>

      <GuideSubAccordion title="Cách đặt câu hỏi tốt" icon="mdi:lightbulb-on-outline">
        <Step num={1} title="Nêu rõ mã, ngành hoặc khoảng thời gian">
          <Typography sx={bodyTextSx} paragraph>
            Câu hỏi càng cụ thể, câu trả lời càng đúng ý. "Dòng tiền ngành thép tuần này"
            sẽ tốt hơn "thị trường thế nào".
          </Typography>
        </Step>
        <Step num={2} title="Hỏi từng ý một">
          <Typography sx={bodyTextSx} paragraph>
            Tách các câu hỏi lớn thành từng bước nhỏ, rồi hỏi tiếp dựa trên câu trả lời
            trước — trợ lý nhớ ngữ cảnh trong cùng một cuộc trò chuyện.
          </Typography>
        </Step>
        <Step num={3} title='Bật "Suy nghĩ sâu" cho câu hỏi phức tạp'>
          <Typography sx={bodyTextSx} paragraph>
            Với câu hỏi cần suy luận nhiều bước hoặc tổng hợp nhiều dữ kiện, bật nút "Suy
            nghĩ sâu" trong ô chat để trợ lý phân tích kỹ hơn trước khi trả lời.
          </Typography>
        </Step>
      </GuideSubAccordion>

      <GuideSubAccordion title="Trả lời kèm biểu đồ và nguồn tra cứu" icon="mdi:chart-box-outline" lazyMount>
        <InfoBox icon="mdi:chart-box-outline">
          Khi phù hợp, trợ lý sẽ dựng luôn biểu đồ hoặc thẻ số liệu ngay trong câu trả lời
          để bạn dễ hình dung. Trợ lý cũng hiển thị các bước tra cứu (đọc, tổng hợp, thống
          kê dữ liệu) và mốc thời gian của dữ liệu, để bạn biết câu trả lời dựa trên đâu.
          Dưới đây là ví dụ một biểu đồ minh hoạ.
        </InfoBox>
        <GuideFlowChart />
      </GuideSubAccordion>

      <InfoBox icon="mdi:alert-outline" variant="warning">
        Thông tin từ Trợ lý Finext AI chỉ mang tính tham khảo, <strong>không phải khuyến
        nghị đầu tư</strong>. Trợ lý vẫn có thể nhầm lẫn — hãy tự kiểm chứng các số liệu
        quan trọng trước khi ra quyết định.
      </InfoBox>

      <Callout icon="mdi:key-outline" title="Quyền truy cập và giới hạn sử dụng">
        Trợ lý dành cho tài khoản đã đăng nhập. Mỗi ngày có một số lượt hỏi nhất định;
        khi gần hết lượt hoặc khi hệ thống đang bận, một thông báo nhỏ sẽ hiện ngay phía
        trên ô chat để bạn nắm được, và bạn có thể xem chi tiết mức sử dụng trong trang
        tài khoản.
      </Callout>
    </GuideAccordion>
  );
}
