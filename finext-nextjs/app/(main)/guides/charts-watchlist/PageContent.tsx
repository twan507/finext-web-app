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

          <GuideSubAccordion title="Tìm và đổi mã" icon="mdi:magnify">
            <InfoBox>
              Gõ mã chứng khoán hoặc tên doanh nghiệp, hệ thống gợi ý ngay các kết quả
              phù hợp — dùng phím mũi tên di chuyển trong danh sách gợi ý, Enter để
              chọn. Khi đổi mã, biểu đồ và các bảng thông tin phụ cập nhật đồng thời
              để bức tranh luôn nhất quán theo đối tượng đang xem.
            </InfoBox>
            <Figure
              src="/guides/charts-watchlist/chart-toolbar-search.png"
              alt="Ô tìm và đổi mã"
              natural
            />
          </GuideSubAccordion>

          <GuideSubAccordion title="Khung thời gian" icon="mdi:calendar-range">
            <InfoBox>
              Chuyển qua lại giữa khung ngày, tuần, và tháng tuỳ theo góc nhìn đang
              cần. Khung ngày phù hợp để phân tích các diễn biến gần nhất và các mẫu
              hình ngắn hạn. Khung tuần lọc bớt nhiễu để nhìn xu hướng trung hạn. Khung
              tháng cho góc nhìn dài hạn, hữu ích khi đánh giá chu kỳ nhiều năm hay
              các vùng hỗ trợ kháng cự lịch sử. Các chỉ báo tự tính lại theo khung mới
              được chọn.
            </InfoBox>
            <Figure
              src="/guides/charts-watchlist/chart-toolbar-timeframe.png"
              alt="Nút chuyển khung thời gian"
              natural
            />
          </GuideSubAccordion>

          <GuideSubAccordion title="Loại biểu đồ" icon="mdi:chart-line-variant">
            <InfoBox>
              Biểu đồ nến giữ lại đầy đủ bốn giá trị quan trọng của mỗi phiên — mở
              cửa, cao nhất, thấp nhất, đóng cửa — cho phép đọc các mẫu hình nến, một
              trong những công cụ được dùng nhiều nhất trong phân tích kỹ thuật. Biểu
              đồ đường chỉ nối các điểm đóng cửa, mặt đồ thị gọn hơn, phù hợp khi
              muốn quan sát xu hướng dài hạn hay so sánh diễn biến giữa nhiều mã mà
              không bị chi tiết trong phiên làm rối.
            </InfoBox>
            <Figure
              src="/guides/charts-watchlist/chart-toolbar-type.png"
              alt="Chuyển giữa biểu đồ nến và đường"
              natural
            />
          </GuideSubAccordion>

          <GuideSubAccordion title="Điều chỉnh hiển thị" icon="mdi:eye-outline">
            <InfoBox>
              Có thể bật tắt từng thành phần của biểu đồ — các đường chỉ báo đang vẽ
              trên đồ thị, thanh khối lượng ở phía dưới, bảng chú thích chỉ báo, cùng
              với cách hiển thị nhãn giá bên phải. Khi chỉ cần nhìn xu hướng thuần
              tuý, tắt bớt để đồ thị sạch. Khi phân tích chi tiết có nhiều chỉ báo
              chồng lớp, bật đủ để không phải đoán.
            </InfoBox>
            <Figure
              src="/guides/charts-watchlist/chart-toolbar-display.png"
              alt="Các nút điều chỉnh hiển thị"
              natural
            />
          </GuideSubAccordion>

          <GuideSubAccordion title="Chế độ toàn màn hình" icon="mdi:fullscreen">
            <InfoBox>
              Biểu đồ mở rộng ra toàn bộ màn hình, che tất cả menu và bảng phụ để
              dành không gian tối đa cho việc đọc đồ thị. Phù hợp khi phân tích trên
              màn hình nhỏ hoặc khi muốn trình bày biểu đồ trong buổi họp nhóm.
            </InfoBox>
            <Figure
              src="/guides/charts-watchlist/chart-toolbar-fullscreen.png"
              alt="Chế độ toàn màn hình"
              natural
            />
          </GuideSubAccordion>

          <GuideSubAccordion title="Mở và đóng các bảng phụ" icon="mdi:dock-right">
            <InfoBox>
              Ba bảng phụ có thể hiển thị cạnh biểu đồ: bảng chi tiết với thông tin
              nhanh về mã và tin tức liên quan, bảng chỉ báo để bật tắt các công cụ kỹ
              thuật, và bảng watchlist để chuyển mã nhanh giữa các mã đang theo dõi.
              Bật bảng nào cần, tắt bảng nào chưa dùng đến — không gian biểu đồ tự
              điều chỉnh để tận dụng phần trống.
            </InfoBox>
            <Figure
              src="/guides/charts-watchlist/chart-toolbar-panels.png"
              alt="Các nút mở đóng bảng phụ"
              natural
            />
          </GuideSubAccordion>
        </GuideAccordion>

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

        {/* ------------------------------------------------------------------ */}
        <GuideAccordion title="Bảng tin tức" icon="mdi:newspaper">
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

          <GuideSubAccordion title="Xoá danh sách" icon="mdi:delete-outline">
            <InfoBox>
              Chọn thao tác xoá, hệ thống yêu cầu xác nhận trước khi thực hiện. Sau
              khi xoá, các danh sách còn lại tự dồn lại trong cột để không để lại
              khoảng trống — lưới nhìn luôn gọn mà không cần thao tác sắp xếp thủ
              công.
            </InfoBox>
            <Figure
              src="/guides/charts-watchlist/watchlist-delete.png"
              alt="Xoá danh sách"
              natural
            />
          </GuideSubAccordion>

          <GuideSubAccordion title="Chuyển sang trang khác" icon="mdi:swap-horizontal">
            <InfoBox>
              Một danh sách đã tạo ở trang này có thể chuyển sang trang khác mà không
              phải tạo lại từ đầu. Tiện khi tổ chức lại theo chủ đề, ví dụ ban đầu
              gộp chung nhưng về sau muốn tách các danh sách cùng ngành về cùng một
              trang để tiện so sánh.
            </InfoBox>
            <Figure
              src="/guides/charts-watchlist/watchlist-move-page.png"
              alt="Chuyển danh sách sang trang khác"
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

          <GuideSubAccordion title="Kéo thả trong cùng cột" icon="mdi:arrow-up-down">
            <InfoBox>
              Kéo thẻ lên hoặc xuống trong cột để đổi thứ tự. Trong lúc kéo có hiệu
              ứng thị giác hiển thị thẻ đang được di chuyển để dễ nhắm vị trí dự
              định thả. Cách dùng hiệu quả là đưa các danh sách đang quan tâm nhất
              lên đầu cột, các danh sách ít kiểm tra hơn xuống dưới.
            </InfoBox>
            <Figure
              src="/guides/charts-watchlist/watchlist-drag-column.png"
              alt="Kéo thả trong cùng cột"
              natural
            />
          </GuideSubAccordion>

          <GuideSubAccordion title="Kéo thả giữa các cột" icon="mdi:arrow-left-right">
            <InfoBox>
              Kéo thẻ sang cột khác trong cùng trang để tổ chức lại bố cục. Phù hợp
              khi muốn đặt các danh sách có tính chất tương tự gần nhau — ví dụ các
              danh sách ngành cùng một cột, các danh sách ý tưởng giao dịch ở cột
              khác — để mắt dễ nhận ra nhóm khi quét ngang.
            </InfoBox>
            <Figure
              src="/guides/charts-watchlist/watchlist-drag-across.png"
              alt="Kéo thả giữa các cột"
              natural
            />
          </GuideSubAccordion>

          <GuideSubAccordion title="Sắp xếp thứ tự các trang" icon="mdi:tab">
            <InfoBox>
              Các tab trang ở đầu khu vực watchlist cũng có thể kéo thả để đổi thứ
              tự. Cách làm quen thuộc là đưa trang dùng hàng ngày lên đầu, các trang
              dùng ít hơn hoặc để dự phòng lùi ra sau — giảm số lần phải tìm đúng
              tab khi mở lại trang.
            </InfoBox>
            <Figure
              src="/guides/charts-watchlist/watchlist-drag-tabs.png"
              alt="Sắp xếp thứ tự tab trang"
              natural
            />
          </GuideSubAccordion>
        </GuideAccordion>

        {/* ------------------------------------------------------------------ */}
        <GuideAccordion title="Hộp thoại xác nhận" icon="mdi:alert-circle-outline">
          <Typography sx={bodyTextSx} paragraph>
            Với các thao tác không thể hoàn tác — chủ yếu là xoá danh sách — hệ thống
            yêu cầu xác nhận trước khi thực hiện để tránh mất dữ liệu do nhấn nhầm.
            Một bước xác nhận thêm có vẻ dư trong các trường hợp đơn giản, nhưng là
            tấm lưới an toàn quan trọng khi thao tác nhanh.
          </Typography>
          <InfoBox>
            Hộp thoại xác nhận gồm biểu tượng cảnh báo, tiêu đề, mô tả ngắn về thao
            tác sắp thực hiện và hai nút lựa chọn — một nút trung tính để huỷ thao
            tác, một nút màu đỏ nổi bật để xác nhận tiếp tục. Phần nền phía sau được
            làm mờ để sự chú ý dồn vào nội dung trong hộp thoại, tránh tình huống bấm
            ra ngoài gây nhầm lẫn.
          </InfoBox>
          <Figure
            src="/guides/charts-watchlist/confirm-dialog.png"
            alt="Hộp thoại xác nhận"
            natural
          />
        </GuideAccordion>

      </Box>
    </Box>
  );
}
