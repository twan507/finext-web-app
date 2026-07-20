// Ngữ cảnh trang + kho câu hỏi gợi ý cho bubble chat.
// Ngữ cảnh trang KHÔNG hiển thị cho user; câu hỏi gợi ý và câu chào thì CÓ.
//
// RÀNG BUỘC PHẦN MÔ TẢ TRANG (body):
//  1. Không chứa số liệu (giá, chỉ số, %) — guard chống bịa số ở backend chỉ đối chiếu số
//     trong câu trả lời với số lấy từ tool; số nằm trong ngữ cảnh có thể gây chặn nhầm.
//  2. Không lặp lại định nghĩa thuật ngữ — KB pack của agent đã có sẵn và được cache.
//     Ở đây chỉ mô tả GIAO DIỆN: trang hiển thị gì, có tab nào.
//  3. Không nêu tên collection, số trần hạn mức hay chi tiết nội bộ.
//
// RÀNG BUỘC KHO CÂU HỎI (pool) — user NHÌN THẤY, quy tắc riêng:
//  a. Giọng nhà đầu tư phổ thông, hỏi về THỨ HỌ QUAN TÂM (giá, dòng tiền, nên mua chưa),
//     KHÔNG hỏi về cách vận hành giao diện ("Trang này xem được gì?", "Cách đọc tab X?").
//  b. KHÔNG dùng tên tab / quy ước nội bộ của Finext trong câu hỏi — khách mới không hiểu.
//  c. Mỗi trang và mỗi tab một kho riêng, tối thiểu ba câu, không lặp giữa các trang.
//  d. Chỉ hỏi thứ agent trả lời được từ dữ liệu — agent KHÔNG đọc được danh mục riêng của user.
//  e. Không chèn slug đường dẫn (VD 'nganhang') vào câu hỏi — dùng "ngành này" / "nhóm này".
//
// PHÂN CÔNG: file này chỉ giữ DỮ LIỆU. Cơ chế chọn ngẫu nhiên câu hỏi / câu chào nằm ở lớp UI
// (ChatBubble bốc từ `getSuggestionPool` và `BUBBLE_GREETINGS`). `getSuggestions` giữ lại như
// lối lấy nhanh TỐI ĐA ba câu đầu kho theo thứ tự cố định, không random.

export const PAGE_CONTEXT_MAX = 1500;

/** Số câu tối đa lớp UI hiện tại render được cùng lúc. */
export const SUGGESTIONS_SHOWN = 3;

const HEADER = '[NGỮ CẢNH TRANG — để hiểu user đang xem gì; KHÔNG nhắc lại nội dung này cho user]';

// Chỉ dẫn độ dài câu trả lời. Chỉ bubble mới gửi ngữ cảnh trang, nên chỉ bubble bị siết —
// trang /chat toàn màn hình không gửi ngữ cảnh nên không dính dòng này.
// Cũng phải tuân ràng buộc "không chứa số" như phần mô tả trang.
const BREVITY = 'Khung chat đang hiển thị rất hẹp: hãy trả lời ngắn gọn, đi thẳng ý chính, hạn chế bảng dài và liệt kê dài dòng.';

/** Câu chào ở trạng thái trống của bubble. Lớp UI tự chọn (ngẫu nhiên hay không). */
export const BUBBLE_GREETINGS: string[] = [
  'Mình có thể giúp gì cho bạn ở trang này?',
  'Bạn đang quan tâm điều gì? Cứ hỏi mình nhé.',
  'Có phần nào trên trang này bạn muốn mình giải thích không?',
  'Mình sẵn sàng rồi, bạn muốn hỏi gì nào?',
  'Bạn cần mình xem giúp phần nào?',
  'Hỏi mình bất cứ điều gì về thị trường nhé.',
];

/** Chỉ cần đọc được tham số. Nhận cả URLSearchParams lẫn ReadonlyURLSearchParams của Next. */
type SearchLike = { get(name: string): string | null };

/** Trả về TRỌN kho câu hỏi. subject = chủ thể trang chi tiết (mã/slug); tab = giá trị thô của ?tab= */
type PoolFn = (subject?: string, tab?: string) => string[];

type Entry = {
  /** Tên trang cho AI hiểu */
  title: string;
  /** Mô tả giao diện trang, 2-5 dòng, không chứa số */
  body: string;
  /** Ánh xạ giá trị ?tab= sang mô tả dễ hiểu. Thiếu key thì hiển thị nguyên giá trị. */
  tabs?: Record<string, string>;
  pool: PoolFn;
};

type DynamicEntry = Entry & {
  /** Tiền tố đường dẫn, đoạn ngay sau nó là chủ thể (VD '/stocks' + '/HPG') */
  prefix: string;
};

/** Kho đổi theo tab đang mở; tab lạ hoặc không có tab thì dùng kho mặc định của trang. */
const byTab =
  (base: string[], map: Record<string, string[]>): PoolFn =>
  (_subject, tab) =>
    (tab && map[tab]) || base;

/** Như byTab nhưng câu hỏi có chèn tên mã đang xem. */
const byTabWithSubject =
  (base: (s?: string) => string[], map: Record<string, (s?: string) => string[]>): PoolFn =>
  (subject, tab) =>
    (tab && map[tab] ? map[tab] : base)(subject);

const EXACT: Record<string, Entry> = {
  '/': {
    title: 'Trang chủ',
    body:
      'Trang tổng quan toàn thị trường, mỗi khối là cửa vào một mục sâu hơn. Có: dải chỉ số chính, ' +
      'biểu đồ chỉ số, độ rộng thị trường, phân bổ dòng tiền, top cổ phiếu tăng và giảm, ' +
      'top khối ngoại mua và bán ròng, hiệu suất nhóm ngành, tin tức.',
    pool: () => [
      'Hôm nay thị trường thế nào?',
      'Khối ngoại đang mua ròng hay bán ròng?',
      'Nhóm ngành nào đang tăng tốt nhất?',
      'Vì sao thị trường hôm nay tăng giảm như vậy?',
      'Cổ phiếu nào tăng mạnh nhất phiên này?',
      'Thanh khoản hôm nay so với mọi khi ra sao?',
    ],
  },
  '/markets': {
    title: 'Thị trường',
    body:
      'Trang phân tích thị trường nhiều chiều. Đầu trang là biểu đồ chỉ số và bảng các chỉ số. ' +
      'Bên dưới là các tab: Biến động, Dòng tiền, Định giá, Kỹ thuật, Nước ngoài, Tự doanh. ' +
      'Một số tab yêu cầu đăng nhập hoặc gói hội viên phù hợp.',
    tabs: {
      volatility: 'Biến động',
      cashflow: 'Dòng tiền',
      valuation: 'Định giá',
      ptkt: 'Kỹ thuật',
      foreign: 'Nước ngoài',
      proprietary: 'Tự doanh',
    },
    pool: byTab(
      [
        'Thị trường đang mạnh hay yếu?',
        'Cổ phiếu nào tăng giảm mạnh nhất hôm nay?',
        'Nhóm vốn hoá nào đang dẫn dắt?',
        'Mấy phiên gần đây thị trường diễn biến ra sao?',
        'Bên mua hay bên bán đang chiếm ưu thế?',
      ],
      {
        volatility: [
          'Hôm nay thị trường biến động ra sao?',
          'Cổ phiếu nào tăng giảm mạnh nhất?',
          'Vốn hoá lớn hay nhỏ đang khoẻ hơn?',
          'Số mã tăng nhiều hơn hay giảm nhiều hơn?',
          'Biến động mấy phiên gần đây có bất thường không?',
        ],
        cashflow: [
          'Dòng tiền đang chảy vào đâu?',
          'Ngành nào đang bị rút tiền?',
          'Thanh khoản hôm nay cao hay thấp?',
          'Tiền đang vào nhóm lớn hay nhóm nhỏ?',
          'Dòng tiền tuần này mạnh lên hay yếu đi?',
        ],
        valuation: [
          'Thị trường đang đắt hay rẻ?',
          'Định giá hiện tại so với trước đây thế nào?',
          'Ngành nào đang rẻ so với chính nó?',
          'Mức định giá này đã hấp dẫn để mua chưa?',
          'Định giá thị trường thay đổi ra sao trong năm qua?',
        ],
        ptkt: [
          'Xu hướng thị trường đang lên hay xuống?',
          'Bao nhiêu cổ phiếu còn giữ được xu hướng tăng?',
          'Thị trường đã tạo đáy chưa?',
          'Chỉ số đang gặp vùng cản nào?',
          'Tín hiệu kỹ thuật hiện tại nói lên điều gì?',
        ],
        foreign: [
          'Khối ngoại đang gom mã nào?',
          'Nước ngoài bán ròng bao lâu rồi?',
          'Khối ngoại rút tiền có đáng lo không?',
          'Khối ngoại bán mạnh nhất ở mã nào?',
          'Nước ngoài mua bán khác gì so với tháng trước?',
        ],
        proprietary: [
          'Tự doanh đang mua bán gì?',
          'Tự doanh có đi cùng chiều khối ngoại không?',
          'Tự doanh gom mạnh mã nào tuần này?',
          'Theo chân tự doanh có hợp lý không?',
          'Tự doanh đang mua ròng hay bán ròng?',
        ],
      },
    ),
  },
  '/phase': {
    title: 'Giai đoạn thị trường',
    body:
      'Trang định vị pha thị trường, dữ liệu chốt cuối phiên. Đầu trang hiển thị trạng thái pha ' +
      'kèm dải các phiên gần nhất, tỷ trọng nắm giữ gợi ý và cường độ thị trường. ' +
      'Có tab phân tích thị trường và các tab rổ danh mục mẫu; tab rổ yêu cầu gói hội viên phù hợp.',
    tabs: {
      market: 'Phân tích thị trường',
      conservative: 'Danh mục Phòng Thủ',
      aggressive: 'Danh mục Mạo Hiểm',
      core: 'Danh mục Sóng Ngành',
    },
    pool: byTab(
      [
        'Giờ tôi nên cầm bao nhiêu cổ phiếu?',
        'Thị trường đang ở giai đoạn nào?',
        'Lúc này nên mua thêm hay đứng ngoài?',
        'Giai đoạn hiện tại kéo dài bao lâu rồi?',
        'Điều gì khiến thị trường chuyển sang giai đoạn khác?',
      ],
      {
        conservative: [
          'Rổ này đang nắm giữ những mã nào?',
          'Rổ này hợp với người ngại rủi ro không?',
          'Hiệu quả của rổ này thời gian qua ra sao?',
          'Rổ này khác gì hai rổ còn lại?',
        ],
        aggressive: [
          'Rổ này đang có những mã nào?',
          'Rổ này rủi ro tới đâu?',
          'Nên bỏ bao nhiêu tiền vào rổ kiểu này?',
          'Hiệu quả của rổ này thời gian qua ra sao?',
        ],
        core: [
          'Rổ này đang bám theo ngành nào?',
          'Rổ này đang nắm giữ những mã nào?',
          'Vì sao rổ lại chọn những ngành đó?',
          'Hiệu quả của rổ này thời gian qua ra sao?',
        ],
      },
    ),
  },
  '/stocks': {
    title: 'Bộ lọc cổ phiếu',
    body:
      'Trang sàng lọc cổ phiếu toàn thị trường. Có ô tìm mã, các mẫu lọc dựng sẵn, bộ lọc nhanh ' +
      'theo sàn và nhóm, bộ lọc nâng cao theo khoảng giá trị, bộ lọc kỹ thuật so giá với chỉ báo. ' +
      'Kết quả hiển thị dạng bảng, chuyển được giữa các kiểu bảng và tuỳ chỉnh cột. ' +
      'Trang yêu cầu gói hội viên phù hợp. AI không đọc được bộ lọc user đang đặt — ' +
      'khi user hỏi tìm cổ phiếu thì tự truy vấn dữ liệu rồi trả lời.',
    pool: () => [
      'Cổ phiếu nào đang có dòng tiền vào mạnh?',
      'Tôi nên chọn cổ phiếu theo những tiêu chí nào?',
      'Cổ phiếu nào vừa vượt vùng đỉnh ngắn hạn?',
      'Gợi ý giúp tôi vài mã đang khoẻ hơn thị trường',
      'Cổ phiếu nào vừa được khối ngoại gom mạnh?',
    ],
  },
  '/sectors': {
    title: 'Ngành nghề',
    body:
      'Trang xếp hạng và so sánh các nhóm ngành theo sức mạnh dòng tiền. Có bảng xếp hạng ngành, ' +
      'các biểu đồ dòng tiền và thanh khoản theo ngành, và bảng chỉ số định giá ngành. ' +
      'Bấm vào một ngành để xem trang chi tiết ngành đó.',
    pool: () => [
      'Ngành nào đang mạnh nhất lúc này?',
      'Ngành nào đang bị bán mạnh?',
      'Ngành nào đang có định giá hấp dẫn?',
      'Ngành nào hút tiền nhiều nhất tuần này?',
      'Giai đoạn hiện tại nên ưu tiên ngành nào?',
    ],
  },
  '/groups': {
    title: 'Nhóm cổ phiếu',
    body:
      'Trang so sánh các rổ chỉ số do Finext tự xây, chia theo ba loại: nhóm thị trường, ' +
      'nhóm dòng tiền và nhóm vốn hoá. Nhóm khác với ngành nghề: nhóm phân theo tiêu chí dòng tiền ' +
      'và vốn hoá chứ không theo lĩnh vực kinh doanh. Bấm một nhóm để xem chi tiết.',
    pool: () => [
      'Nhóm nào đang hút tiền nhất?',
      'Cổ phiếu vốn hoá lớn hay nhỏ đang khoẻ hơn?',
      'Các nhóm này khác ngành nghề ở chỗ nào?',
      'Nhóm nào đang chạy tốt hơn thị trường chung?',
      'Người mới nên bắt đầu với nhóm nào?',
    ],
  },
  '/commodities': {
    title: 'Thị trường hàng hoá',
    body:
      'Trang theo dõi giá hàng hoá, chia theo các tab nhóm mặt hàng. Mỗi tab có biểu đồ giá của ' +
      'mục đang chọn và bảng liệt kê kèm mức biến động theo tuần, tháng, quý, năm. ' +
      'Bấm một dòng trong bảng để đổi biểu đồ.',
    tabs: {
      metals: 'Kim loại',
      energy: 'Năng lượng',
      chemical: 'Hóa chất',
      agriculture: 'Nông sản',
    },
    pool: byTab(
      [
        'Giá hàng hoá đang tăng hay giảm?',
        'Mặt hàng nào biến động mạnh nhất?',
        'Giá hàng hoá tác động gì tới cổ phiếu?',
        'Mặt hàng nào tăng mạnh nhất năm nay?',
      ],
      {
        metals: [
          'Giá thép và kim loại đang thế nào?',
          'Giá kim loại tác động gì tới cổ phiếu thép?',
          'Giá vàng đang diễn biến ra sao?',
          'Kim loại nào tăng mạnh nhất gần đây?',
        ],
        energy: [
          'Giá dầu đang tăng hay giảm?',
          'Giá dầu tác động gì tới cổ phiếu dầu khí?',
          'Giá khí và than đang thế nào?',
          'Giá năng lượng cao có làm tăng lạm phát không?',
        ],
        chemical: [
          'Giá hoá chất phân bón đang biến động ra sao?',
          'Doanh nghiệp phân bón hưởng lợi hay chịu thiệt?',
          'Giá nguyên liệu nhựa đang thế nào?',
          'Nhóm hoá chất nào đáng chú ý lúc này?',
        ],
        agriculture: [
          'Giá nông sản đang thế nào?',
          'Doanh nghiệp nào hưởng lợi khi giá nông sản tăng?',
          'Giá gạo và cà phê biến động ra sao?',
          'Giá nông sản ảnh hưởng gì tới lạm phát?',
        ],
      },
    ),
  },
  '/macro': {
    title: 'Kinh tế vĩ mô',
    body:
      'Trang theo dõi các chỉ tiêu kinh tế vĩ mô, lãi suất tiền tệ và tỷ giá, chia theo tab. ' +
      'Mỗi tab có biểu đồ của mục đang chọn, mặc định khung một năm, kèm bảng liệt kê ' +
      'và mức biến động theo nhiều mốc thời gian.',
    tabs: {
      economy: 'Kinh tế vĩ mô',
      monetary: 'Lãi suất tiền tệ',
      exchange_rate: 'Tỷ giá VNĐ',
    },
    pool: byTab(
      [
        'Kinh tế đang tăng trưởng ra sao?',
        'Vĩ mô hiện tại tác động gì tới chứng khoán?',
        'Số liệu vĩ mô mới nhất nói lên điều gì?',
        'Bối cảnh vĩ mô đang thuận hay nghịch cho cổ phiếu?',
      ],
      {
        economy: [
          'Kinh tế Việt Nam đang tăng trưởng thế nào?',
          'Lạm phát hiện giờ ra sao?',
          'Xuất nhập khẩu đang tăng hay giảm?',
          'Kinh tế khoẻ lên thì nhóm nào hưởng lợi?',
        ],
        monetary: [
          'Lãi suất bây giờ cao hay thấp?',
          'Lãi suất tác động thế nào tới chứng khoán?',
          'Tiền đang được bơm ra hay hút về?',
          'Lãi suất gửi tiết kiệm đang ra sao?',
          'Lãi suất giảm thì nên mua nhóm nào?',
        ],
        exchange_rate: [
          'Tỷ giá đang căng hay ổn định?',
          'Tỷ giá tăng thì nhóm cổ phiếu nào bị ảnh hưởng?',
          'Đồng Việt Nam mất giá bao nhiêu trong năm nay?',
          'Tỷ giá có đang gây áp lực lên thị trường không?',
        ],
      },
    ),
  },
  '/international': {
    title: 'Tài chính quốc tế',
    body:
      'Trang theo dõi thị trường tài chính toàn cầu, chia theo tab: chứng khoán, ngoại hối, ' +
      'trái phiếu, tiền mã hoá. Mỗi tab có biểu đồ mục đang chọn và bảng liệt kê kèm mức biến động.',
    tabs: {
      global_index: 'Chứng khoán',
      fx: 'Ngoại hối',
      bonds: 'Trái phiếu',
      crypto: 'Tiền mã hóa',
    },
    pool: byTab(
      [
        'Chứng khoán thế giới đang thế nào?',
        'Thị trường quốc tế tác động gì tới Việt Nam?',
        'Thế giới đang có rủi ro gì đáng chú ý?',
        'Nên theo dõi chỉ số quốc tế nào?',
      ],
      {
        global_index: [
          'Chứng khoán Mỹ và châu Á đang tăng hay giảm?',
          'Thế giới giảm thì Việt Nam có bị kéo theo không?',
          'Chỉ số nào đang mạnh nhất thế giới?',
          'Chứng khoán Mỹ tác động tới ta ra sao?',
        ],
        fx: [
          'Đồng đô la đang mạnh hay yếu?',
          'Đô la mạnh lên thì chứng khoán Việt Nam ra sao?',
          'Các đồng tiền lớn đang biến động thế nào?',
          'Vì sao nhà đầu tư cần theo dõi tỷ giá quốc tế?',
        ],
        bonds: [
          'Lợi suất trái phiếu Mỹ đang thế nào?',
          'Lợi suất trái phiếu tác động gì tới cổ phiếu?',
          'Lợi suất tăng thì tiền chảy đi đâu?',
          'Trái phiếu đang hấp dẫn hơn cổ phiếu không?',
        ],
        crypto: [
          'Bitcoin đang tăng hay giảm?',
          'Tiền mã hoá có liên quan gì tới chứng khoán không?',
          'Dòng tiền đang vào hay ra khỏi tiền mã hoá?',
          'Tiền mã hoá biến động mạnh cỡ nào?',
        ],
      },
    ),
  },
  '/watchlist': {
    title: 'Danh sách theo dõi',
    body:
      'Trang công cụ theo dõi. Có khối chỉ số thị trường, khối chỉ số ngành, và các danh mục ' +
      'do user tự tạo. Danh mục sắp xếp nhiều cột và nhiều trang, kéo thả để đổi thứ tự, ' +
      'đổi được kiểu sắp xếp. Mỗi dòng hiển thị giá, mức biến động, thanh khoản và giá trị giao dịch. ' +
      'Đây là công cụ theo dõi, không phải khuyến nghị mua bán. ' +
      'AI KHÔNG đọc được danh mục riêng của user: nếu user hỏi về danh mục của họ, ' +
      'hãy đề nghị user nêu các mã cụ thể rồi phân tích theo đó.',
    pool: () => [
      'Các chỉ số chính hôm nay tăng hay giảm?',
      'Ngành nào đang dẫn dắt thị trường?',
      'Nên theo dõi cổ phiếu bằng những tiêu chí nào?',
      'Chỉ số ngành nào đang tăng tốt nhất?',
      'Một danh mục bao nhiêu mã là hợp lý?',
    ],
  },
};

const DYNAMIC: DynamicEntry[] = [
  {
    prefix: '/stocks',
    title: 'Chi tiết cổ phiếu',
    body:
      'Trang phân tích chi tiết một mã. Có giá và mức biến động, thông tin doanh nghiệp, ' +
      'các chỉ số định giá, và chuyển được giữa chế độ thông tin và biểu đồ. ' +
      'Bên dưới là các tab: Dòng tiền, Kỹ thuật, Tài chính, Tin tức. ' +
      'Một số tab yêu cầu gói hội viên phù hợp.',
    tabs: {
      cashflow: 'Dòng tiền',
      pricemap: 'Kỹ thuật',
      financials: 'Tài chính',
      news: 'Tin tức',
    },
    pool: byTabWithSubject(
      (s) => [
        `${s} hôm nay tăng hay giảm?`,
        `${s} đang đắt hay rẻ?`,
        `${s} làm ăn thế nào?`,
        `Có nên mua ${s} lúc này không?`,
        `${s} có gì đáng chú ý gần đây?`,
      ],
      {
        cashflow: (s) => [
          `Ai đang mua bán ${s} nhiều nhất?`,
          `Dòng tiền vào ${s} đang mạnh hay yếu?`,
          `Khối ngoại đang gom hay xả ${s}?`,
          `Thanh khoản của ${s} có bất thường không?`,
        ],
        pricemap: (s) => [
          `${s} đang ở xu hướng nào?`,
          `${s} có vùng hỗ trợ kháng cự ở đâu?`,
          `${s} đã vào vùng quá mua chưa?`,
          `Điểm mua hợp lý của ${s} ở đâu?`,
        ],
        financials: (s) => [
          `${s} làm ăn có lãi không?`,
          `Kết quả kinh doanh gần đây của ${s} ra sao?`,
          `${s} có vay nợ nhiều không?`,
          `Lợi nhuận ${s} tăng hay giảm so với cùng kỳ?`,
        ],
        news: (s) => [
          `Có tin gì mới về ${s} không?`,
          `Tin gần đây tác động thế nào tới ${s}?`,
          `${s} có sự kiện gì sắp tới không?`,
          `Vì sao ${s} biến động mạnh gần đây?`,
        ],
      },
    ),
  },
  {
    prefix: '/sectors',
    title: 'Chi tiết ngành',
    body:
      'Trang phân tích chi tiết một ngành. Có biểu đồ chỉ số ngành, thông tin phiên, ' +
      'dải chỉ số định giá ngành, và các tab: Dòng tiền, Cổ phiếu trong ngành, Tài chính, Tin tức. ' +
      'Tab Cổ phiếu có bảng xếp hạng và bản đồ ngành. Một số tab yêu cầu gói hội viên phù hợp. ' +
      'Chủ thể trên đường dẫn là slug rút gọn không dấu, không phải tên ngành chuẩn — ' +
      'hãy tra tên ngành đầy đủ ngay ở lần truy vấn đầu, đừng dò nhiều lượt.',
    tabs: {
      cashflow: 'Dòng tiền',
      stocks: 'Cổ phiếu',
      financials: 'Tài chính',
      news: 'Tin tức',
    },
    pool: byTab(
      [
        'Ngành này đang mạnh hay yếu?',
        'Ngành này đang đắt hay rẻ?',
        'Cổ phiếu nào đáng chú ý trong ngành này?',
        'Ngành này so với các ngành khác thế nào?',
        'Triển vọng ngành này ra sao?',
      ],
      {
        cashflow: [
          'Dòng tiền vào ngành này đang thế nào?',
          'Ngành này có đang bị rút tiền không?',
          'Thanh khoản ngành này ra sao?',
          'Khối ngoại có quan tâm ngành này không?',
        ],
        stocks: [
          'Cổ phiếu nào mạnh nhất trong ngành này?',
          'Các mã trong ngành đang phân hoá ra sao?',
          'Mã nào trong ngành đang rẻ nhất?',
          'Nên chọn mã đầu ngành hay mã nhỏ?',
        ],
        financials: [
          'Doanh nghiệp ngành này làm ăn thế nào?',
          'Lợi nhuận ngành này đang tăng hay giảm?',
          'Ngành này có vay nợ nhiều không?',
          'Biên lợi nhuận ngành này ra sao?',
        ],
        news: [
          'Có tin gì mới về ngành này không?',
          'Tin gần đây tác động thế nào tới ngành này?',
          'Chính sách nào đang ảnh hưởng tới ngành này?',
          'Ngành này có sự kiện gì đáng chú ý?',
        ],
      },
    ),
  },
  {
    prefix: '/groups',
    title: 'Chi tiết nhóm cổ phiếu',
    body:
      'Trang phân tích chi tiết một rổ chỉ số của Finext. Có biểu đồ chỉ số rổ, thông tin phiên, ' +
      'các biểu đồ dòng tiền và thanh khoản của rổ, bảng cổ phiếu nổi bật trong nhóm và bản đồ nhóm. ' +
      'Đây là rổ phân theo dòng tiền hoặc vốn hoá, không phải ngành nghề. ' +
      'Phần nâng cao yêu cầu gói hội viên phù hợp.',
    pool: () => [
      'Nhóm này gồm những cổ phiếu nào?',
      'Nhóm này đang khoẻ hay yếu hơn thị trường?',
      'Dòng tiền vào nhóm này ra sao?',
      'Nhóm này được xếp theo tiêu chí gì?',
      'Mã nào nổi bật nhất trong nhóm này?',
    ],
  },
  {
    prefix: '/charts',
    title: 'Biểu đồ kỹ thuật',
    body:
      'Trang biểu đồ kỹ thuật của một mã, có thể là cổ phiếu, chỉ số hoặc ngành. ' +
      'Gồm biểu đồ nến và khối lượng, đổi được khung thời gian và loại biểu đồ. ' +
      'Có bảng chỉ báo bật tắt được, bảng thông tin mã, và bảng danh mục theo dõi. ' +
      'Bảng chỉ báo yêu cầu gói hội viên phù hợp. Đây là công cụ phân tích tham khảo, ' +
      'không phải khuyến nghị đầu tư.',
    pool: (s) => [
      `${s} đang ở xu hướng tăng hay giảm?`,
      `${s} có vùng hỗ trợ kháng cự ở đâu?`,
      `Đồ thị ${s} đang cho tín hiệu gì?`,
      `${s} biến động thế nào trong năm qua?`,
      `Nên xem chỉ báo nào cho ${s}?`,
    ],
  },
];

function normalize(pathname: string): string {
  const p = pathname.split('?')[0].split('#')[0];
  return p.length > 1 && p.endsWith('/') ? p.slice(0, -1) : p;
}

function resolve(pathname: string): { entry: Entry; subject?: string } | undefined {
  const path = normalize(pathname);
  const exact = EXACT[path];
  if (exact) return { entry: exact };
  for (const d of DYNAMIC) {
    if (!path.startsWith(`${d.prefix}/`)) continue;
    const rest = path.slice(d.prefix.length + 1);
    if (!rest || rest.includes('/')) continue; // chỉ nhận đúng một đoạn
    return { entry: d, subject: decodeURIComponent(rest) };
  }
  return undefined;
}

/** Chuỗi ngữ cảnh gửi kèm lượt chat. undefined = trang không có ngữ cảnh (không hiện bubble). */
export function buildPageContext(pathname: string, search?: SearchLike): string | undefined {
  const hit = resolve(pathname);
  if (!hit) return undefined;
  const { entry, subject } = hit;

  const head = [`Trang: ${entry.title}`];
  if (subject) head.push(`Đang xem: ${subject}`);
  const tabKey = search?.get('tab');
  if (tabKey) head.push(`Tab: ${entry.tabs?.[tabKey] ?? tabKey}`);

  const out = [HEADER, head.join(' · '), entry.body, BREVITY].join('\n');
  return out.length > PAGE_CONTEXT_MAX ? out.slice(0, PAGE_CONTEXT_MAX) : out;
}

/**
 * TRỌN kho câu hỏi của trang (và tab) đang xem — dành cho lớp UI muốn chọn ngẫu nhiên.
 * Mảng rỗng nếu trang không có bubble.
 */
export function getSuggestionPool(pathname: string, search?: SearchLike): string[] {
  const hit = resolve(pathname);
  return hit ? hit.entry.pool(hit.subject, search?.get('tab') ?? undefined) : [];
}

/**
 * Câu hỏi gợi ý để render ngay: TỐI ĐA `SUGGESTIONS_SHOWN` câu đầu kho, thứ tự cố định.
 * Cố ý không random — BubbleMessages render mọi phần tử nhận được.
 */
export function getSuggestions(pathname: string, search?: SearchLike): string[] {
  return getSuggestionPool(pathname, search).slice(0, SUGGESTIONS_SHOWN);
}

/** Trang này có hiện bubble không. Nguồn sự thật duy nhất cho việc ẩn/hiện. */
export function hasBubble(pathname: string): boolean {
  return resolve(pathname) !== undefined;
}
