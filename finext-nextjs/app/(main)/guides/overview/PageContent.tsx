'use client';

import { Box, Typography } from '@mui/material';
import GuideAccordion from '../components/GuideAccordion';
import GuideSubAccordion from '../components/GuideSubAccordion';
import GuideBreadcrumb from '../components/GuideBreadcrumb';
import {
  bodyTextSx,
  smallTextSx,
  pageTitleSx,
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
      <GuideBreadcrumb items={[]} />

      <Typography sx={pageTitleSx}>Tổng quan các tính năng</Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column' }}>

        {/* ========================================================================
            ACCORDION 1: TRANG CHỦ
        ======================================================================== */}
        <GuideAccordion title="Trang chủ" icon="mdi:home-variant">
          <Typography sx={bodyTextSx} paragraph>
            Trang chủ là nơi bạn nắm nhanh thị trường đang diễn ra như thế nào trong ngày:
            chỉ số chính đang tăng hay giảm, nhóm ngành nào đang nóng, cổ phiếu nào được
            chú ý, và tin tức mới. Số liệu tự động cập nhật liên tục, không cần tải lại
            trang.
          </Typography>

          <GuideSubAccordion title="Chỉ số nhanh" icon="mdi:view-dashboard-outline">
            <InfoBox>
              6 ô nhỏ ở đầu trang cho bạn xem ngay các chỉ số VNINDEX, VN30, HNX, UPCoM...
              đang tăng hay giảm bao nhiêu, kèm biểu đồ nhỏ trong phiên. Click vào ô nào
              thì biểu đồ lớn bên dưới sẽ chuyển sang chỉ số đó.
            </InfoBox>
            <Figure
              src="/guides/overview/home-mini-indexes.png"
              alt="6 mini chỉ số ở đầu trang"
            />
          </GuideSubAccordion>

          <GuideSubAccordion title="Thị trường" icon="mdi:chart-line">
            <InfoBox>
              Biểu đồ lớn của một chỉ số kèm bảng liệt kê các chỉ số khác. Click vào mã nào
              trong bảng, biểu đồ sẽ chuyển sang mã đó. Bạn chuyển qua lại giữa 3 nhóm: Chỉ
              số sàn chính, chỉ số phái sinh, và chỉ số do Finext tự xây dựng.
            </InfoBox>
            <Figure
              src="/guides/overview/home-market-section.png"
              alt="Biểu đồ thị trường"
            />
          </GuideSubAccordion>

          <GuideSubAccordion title="Diễn biến thị trường" icon="mdi:chart-bar">
            <InfoBox>
              Cho bạn biết trong phiên có bao nhiêu cổ phiếu tăng - giảm và khối ngoại đang
              mua vào hay bán ra nhiều hơn. Nhìn vào đây bạn đọc được "tâm lý chung" của
              phiên, biết thị trường đang hưng phấn hay thận trọng.
            </InfoBox>
            <Figure
              src="/guides/overview/home-volatility.png"
              alt="Diễn biến thị trường"
            />
          </GuideSubAccordion>

          <GuideSubAccordion title="Nhóm ngành" icon="mdi:view-grid-outline">
            <InfoBox>
              Các ô xếp cạnh nhau đại diện cho từng ngành (ngân hàng, bất động sản, chứng
              khoán, thép...). Ngành nào đang tăng mạnh hoặc có nhiều tiền đổ vào sẽ hiện
              nổi bật hơn, bạn dễ nhận ra bằng mắt mà không cần so số cụ thể.
            </InfoBox>
            <Figure
              src="/guides/overview/home-industry.png"
              alt="Nhóm ngành"
            />
          </GuideSubAccordion>

          <GuideSubAccordion title="Cổ phiếu nổi bật theo ngành" icon="mdi:star-outline">
            <InfoBox>
              Danh sách các mã tiêu biểu của những ngành đang dẫn đầu thị trường, giúp bạn
              nhanh chóng nhận ra cơ hội tiềm năng trong ngày mà không cần mở từng ngành
              xem riêng từng mã một.
            </InfoBox>
            <Figure
              src="/guides/overview/home-industry-stocks.png"
              alt="Cổ phiếu nổi bật theo ngành"
            />
          </GuideSubAccordion>

          <GuideSubAccordion title="Tin tức" icon="mdi:newspaper-variant-outline">
            <InfoBox>
              Các bài viết mới nhất được tổng hợp từ nhiều nguồn tài chính uy tín, click vào
              là đọc chi tiết ngay. Muốn xem nhiều tin hơn hoặc lọc theo chủ đề, hãy vào
              mục Tin tức — có hướng dẫn riêng ở phía dưới.
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
            Trang Thị trường cho bạn cái nhìn sâu hơn về toàn cảnh thị trường so với trang
            chủ. Gồm biểu đồ chi tiết của từng chỉ số kèm bảng chỉ số, và 5 phần đi sâu
            vào từng góc nhìn khác nhau của thị trường.
          </Typography>

          <GuideSubAccordion title="Biểu đồ chỉ số" icon="mdi:chart-line">
            <InfoBox>
              Biểu đồ bên trái hiển thị diễn biến của chỉ số đang chọn (mặc định VNINDEX),
              có thể xem theo nhiều khung thời gian. Bảng bên phải liệt kê các chỉ số sàn
              chính và chỉ số Finext xây dựng — click vào mã nào thì biểu đồ sẽ chuyển sang
              mã đó ngay lập tức.
            </InfoBox>
            <Figure
              src="/guides/overview/markets-top-section.png"
              alt="Biểu đồ và bảng chỉ số"
            />
          </GuideSubAccordion>

          <GuideSubAccordion title="Biến động" icon="mdi:chart-bar">
            <InfoBox>
              Xem trong phiên nhóm nào đang kéo chỉ số lên hay xuống, cổ phiếu tăng - giảm
              mạnh nhất, và độ rộng thị trường (bao nhiêu mã tăng so với giảm).
            </InfoBox>
            <Figure
              src="/guides/overview/markets-tab-bien-dong.png"
              alt="Phần Biến động"
            />
          </GuideSubAccordion>

          <GuideSubAccordion title="Dòng tiền" icon="mdi:cash-multiple">
            <InfoBox>
              Theo dõi tiền đang chảy vào ngành nào, nhóm vốn hóa nào đang được mua mạnh —
              chỉ báo quan trọng để hiểu nhà đầu tư đang ưu tiên đâu.
            </InfoBox>
            <Figure
              src="/guides/overview/markets-tab-dong-tien.png"
              alt="Phần Dòng tiền"
            />
          </GuideSubAccordion>

          <GuideSubAccordion title="Định giá" icon="mdi:calculator-variant">
            <InfoBox>
              P/E, P/B, EPS của thị trường và từng ngành so với trung bình lịch sử — xem
              thị trường đang đắt hay rẻ, ngành nào đang giao dịch dưới giá trị hợp lý.
            </InfoBox>
            <Figure
              src="/guides/overview/markets-tab-dinh-gia.png"
              alt="Phần Định giá"
            />
          </GuideSubAccordion>

          <GuideSubAccordion title="Kỹ thuật" icon="mdi:chart-timeline-variant">
            <InfoBox>
              Tín hiệu kỹ thuật cho toàn thị trường: Xu hướng, hỗ trợ/kháng cự, mẫu hình.
              Phù hợp nhà đầu tư theo phân tích kỹ thuật (yêu cầu gói hội viên phù hợp).
            </InfoBox>
            <Figure
              src="/guides/overview/markets-tab-ky-thuat.png"
              alt="Phần Kỹ thuật"
            />
          </GuideSubAccordion>

          <GuideSubAccordion title="Nước ngoài và Tự doanh" icon="mdi:earth">
            <InfoBox>
              Hai phần có cách bố trí tương tự nhau, thống kê mua - bán ròng theo ngày,
              top mã được mua / bán mạnh nhất, và xu hướng nhiều phiên gần đây. Nước ngoài
              cho bạn thấy dòng vốn quốc tế đang nghĩ gì về thị trường, còn Tự doanh cho
              bạn thấy các công ty chứng khoán trong nước — những "người trong nghề"
              thường có thông tin tốt và hành động sớm — đang đi hướng nào.
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
            Trang Nhóm cổ phiếu tập hợp các "rổ" cổ phiếu do Finext xây dựng theo từng chủ
            đề. Thay vì theo dõi từng mã riêng lẻ, bạn nhìn cả một nhóm để hiểu xu hướng
            tổng thể — ví dụ muốn biết cổ phiếu vốn hóa vừa đang thế nào, xem rổ MIDCAP.
          </Typography>

          <GuideSubAccordion title="Bảng tổng quan các nhóm cổ phiếu" icon="mdi:table">
            <InfoBox>
              Bảng hiển thị 8 nhóm Finext (FNXINDEX, FNX100, Vượt trội, Ổn định, Sự kiện,
              LargeCap, MidCap, SmallCap) kèm giá, % thay đổi theo ngày - tuần - tháng -
              quý - năm, và điểm dòng tiền. Click vào tên nhóm để mở trang chi tiết.
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
                Gồm FNXINDEX và FNX100 đại diện cho toàn thị trường và top 100 cổ phiếu lớn
                nhất. Nhìn vào đây bạn biết "bức tranh" chung vì 2 rổ này thường di chuyển
                cùng chiều với dòng tiền thị trường chung.
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
                Gồm 3 rổ: Vượt trội (cổ phiếu có dòng tiền mạnh nhất), Ổn định (dòng tiền
                đều đặn, rủi ro thấp), và Sự kiện (có tin tức hoặc biến động đặc biệt).
                Giúp bạn chọn chiến lược theo khẩu vị — tấn công hay phòng thủ.
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
                Chia theo quy mô: LargeCap (lớn, ổn định), MidCap (vừa, tiềm năng tăng
                trưởng), SmallCap (nhỏ, biến động mạnh). Xem nhóm nào đang được dòng tiền
                ưu tiên để cân đối chiến lược phân bổ tài sản.
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
            Trang chi tiết 1 nhóm có biểu đồ giá, thông tin nhanh, biểu đồ VSI trong phiên,
            các biểu đồ dòng tiền, và danh sách cổ phiếu nổi bật thuộc nhóm. Từ đây click
            tiếp vào mã để sang trang phân tích cổ phiếu.
          </Callout>
        </GuideAccordion>

        {/* ========================================================================
            ACCORDION 4: NHÓM NGÀNH
        ======================================================================== */}
        <GuideAccordion title="Nhóm ngành" icon="mdi:view-grid-outline">
          <Typography sx={bodyTextSx} paragraph>
            Trang Nhóm ngành giúp bạn nhìn thị trường từ góc độ ngành nghề thay vì từng mã
            riêng lẻ. Bạn sẽ thấy bảng các ngành, các biểu đồ dòng tiền theo ngành, và khi
            click vào một ngành cụ thể sẽ mở trang chi tiết của ngành đó.
          </Typography>

          <GuideSubAccordion title="Bảng tổng quan các ngành" icon="mdi:table">
            <InfoBox>
              Liệt kê toàn bộ ngành với giá chỉ số ngành, chênh lệch và % thay đổi theo
              ngày - tuần - tháng - quý - năm, điểm dòng tiền trong phiên (T0), điểm dòng
              tiền 5 phiên (T5), và chỉ số thanh khoản VSI. Bảng sắp xếp mặc định theo
              điểm dòng tiền trong phiên giảm dần — ngành nóng nhất nằm trên. Click vào
              tên ngành để mở trang chi tiết.
            </InfoBox>
            <Figure
              src="/guides/overview/sectors-table.png"
              alt="Bảng tổng quan các ngành nghề"
            />
          </GuideSubAccordion>

          <GuideSubAccordion title="Biểu đồ biến động dòng tiền ngành" icon="mdi:chart-multiple">
            <InfoBox>
              Khu vực "Dòng tiền ngành nghề" gồm 4 biểu đồ xếp cạnh nhau cho bạn cái nhìn
              đa chiều: <strong>Dòng tiền trong phiên</strong> (điểm T0 theo từng ngành),
              <strong> Chỉ số thanh khoản</strong> (VSI quy đổi sang %),
              <strong> Phân bổ dòng tiền</strong> (tỷ lệ mã vào / ra / đứng giá trong ngành),
              và <strong>Dòng tiền trong tuần</strong> (điểm T0 qua 5 phiên T-4 → T-0).
              Phần này yêu cầu gói hội viên phù hợp.
            </InfoBox>
            <Figure
              src="/guides/overview/sectors-cashflow.png"
              alt="Biểu đồ biến động dòng tiền ngành"
            />
          </GuideSubAccordion>

          <GuideSubAccordion title="Bảng tổng hợp định giá ngành" icon="mdi:calculator-variant">
            <InfoBox>
              Bảng liệt kê các chỉ số định giá của từng ngành: Vốn hóa, P/E, P/B, P/S,
              EPS, BVPS, PEG, EV/EBITDA. Dùng để so sánh mặt bằng định giá giữa các ngành
              — ngành nào đang đắt, ngành nào đang rẻ so với phần còn lại của thị trường.
              Phần này yêu cầu gói hội viên phù hợp.
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
            Trang chi tiết 1 ngành có 4 phần: <strong>Dòng tiền</strong> (sức mạnh dòng tiền
            ngành so với thị trường), <strong>Cổ phiếu</strong> (danh sách các mã thuộc
            ngành), <strong>Tài Chính</strong> (báo cáo tài chính tổng hợp ngành), và
            <strong> Tin tức</strong> (bài viết liên quan đến ngành).
          </Callout>
        </GuideAccordion>

        {/* ========================================================================
            ACCORDION 5: PHÂN TÍCH CỔ PHIẾU
        ======================================================================== */}
        <GuideAccordion title="Phân tích cổ phiếu" icon="mdi:chart-line">
          <Typography sx={bodyTextSx} paragraph>
            Trang phân tích chi tiết một cổ phiếu cụ thể (ví dụ <code>/stocks/FPT</code>).
            Mỗi lần bạn truy cập sẽ theo cùng một luồng: Chọn mã → xem biểu đồ và thông tin
            nhanh → khám phá 4 phần phân tích sâu hơn bên dưới.
          </Typography>

          <Step num={1} title="Chọn mã cổ phiếu muốn xem">
            <Typography sx={bodyTextSx} paragraph>
              Click vào tên mã ở phía trên (vd "Cổ phiếu FPT") để mở dropdown với ô tìm
              kiếm. Gõ mã bất kỳ rồi chọn — trang sẽ reload với mã mới.
            </Typography>
            <Figure
              src="/guides/overview/stocks-symbol-dropdown.png"
              alt="Dropdown chọn mã cổ phiếu"
              caption="Dropdown có search bar + danh sách mã, click mã để chuyển sang"
            />
          </Step>

          <Step num={2} title="Xem biểu đồ giá và thông tin nhanh">
            <Typography sx={bodyTextSx} paragraph>
              Biểu đồ giá bên trái với nhiều khung thời gian, panel bên phải hiển thị giá
              hiện tại, khối lượng, biên độ. Dưới biểu đồ có bảng các chỉ số tài chính
              quan trọng (doanh thu, lợi nhuận, P/E, P/B) để nắm nhanh sức khỏe doanh nghiệp.
            </Typography>
            <Figure
              src="/guides/overview/stocks-symbol-top.png"
              alt="Phần biểu đồ + detail panel + bảng chỉ số tài chính"
            />
          </Step>

          <Step num={3} title="Khám phá 4 phần phân tích chuyên sâu">
            <Typography sx={bodyTextSx} paragraph>
              Cuộn xuống dưới biểu đồ, bạn thấy thanh 4 phần: Dòng tiền, Kỹ thuật, Tài Chính,
              Tin tức. Click từng phần để đi sâu vào góc nhìn đó.
            </Typography>
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
                Sức mạnh dòng tiền so với thị trường và ngành, tương quan giữa dòng tiền
                và giá, xếp hạng của mã (yêu cầu gói hội viên phù hợp).
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
                Bản đồ giá: Vùng giao dịch nhiều, hỗ trợ - kháng cự, chỉ báo kỹ thuật phổ
                biến. Đắc lực cho giao dịch ngắn hạn (yêu cầu gói hội viên phù hợp).
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
                Báo cáo tài chính qua nhiều quý, năm (doanh thu, lợi nhuận, tài sản, nợ
                vay...) kèm biểu đồ xu hướng (yêu cầu gói hội viên phù hợp).
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
                Các bài viết nhắc đến mã này: Tin công ty, báo cáo phân tích, sự kiện
                liên quan. Giúp hiểu bối cảnh đằng sau biến động giá gần đây.
              </FeatureCard>
            </Box>
          </Step>
        </GuideAccordion>

        {/* ========================================================================
            ACCORDION 6: TIN TỨC
        ======================================================================== */}
        <GuideAccordion title="Tin tức" icon="mdi:newspaper-variant-outline">
          <Typography sx={bodyTextSx} paragraph>
            Trang Tin tức tổng hợp các bài viết tài chính - chứng khoán từ nhiều nguồn uy
            tín (Cổng thông tin Chính phủ, Tin nhanh chứng khoán, các báo kinh tế...). Bạn
            lọc theo loại tin hoặc theo mã cổ phiếu cụ thể, click vào bài để đọc chi tiết
            trong trang riêng mà không phải rời app.
          </Typography>

          <Box sx={stackSx}>
            <FeatureCard title="Tài chính quốc tế" icon="mdi:earth">
              Tin tức và sự kiện kinh tế - tài chính toàn cầu ảnh hưởng đến Việt Nam: FED,
              chứng khoán Mỹ, giá dầu, tỷ giá... Giúp hiểu bối cảnh quốc tế tác động thế
              nào đến dòng tiền vào thị trường.
            </FeatureCard>

            <FeatureCard title="Vĩ mô trong nước" icon="mdi:domain">
              Tin kinh tế Việt Nam: Chính sách tiền tệ, lãi suất, tỷ giá, GDP, lạm phát,
              xuất nhập khẩu. Các yếu tố chi phối xu hướng dài hạn của thị trường chứng
              khoán trong nước.
            </FeatureCard>

            <FeatureCard title="Doanh nghiệp niêm yết" icon="mdi:office-building">
              Tin và phân tích về các công ty niêm yết: Kết quả kinh doanh, phát hành cổ
              phiếu, chia cổ tức, thay đổi lãnh đạo. Nguồn thông tin chính khi tìm hiểu
              sâu về một cổ phiếu cụ thể.
            </FeatureCard>

            <FeatureCard title="Thông cáo chính phủ" icon="mdi:bank">
              Thông cáo chính thức từ Cổng thông tin điện tử Chính phủ — quyết định, nghị
              định, chính sách mới tác động trực tiếp đến ngành nghề hoặc cơ chế vận hành
              thị trường.
            </FeatureCard>
          </Box>

          <Callout icon="mdi:magnify" title="Lọc theo mã cổ phiếu">
            Ô tìm kiếm ở góc trên phải cho phép bạn gõ mã chứng khoán, trang sẽ chỉ hiển
            thị các bài có nhắc đến mã đó. Tiện khi muốn cập nhật nhanh tin tức liên quan
            đến một cổ phiếu bạn đang quan tâm.
          </Callout>
        </GuideAccordion>

        {/* ========================================================================
            ACCORDION 7: BÁO CÁO
        ======================================================================== */}
        <GuideAccordion title="Báo cáo" icon="mdi:file-document-outline">
          <Typography sx={bodyTextSx} paragraph>
            Trang Báo cáo là nơi đọc các bản phân tích tổng hợp do Finext biên soạn, tóm
            tắt thị trường theo từng chu kỳ. Đây là nội dung đã qua chọn lọc và phân tích
            kỹ, tiết kiệm thời gian so với tự đọc nhiều nguồn tin lẻ rồi tổng hợp. Trang
            này yêu cầu gói hội viên phù hợp.
          </Typography>

          <Box sx={{ my: 2 }}>
            <TimelineItem label="Hàng ngày" title="Báo cáo tổng kết phiên">
              Tóm tắt những gì đã xảy ra trong phiên giao dịch: Chỉ số chính biến động thế
              nào, nhóm ngành nào nổi bật, khối ngoại mua bán ra sao, các sự kiện đáng
              chú ý. Đọc vào buổi tối hoặc sáng hôm sau để nắm nhanh bức tranh ngày trước.
            </TimelineItem>

            <TimelineItem label="Hàng tuần" title="Báo cáo tổng kết tuần">
              Tổng kết xu hướng tuần vừa qua: Cổ phiếu và ngành tăng giảm nổi bật, dòng
              tiền luân chuyển thế nào, các sự kiện lớn tác động đến thị trường. Giúp bạn
              nhìn xu hướng ngắn hạn rõ hơn và điều chỉnh chiến lược cho tuần tới.
            </TimelineItem>

            <TimelineItem label="Hàng tháng" title="Báo cáo tổng kết tháng">
              Báo cáo quy mô lớn đi sâu vào diễn biến cả tháng: Các chủ đề đầu tư nổi
              bật, cập nhật vĩ mô, đánh giá các ngành và dự báo xu hướng. Phù hợp khi bạn
              muốn nhìn thị trường ở góc độ dài hạn và kiểm tra lại luận điểm đầu tư.
            </TimelineItem>
          </Box>

          <Callout icon="mdi:magnify" title="Lọc báo cáo theo mã ngành hoặc mã cổ phiếu">
            Ô "Lọc theo Mã Ngành, Mã CP" ở góc trên phải giúp tìm nhanh báo cáo có liên
            quan đến mã hoặc ngành cụ thể mà bạn đang theo dõi. Click vào tiêu đề báo cáo
            để mở trang chi tiết với nội dung đầy đủ, biểu đồ đính kèm, và các mã được
            đề cập được nhấn mạnh.
          </Callout>
        </GuideAccordion>
      </Box>
    </Box>
  );
}
