'use client';

import { Box, Typography } from '@mui/material';
import GuideAccordion from '../components/GuideAccordion';
import GuideSubAccordion from '../components/GuideSubAccordion';
import {
  bodyTextSx,
  subHeadingSx,
  Figure,
  InfoBox,
} from '../components/GuideBlocks';
import { spacing } from 'theme/tokens';

export default function ChartsWatchlistContent() {
  return (
    <Box sx={{ py: spacing.xs }}>
      {/* ========================================================================
          SECTION: BIỂU ĐỒ
      ======================================================================== */}
      <Typography sx={{ ...subHeadingSx, mt: 0 }}>Biểu đồ</Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column' }}>

        {/* ------------------------------------------------------------------ */}
        <GuideAccordion title="Giới thiệu biểu đồ" icon="mdi:chart-timeline-variant">
          <Typography sx={bodyTextSx} paragraph>
            Biểu đồ là công cụ trung tâm của phân tích kỹ thuật — mọi quyết định vào
            ra lệnh theo xu hướng, theo mẫu hình hay theo vùng hỗ trợ kháng cự đều bắt
            đầu từ đây. Khác với biểu đồ thu nhỏ xuất hiện rải rác trong các trang
            khác, trang biểu đồ dành toàn bộ không gian cho việc đọc đồ thị, đi kèm bộ
            chỉ báo đầy đủ, thanh công cụ linh hoạt và các bảng thông tin phụ có thể
            bật tắt tuỳ tình huống.
          </Typography>
          <Typography sx={bodyTextSx} paragraph>
            Trang hỗ trợ ba loại đối tượng quan sát: cổ phiếu đơn lẻ khi muốn đi sâu
            vào một mã cụ thể, nhóm ngành khi phân tích ở cấp ngành, và chỉ số thị
            trường khi cần nhìn tổng thể. Các bảng thông tin phụ tự điều chỉnh nội
            dung theo loại đối tượng đang xem — ví dụ khi xem chỉ số sẽ không có các
            chỉ tiêu tài chính doanh nghiệp.
          </Typography>
          <InfoBox>
            Mã đang xem được ghi nhớ giữa các phiên làm việc — quay lại trang biểu đồ
            sẽ mở đúng đồ thị cuối cùng bạn đã xem. Dữ liệu giá và các chỉ báo cập
            nhật liên tục trong phiên, không cần tải lại trang để thấy giá mới nhất.
          </InfoBox>
          <Figure
            src="/guides/charts-watchlist/chart-overview.png"
            alt="Tổng quan trang biểu đồ"
            natural
          />
        </GuideAccordion>

        {/* ------------------------------------------------------------------ */}
        <GuideAccordion title="Thanh công cụ" icon="mdi:tools">
          <Typography sx={bodyTextSx} paragraph>
            Thanh công cụ gom toàn bộ các thao tác điều khiển biểu đồ vào một hàng duy
            nhất để luôn nằm trong tầm mắt. Mọi thay đổi — đổi mã, đổi khung thời
            gian, đổi loại đồ thị hay bật tắt các thành phần hiển thị — đều chỉ cần
            một cú bấm, không phải đi sâu vào menu cấu hình.
          </Typography>

          <GuideSubAccordion title="Các nút điều khiển biểu đồ" icon="mdi:tune-variant">
            <InfoBox>
              <Box component="span" sx={{ display: 'block', mb: 1 }}>
                <strong>Ô tìm mã:</strong> gõ mã chứng khoán hoặc tên doanh nghiệp,
                dropdown gợi ý mở ngay các kết quả phù hợp. Khi đổi mã, biểu đồ và
                các bảng thông tin phụ cùng cập nhật để bức tranh luôn nhất quán theo
                đối tượng đang xem.
              </Box>
              <Box component="span" sx={{ display: 'block', mb: 1 }}>
                <strong>Khung thời gian:</strong> ba khung cơ bản — ngày cho diễn biến
                gần và các mẫu hình ngắn hạn, tuần lọc bớt nhiễu để nhìn xu hướng
                trung hạn, tháng cho góc nhìn dài hạn đánh giá chu kỳ nhiều năm. Các
                chỉ báo tự tính lại theo khung mới.
              </Box>
              <Box component="span" sx={{ display: 'block', mb: 1 }}>
                <strong>Loại biểu đồ:</strong> nến giữ đủ bốn giá trị mở cửa, cao nhất,
                thấp nhất, đóng cửa của mỗi phiên — nền tảng để đọc các mẫu hình nến.
                Đường chỉ nối các điểm đóng cửa, mặt đồ thị gọn hơn, hợp khi quan sát
                xu hướng dài hạn hay so sánh nhiều mã.
              </Box>
              <Box component="span" sx={{ display: 'block' }}>
                <strong>Điều chỉnh hiển thị:</strong> bật tắt từng thành phần — các
                đường chỉ báo trên đồ thị, thanh khối lượng phía dưới, bảng chú thích
                chỉ báo, nhãn giá bên phải. Tắt bớt khi chỉ cần nhìn xu hướng thuần
                tuý, bật đủ khi phân tích chi tiết có nhiều lớp chồng nhau.
              </Box>
            </InfoBox>
            <Figure
              src="/guides/charts-watchlist/chart-toolbar-controls.png"
              alt="Các nút điều khiển biểu đồ: tìm mã, khung thời gian, loại biểu đồ, toggle hiển thị"
              natural
            />
          </GuideSubAccordion>

          <GuideSubAccordion title="Bố cục và bảng phụ" icon="mdi:view-dashboard-outline">
            <InfoBox>
              <Box component="span" sx={{ display: 'block', mb: 1 }}>
                <strong>Chế độ toàn màn hình:</strong> biểu đồ mở rộng ra toàn bộ màn
                hình, che menu và bảng phụ để dành không gian tối đa cho việc đọc đồ
                thị. Phù hợp khi phân tích trên màn hình nhỏ hoặc trình bày biểu đồ
                trong buổi họp nhóm.
              </Box>
              <Box component="span" sx={{ display: 'block' }}>
                <strong>Mở và đóng bảng phụ:</strong> ba bảng có thể hiển thị cạnh
                biểu đồ — chi tiết mã kèm tin tức, bảng chỉ báo kỹ thuật, và watchlist
                để chuyển mã nhanh. Bật bảng nào cần, tắt bảng nào chưa dùng đến,
                không gian biểu đồ tự điều chỉnh để tận dụng phần trống.
              </Box>
            </InfoBox>
            <Figure
              src="/guides/charts-watchlist/chart-toolbar-layout.png"
              alt="Nút toàn màn hình và các nút mở đóng bảng phụ"
              natural
            />
          </GuideSubAccordion>
        </GuideAccordion>
        
        {/* ------------------------------------------------------------------ */}
        <GuideAccordion title="Bảng thông tin" icon="mdi:newspaper">
          <Typography sx={bodyTextSx} paragraph>
            Bảng phụ đặt cạnh biểu đồ có hai tab — một tab cho bức tranh tóm tắt về
            mã đang xem, và một tab cho các bài viết liên quan. Đặt ngay cạnh đồ thị
            giúp đối chiếu biến động giá với bối cảnh tin tức trong cùng một khung
            nhìn, hạn chế tình huống bỏ sót các sự kiện giải thích được chuyển động
            bất thường của giá.
          </Typography>

          <GuideSubAccordion title="Tab Tóm tắt" icon="mdi:information-variant">
            <InfoBox>
              Hiển thị bức tranh tổng thể về mã đang xem — biểu đồ nhỏ diễn biến trong
              phiên, các chỉ số giá quan trọng, thanh khoản, giá trị giao dịch, vốn
              hoá cùng hiệu suất theo các khung thời gian từ tuần đến năm. Phần thông
              tin phân loại cho biết mã thuộc ngành nào, đặc điểm dòng tiền ra sao,
              và thuộc nhóm vốn hoá nào. Các tỷ số định giá cơ bản như P/E, P/B, EPS
              được đặt ở cuối để nhanh chóng đánh giá mức độ đắt rẻ tương đối.
            </InfoBox>
            <Figure
              src="/guides/charts-watchlist/news-summary-tab.png"
              alt="Tab Tóm tắt thông tin mã"
              natural
            />
          </GuideSubAccordion>

          <GuideSubAccordion title="Tab Tin tức" icon="mdi:newspaper-variant-outline">
            <InfoBox>
              Danh sách các bài viết có nhắc đến mã đang xem, kèm nguồn và thời gian
              đăng dưới dạng tương đối như "hai giờ trước" hay "hôm qua" để nhanh
              chóng nhận ra tin nào mới. Bấm tiêu đề để đọc toàn văn mà không phải
              rời khỏi ứng dụng — sau khi đọc xong, quay lại là biểu đồ vẫn đang mở
              đúng mã đó.
            </InfoBox>
            <Figure
              src="/guides/charts-watchlist/news-news-tab.png"
              alt="Tab Tin tức liên quan"
              natural
            />
          </GuideSubAccordion>
        </GuideAccordion>
      </Box>

      {/* ------------------------------------------------------------------ */}
      <GuideAccordion title="Bảng chỉ báo" icon="mdi:chart-bell-curve">
        <Typography sx={bodyTextSx} paragraph>
          Bảng chỉ báo là nơi chọn công cụ kỹ thuật để vẽ lên đồ thị — từ các đường
          trung bình động quen thuộc đến các mức Fibonacci, các vùng Volume Profile
          và các điểm Pivot theo nhiều khung thời gian khác nhau. Lựa chọn của bạn
          được lưu lại giữa các phiên, không phải bật tắt lại mỗi lần mở trang.
        </Typography>

        <GuideSubAccordion title="Các nhóm chỉ báo" icon="mdi:folder-outline">
          <InfoBox>
            Các chỉ báo được phân theo nhóm chức năng để dễ tìm — đường trung bình
            cho góc nhìn xu hướng, Pivot Point cho các mốc xoay chiều tiềm năng,
            Fibonacci cho các mức điều chỉnh và mở rộng, Volume Profile cho các vùng
            giá có khối lượng giao dịch lớn trong lịch sử. Mở từng nhóm để thấy các
            biến thể bên trong.
          </InfoBox>
          <Figure
            src="/guides/charts-watchlist/indicators-groups.png"
            alt="Các nhóm chỉ báo kỹ thuật"
            natural
          />
        </GuideSubAccordion>

        <GuideSubAccordion title="Bật tắt chỉ báo" icon="mdi:toggle-switch-outline">
          <InfoBox>
            Trạng thái bật tắt của mỗi chỉ báo được hiển thị rõ bằng dấu hiệu thị
            giác — đang bật hay đang tắt nhìn là biết. Bấm để đổi trạng thái, đồ
            thị phản hồi ngay lập tức. Khi đồ thị đã quá nhiều đường chồng chéo,
            dùng chức năng xoá toàn bộ để trở lại nền sạch, hoặc khôi phục mặc
            định để về bộ chỉ báo cơ bản thường dùng.
          </InfoBox>
          <Figure
            src="/guides/charts-watchlist/indicators-toggle.png"
            alt="Bật tắt chỉ báo"
            natural
          />
        </GuideSubAccordion>

        <GuideSubAccordion title="Chỉ báo theo nhiều khung thời gian" icon="mdi:calendar-multiple">
          <InfoBox>
            Một chỉ báo có thể được tính trên nhiều khung khác nhau — Pivot Point
            tuần, Pivot Point tháng, Pivot Point quý, Pivot Point năm đều có ý
            nghĩa riêng. Khi một mức giá trùng với nhiều khung cùng lúc, đó thường
            là điểm có độ tin cậy cao hơn so với một mức chỉ xuất hiện ở một khung
            đơn lẻ. Bật vài khung cùng lúc để tìm các điểm đồng thuận đa khung.
          </InfoBox>
          <Figure
            src="/guides/charts-watchlist/indicators-timeframes.png"
            alt="Chỉ báo theo nhiều khung thời gian"
            natural
          />
        </GuideSubAccordion>
      </GuideAccordion>

      {/* ========================================================================
          SECTION: WATCHLIST
      ======================================================================== */}
      <Typography sx={subHeadingSx}>Watchlist</Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column' }}>

        {/* ------------------------------------------------------------------ */}
        <GuideAccordion title="Thêm danh sách mới" icon="mdi:playlist-plus">
          <Typography sx={bodyTextSx} paragraph>
            Nhà đầu tư chuyên nghiệp thường không theo dõi duy nhất một danh sách duy
            nhất mà chia theo mục đích — một danh sách cho các mã đang nắm, một danh
            sách cho các mã đang quan sát chờ điểm vào, một danh sách cho các ngành
            đang theo dõi chu kỳ. Watchlist được tổ chức theo dạng lưới nhiều cột và
            nhiều trang để phục vụ cách làm này, thay vì gom tất cả vào một danh sách
            dài khó đọc.
          </Typography>

          <GuideSubAccordion title="Tạo từ đầu" icon="mdi:plus-box-outline">
            <InfoBox>
              Mở cửa sổ tạo mới, đặt tên cho danh sách, xác nhận. Danh sách trống xuất
              hiện ngay trong lưới, sẵn sàng để thêm các mã cụ thể. Tên có thể sửa
              lại sau nên không cần quá kỹ ở bước này — đặt tên sao cho phản ánh đúng
              mục đích theo dõi là đủ.
            </InfoBox>
            <Figure
              src="/guides/charts-watchlist/watchlist-create-new.png"
              alt="Tạo danh sách mới"
              natural
            />
          </GuideSubAccordion>

          <GuideSubAccordion title="Tạo theo ngành" icon="mdi:view-grid-outline">
            <InfoBox>
              Khi muốn theo dõi toàn bộ một ngành, chọn tên ngành trong danh mục ngành
              có sẵn — hệ thống tự tạo danh sách và thêm ngay tất cả mã thuộc ngành
              đó. Tiết kiệm thời gian so với tạo từ đầu rồi thêm từng mã, đặc biệt
              hữu ích khi theo dõi sự quay vòng của dòng tiền giữa các ngành và cần
              danh sách ngành mới chỉ trong vài giây.
            </InfoBox>
            <Figure
              src="/guides/charts-watchlist/watchlist-create-industry.png"
              alt="Tạo watchlist theo ngành"
              natural
            />
          </GuideSubAccordion>

          <GuideSubAccordion title="Vị trí và nhiều trang" icon="mdi:tab-plus">
            <InfoBox>
              Khi tạo mới có thể chỉ định vị trí cụ thể trong lưới hoặc để hệ thống
              tự xếp vào cuối trang hiện tại. Khi một trang bắt đầu đầy, tạo thêm
              trang mới để không làm mỗi trang quá rối. Cách làm gợi ý là mỗi trang
              phục vụ một nhóm mục đích — ví dụ trang cho danh mục đang nắm, trang
              cho các ý tưởng đang theo dõi, trang cho các ngành đang quan sát — tên
              tab phản ánh rõ nội dung để chuyển trang nhanh.
            </InfoBox>
            <Figure
              src="/guides/charts-watchlist/watchlist-position.png"
              alt="Vị trí và nhiều trang watchlist"
              natural
            />
          </GuideSubAccordion>
        </GuideAccordion>

        {/* ------------------------------------------------------------------ */}
        <GuideAccordion title="Xóa và chỉnh sửa danh sách" icon="mdi:playlist-edit">
          <Typography sx={bodyTextSx} paragraph>
            Danh sách theo dõi cần thay đổi theo thời gian — các ý tưởng đã kết thúc
            cần được dọn đi để tập trung vào những cơ hội đang mở. Các thao tác chỉnh
            sửa được thiết kế gọn nhẹ, phần lớn chỉ cần một đến hai bước, vị trí lưới
            tự chuẩn lại sau mỗi thay đổi để bố cục luôn ngăn nắp.
          </Typography>

          <GuideSubAccordion title="Đổi tên nhanh" icon="mdi:rename-box">
            <InfoBox>
              Bấm vào tên danh sách để vào chế độ chỉnh sửa, nhập tên mới, lưu lại.
              Không cần mở thêm cửa sổ cấu hình cho một thao tác đơn giản như đổi
              tên. Tiện khi mục đích theo dõi thay đổi hoặc khi muốn đặt tên gợi ý
              rõ hơn sau thời gian sử dụng.
            </InfoBox>
            <Figure
              src="/guides/charts-watchlist/watchlist-rename.png"
              alt="Đổi tên danh sách"
              natural
            />
          </GuideSubAccordion>

          <GuideSubAccordion title="Xoá và chuyển trang" icon="mdi:dots-horizontal">
            <InfoBox>
              <Box component="span" sx={{ display: 'block', mb: 1 }}>
                <strong>Xoá danh sách:</strong> chọn thao tác xoá trong menu ngữ cảnh,
                hệ thống yêu cầu xác nhận trước khi thực hiện. Sau khi xoá, các danh
                sách còn lại tự dồn lại trong cột để không để lại khoảng trống — lưới
                nhìn luôn gọn mà không cần sắp xếp thủ công.
              </Box>
              <Box component="span" sx={{ display: 'block' }}>
                <strong>Chuyển sang trang khác:</strong> một danh sách đã tạo ở trang
                này có thể chuyển sang trang khác mà không phải tạo lại. Tiện khi tổ
                chức lại theo chủ đề — ví dụ ban đầu gộp chung, về sau muốn tách các
                danh sách cùng ngành về cùng một trang để tiện so sánh.
              </Box>
            </InfoBox>
            <Figure
              src="/guides/charts-watchlist/watchlist-context-menu.png"
              alt="Menu ngữ cảnh với tuỳ chọn xoá và chuyển trang"
              natural
            />
          </GuideSubAccordion>
        </GuideAccordion>

        {/* ------------------------------------------------------------------ */}
        <GuideAccordion title="Kéo thả sắp xếp" icon="mdi:drag-variant">
          <Typography sx={bodyTextSx} paragraph>
            Cách tổ chức lưới chủ yếu thông qua thao tác kéo thả — nhanh, trực quan và
            không cần đi sâu vào các menu cấu hình. Kéo thả áp dụng ở ba cấp độ: trong
            cùng một cột, giữa các cột, và cả với các tab trang. Sau mỗi lần thả, vị
            trí các thẻ tự chuẩn lại để lưới giữ được sự cân đối.
          </Typography>

          <InfoBox>
            <Box component="span" sx={{ display: 'block', mb: 1 }}>
              <strong>Kéo thả trong cùng cột:</strong> kéo thẻ lên xuống để đổi thứ tự.
              Trong lúc kéo có hiệu ứng thị giác hiển thị thẻ đang di chuyển để dễ
              nhắm vị trí thả. Cách dùng hiệu quả là đưa các danh sách đang quan tâm
              nhất lên đầu cột, các danh sách ít kiểm tra hơn xuống dưới.
            </Box>
            <Box component="span" sx={{ display: 'block', mb: 1 }}>
              <strong>Kéo thả giữa các cột:</strong> kéo thẻ sang cột khác trong cùng
              trang để tổ chức lại bố cục. Phù hợp khi muốn đặt các danh sách cùng
              tính chất gần nhau — ví dụ các danh sách ngành một cột, các danh sách ý
              tưởng giao dịch ở cột khác — để mắt dễ nhận ra nhóm khi quét ngang.
            </Box>
            <Box component="span" sx={{ display: 'block' }}>
              <strong>Sắp xếp thứ tự tab trang:</strong> các tab trang ở đầu khu vực
              watchlist cũng có thể kéo thả để đổi thứ tự. Đưa trang dùng hàng ngày
              lên đầu, các trang dùng ít hoặc dự phòng lùi ra sau — giảm số lần phải
              tìm đúng tab khi mở lại trang.
            </Box>
          </InfoBox>
          <Figure
            src="/guides/charts-watchlist/watchlist-drag.png"
            alt="Kéo thả ở ba cấp độ: trong cùng cột, giữa các cột, và tab trang"
            natural
          />
        </GuideAccordion>

      </Box>
    </Box>
  );
}
