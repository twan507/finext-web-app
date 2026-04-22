'use client';

import { Box, Typography } from '@mui/material';
import GuideAccordion from '../components/GuideAccordion';
import GuideSubAccordion from '../components/GuideSubAccordion';
import {
  bodyTextSx,
  smallTextSx,
  Figure,
  Step,
  FeatureCard,
  Callout,
  TimelineItem,
  InfoBox,
} from '../components/GuideBlocks';
import { spacing } from 'theme/tokens';

// Box wrapper giúp stack FeatureCards hoặc sections dọc đều nhau
const stackSx = { display: 'flex', flexDirection: 'column', gap: 2, my: 2 } as const;

export default function OverviewContent() {
  return (
    <Box sx={{ py: spacing.xs }}>
      <Box sx={{ display: 'flex', flexDirection: 'column' }}>

        {/* ========================================================================
            ACCORDION 1: TRANG CHỦ
        ======================================================================== */}
        <GuideAccordion title="Trang chủ" icon="mdi:home-variant">
          <Typography sx={bodyTextSx} paragraph>
            Trang chủ tổng hợp toàn bộ diễn biến thị trường trong một khung nhìn duy nhất:
            chỉ số chính, dòng tiền theo ngành, cổ phiếu dẫn dắt, tin tức nổi bật. Mọi số
            liệu cập nhật theo thời gian thực — mở trang là có đủ dữ kiện cho quyết định
            phiên.
          </Typography>

          <GuideSubAccordion title="Chỉ số nhanh" icon="mdi:view-dashboard-outline">
            <InfoBox>
              Sáu thẻ tóm tắt các chỉ số chính — VNINDEX, VN30, HNX, UPCoM và hai chỉ số
              bổ sung — mỗi thẻ hiển thị điểm số hiện tại, biên độ và biểu đồ trong phiên.
              Chạm vào thẻ bất kỳ để chuyển biểu đồ lớn ngay bên dưới sang chỉ số đó mà
              không cần rời trang.
            </InfoBox>
            <Figure
              src="/guides/overview/home-mini-indexes.png"
              alt="6 mini chỉ số ở đầu trang"
            />
          </GuideSubAccordion>

          <GuideSubAccordion title="Thị trường" icon="mdi:chart-line">
            <InfoBox>
              Biểu đồ đầy đủ của chỉ số đang chọn đặt song song với bảng liệt kê các chỉ
              số còn lại. Chuyển qua lại giữa ba nhóm — chỉ số sàn chính, chỉ số phái
              sinh, và chỉ số do Finext tự xây dựng. Bấm vào mã bất kỳ trong bảng, biểu
              đồ đồng bộ tức thì để so sánh nhanh.
            </InfoBox>
            <Figure
              src="/guides/overview/home-market-section.png"
              alt="Biểu đồ thị trường"
            />
          </GuideSubAccordion>

          <GuideSubAccordion title="Diễn biến thị trường" icon="mdi:chart-bar">
            <InfoBox>
              Độ rộng thị trường trong phiên (số mã tăng so với số mã giảm) đặt cạnh dòng
              tiền khối ngoại mua - bán ròng. Hai chỉ báo đọc song song cho biết tâm lý
              đang chiếm ưu thế là tích lũy, phân phối hay trung lập — cơ sở quan trọng
              để đánh giá chất lượng diễn biến điểm số.
            </InfoBox>
            <Figure
              src="/guides/overview/home-volatility.png"
              alt="Diễn biến thị trường"
            />
          </GuideSubAccordion>

          <GuideSubAccordion title="Nhóm ngành" icon="mdi:view-grid-outline">
            <InfoBox>
              Bản đồ 24 ngành xếp dạng lưới, mỗi ô tương ứng một ngành và trực quan hóa
              mức biến động giá cùng cường độ dòng tiền trong phiên. Xác định trong vài
              giây ngành nào đang dẫn dắt, ngành nào bị phân phối — thay vì rà qua nhiều
              cột của bảng điện tử truyền thống.
            </InfoBox>
            <Figure
              src="/guides/overview/home-industry.png"
              alt="Nhóm ngành"
            />
          </GuideSubAccordion>

          <GuideSubAccordion title="Cổ phiếu nổi bật theo ngành" icon="mdi:star-outline">
            <InfoBox>
              Tập hợp các mã dẫn dắt trong những ngành có dòng tiền mạnh nhất phiên, được
              lọc sẵn theo biến động giá và cường độ thanh khoản. Thay vì mở từng ngành
              soi từng mã, xem tại đây là đủ để khoanh vùng danh mục theo dõi cho phiên
              giao dịch.
            </InfoBox>
            <Figure
              src="/guides/overview/home-industry-stocks.png"
              alt="Cổ phiếu nổi bật theo ngành"
            />
          </GuideSubAccordion>

          <GuideSubAccordion title="Tin tức" icon="mdi:newspaper-variant-outline">
            <InfoBox>
              Luồng tin mới nhất tổng hợp từ các nguồn tài chính chính thống, hiển thị
              ngay trên trang chủ để nắm bối cảnh phiên. Bấm vào tiêu đề để đọc toàn văn.
              Muốn lọc theo chủ đề, theo mã cổ phiếu hoặc xem kho tin đầy đủ, mở mục Tin
              tức trên menu chính.
            </InfoBox>
            <Figure
              src="/guides/overview/home-news.png"
              alt="Tin tức trên trang chủ"
            />
          </GuideSubAccordion>
        </GuideAccordion>

        {/* ========================================================================
            ACCORDION 2: THỊ TRƯỜNG
        ======================================================================== */}
        <GuideAccordion title="Thị trường" icon="mdi:chart-box-outline">
          <Typography sx={bodyTextSx} paragraph>
            Khung phân tích thị trường chi tiết hơn trang chủ: biểu đồ và bảng chỉ số ở
            đầu, tiếp theo là năm lăng kính chuyên sâu — biến động, dòng tiền, định giá,
            kỹ thuật, và giao dịch của khối ngoại cùng tự doanh. Mỗi lăng kính đào sâu
            một chiều dữ liệu khác nhau.
          </Typography>

          <GuideSubAccordion title="Biểu đồ chỉ số" icon="mdi:chart-line">
            <InfoBox>
              Bên trái là biểu đồ chỉ số đang chọn với đầy đủ khung thời gian từ trong
              phiên đến đa năm. Bên phải là bảng các chỉ số sàn chính và chỉ số Finext tự
              xây dựng. Bấm vào mã bất kỳ trong bảng, biểu đồ bên trái đồng bộ ngay lập
              tức để đối chiếu trực quan.
            </InfoBox>
            <Figure
              src="/guides/overview/markets-top-section.png"
              alt="Biểu đồ và bảng chỉ số"
            />
          </GuideSubAccordion>

          <GuideSubAccordion title="Biến động" icon="mdi:chart-bar">
            <InfoBox>
              Phân rã biến động của chỉ số xuống từng thành phần cấu thành: nhóm ngành
              đóng góp điểm tăng hoặc kéo điểm giảm, top mã biến động mạnh nhất phiên,
              độ rộng thị trường theo tỷ lệ tăng so với giảm. Công cụ để tách điểm số bề
              mặt khỏi chất lượng vận động bên trong.
            </InfoBox>
            <Figure
              src="/guides/overview/markets-tab-bien-dong.png"
              alt="Phần Biến động"
            />
          </GuideSubAccordion>

          <GuideSubAccordion title="Dòng tiền" icon="mdi:cash-multiple">
            <InfoBox>
              Bức tranh dòng tiền theo hai chiều: theo ngành (ngành nào đang thu hút vốn,
              ngành nào bị rút ra) và theo nhóm vốn hóa (LargeCap, MidCap, SmallCap). Dòng
              tiền thường đi trước giá — nhận diện sớm nhóm đang được ưu tiên giúp định
              hình ý tưởng giao dịch trước khi xu hướng trở nên rõ ràng.
            </InfoBox>
            <Figure
              src="/guides/overview/markets-tab-dong-tien.png"
              alt="Phần Dòng tiền"
            />
          </GuideSubAccordion>

          <GuideSubAccordion title="Định giá" icon="mdi:calculator-variant">
            <InfoBox>
              Các tỷ số P/E, P/B, EPS ở cấp toàn thị trường và từng ngành, đặt cạnh vùng
              trung bình lịch sử của chính chỉ số đó. So sánh ngang giữa các ngành và dọc
              theo thời gian để nhận diện nhóm đang chiết khấu hay vượt giá trị hợp lý —
              cơ sở cho chiến lược phân bổ trung và dài hạn.
            </InfoBox>
            <Figure
              src="/guides/overview/markets-tab-dinh-gia.png"
              alt="Phần Định giá"
            />
          </GuideSubAccordion>

          <GuideSubAccordion title="Kỹ thuật" icon="mdi:chart-timeline-variant">
            <InfoBox>
              Bộ tín hiệu kỹ thuật ở cấp thị trường: trạng thái xu hướng theo nhiều khung
              thời gian, các vùng hỗ trợ và kháng cự trọng yếu, tín hiệu mẫu hình đang
              hình thành. Giúp xác định đâu là vùng rủi ro cần phòng thủ và đâu là vùng
              thuận lợi cho vị thế mới. Yêu cầu gói hội viên phù hợp.
            </InfoBox>
            <Figure
              src="/guides/overview/markets-tab-ky-thuat.png"
              alt="Phần Kỹ thuật"
            />
          </GuideSubAccordion>

          <GuideSubAccordion title="Nước ngoài và Tự doanh" icon="mdi:earth">
            <InfoBox>
              Hai phần có cùng cấu trúc: giá trị mua - bán ròng theo ngày, top mã được
              giao dịch mạnh nhất, và xu hướng qua nhiều phiên gần đây. Khối ngoại phản
              ánh dòng vốn quốc tế đổ vào hay rút ra khỏi Việt Nam; tự doanh phản ánh
              quan điểm của các công ty chứng khoán trong nước. Theo dõi song song để đối
              chiếu hai dòng vốn có tính định hướng rõ nhất trên thị trường.
            </InfoBox>
            <Figure
              src="/guides/overview/markets-tab-nuoc-ngoai.png"
              alt="Phần Nước ngoài và Tự doanh"
            />
          </GuideSubAccordion>
        </GuideAccordion>

        {/* ========================================================================
            ACCORDION 3: NHÓM CỔ PHIẾU
        ======================================================================== */}
        <GuideAccordion title="Nhóm cổ phiếu" icon="mdi:account-group-outline">
          <Typography sx={bodyTextSx} paragraph>
            Nhóm cổ phiếu là các rổ do Finext xây dựng theo từng chủ đề — vốn hóa, đặc
            điểm dòng tiền, hoặc phạm vi đại diện thị trường. Thay vì theo dõi từng mã
            rời rạc, nhìn ở cấp rổ giúp nắm xu hướng chung của một nhóm đồng dạng và so
            sánh tương quan giữa các nhóm.
          </Typography>

          <GuideSubAccordion title="Bảng tổng quan các nhóm cổ phiếu" icon="mdi:table">
            <InfoBox>
              Bảng gom tám rổ Finext (FNXINDEX, FNX100, Vượt trội, Ổn định, Sự kiện,
              LargeCap, MidCap, SmallCap) với giá trị chỉ số, biến động theo ngày, tuần,
              tháng, quý, năm và điểm dòng tiền. Sắp xếp và so sánh nhanh để biết rổ nào
              đang dẫn dắt thị trường. Bấm vào tên rổ để mở trang chi tiết.
            </InfoBox>
            <Figure
              src="/guides/overview/groups-table.png"
              alt="Bảng tổng quan biến động"
            />
          </GuideSubAccordion>

          <GuideSubAccordion title="Biểu đồ biến động dòng tiền" icon="mdi:chart-multiple">
            <Typography sx={{ ...smallTextSx, color: 'text.secondary', mb: 2 }}>
              Phần này yêu cầu gói hội viên phù hợp.
            </Typography>
            <Box sx={stackSx}>
              <FeatureCard
                title="Nhóm thị trường"
                icon="mdi:chart-box"
                image={
                  <Figure
                    src="/guides/overview/groups-chart-thitruong.png"
                    alt="Biểu đồ nhóm thị trường"
                    sx={{ my: 0 }}
                  />
                }
              >
                Gồm FNXINDEX và FNX100 — đại diện cho toàn thị trường và top 100 cổ phiếu
                vốn hóa lớn nhất. Hai rổ này thường đồng pha với dòng tiền chung, cho bức
                tranh nền trước khi đi sâu vào từng nhóm hẹp hơn.
              </FeatureCard>

              <FeatureCard
                title="Nhóm dòng tiền"
                icon="mdi:cash-multiple"
                image={
                  <Figure
                    src="/guides/overview/groups-chart-dongtien.png"
                    alt="Biểu đồ nhóm dòng tiền"
                    sx={{ my: 0 }}
                  />
                }
              >
                Ba rổ phân loại theo đặc tính dòng tiền: Vượt trội (dòng tiền mạnh nhất
                thị trường), Ổn định (dòng tiền duy trì đều qua nhiều phiên), và Sự kiện
                (dòng tiền biến động đột biến). Giúp chọn chiến lược phù hợp với khẩu vị
                — ưu tiên đà tăng, độ ổn định hay cơ hội sự kiện.
              </FeatureCard>

              <FeatureCard
                title="Nhóm vốn hóa"
                icon="mdi:scale-balance"
                image={
                  <Figure
                    src="/guides/overview/groups-chart-vonhoa.png"
                    alt="Biểu đồ nhóm vốn hóa"
                    sx={{ my: 0 }}
                  />
                }
              >
                Ba rổ chia theo quy mô vốn hóa: LargeCap (các doanh nghiệp đầu ngành),
                MidCap (quy mô vừa, thường gắn với dư địa tăng trưởng), SmallCap (quy mô
                nhỏ, biến động mạnh hơn). Theo dõi dòng tiền đang ưu tiên nhóm nào để cân
                đối tỷ trọng danh mục.
              </FeatureCard>
            </Box>
          </GuideSubAccordion>

          <Callout
            icon="mdi:arrow-right-circle-outline"
            title="Click vào tên nhóm để vào trang chi tiết"
            image={
              <Figure src="/guides/overview/groups-detail.png" alt="Trang chi tiết một nhóm" />
            }
          >
            Trang chi tiết của một rổ gồm biểu đồ giá, thông tin nhanh, biểu đồ chỉ số
            thanh khoản trong phiên, các biểu đồ phân tích dòng tiền, và danh sách mã nổi
            bật trong rổ. Từ đây bấm tiếp vào mã bất kỳ để sang trang phân tích cổ phiếu
            chi tiết.
          </Callout>
        </GuideAccordion>

        {/* ========================================================================
            ACCORDION 4: NHÓM NGÀNH
        ======================================================================== */}
        <GuideAccordion title="Nhóm ngành" icon="mdi:view-grid-outline">
          <Typography sx={bodyTextSx} paragraph>
            Nhóm ngành cho góc nhìn thị trường theo 24 ngành nghề thay vì từng mã riêng
            lẻ. Bảng tổng quan, các biểu đồ dòng tiền và bảng định giá ngành được đặt
            cạnh nhau để so sánh trực tiếp. Bấm vào tên ngành bất kỳ để vào trang chi
            tiết với đầy đủ mã thành phần và báo cáo liên quan.
          </Typography>

          <GuideSubAccordion title="Bảng tổng quan các ngành" icon="mdi:table">
            <InfoBox>
              Liệt kê đầy đủ 24 ngành với chỉ số giá ngành, biến động theo ngày, tuần,
              tháng, quý, năm, điểm dòng tiền phiên, điểm dòng tiền năm phiên và chỉ số
              thanh khoản. Mặc định sắp xếp theo điểm dòng tiền phiên giảm dần — ngành
              đang nóng nhất luôn ở trên cùng. Bấm vào tên ngành để mở trang chi tiết.
            </InfoBox>
            <Figure
              src="/guides/overview/sectors-table.png"
              alt="Bảng tổng quan các ngành nghề"
            />
          </GuideSubAccordion>

          <GuideSubAccordion title="Biểu đồ biến động dòng tiền ngành" icon="mdi:chart-multiple">
            <InfoBox>
              Khu vực này gồm bốn biểu đồ đặt cạnh nhau cho góc nhìn đa chiều: Dòng tiền
              trong phiên theo từng ngành, Chỉ số thanh khoản quy đổi phần trăm, Phân bổ
              dòng tiền (tỷ lệ mã vào - ra - đứng giá trong ngành), và Dòng tiền tuần qua
              năm phiên gần nhất. Yêu cầu gói hội viên phù hợp.
            </InfoBox>
            <Figure
              src="/guides/overview/sectors-cashflow.png"
              alt="Biểu đồ biến động dòng tiền ngành"
            />
          </GuideSubAccordion>

          <GuideSubAccordion title="Bảng tổng hợp định giá ngành" icon="mdi:calculator-variant">
            <InfoBox>
              Tập hợp đầy đủ các chỉ số định giá theo ngành: Vốn hóa, P/E, P/B, P/S, EPS,
              BVPS, PEG, EV/EBITDA. Đặt cạnh nhau để so sánh mặt bằng định giá giữa các
              ngành — nhận diện ngành nào đang giao dịch ở vùng đắt so với phần còn lại
              của thị trường, ngành nào đang chiết khấu. Yêu cầu gói hội viên phù hợp.
            </InfoBox>
            <Figure
              src="/guides/overview/sectors-valuation.png"
              alt="Bảng tổng hợp định giá ngành"
            />
          </GuideSubAccordion>

          <Callout
            icon="mdi:arrow-right-circle-outline"
            title="Click vào tên ngành để mở trang chi tiết"
            image={
              <Figure
                src="/guides/overview/sectors-detail.png"
                alt="Trang chi tiết một ngành"
              />
            }
          >
            Trang chi tiết một ngành có bốn phần: Dòng tiền (sức mạnh dòng tiền của ngành
            so với toàn thị trường), Cổ phiếu (danh sách các mã thuộc ngành), Tài chính
            (báo cáo tài chính tổng hợp cấp ngành), và Tin tức (các bài viết liên quan
            đến ngành).
          </Callout>
        </GuideAccordion>

        {/* ========================================================================
            ACCORDION 5: PHÂN TÍCH CỔ PHIẾU
        ======================================================================== */}
        <GuideAccordion title="Phân tích cổ phiếu" icon="mdi:chart-line">
          <Typography sx={bodyTextSx} paragraph>
            Trang phân tích chi tiết từng cổ phiếu theo đường dẫn dạng <code>/stocks/[MÃ]</code>
            {' '}(ví dụ <code>/stocks/FPT</code>). Luồng sử dụng thống nhất qua ba bước —
            chọn mã, xem biểu đồ và thông tin nhanh ở đầu trang, sau đó khám phá bốn phần
            phân tích chuyên sâu được tổ chức theo các lăng kính khác nhau.
          </Typography>

          <Step
            num={1}
            title="Chọn mã cổ phiếu muốn xem"
            media={
              <Figure
                src="/guides/overview/stocks-symbol-dropdown.png"
                alt="Dropdown chọn mã cổ phiếu"
                caption="Dropdown có search bar + danh sách mã, click mã để chuyển sang"
              />
            }
          >
            <Typography sx={bodyTextSx} paragraph>
              Bấm vào tên mã đang hiển thị ở đầu trang (ví dụ "Cổ phiếu FPT") để mở danh
              sách có ô tìm kiếm. Gõ mã cần xem, chọn từ kết quả — trang sẽ tải lại với
              dữ liệu hiển thị cho mã mới.
            </Typography>
          </Step>

          <Step
            num={2}
            title="Xem biểu đồ giá và thông tin nhanh"
            media={
              <Figure
                src="/guides/overview/stocks-symbol-top.png"
                alt="Phần biểu đồ + detail panel + bảng chỉ số tài chính"
              />
            }
          >
            <Typography sx={bodyTextSx} paragraph>
              Biểu đồ giá bên trái hỗ trợ nhiều khung thời gian, bảng thông tin bên phải
              hiển thị giá, khối lượng và biên độ hiện tại. Ngay dưới biểu đồ là bảng các
              chỉ số tài chính trọng yếu — doanh thu, lợi nhuận, P/E, P/B — để nắm nhanh
              sức khỏe doanh nghiệp trước khi đi sâu.
            </Typography>
          </Step>

          <Step
            num={3}
            title="Khám phá 4 phần phân tích chuyên sâu"
            media={
              <Box sx={stackSx}>
              <FeatureCard
                title="Dòng tiền"
                icon="mdi:cash-multiple"
                image={
                  <Figure
                    src="/guides/overview/stocks-symbol-tab-cashflow.png"
                    alt="Phần Dòng tiền"
                    sx={{ my: 0 }}
                  />
                }
              >
                Sức mạnh dòng tiền của mã so với toàn thị trường và so với ngành đang
                thuộc, tương quan giữa dòng tiền và biến động giá qua nhiều phiên, cùng
                xếp hạng của mã trong ngành và trên thị trường. Yêu cầu gói hội viên phù
                hợp.
              </FeatureCard>

              <FeatureCard
                title="Kỹ thuật"
                icon="mdi:chart-timeline-variant"
                image={
                  <Figure
                    src="/guides/overview/stocks-symbol-tab-pricemap.png"
                    alt="Phần Kỹ thuật"
                    sx={{ my: 0 }}
                  />
                }
              >
                Bản đồ giá trực quan: các vùng giao dịch tập trung khối lượng lớn, các
                mức hỗ trợ và kháng cự trọng yếu, kèm một số chỉ báo kỹ thuật phổ biến.
                Phù hợp cho giao dịch ngắn hạn và xác định vùng mua bán. Yêu cầu gói hội
                viên phù hợp.
              </FeatureCard>

              <FeatureCard
                title="Tài Chính"
                icon="mdi:file-chart"
                image={
                  <Figure
                    src="/guides/overview/stocks-symbol-tab-financials.png"
                    alt="Phần Tài Chính"
                    sx={{ my: 0 }}
                  />
                }
              >
                Báo cáo tài chính qua nhiều quý và nhiều năm — doanh thu, lợi nhuận, tài
                sản, nợ vay, dòng tiền — đi kèm biểu đồ xu hướng từng chỉ tiêu để đánh
                giá chất lượng kinh doanh theo chuỗi thời gian. Yêu cầu gói hội viên phù
                hợp.
              </FeatureCard>

              <FeatureCard
                title="Tin tức"
                icon="mdi:newspaper-variant-outline"
                image={
                  <Figure
                    src="/guides/overview/stocks-symbol-tab-news.png"
                    alt="Phần Tin tức"
                    sx={{ my: 0 }}
                  />
                }
              >
                Các bài viết có nhắc đến mã: tin từ doanh nghiệp, báo cáo phân tích, sự
                kiện liên quan. Đặt cạnh biểu đồ giá giúp hiểu bối cảnh đằng sau mỗi biến
                động đáng chú ý — cơ sở để hạn chế các phản ứng cảm tính với tin.
              </FeatureCard>
              </Box>
            }
          >
            <Typography sx={bodyTextSx} paragraph>
              Cuộn xuống dưới biểu đồ để thấy thanh chuyển giữa bốn phần: Dòng tiền, Kỹ
              thuật, Tài chính, Tin tức. Mỗi phần đào sâu vào một lăng kính phân tích
              khác nhau — chọn lăng kính phù hợp với câu hỏi đang cần trả lời.
            </Typography>
          </Step>
        </GuideAccordion>

        {/* ========================================================================
            ACCORDION 6: TIN TỨC
        ======================================================================== */}
        <GuideAccordion title="Tin tức" icon="mdi:newspaper-variant-outline">
          <Typography sx={bodyTextSx} paragraph>
            Trang Tin tức tập hợp các bài viết về tài chính và chứng khoán từ nhiều nguồn
            chính thống — Cổng thông tin Chính phủ, các trang chuyên về chứng khoán, các
            báo kinh tế lớn. Lọc theo loại tin hoặc theo mã cổ phiếu; bấm tiêu đề để đọc
            toàn văn trong trang riêng mà không phải rời ứng dụng.
          </Typography>

          <Box sx={stackSx}>
            <FeatureCard title="Tài chính quốc tế" icon="mdi:earth">
              Tin và sự kiện tài chính toàn cầu có khả năng ảnh hưởng đến Việt Nam: chính
              sách của Cục Dự trữ Liên bang Mỹ, diễn biến chứng khoán Mỹ, giá dầu, biến
              động tỷ giá các đồng tiền chủ chốt. Giúp nắm bối cảnh bên ngoài trước khi
              đánh giá dòng tiền vào thị trường trong nước.
            </FeatureCard>

            <FeatureCard title="Vĩ mô trong nước" icon="mdi:domain">
              Tin kinh tế Việt Nam: chính sách tiền tệ, lãi suất, tỷ giá, tăng trưởng
              GDP, lạm phát, cán cân xuất nhập khẩu. Đây là các yếu tố nền chi phối xu
              hướng trung và dài hạn của thị trường chứng khoán — thường có tác động
              trước khi truyền vào giá.
            </FeatureCard>

            <FeatureCard title="Doanh nghiệp niêm yết" icon="mdi:office-building">
              Tin và phân tích về các công ty niêm yết: kết quả kinh doanh, phát hành cổ
              phiếu, chia cổ tức, thay đổi nhân sự cấp cao. Nguồn thông tin chính khi cần
              tìm hiểu sâu một cổ phiếu cụ thể — đặt cạnh biểu đồ giá để đối chiếu phản
              ứng của thị trường.
            </FeatureCard>

            <FeatureCard title="Thông cáo chính phủ" icon="mdi:bank">
              Các văn bản chính thức từ Cổng thông tin điện tử Chính phủ — quyết định,
              nghị định, chính sách mới có tác động trực tiếp đến ngành nghề hoặc cơ chế
              vận hành thị trường. Thường dẫn trước các đợt tái định giá lớn ở nhóm ngành
              nhạy chính sách.
            </FeatureCard>
          </Box>

          <Callout icon="mdi:magnify" title="Lọc theo mã cổ phiếu">
            Ô tìm kiếm ở góc trên phải cho phép gõ mã chứng khoán; trang sẽ chỉ hiển thị
            các bài có nhắc đến mã đó. Tiện cho việc cập nhật nhanh các tin liên quan đến
            một cổ phiếu đang theo dõi hoặc đang cân nhắc mở vị thế.
          </Callout>
        </GuideAccordion>

        {/* ========================================================================
            ACCORDION 7: BÁO CÁO
        ======================================================================== */}
        <GuideAccordion title="Báo cáo" icon="mdi:file-document-outline">
          <Typography sx={bodyTextSx} paragraph>
            Trang Báo cáo tập hợp các bản phân tích tổng hợp do Finext biên soạn, tóm
            lược thị trường theo từng chu kỳ — ngày, tuần, tháng. Mỗi báo cáo đã qua chọn
            lọc và phân tích, tiết kiệm thời gian so với tự đọc nhiều nguồn rời rạc rồi
            tổng hợp lại. Yêu cầu gói hội viên phù hợp.
          </Typography>

          <Box sx={{ my: 2 }}>
            <TimelineItem label="Hàng ngày" title="Báo cáo tổng kết phiên">
              Tóm tắt diễn biến phiên giao dịch: các chỉ số chính biến động ra sao, ngành
              và nhóm cổ phiếu nào nổi bật, cán cân khối ngoại, các sự kiện đáng chú ý
              trong phiên. Đọc vào cuối ngày hoặc đầu phiên hôm sau để nắm nhanh bối cảnh
              trước khi quyết định giao dịch.
            </TimelineItem>

            <TimelineItem label="Hàng tuần" title="Báo cáo tổng kết tuần">
              Tổng kết xu hướng tuần: các mã và ngành tăng giảm nổi bật, dòng tiền luân
              chuyển giữa các nhóm, các sự kiện lớn tác động đến thị trường. Giúp nhìn rõ
              hơn xu hướng ngắn hạn và điều chỉnh chiến lược cho tuần kế tiếp.
            </TimelineItem>

            <TimelineItem label="Hàng tháng" title="Báo cáo tổng kết tháng">
              Báo cáo quy mô lớn đi sâu vào diễn biến cả tháng: các chủ đề đầu tư nổi
              bật, cập nhật vĩ mô, đánh giá triển vọng từng ngành và dự báo xu hướng. Phù
              hợp khi cần nhìn thị trường ở góc độ trung hạn hoặc kiểm tra lại luận điểm
              đầu tư đã xây dựng.
            </TimelineItem>
          </Box>

          <Callout icon="mdi:magnify" title="Lọc báo cáo theo mã ngành hoặc mã cổ phiếu">
            Ô "Lọc theo Mã Ngành, Mã CP" ở góc trên phải giúp tìm nhanh báo cáo có liên
            quan đến mã hoặc ngành cụ thể đang theo dõi. Bấm vào tiêu đề báo cáo để mở
            trang chi tiết với nội dung đầy đủ, biểu đồ đính kèm, và các mã được đề cập
            được làm nổi bật.
          </Callout>
        </GuideAccordion>
      </Box>
    </Box>
  );
}
