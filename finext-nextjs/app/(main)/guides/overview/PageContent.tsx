'use client';

import { Box, Typography } from '@mui/material';
import GuideAccordion from '../components/GuideAccordion';
import GuideBreadcrumb from '../components/GuideBreadcrumb';
import {
  bodyTextSx,
  smallTextSx,
  subHeadingSx,
  pageTitleSx,
  Figure,
  Step,
  FeatureCard,
  Callout,
  TimelineItem,
} from '../components/GuideBlocks';
import { spacing, fontWeight } from 'theme/tokens';

// Box wrapper giúp stack FeatureCards hoặc sections dọc đều nhau
const stackSx = { display: 'flex', flexDirection: 'column', gap: 2, my: 2 } as const;

export default function OverviewContent() {
  return (
    <Box sx={{ py: spacing.xs }}>
      <GuideBreadcrumb items={[]} />

      <Typography sx={pageTitleSx}>Tổng quan các tính năng</Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column' }}>

        {/* ========================================================================
            ACCORDION 1: TRANG CHỦ — Layout: Subheading narrative (plain vertical)
        ======================================================================== */}
        <GuideAccordion title="Trang chủ" icon="mdi:home-variant">
          <Typography sx={bodyTextSx} paragraph>
            Trang chủ là nơi bạn nắm nhanh thị trường đang diễn ra như thế nào trong ngày:
            chỉ số chính đang tăng hay giảm, nhóm ngành nào đang nóng, cổ phiếu nào được
            chú ý, và tin tức mới. Số liệu tự động cập nhật liên tục, không cần tải lại
            trang.
          </Typography>

          <Typography sx={subHeadingSx}>1. Chỉ số nhanh</Typography>
          <Figure
            src="/guides/overview/home-mini-indexes.png"
            alt="6 mini chỉ số ở đầu trang"
          />
          <Typography sx={bodyTextSx}>
            6 ô nhỏ ở đầu trang cho bạn xem ngay các chỉ số VNINDEX, VN30, HNX, UPCoM...
            đang tăng hay giảm bao nhiêu, kèm biểu đồ nhỏ trong phiên. Click vào ô nào
            thì biểu đồ lớn bên dưới sẽ chuyển sang chỉ số đó.
          </Typography>

          <Typography sx={subHeadingSx}>2. Thị trường</Typography>
          <Figure
            src="/guides/overview/home-market-section.png"
            alt="Biểu đồ thị trường"
          />
          <Typography sx={bodyTextSx}>
            Biểu đồ lớn của một chỉ số kèm bảng liệt kê các chỉ số khác. Click vào mã nào
            trong bảng, biểu đồ sẽ chuyển sang mã đó. Bạn chuyển qua lại giữa 3 nhóm: Chỉ
            số sàn chính, chỉ số phái sinh, và chỉ số do Finext tự xây dựng.
          </Typography>

          <Typography sx={subHeadingSx}>3. Diễn biến thị trường</Typography>
          <Figure
            src="/guides/overview/home-volatility.png"
            alt="Diễn biến thị trường"
          />
          <Typography sx={bodyTextSx}>
            Cho bạn biết trong phiên có bao nhiêu cổ phiếu tăng - giảm và khối ngoại đang
            mua vào hay bán ra nhiều hơn. Nhìn vào đây bạn đọc được "tâm lý chung" của
            phiên, biết thị trường đang hưng phấn hay thận trọng.
          </Typography>

          <Typography sx={subHeadingSx}>4. Nhóm ngành</Typography>
          <Figure
            src="/guides/overview/home-industry.png"
            alt="Nhóm ngành"
          />
          <Typography sx={bodyTextSx}>
            Các ô xếp cạnh nhau đại diện cho từng ngành (ngân hàng, bất động sản, chứng
            khoán, thép...). Ngành nào đang tăng mạnh hoặc có nhiều tiền đổ vào sẽ hiện
            nổi bật hơn, bạn dễ nhận ra bằng mắt mà không cần so số cụ thể.
          </Typography>

          <Typography sx={subHeadingSx}>5. Cổ phiếu nổi bật theo ngành</Typography>
          <Figure
            src="/guides/overview/home-industry-stocks.png"
            alt="Cổ phiếu nổi bật theo ngành"
          />
          <Typography sx={bodyTextSx}>
            Danh sách các mã tiêu biểu của những ngành đang dẫn đầu thị trường, giúp bạn
            nhanh chóng nhận ra cơ hội tiềm năng trong ngày mà không cần mở từng ngành
            xem riêng từng mã một.
          </Typography>

          <Typography sx={subHeadingSx}>6. Tin tức</Typography>
          <Figure
            src="/guides/overview/home-news.png"
            alt="Tin tức trên trang chủ"
          />
          <Typography sx={bodyTextSx}>
            Các bài viết mới nhất được tổng hợp từ nhiều nguồn tài chính uy tín, click vào
            là đọc chi tiết ngay. Muốn xem nhiều tin hơn hoặc lọc theo chủ đề, hãy vào
            mục Tin tức — có hướng dẫn riêng ở phía dưới.
          </Typography>
        </GuideAccordion>

        {/* ========================================================================
            ACCORDION 2: THỊ TRƯỜNG — Layout: Hero + subheading block + stacked FeatureCards
        ======================================================================== */}
        <GuideAccordion title="Thị trường" icon="mdi:chart-box-outline">
          <Typography sx={bodyTextSx} paragraph>
            Trang Thị trường cho bạn cái nhìn sâu hơn về toàn cảnh thị trường so với trang
            chủ. Phần trên là biểu đồ chi tiết của từng chỉ số kèm bảng chỉ số; phần dưới
            có 6 phần đi sâu vào từng góc nhìn khác nhau của thị trường.
          </Typography>

          <Typography sx={subHeadingSx}>Phần trên: Biểu đồ và bảng chỉ số</Typography>
          <Figure
            src="/guides/overview/markets-top-section.png"
            alt="Biểu đồ và bảng chỉ số ở phần trên"
          />
          <Typography sx={bodyTextSx}>
            Biểu đồ bên trái hiển thị diễn biến của chỉ số đang chọn (mặc định VNINDEX),
            có thể xem theo nhiều khung thời gian. Bảng bên phải liệt kê các chỉ số sàn
            chính và chỉ số Finext xây dựng — click vào mã nào thì biểu đồ sẽ chuyển sang
            mã đó ngay lập tức.
          </Typography>

          <Typography sx={subHeadingSx}>Phần dưới: 6 phần phân tích riêng biệt</Typography>
          <Box sx={stackSx}>
            <FeatureCard
              title="Biến động"
              icon="mdi:chart-bar"
              image={
                <Figure
                  src="/guides/overview/markets-tab-bien-dong.png"
                  alt="Phần Biến động"
                  sx={{ my: 0 }}
                />
              }
            >
              Xem trong phiên nhóm nào đang kéo chỉ số lên hay xuống, cổ phiếu tăng - giảm
              mạnh nhất, và độ rộng thị trường (bao nhiêu mã tăng so với giảm).
            </FeatureCard>

            <FeatureCard
              title="Dòng tiền"
              icon="mdi:cash-multiple"
              image={
                <Figure
                  src="/guides/overview/markets-tab-dong-tien.png"
                  alt="Phần Dòng tiền"
                  sx={{ my: 0 }}
                />
              }
            >
              Theo dõi tiền đang chảy vào ngành nào, nhóm vốn hóa nào đang được mua mạnh —
              chỉ báo quan trọng để hiểu nhà đầu tư đang ưu tiên đâu.
            </FeatureCard>

            <FeatureCard
              title="Định giá"
              icon="mdi:calculator-variant"
              image={
                <Figure
                  src="/guides/overview/markets-tab-dinh-gia.png"
                  alt="Phần Định giá"
                  sx={{ my: 0 }}
                />
              }
            >
              P/E, P/B, EPS của thị trường và từng ngành so với trung bình lịch sử — xem
              thị trường đang đắt hay rẻ, ngành nào đang giao dịch dưới giá trị hợp lý.
            </FeatureCard>

            <FeatureCard
              title="Kỹ thuật"
              icon="mdi:chart-timeline-variant"
              image={
                <Figure
                  src="/guides/overview/markets-tab-ky-thuat.png"
                  alt="Phần Kỹ thuật"
                  sx={{ my: 0 }}
                />
              }
            >
              Tín hiệu kỹ thuật cho toàn thị trường: Xu hướng, hỗ trợ/kháng cự, mẫu hình.
              Phù hợp nhà đầu tư theo phân tích kỹ thuật (yêu cầu gói hội viên phù hợp).
            </FeatureCard>

            <FeatureCard
              title="Nước ngoài & Tự doanh"
              icon="mdi:earth"
              image={
                <Figure
                  src="/guides/overview/markets-tab-nuoc-ngoai.png"
                  alt="Phần Nước ngoài & Tự doanh"
                  sx={{ my: 0 }}
                />
              }
            >
              Hai phần có cách bố trí tương tự nhau, thống kê mua - bán ròng theo ngày,
              top mã được mua / bán mạnh nhất, và xu hướng nhiều phiên gần đây. Nước ngoài
              cho bạn thấy dòng vốn quốc tế đang nghĩ gì về thị trường, còn Tự doanh cho
              bạn thấy các công ty chứng khoán trong nước — những "người trong nghề"
              thường có thông tin tốt và hành động sớm — đang đi hướng nào.
            </FeatureCard>
          </Box>
        </GuideAccordion>

        {/* ========================================================================
            ACCORDION 3: PHÂN TÍCH CỔ PHIẾU — Layout: Numbered steps (vertical walkthrough)
        ======================================================================== */}
        <GuideAccordion title="Phân tích cổ phiếu" icon="mdi:chart-line">
          <Typography sx={bodyTextSx} paragraph>
            Trang phân tích chi tiết một cổ phiếu cụ thể (ví dụ <code>/stocks/FPT</code>).
            Mỗi lần bạn truy cập sẽ theo cùng một luồng: Chọn mã → xem biểu đồ và thông tin
            nhanh → khám phá 4 phần phân tích sâu hơn bên dưới.
          </Typography>

          <Figure
            src="/guides/overview/stocks-symbol-overview.png"
            alt="Toàn cảnh trang phân tích cổ phiếu"
            caption="Tên mã + dropdown ở trên, biểu đồ giữa, thanh 4 phần phân tích bên dưới"
          />

          <Typography sx={subHeadingSx}>Hướng dẫn theo bước</Typography>

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
            ACCORDION 4: NHÓM NGÀNH — Layout: Section blocks (plain + glass) + callout
        ======================================================================== */}
        <GuideAccordion title="Nhóm ngành" icon="mdi:view-grid-outline">
          <Typography sx={bodyTextSx} paragraph>
            Trang Nhóm ngành giúp bạn nhìn thị trường từ góc độ ngành nghề thay vì từng mã
            riêng lẻ. Bạn sẽ thấy bảng các ngành, các biểu đồ dòng tiền theo ngành, và khi
            click vào một ngành cụ thể sẽ mở trang chi tiết của ngành đó.
          </Typography>

          <Figure
            src="/guides/overview/sectors-overview.png"
            alt="Toàn cảnh trang Nhóm ngành"
            caption="Cấu trúc: Bảng ngành ở trên, các biểu đồ dòng tiền ngành ở giữa, bảng định giá ở cuối"
          />

          <Typography sx={subHeadingSx}>Bảng các ngành ở phần trên</Typography>
          <Figure
            src="/guides/overview/sectors-table.png"
            alt="Bảng các ngành"
          />
          <Typography sx={bodyTextSx}>
            Liệt kê toàn bộ ngành với giá chỉ số ngành, % thay đổi theo ngày - tuần -
            tháng - quý - năm, điểm dòng tiền, và VSI. Bảng sắp xếp mặc định theo điểm
            dòng tiền giảm dần — ngành nóng nhất nằm trên. Click vào tên ngành để mở
            trang chi tiết.
          </Typography>

          <Typography sx={subHeadingSx}>4 biểu đồ dòng tiền ngành</Typography>
          <Typography sx={{ ...bodyTextSx, mb: 2 }}>
            Phần này yêu cầu gói hội viên phù hợp. 4 biểu đồ xếp cạnh nhau cho bạn cái
            nhìn đa chiều về dòng tiền của từng ngành:
          </Typography>
          <Box sx={stackSx}>
            <FeatureCard
              title="Dòng tiền trong phiên"
              icon="mdi:chart-bar"
              image={
                <Figure
                  src="/guides/overview/sectors-chart-phien.png"
                  alt="Biểu đồ dòng tiền trong phiên"
                  sx={{ my: 0 }}
                />
              }
            >
              Tiền đang chảy vào ngành nào nhiều nhất hôm nay, trực quan theo thanh
              ngang để so sánh nhanh.
            </FeatureCard>

            <FeatureCard
              title="Chỉ số thanh khoản"
              icon="mdi:water-percent"
              image={
                <Figure
                  src="/guides/overview/sectors-chart-thanhkhoan.png"
                  alt="Biểu đồ chỉ số thanh khoản"
                  sx={{ my: 0 }}
                />
              }
            >
              Mức độ giao dịch sôi động của từng ngành — ngành thanh khoản cao thường
              được quan tâm nhất.
            </FeatureCard>

            <FeatureCard
              title="Phân bổ dòng tiền"
              icon="mdi:chart-pie"
              image={
                <Figure
                  src="/guides/overview/sectors-chart-phanbo.png"
                  alt="Biểu đồ phân bổ dòng tiền"
                  sx={{ my: 0 }}
                />
              }
            >
              Cấu trúc dòng tiền giữa các ngành — tiền phân bổ đều hay tập trung mạnh
              vào vài ngành nhất định.
            </FeatureCard>

            <FeatureCard
              title="Dòng tiền trong tuần"
              icon="mdi:calendar-week"
              image={
                <Figure
                  src="/guides/overview/sectors-chart-tuan.png"
                  alt="Biểu đồ dòng tiền trong tuần"
                  sx={{ my: 0 }}
                />
              }
            >
              Xu hướng dòng tiền qua 5 phiên gần nhất, phát hiện ngành mới nổi hoặc
              đang mất dần sự chú ý.
            </FeatureCard>
          </Box>

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
            ACCORDION 5: NHÓM CỔ PHIẾU — Layout: Subheading narrative + stacked cards + callout
        ======================================================================== */}
        <GuideAccordion title="Nhóm cổ phiếu" icon="mdi:account-group-outline">
          <Typography sx={bodyTextSx} paragraph>
            Trang Nhóm cổ phiếu tập hợp các "rổ" cổ phiếu do Finext xây dựng theo từng chủ
            đề. Thay vì theo dõi từng mã riêng lẻ, bạn nhìn cả một nhóm để hiểu xu hướng
            tổng thể — ví dụ muốn biết cổ phiếu vốn hóa vừa đang thế nào, xem rổ MIDCAP.
          </Typography>

          <Figure
            src="/guides/overview/groups-overview.png"
            alt="Toàn cảnh trang Nhóm cổ phiếu"
            caption="Bảng 8 nhóm ở trên + 3 hàng biểu đồ chia theo 3 chủ đề ở dưới"
          />

          <Typography sx={subHeadingSx}>Bảng 8 nhóm cổ phiếu ở phần trên</Typography>
          <Figure
            src="/guides/overview/groups-table.png"
            alt="Bảng 8 nhóm cổ phiếu"
          />
          <Typography sx={bodyTextSx}>
            Bảng hiển thị 8 nhóm Finext (FNXINDEX, FNX100, Vượt trội, Ổn định, Sự kiện,
            LargeCap, MidCap, SmallCap) kèm giá, % thay đổi theo ngày - tuần - tháng -
            quý - năm, và điểm dòng tiền. Click vào tên nhóm để mở trang chi tiết.
          </Typography>

          <Typography sx={subHeadingSx}>3 chủ đề nhóm biểu đồ</Typography>
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
            ACCORDION 6: TIN TỨC — Layout: Hero + stacked cards (4 types) + 2 callouts
        ======================================================================== */}
        <GuideAccordion title="Tin tức" icon="mdi:newspaper-variant-outline">
          <Typography sx={bodyTextSx} paragraph>
            Trang Tin tức tổng hợp các bài viết tài chính - chứng khoán từ nhiều nguồn uy
            tín (Cổng thông tin Chính phủ, Tin nhanh chứng khoán, các báo kinh tế...). Bạn
            lọc theo loại tin hoặc theo mã cổ phiếu cụ thể, click vào bài để đọc chi tiết
            trong trang riêng mà không phải rời app.
          </Typography>

          <Figure
            src="/guides/overview/news-overview.png"
            alt="Toàn cảnh trang Tin tức"
            caption="Ô lọc theo mã ở góc phải, thẻ chọn 4 loại tin ở giữa, danh sách bài bên dưới"
          />

          <Typography sx={subHeadingSx}>4 loại tin chính</Typography>
          <Box sx={stackSx}>
            <FeatureCard
              title="Tài chính quốc tế"
              icon="mdi:earth"
              image={
                <Figure
                  src="/guides/overview/news-type-quocte.png"
                  alt="Loại tin Tài chính quốc tế"
                  sx={{ my: 0 }}
                />
              }
            >
              Tin tức và sự kiện kinh tế - tài chính toàn cầu ảnh hưởng đến Việt Nam: FED,
              chứng khoán Mỹ, giá dầu, tỷ giá... Giúp hiểu bối cảnh quốc tế tác động thế
              nào đến dòng tiền vào thị trường.
            </FeatureCard>

            <FeatureCard
              title="Vĩ mô trong nước"
              icon="mdi:domain"
              image={
                <Figure
                  src="/guides/overview/news-type-trongnuoc.png"
                  alt="Loại tin Vĩ mô trong nước"
                  sx={{ my: 0 }}
                />
              }
            >
              Tin kinh tế Việt Nam: Chính sách tiền tệ, lãi suất, tỷ giá, GDP, lạm phát,
              xuất nhập khẩu. Các yếu tố chi phối xu hướng dài hạn của thị trường chứng
              khoán trong nước.
            </FeatureCard>

            <FeatureCard
              title="Doanh nghiệp niêm yết"
              icon="mdi:office-building"
              image={
                <Figure
                  src="/guides/overview/news-type-doanhnghiep.png"
                  alt="Loại tin Doanh nghiệp niêm yết"
                  sx={{ my: 0 }}
                />
              }
            >
              Tin và phân tích về các công ty niêm yết: Kết quả kinh doanh, phát hành cổ
              phiếu, chia cổ tức, thay đổi lãnh đạo. Nguồn thông tin chính khi tìm hiểu
              sâu về một cổ phiếu cụ thể.
            </FeatureCard>

            <FeatureCard
              title="Thông cáo chính phủ"
              icon="mdi:bank"
              image={
                <Figure
                  src="/guides/overview/news-type-thongcao.png"
                  alt="Loại tin Thông cáo chính phủ"
                  sx={{ my: 0 }}
                />
              }
            >
              Thông cáo chính thức từ Cổng thông tin điện tử Chính phủ — quyết định, nghị
              định, chính sách mới tác động trực tiếp đến ngành nghề hoặc cơ chế vận hành
              thị trường.
            </FeatureCard>
          </Box>

          <Callout
            icon="mdi:magnify"
            title="Lọc theo mã cổ phiếu"
            image={
              <Figure
                src="/guides/overview/news-filter-ticker.png"
                alt="Ô lọc theo mã"
              />
            }
          >
            Ô tìm kiếm ở góc trên phải cho phép bạn gõ mã chứng khoán, trang sẽ chỉ hiển
            thị các bài có nhắc đến mã đó. Tiện khi muốn cập nhật nhanh tin tức liên quan
            đến một cổ phiếu bạn đang quan tâm.
          </Callout>

          <Callout
            icon="mdi:open-in-new"
            title="Đọc chi tiết trong trang riêng"
            image={
              <Figure src="/guides/overview/news-article.png" alt="Trang chi tiết bài viết" />
            }
          >
            Click vào tiêu đề hoặc ảnh để mở trang chi tiết với nội dung đầy đủ, các mã
            liên quan được nhấn mạnh, và link dẫn về trang báo gốc ở cuối bài. Mỗi trang
            danh sách hiển thị 12 bài mới nhất, có nút chuyển trang ở cuối.
          </Callout>
        </GuideAccordion>

        {/* ========================================================================
            ACCORDION 7: BÁO CÁO — Layout: Timeline vertical + callout
        ======================================================================== */}
        <GuideAccordion title="Báo cáo" icon="mdi:file-document-outline">
          <Typography sx={bodyTextSx} paragraph>
            Trang Báo cáo là nơi đọc các bản phân tích tổng hợp do Finext biên soạn, tóm
            tắt thị trường theo từng chu kỳ. Đây là nội dung đã qua chọn lọc và phân tích
            kỹ, tiết kiệm thời gian so với tự đọc nhiều nguồn tin lẻ rồi tổng hợp. Trang
            này yêu cầu gói hội viên phù hợp.
          </Typography>

          <Figure
            src="/guides/overview/reports-overview.png"
            alt="Toàn cảnh trang Báo cáo"
            caption="Ô lọc theo mã ở góc phải, thẻ chọn 3 loại báo cáo ở giữa, danh sách bên dưới"
          />

          <Typography sx={subHeadingSx}>3 loại báo cáo theo chu kỳ</Typography>

          <Box sx={{ my: 2 }}>
            <TimelineItem
              label="Hàng ngày"
              title="Báo cáo tổng kết phiên"
              image={
                <Figure
                  src="/guides/overview/reports-daily.png"
                  alt="Báo cáo hàng ngày"
                />
              }
            >
              Tóm tắt những gì đã xảy ra trong phiên giao dịch: Chỉ số chính biến động thế
              nào, nhóm ngành nào nổi bật, khối ngoại mua bán ra sao, các sự kiện đáng
              chú ý. Đọc vào buổi tối hoặc sáng hôm sau để nắm nhanh bức tranh ngày trước.
            </TimelineItem>

            <TimelineItem
              label="Hàng tuần"
              title="Báo cáo tổng kết tuần"
              image={
                <Figure
                  src="/guides/overview/reports-weekly.png"
                  alt="Báo cáo hàng tuần"
                />
              }
            >
              Tổng kết xu hướng tuần vừa qua: Cổ phiếu và ngành tăng giảm nổi bật, dòng
              tiền luân chuyển thế nào, các sự kiện lớn tác động đến thị trường. Giúp bạn
              nhìn xu hướng ngắn hạn rõ hơn và điều chỉnh chiến lược cho tuần tới.
            </TimelineItem>

            <TimelineItem
              label="Hàng tháng"
              title="Báo cáo tổng kết tháng"
              isLast
              image={
                <Figure
                  src="/guides/overview/reports-monthly.png"
                  alt="Báo cáo hàng tháng"
                />
              }
            >
              Báo cáo quy mô lớn đi sâu vào diễn biến cả tháng: Các chủ đề đầu tư nổi
              bật, cập nhật vĩ mô, đánh giá các ngành và dự báo xu hướng. Phù hợp khi bạn
              muốn nhìn thị trường ở góc độ dài hạn và kiểm tra lại luận điểm đầu tư.
            </TimelineItem>
          </Box>

          <Callout
            icon="mdi:magnify"
            title="Lọc báo cáo theo mã ngành hoặc mã cổ phiếu"
            image={
              <Figure
                src="/guides/overview/reports-filter-ticker.png"
                alt="Ô lọc báo cáo theo mã"
              />
            }
          >
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
