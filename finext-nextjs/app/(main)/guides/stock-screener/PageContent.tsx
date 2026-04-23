'use client';

import { Box, Typography } from '@mui/material';
import GuideAccordion from '../components/GuideAccordion';
import GuideSubAccordion from '../components/GuideSubAccordion';
import {
  bodyTextSx,
  Figure,
  Callout,
  InfoBox,
} from '../components/GuideBlocks';
import { spacing } from 'theme/tokens';

export default function StockScreenerContent() {
  return (
    <Box sx={{ py: spacing.xs }}>
      <Box sx={{ display: 'flex', flexDirection: 'column' }}>

        {/* ========================================================================
            ACCORDION 1: GIỚI THIỆU BỘ LỌC
        ======================================================================== */}
        <GuideAccordion title="Giới thiệu bộ lọc" icon="mdi:information-outline">
          <Typography sx={bodyTextSx} paragraph>
            Thị trường Việt Nam hiện có hơn một nghìn mã niêm yết — nếu phải rà từng mã
            để tìm cơ hội, phần lớn thời gian giao dịch sẽ trôi qua trước khi kịp vào
            lệnh. Bộ lọc cổ phiếu giúp chuyển cách làm đó thành một quy trình có chủ
            đích: đặt tiêu chí một lần theo chiến lược của mình, danh sách mã phù hợp
            tự hiện ra và cập nhật liên tục theo diễn biến phiên.
          </Typography>
          <Typography sx={bodyTextSx} paragraph>
            Trang được tổ chức thành ba tầng từ đơn giản đến chi tiết. Tầng đầu là các
            tiêu chí phổ biến và các mẫu lọc dựng sẵn — phù hợp cho người muốn có kết
            quả nhanh. Tầng giữa mở ra các điều kiện định lượng chi tiết cho ai đã có
            chiến lược rõ ràng. Tầng cuối là bảng kết quả có thể tuỳ biến cột, đổi góc
            nhìn, sắp xếp, và mở thẳng sang trang phân tích của bất kỳ mã nào trong kết
            quả.
          </Typography>
          <InfoBox>
            Số mã đang khớp điều kiện hiển thị ngay cạnh ô tìm kiếm, kèm chỉ báo trạng
            thái kết nối dữ liệu. Giá trị này cho biết bộ lọc đang thu hẹp thị trường
            xuống bao nhiêu phần trăm — một thước đo nhanh để đánh giá độ chặt của tiêu
            chí: con số vài nghìn là lỏng, dưới một trăm là chặt, chỉ còn vài mã là
            nên xem lại đã quá khắt khe hay chưa.
          </InfoBox>
          <Figure
            src="/guides/stock-screener/overview.png"
            alt="Tổng quan trang bộ lọc cổ phiếu"
            natural
          />
        </GuideAccordion>

        {/* ========================================================================
            ACCORDION 2: BỘ LỌC NHANH
        ======================================================================== */}
        <GuideAccordion title="Bộ lọc nhanh" icon="mdi:filter-outline">
          <Typography sx={bodyTextSx} paragraph>
            Khu vực lọc nhanh tập trung các tiêu chí mà hầu hết nhà đầu tư đều cần —
            tìm theo mã, thu hẹp theo sàn, theo ngành, theo quy mô vốn hoá. Phần lớn
            phiên giao dịch có thể bắt đầu từ đây, không cần chạm đến bộ lọc chi tiết
            ở dưới. Các mẫu lọc dựng sẵn là điểm khởi đầu tốt nếu bạn chưa có ý tưởng
            cụ thể — chọn một mẫu để xem bức tranh tổng quan, sau đó tinh chỉnh dần.
          </Typography>

          <GuideSubAccordion title="Thanh tìm kiếm mã" icon="mdi:magnify">
            <InfoBox>
              Nhập mã chứng khoán hoặc tên doanh nghiệp để tìm nhanh một cổ phiếu cụ
              thể. Kết quả thu hẹp ngay theo từng ký tự, kể cả khi chỉ nhớ một phần tên
              công ty. Khi đã tìm được, xoá ô tìm kiếm chỉ huỷ điều kiện tìm — các bộ
              lọc khác vẫn giữ nguyên, tiện cho tình huống đang cân nhắc giữa vài mã
              trong cùng một bộ tiêu chí.
            </InfoBox>
            <Figure
              src="/guides/stock-screener/quick-search.png"
              alt="Thanh tìm kiếm mã cổ phiếu"
              natural
            />
          </GuideSubAccordion>

          <GuideSubAccordion title="Mẫu lọc dựng sẵn" icon="mdi:lightning-bolt-outline">
            <InfoBox>
              Các mẫu lọc tương ứng với những ý tưởng giao dịch phổ biến: tìm cổ phiếu
              có đà tăng tuần, tìm dòng tiền mạnh, tìm thanh khoản cao, tìm vùng tích
              luỹ, hay các mã đang xếp hạng cao theo nhiều tiêu chí. Mỗi mẫu là tổ hợp
              các điều kiện đã được cân nhắc — dùng làm bộ khung ban đầu rồi điều chỉnh
              cho hợp với khẩu vị, nhanh hơn so với xây tiêu chí từ đầu. Di chuột vào
              mẫu để xem mô tả trước khi áp dụng.
            </InfoBox>
            <Figure
              src="/guides/stock-screener/quick-presets.png"
              alt="Các mẫu lọc dựng sẵn"
              natural
            />
          </GuideSubAccordion>

          <GuideSubAccordion title="Lọc theo Sàn, Ngành, Vốn hoá, Nhóm" icon="mdi:filter-variant">
            <InfoBox>
              Bốn ô chọn phía trên bảng kết quả khoanh phạm vi quan tâm. Chọn sàn khi
              muốn tập trung vào một nhóm niêm yết nhất định; chọn ngành khi đang theo
              dõi một chu kỳ ngành cụ thể; chọn vốn hoá để phân biệt cổ phiếu đầu ngành
              với nhóm quy mô vừa và nhỏ — mỗi nhóm có đặc điểm biến động và rủi ro
              khác nhau. Có thể chọn nhiều giá trị trong cùng một ô, điều kiện hiểu là
              thoả mãn bất kỳ giá trị nào trong số đó.
            </InfoBox>
            <Figure
              src="/guides/stock-screener/quick-dropdowns.png"
              alt="Các ô chọn Sàn, Ngành, Vốn hoá, Nhóm"
              natural
            />
          </GuideSubAccordion>

          <GuideSubAccordion title="Xoá toàn bộ bộ lọc" icon="mdi:close-circle-outline">
            <InfoBox>
              Khi muốn bắt đầu lại từ đầu hoặc kiểm tra một ý tưởng khác, nút Xoá bộ
              lọc đưa tất cả điều kiện — cả nhanh lẫn nâng cao — về trạng thái trống.
              Con số hiển thị cạnh nút cho biết hiện có bao nhiêu điều kiện đang áp
              dụng, tránh tình huống tưởng đã xoá hết nhưng còn sót vài điều kiện ẩn
              trong phần nâng cao đã thu gọn.
            </InfoBox>
            <Figure
              src="/guides/stock-screener/quick-clear.png"
              alt="Nút xoá toàn bộ bộ lọc"
              natural
            />
          </GuideSubAccordion>
        </GuideAccordion>

        {/* ========================================================================
            ACCORDION 3: BỘ LỌC NÂNG CAO
        ======================================================================== */}
        <GuideAccordion title="Bộ lọc nâng cao" icon="mdi:filter-cog-outline">
          <Typography sx={bodyTextSx} paragraph>
            Bộ lọc nâng cao là phần dành cho nhà đầu tư đã có chiến lược định lượng —
            biết mình tìm biên độ biến động nào, mức thanh khoản bao nhiêu, hoặc vị trí
            giá ra sao so với các mốc kỹ thuật. Thay vì mô tả ý tưởng bằng lời, bạn đặt
            nó thành các con số cụ thể và bộ lọc lọc ra đúng tập mã thoả mãn. Càng định
            nghĩa rõ tiêu chí, càng dễ loại bỏ các lựa chọn tuỳ hứng.
          </Typography>

          <GuideSubAccordion title="Bộ lọc theo khoảng giá trị" icon="mdi:tune-variant">
            <InfoBox>
              Đặt biên dưới và biên trên cho các chỉ tiêu định lượng — biến động giá,
              giá trị giao dịch, thanh khoản, biến động theo các khung thời gian từ
              tuần đến năm, điểm dòng tiền, và xếp hạng của mã trong ngành cũng như
              trên toàn thị trường. Kéo hai đầu của thanh kéo hoặc nhập trực tiếp giá
              trị vào ô số để ấn định biên chính xác. Thói quen tốt là đặt từng tiêu
              chí một và quan sát số mã thay đổi ra sao — cảm nhận được tiêu chí nào
              đang thực sự thu hẹp kết quả.
            </InfoBox>
            <Figure
              src="/guides/stock-screener/advanced-range.png"
              alt="Các thanh kéo lọc theo khoảng giá trị"
              natural
            />
          </GuideSubAccordion>

          <GuideSubAccordion title="Bộ lọc theo vùng chất lượng" icon="mdi:grid">
            <InfoBox>
              Mỗi cổ phiếu được đánh giá thành các bậc chất lượng từ tốt nhất đến yếu
              nhất dựa trên nhiều chiều dữ liệu — vị trí tương đối so với đường trung
              bình, so với các mức Fibonacci, và so với vùng phân bổ khối lượng trong
              lịch sử. Chọn giữ lại các bậc mong muốn để lọc ra những mã đang ở trạng
              thái đáp ứng đồng thời nhiều tiêu chuẩn. Kết hợp vài khung thời gian
              cùng lúc giúp tìm ra những mã có sự đồng thuận trên cả ngắn và trung hạn.
            </InfoBox>
            <Figure
              src="/guides/stock-screener/advanced-zones.png"
              alt="Bộ lọc theo vùng chất lượng"
              natural
            />
          </GuideSubAccordion>

          <GuideSubAccordion title="Bộ lọc theo chỉ báo kỹ thuật" icon="mdi:chart-timeline-variant">
            <InfoBox>
              Lọc theo vị trí giá hiện tại so với các mốc kỹ thuật trọng yếu — đường
              trung bình ngắn, trung, dài hạn, các mức Pivot, Fibonacci, và các vùng
              khối lượng giao dịch lớn trong quá khứ. Đi kèm thanh điều chỉnh biên độ
              chênh lệch cho phép, nghĩa là không chỉ lọc đúng điểm chạm mà còn lọc
              được các mã đang dao động trong vùng lân cận. Phù hợp cho các chiến lược
              giao dịch bám mốc kỹ thuật: mua pullback về đường trung bình, giao dịch
              quanh vùng hỗ trợ kháng cự, hoặc bắt điểm phá vỡ.
            </InfoBox>
            <Figure
              src="/guides/stock-screener/advanced-technical.png"
              alt="Bộ lọc theo chỉ báo kỹ thuật"
              natural
            />
          </GuideSubAccordion>
        </GuideAccordion>

        {/* ========================================================================
            ACCORDION 4: ĐỔI VIEW BẢNG KẾT QUẢ
        ======================================================================== */}
        <GuideAccordion title="Đổi góc nhìn bảng kết quả" icon="mdi:view-dashboard-outline">
          <Typography sx={bodyTextSx} paragraph>
            Cùng một tập mã có thể được đọc theo nhiều góc nhìn khác nhau tuỳ vào câu
            hỏi đang cần trả lời. Thay vì đổi cột thủ công mỗi lần chuyển chủ đề phân
            tích, các góc nhìn dựng sẵn bố trí cột theo từng mục đích — chọn tab tương
            ứng là bảng tự tái cấu trúc.
          </Typography>

          <GuideSubAccordion title="Các góc nhìn dựng sẵn" icon="mdi:tab">
            <InfoBox>
              Tổng quan cung cấp cái nhìn chung với các chỉ tiêu cơ bản, phù hợp khi
              mới bắt đầu lọc và chưa xác định rõ chủ đề. Dòng tiền đặt trọng tâm vào
              các chỉ tiêu cường độ dòng tiền và xếp hạng — góc nhìn quen thuộc với
              nhà đầu tư theo trường phái dòng tiền. Vùng kỹ thuật tập trung vào các
              cột phân loại vị trí giá theo chỉ báo, phù hợp cho giao dịch theo tín
              hiệu kỹ thuật. Tuỳ chỉnh là góc nhìn tự thiết lập.
            </InfoBox>
            <Figure
              src="/guides/stock-screener/views-tabs.png"
              alt="Các tab góc nhìn dựng sẵn"
              natural
            />
          </GuideSubAccordion>

          <GuideSubAccordion title="Góc nhìn tuỳ chỉnh" icon="mdi:tune">
            <InfoBox>
              Bảng được lưu theo lựa chọn cá nhân — mở lại trang vào phiên sau vẫn giữ
              nguyên cấu hình, không cần thiết lập lại. Phù hợp khi bạn đã có một bộ
              cột ưa thích và muốn quay lại đúng bảng đó mỗi lần mở bộ lọc.
            </InfoBox>
            <Figure
              src="/guides/stock-screener/views-custom.png"
              alt="Góc nhìn tuỳ chỉnh với biểu tượng cấu hình"
              natural
            />
          </GuideSubAccordion>
        </GuideAccordion>

        {/* ========================================================================
            ACCORDION 5: TÙY CHỈNH CỘT HIỂN THỊ
        ======================================================================== */}
        <GuideAccordion title="Tùy chỉnh cột hiển thị" icon="mdi:table-column">
          <Typography sx={bodyTextSx} paragraph>
            Không phải mọi chỉ tiêu đều cần hiển thị cùng lúc. Người quan tâm dòng tiền
            không cần các cột định giá trong cùng khung nhìn; người phân tích kỹ thuật
            có thể bỏ qua các chỉ tiêu tài chính cơ bản. Tuỳ chỉnh cột giúp mỗi bộ lọc
            có một bảng kết quả gọn gàng, chỉ hiển thị đúng những gì đang cần đọc.
          </Typography>

          <GuideSubAccordion title="Mở hộp thoại tuỳ chỉnh" icon="mdi:cog-outline">
            <InfoBox>
              Biểu tượng bánh răng cạnh tab góc nhìn tuỳ chỉnh mở hộp thoại chọn cột.
              Các góc nhìn khác được dựng sẵn với bố cục cố định để đảm bảo tính nhất
              quán — chỉ góc nhìn tuỳ chỉnh mới cho phép thay đổi cột hiển thị.
            </InfoBox>
            <Figure
              src="/guides/stock-screener/columns-modal.png"
              alt="Hộp thoại tuỳ chỉnh cột hiển thị"
              natural
            />
          </GuideSubAccordion>

          <GuideSubAccordion title="Chọn cột theo nhóm" icon="mdi:format-list-checks">
            <InfoBox>
              Các cột được nhóm theo chủ đề — thông tin doanh nghiệp, giá và biến động
              trong phiên, biến động phần trăm theo các khung thời gian, chỉ tiêu dòng
              tiền, và các chỉ báo kỹ thuật. Mỗi nhóm có ô chọn tổng để bật tắt toàn
              bộ nhóm trong một thao tác, bên trong là các ô chọn riêng cho từng cột.
              Cách hiệu quả là bắt đầu bằng cách tắt tất cả, sau đó chỉ bật đúng những
              cột phục vụ câu hỏi đang cần trả lời.
            </InfoBox>
            <Figure
              src="/guides/stock-screener/columns-groups.png"
              alt="Chọn cột theo nhóm chủ đề"
              natural
            />
          </GuideSubAccordion>

          <GuideSubAccordion title="Khôi phục mặc định" icon="mdi:restore">
            <InfoBox>
              Nếu đã tinh chỉnh nhiều lần và muốn quay lại bố cục gọn gàng ban đầu, nút
              khôi phục mặc định đưa bảng về bộ cột chuẩn — điểm xuất phát an toàn cho
              các lần điều chỉnh tiếp theo.
            </InfoBox>
            <Figure
              src="/guides/stock-screener/columns-reset.png"
              alt="Khôi phục cột mặc định"
              natural
            />
          </GuideSubAccordion>
        </GuideAccordion>

        {/* ========================================================================
            ACCORDION 6: ĐỌC BẢNG KẾT QUẢ
        ======================================================================== */}
        <GuideAccordion title="Đọc bảng kết quả" icon="mdi:table">
          <Typography sx={bodyTextSx} paragraph>
            Mục tiêu của bảng kết quả là giúp nhận ra điểm đáng chú ý trong vài giây
            mà không phải đọc từng số. Màu sắc, cách sắp xếp, và các thao tác tương tác
            đều được thiết kế để rút ngắn thời gian từ nhìn đến hiểu.
          </Typography>

          <GuideSubAccordion title="Màu sắc theo loại dữ liệu" icon="mdi:palette-outline">
            <InfoBox>
              Biến động giá dùng hệ màu tiêu chuẩn của thị trường Việt Nam — xanh tham
              chiếu cho đứng giá, xanh lá cho tăng, đỏ cho giảm, tím cho kịch trần,
              vàng cam cho kịch sàn. Các cột phân loại chất lượng được tô theo gradient
              từ đậm đến nhạt, bậc tốt nhất được làm nổi bật mạnh nhất. Xếp hạng dùng
              thang màu theo vị trí trong phân phối — nhóm top được nhấn, nhóm đuôi
              giảm sáng để mắt tự bỏ qua.
            </InfoBox>
            <Figure
              src="/guides/stock-screener/table-colors.png"
              alt="Màu sắc theo loại dữ liệu trong bảng"
              natural
            />
          </GuideSubAccordion>

          <GuideSubAccordion title="Sắp xếp và đổi thứ tự cột" icon="mdi:sort">
            <InfoBox>
              Bấm vào tên cột để sắp xếp bảng theo cột đó — lần một giảm dần, lần hai
              tăng dần, lần ba bỏ sắp xếp. Với các cột số, sắp xếp là cách nhanh nhất
              để đưa các mã cực trị lên đầu. Để đổi thứ tự các cột cho hợp với luồng
              đọc, kéo tiêu đề cột sang vị trí mới — thứ tự mới được ghi nhớ cho các
              lần mở sau.
            </InfoBox>
            <Figure
              src="/guides/stock-screener/table-sort-drag.png"
              alt="Sắp xếp và kéo thả cột"
              natural
            />
          </GuideSubAccordion>

          <GuideSubAccordion title="Phân trang" icon="mdi:page-next-outline">
            <InfoBox>
              Chọn số dòng mỗi trang theo thói quen làm việc — ít dòng giúp tập trung,
              nhiều dòng giúp so sánh rộng hơn. Các số lớn được rút gọn theo quy ước
              quen thuộc của thị trường — đơn vị tỷ cho giá trị giao dịch, dấu phân
              cách hàng nghìn cho khối lượng, dấu cộng trừ kèm phần trăm cho biến động.
            </InfoBox>
            <Figure
              src="/guides/stock-screener/table-pagination.png"
              alt="Phân trang ở chân bảng"
              natural
            />
          </GuideSubAccordion>
        </GuideAccordion>

        {/* ========================================================================
            ACCORDION 7: MỞ TRANG PHÂN TÍCH CỔ PHIẾU
        ======================================================================== */}
        <GuideAccordion title="Mở trang phân tích cổ phiếu" icon="mdi:arrow-right-circle-outline">
          <Typography sx={bodyTextSx} paragraph>
            Sau khi thu hẹp về một nhóm nhỏ đáng quan tâm, bước tiếp theo là kiểm định
            từng mã trước khi ra quyết định. Bộ lọc chỉ dừng ở việc khoanh vùng — việc
            đánh giá sâu cần đến trang phân tích chuyên biệt của từng cổ phiếu.
          </Typography>

          <Callout
            icon="mdi:cursor-default-click-outline"
            title="Bấm vào dòng để mở trang phân tích"
            image={
              <Figure
                src="/guides/stock-screener/analyze-click.png"
                alt="Bấm vào dòng để mở trang phân tích cổ phiếu"
                natural
              />
            }
          >
            Mỗi dòng trong bảng là một cửa vào trang phân tích chi tiết của mã tương
            ứng — bấm trực tiếp để chuyển sang. Tại đó có biểu đồ giá đầy đủ khung thời
            gian, bảng thông tin nhanh, và bốn phần phân tích chuyên sâu về dòng tiền,
            kỹ thuật, tài chính và tin tức. Cách làm hiệu quả là giữ trang bộ lọc ở một
            tab và mở các trang phân tích ở tab mới, tránh phải quay lại chạy lại bộ
            lọc mỗi lần kiểm tra xong một mã.
          </Callout>
        </GuideAccordion>

      </Box>
    </Box>
  );
}
