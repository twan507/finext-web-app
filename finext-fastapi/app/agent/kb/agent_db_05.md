# agent_db_05 — News Methodology

## 0. Giới thiệu

File này cung cấp khung diễn giải và phương pháp phân tích bốn loại tin tức lưu trong `agent_db` — `doanh_nghiep` (tin doanh nghiệp niêm yết cụ thể), `quoc_te` (tin tài chính quốc tế), `trong_nuoc` (bucket rộng gồm mọi tin nội địa, cần lọc thêm qua `category_name` để tách tin vĩ mô/chính sách thực sự ảnh hưởng TTCK), và `thong_cao` (tổng hợp chỉ đạo điều hành Chính phủ/Thủ tướng hàng ngày — volume nhỏ nhưng chứa định hướng chính sách cấp cao). Khác với `agent_db_01` mô tả schema các collection tin và `agent_db_02` cung cấp query patterns, file này trả lời câu hỏi mang tính diễn giải: có tin rồi thì đọc thế nào cho đúng bối cảnh thị trường Việt Nam, xếp hạng mức độ ảnh hưởng ra sao, và map sang hành động đầu tư cụ thể nào.

Trong hệ thống tài liệu methodology của agent, `agent_db_05` đứng ở vị trí bổ sung cho `agent_db_04`. `agent_db_04` chuyên về diễn giải các chỉ báo định lượng (dòng tiền, trend, kỹ thuật, cơ bản), còn `agent_db_05` chuyên về diễn giải thông tin định tính (tin tức và sự kiện). Hai file kết hợp tạo nên bức tranh phân tích đầy đủ: khi có tín hiệu từ chỉ báo, `agent_db_04` cho biết diễn giải thế nào; khi có tin tức, `agent_db_05` cho biết tin có ý nghĩa gì và tác động ra sao. Phần cuối file này (phần 8) đặc biệt hướng dẫn cách kết hợp hai loại phân tích này để ra kết luận có độ tin cậy cao hơn là dùng riêng rẽ.

### Quan hệ với các file khác

`agent_db_01` mô tả schema bốn collection tin tức là `news_today_feed`, `news_today_content`, `news_history_feed`, và `news_history_content`, cùng với cấu trúc doc và các field metadata. `agent_db_02` có Workflow L ở phần cuối cung cấp query patterns mẫu cho bốn loại tin. `agent_db_03` chuyên về các lỗi xử lý dữ liệu định lượng, không cover tin tức nên không trùng lặp với file này. `agent_db_04` chuyên về diễn giải chỉ báo và phân tích cơ bản theo 4 type doanh nghiệp. `agent_db_05` hoàn thiện lăng kính thứ tư của agent là tin tức, đi kèm với dòng tiền, trend kỹ thuật, và cơ bản doanh nghiệp.

### Khi nào đọc file này

Agent nên đọc file này trong ba tình huống chính. Thứ nhất là đầu session khi câu hỏi của user có liên quan đến tin tức, chính sách vĩ mô, hoặc yêu cầu bối cảnh sự kiện cụ thể — đọc toàn file một lần để internalize framework. Thứ hai là khi gặp một sự kiện tin cụ thể mà chưa chắc cách đọc — tra section tương ứng với loại tin đó ở phần 3, 4, hoặc 5. Thứ ba là trước khi đưa khuyến nghị hành động dựa trên tin — kiểm tra framework chấm điểm nội bộ ở phần 2, workflow kết hợp đa tin ở phần 6, và nguyên tắc kết hợp với chỉ báo định lượng ở phần 8.

### Nguyên tắc chủ đạo

Tin tức không bao giờ được phân tích cô lập khỏi các chỉ báo định lượng đã có trong agent. Một tin tích cực xuất hiện khi giá đã tăng nóng thường mang ý nghĩa phân phối nhiều hơn là khởi đầu chu kỳ mới — đây là hiện tượng thị trường Việt Nam gọi là "tin ra là bán" (bán khi tin tốt được công bố chính thức, sau một giai đoạn đầu cơ theo kỳ vọng). Ngược lại, một tin tiêu cực xuất hiện khi dòng tiền thông minh đang âm thầm mua vào tại vùng giá thấp lịch sử thường là pha rũ bỏ cuối cùng của nhịp giảm, báo hiệu đáy trung hạn sắp hình thành.

Bốn loại tin đòi hỏi chiều sâu phân tích khác nhau. Tin trong nước thuộc subset vĩ mô/chính sách và tin thông cáo Chính phủ đòi hỏi hiểu pattern điều hành đặc thù của chính phủ Việt Nam — không thể áp dụng analogy từ thị trường Mỹ hay châu Âu một cách máy móc vì thể chế và phương thức quản lý kinh tế khác nhau. Tin quốc tế cần ba tầng nhận thức kết nối với nhau: đọc đúng tin theo chuẩn phân tích tài chính quốc tế, phân tích địa chính trị từng khu vực ở chiều sâu cấu trúc, và mapping cụ thể về kinh tế Việt Nam qua các kênh truyền dẫn. Tin doanh nghiệp bắt buộc agent phải giải mã được mạng lưới sở hữu chéo phức tạp trong các hệ sinh thái tập đoàn Việt Nam và nắm vững các quy định pháp lý về công bố thông tin theo Luật Chứng khoán và Thông tư 96/2020/TT-BTC. Riêng `trong_nuoc` là bucket rộng gồm cả tin không liên quan TTCK (chính trị thuần, đối ngoại, văn hoá) — agent phải filter qua `category_name` trước khi áp methodology, mặc định skip các category "Chính trị", "Đối ngoại", "Thời sự", "Khoa học - Công nghệ" trừ khi user hỏi đích danh.

---

## 1. Nguyên tắc chung khi phân tích tin tức

### 1.1. Tin là chất xúc tác, không phải nguyên nhân tự thân

Tin tức thường không trực tiếp tạo ra xu hướng giá — nó xúc tác cho các xu hướng đã âm thầm hình thành sẵn trong cấu trúc thị trường. Hai cổ phiếu nhận cùng một tin tốt có thể phản ứng hoàn toàn khác nhau tùy vào trạng thái kỹ thuật và dòng tiền trước đó của mỗi cổ phiếu. Một mã đang ở vùng tích lũy chặt chẽ sau giai đoạn điều chỉnh sâu, có dòng tiền tuần đang chuyển từ âm sang dương, khi nhận tin tốt có thể bật mạnh và xác lập uptrend mới. Cùng tin đó đến với một mã đã tăng 40% trong hai tháng qua, dòng tiền tuần đã chuyển từ cao xuống trung tính, sẽ có thể kích hoạt phân phối. Chính vì vậy agent không bao giờ đưa kết luận chỉ dựa trên nội dung tin, mà phải luôn đặt câu hỏi: trạng thái kỹ thuật và dòng tiền hiện tại có xác nhận hướng tác động mà tin gợi ý không.

### 1.2. Độ trễ tác động và khái niệm price-in

Tin tức có độ trễ tác động khác nhau tùy nội dung và tùy giai đoạn thị trường đã tiêu hóa trước đó. Có những tin tức phản ánh vào giá ngay trong phiên (công bố lợi nhuận bất ngờ, quyết định bắt giữ lãnh đạo), có những tin cần vài tuần (chính sách tiền tệ mới ban hành) để dòng tiền tái cơ cấu, và có những tin cần vài quý (thay đổi cấu trúc ngành do luật mới) để tác động thấm vào báo cáo tài chính. Khi một tin được chính thức công bố, agent phải kiểm tra xem thị trường đã tiêu hóa tin này được bao lâu rồi. Nếu giá đã phản ánh toàn bộ kỳ vọng tích cực trong hai tháng trước (price-in đầy đủ), tin ra chính thức thậm chí có thể là điểm bán — hiện tượng "buy the rumor, sell the news" quen thuộc của thị trường chứng khoán.

### 1.3. Nguồn tin và mức độ tin cậy

Không phải tất cả tin đều có trọng lượng như nhau. Agent phân loại nguồn tin thành bốn tầng giảm dần về độ tin cậy để quyết định mức độ chắc chắn khi diễn giải.

Tầng cao nhất là các văn bản quy phạm pháp luật có số hiệu chính thức đã ký ban hành (nghị định, quyết định, thông tư), công bố chính thức của doanh nghiệp niêm yết qua hệ thống của Sở Giao dịch (HOSE, HNX), thông báo chính thức của cơ quan nhà nước (NHNN, UBCKNN, Bộ Tài chính, Tổng cục Thống kê), và các định chế tài chính quốc tế uy tín (Fed, IMF, World Bank, BIS). Tầng này cũng bao gồm các hãng tin tài chính quốc tế có biên tập kiểm duyệt chặt chẽ như Reuters, Bloomberg, Financial Times, Nikkei Asia. Tin ở tầng này được dùng làm cơ sở chắc chắn cho phân tích và khuyến nghị hành động rõ ràng.

Tầng thứ hai là báo cáo phân tích của các công ty chứng khoán lớn trong nước (SSI, VCSC, HSC, VNDirect, MBS), các báo chuyên ngành kinh tế và chứng khoán có biên tập uy tín như VnExpress, CafeF, VietstockFinance, Nhịp cầu Đầu tư, VnEconomy. Tin ở tầng này cần được cross-check với ít nhất một nguồn tầng một hoặc tầng hai khác trước khi dùng làm cơ sở cho khuyến nghị hành động mạnh. Nếu chỉ có nguồn tầng hai, khuyến nghị nên thận trọng hơn và kèm điều kiện cần xác nhận thêm.

Tầng thứ ba là các trang tin nhỏ không thuộc hệ thống báo chí lớn, blog phân tích cá nhân, bài PR có nội dung lặp lại trên nhiều trang nhỏ. Tin ở tầng này không được dùng làm cơ sở khuyến nghị mua bán, chỉ dùng để tham khảo và làm lẫy kích hoạt cho việc rà soát các chỉ báo định lượng bất thường. Tầng thứ tư là nhóm chat kín (Zalo, Telegram, Messenger), diễn đàn, bình luận cá nhân trên mạng xã hội, tin nhắn riêng — những nguồn này không qua biên tập và thường là kênh lan truyền tin đồn hoặc thao túng truyền thông. Agent không dùng tầng thứ tư làm cơ sở phân tích dưới bất kỳ hình thức nào.

Nguyên tắc áp dụng: độ chắc chắn của khuyến nghị tỷ lệ thuận với độ cao của nguồn tin. Với tin tầng một đã được xác minh, agent có thể đưa khuyến nghị hành động rõ ràng. Với tin tầng hai chưa cross-check, agent nên kèm điều kiện cần xác nhận thêm (ví dụ chờ công bố chính thức, chờ phiên xác nhận khối lượng). Với tin tầng ba, agent chỉ nên nhắc lại thông tin có ghi chú "chưa xác minh" và không đưa khuyến nghị. Với tin tầng bốn, agent không dùng nội dung tin làm cơ sở phân tích hay khuyến nghị dưới bất kỳ hình thức nào; tuy nhiên nếu tin tầng bốn đi kèm dấu hiệu bất thường trên thị trường (khối lượng giao dịch đột biến, dòng tiền tháo chạy, giá phá hỗ trợ), agent có thể dùng bất thường đó làm lẫy kích hoạt cảnh báo rủi ro thanh khoản — cảnh báo dựa trên dữ liệu giao dịch thực chứ không dựa vào nội dung tin. Chi tiết cách xử lý tin đồn xem thêm section 7.1.

### 1.4. Phân biệt tin chất (material) và tin nhiễu (noise)

Tin chất là tin thực sự có khả năng thay đổi định giá cơ bản của doanh nghiệp hay cấu trúc dòng tiền thị trường. Tin nhiễu là tin có vẻ quan trọng nhưng thực chất chỉ tạo biến động ngắn hạn mà không thay đổi các yếu tố nền tảng. Ba tiêu chí phân biệt cơ bản là nguồn (tin chất đến từ cơ quan chính thống có thẩm quyền, tin nhiễu thường từ nguồn không xác minh được), tính lượng hóa (tin chất có số liệu cụ thể, tin nhiễu thường chỉ định tính), và tính verify chéo (tin chất được ít nhất hai nguồn uy tín xác nhận độc lập, tin nhiễu thường chỉ có một nguồn duy nhất). Agent phải lọc nhiễu ra khỏi mô hình phân tích trước khi chạm đến bước chấm điểm impact.

---

## 2. Framework chấm điểm impact — công cụ nội bộ của agent

### 2.1. Quan trọng: đây là quá trình nội bộ, không hiển thị ra output

Framework trong phần này là công cụ tư duy để agent không bỏ sót các dimension quan trọng khi đánh giá tin tức. Agent chấm điểm trong quá trình suy luận nội bộ để quyết định độ nặng ký của tin, nhưng TUYỆT ĐỐI KHÔNG bao giờ báo điểm số hay nhãn phân loại cho user. Cụ thể:

Các cụm từ sau là taxonomy nội bộ, bị cấm lộ ra output cho user: "tin HIGH impact", "tin MID impact", "tin LOW impact", "điểm 5/6", "logic gate số 3", "framework chấm điểm", "impact score". Khi agent trả lời user, thay vì dùng nhãn, agent phải mô tả trực tiếp tác động cụ thể và cơ chế. Ví dụ thay vì nói "Tin này là HIGH impact, điểm 5/6", agent nói "Tin này có khả năng thay đổi chi phí vốn toàn thị trường trong 1-3 tháng thông qua kênh lãi suất điều hành, khuyến nghị hạ ngay tỷ trọng nhóm cổ phiếu bất động sản và chứng khoán vốn nhạy cảm với lãi suất". Cách diễn đạt thứ hai không chỉ tránh lộ taxonomy nội bộ mà còn thực sự có ích cho user vì nó giải thích cơ chế và đề xuất hành động cụ thể.

### 2.2. Framework 5 cổng logic áp chung cho cả bốn loại tin

Dựa trên nguyên tắc nhất quán để agent dễ nhớ và áp dụng, framework này gồm 5 câu hỏi có trọng số tương đương (hoặc được điều chỉnh nhẹ theo đặc thù loại tin). Agent chạy tuần tự qua 5 câu hỏi, cho điểm, cộng tổng để ra mức độ tác động nội bộ. Ngưỡng phân loại nội bộ là: 5-7 điểm tương đương tác động rất mạnh toàn thị trường (thường đi kèm biến động VN-Index từ ±3% trở lên), 3-4 điểm tác động đáng kể nhưng cục bộ ngành (biến động VN-Index ±1-3%, nhóm ngành liên quan biến động mạnh hơn), 0-2 điểm tác động không đủ lớn để thay đổi chiến lược (biến động VN-Index dưới ±1%). Các ngưỡng biến động này chỉ để agent tự calibrate mức độ chấm điểm khi có dữ liệu lịch sử tương tự, không phải con số hiển thị cho user.

Câu hỏi thứ nhất kiểm tra nguồn tin theo hệ tier ở section 1.3: tin đến từ tầng một (nguồn chính thống đã xác minh) được 1 điểm, tầng hai chưa cross-check được 0.5 điểm, tầng ba hoặc bốn được 0 điểm và agent dừng luôn ở câu hỏi này vì không nên đưa tin vào mô hình phân tích. Đây là cửa chặn đầu tiên.

Câu hỏi thứ hai kiểm tra tính pháp lý và cấu trúc của tin: tin có được ban hành dưới dạng văn bản chính thức có số hiệu (nghị định, quyết định, thông tư) cho tin vĩ mô, có phải nghị quyết HĐQT hay quyết định cơ quan điều tra cho tin doanh nghiệp, hay tin quốc tế đi kèm quyết định chính thức có hiệu lực pháp lý không. Tin có tính pháp lý được 1 điểm, tin chỉ là thông báo truyền thông hay phát biểu miệng được 0 điểm. Đây là lý do tin đồn dù lan truyền rộng nhưng không đạt điểm ở câu này.

Câu hỏi thứ ba kiểm tra cơ chế tác động: tin có trực tiếp thay đổi chi phí vốn, thanh khoản, cấu trúc dòng tiền của hệ thống hay một nhóm cổ phiếu, hay chỉ gián tiếp qua kỳ vọng tâm lý. Tin trực tiếp thay đổi chi phí vốn được 2 điểm (trọng số cao hơn vì tác động cơ học mạnh và khó tránh), tin chỉ tác động qua tâm lý được 0 điểm. Thay đổi lãi suất điều hành từ 0.5% trở lên, quyết định cấp room tín dụng có điều chỉnh đáng kể từ ±1 điểm phần trăm, công bố kết quả kinh doanh chính thức lệch mạnh consensus, hay tin khởi tố lãnh đạo là các ví dụ tác động trực tiếp. Các phát biểu định hướng chung chung không đi kèm quyết định cụ thể chỉ tác động qua tâm lý.

Câu hỏi thứ tư kiểm tra quy mô định lượng: tác động ước tính có vượt ngưỡng có ý nghĩa không. Ngưỡng cụ thể tùy loại tin. Với tin vĩ mô VN là quy mô tác động vượt 1% tổng tín dụng hay GDP, hoặc số liệu vĩ mô lệch consensus trên 10%. Với tin quốc tế là giá nguyên liệu biến động trên 5% trong vài phiên, DXY biến động trên 1%, hoặc khoảng cách giữa Fed funds rate thực tế và dot plot dự báo lệch đáng kể. Với tin doanh nghiệp là lợi nhuận sau thuế hoặc doanh thu biến động trên 20-30% so với cùng kỳ hoặc so với consensus, giao dịch cổ đông nội bộ vượt 5% vốn điều lệ, hoặc giao dịch chiến lược vượt 10% vốn điều lệ. Vượt ngưỡng được 1 điểm, dưới ngưỡng được 0 điểm. Điểm quan trọng cần lưu ý là thị trường phản ứng với mức lệch so với kỳ vọng chứ không phải con số tuyệt đối — một quý lợi nhuận tăng 15% có vẻ tốt nhưng nếu consensus đã dự báo tăng 25% thì thị trường vẫn có thể phản ứng tiêu cực.

Câu hỏi thứ năm kiểm tra phạm vi tác động: tin tác động đa ngành toàn thị trường hay chỉ cục bộ một ngành hay một cổ phiếu. Tác động đa ngành được 1 điểm, cục bộ được 0 điểm. Tin đa ngành cần được xử lý ở cấp độ danh mục, tin cục bộ ở cấp độ cổ phiếu đơn lẻ.

### 2.3. Cách áp framework theo từng loại tin

Với tin vĩ mô trong nước, cả 5 câu hỏi đều áp dụng như mô tả trên. Tin có tổng điểm cao thường là các quyết định thay đổi lãi suất điều hành, các gói cứu trợ thanh khoản diện rộng, hay luật mới làm thay đổi mô hình kinh doanh của nhóm ngành trọng điểm. Tin có tổng điểm trung bình thường là số liệu vĩ mô hàng tháng có độ lệch nhẹ so với dự báo, hay chính sách hỗ trợ tài khóa cục bộ.

Với tin quốc tế, câu hỏi số 3 về cơ chế tác động cần được mở rộng để cover kênh truyền dẫn về Việt Nam — tin có làm thay đổi lộ trình lãi suất tương lai của Fed/ECB, thay đổi giá nguyên liệu cốt lõi cho doanh nghiệp VN, hay gây đứt gãy chuỗi cung ứng trên tuyến đường biển chính không. Tin có tổng điểm cao thường là quyết định đảo chiều chính sách của Fed, chiến tranh quy mô lớn ảnh hưởng đến rốn cung năng lượng thế giới, hay khủng hoảng tài chính lây lan. Tin có tổng điểm trung bình là biến động giá hàng hóa cục bộ, dữ liệu kinh tế Mỹ có độ chệch nhẹ so với dự báo.

Với tin doanh nghiệp, câu hỏi số 3 và số 4 có cách áp riêng. Câu 3 về cơ chế tác động — tin có thay đổi năng lực sinh lời hay cấu trúc vốn của doanh nghiệp không (thay vì thay đổi chi phí vốn hệ thống). Câu 4 về quy mô — lợi nhuận biến động lớn, giao dịch cổ đông nội bộ lớn, hay rủi ro pháp lý của lãnh đạo. Ngoài ra với tin doanh nghiệp có một yếu tố đặc biệt là tin liên quan đến tính hợp pháp của lãnh đạo hay ý kiến kiểm toán ngoại trừ — những loại tin này có thể tự nó đạt tổng điểm cao bất kể các câu khác, vì chúng là "Thiên nga đen" có sức tàn phá không lượng hóa được.

### 2.4. Sau khi chấm điểm nội bộ xong — output cho user

Sau khi agent đã chấm điểm nội bộ, bước tiếp theo là dịch kết quả sang ngôn ngữ tự nhiên. Thay vì nói "tin này 5 điểm là HIGH impact", agent mô tả cụ thể ba yếu tố: tác động gì (chi phí vốn, thanh khoản, lợi nhuận, cấu trúc ngành...), cơ chế tác động qua kênh nào (lãi suất, tỷ giá, chuỗi cung ứng, tâm lý, pháp lý...), và hệ quả hành động nào (hạ tỷ trọng nhóm A, nâng tỷ trọng nhóm B, đóng vị thế X, chờ xác nhận trước khi vào Y...).

Ví dụ mô tả đúng cho tin hạ lãi suất điều hành của NHNN: "Quyết định hạ lãi suất điều hành 0.5% có tác động trực tiếp giảm chi phí vốn cho toàn hệ thống ngân hàng, dự kiến kéo theo mặt bằng lãi suất cho vay giảm trong 1-2 tháng tới. Nhóm cổ phiếu hưởng lợi trực tiếp gồm công ty chứng khoán (do thanh khoản thị trường tăng và cho vay margin rẻ hơn), ngân hàng thương mại (do biên NIM cải thiện trong ngắn hạn), và bất động sản (do chi phí vốn dự án giảm). Khuyến nghị nâng tỷ trọng ba nhóm này và chờ xác nhận bằng dòng tiền tuần chuyển dương trước khi gia tăng vị thế."

Mô tả này đạt ba yêu cầu: không lộ taxonomy nội bộ (không có "HIGH impact"), giải thích cơ chế cụ thể (giảm chi phí vốn → lãi suất cho vay → biên NIM), và có hành động rõ ràng (nâng tỷ trọng ba nhóm, chờ xác nhận bằng dòng tiền tuần).

---

## 3. Tin trong nước (`trong_nuoc`) và thông cáo Chính phủ (`thong_cao`)

Phân tích tin nội địa Việt Nam là phần đòi hỏi chiều sâu đặc thù nhất trong bốn loại tin. Không được áp dụng lý thuyết kinh tế phương Tây một cách máy móc vì thể chế chính trị, phương thức điều hành kinh tế, và văn hoá quản trị tài chính của Việt Nam có nhiều đặc điểm riêng không có trong các giáo trình chuẩn quốc tế. Agent cần hiểu pattern hành xử của chính phủ theo giai đoạn kinh tế, đọc được mục đích ẩn sau mỗi chính sách, nắm rõ chu kỳ ban hành văn bản pháp luật, và phân biệt phong cách của từng cơ quan phát ngôn.

### 3.0. Bucket `trong_nuoc` — lọc category_name trước khi áp methodology

`trong_nuoc` là bucket rộng gồm mọi tin nội địa, KHÔNG đồng nghĩa "tin vĩ mô". Trong 30 ngày gần nhất, 247 tin `trong_nuoc` trải ra 11 `category_name` khác nhau. Agent bắt buộc lọc `category_name` trước khi áp methodology phần này:

**Relevant cho phân tích TTCK (áp methodology 3.1-3.6 dưới đây):**
- "Kinh tế" — số liệu kinh tế vĩ mô, xuất nhập khẩu, giá cả, ngành hàng.
- "Thị trường" — thông tin điều hành giá, thị trường hàng hoá, thị trường tài chính nội địa.
- "Chính sách mới" — chính sách tài khóa, thuế, các nghị định mới ban hành.
- "Ngân hàng" — hoạt động hệ thống ngân hàng, lãi suất, tỷ giá.
- "Chỉ đạo, quyết định của Chính phủ - Thủ tướng Chính phủ" — chỉ đạo cấp Thủ tướng về kinh tế, ngành.
- "Pháp luật" — các vụ việc pháp lý liên quan doanh nghiệp/kinh tế (khởi tố, thanh tra).
- "Tham vấn chính sách" — dự thảo chính sách đang lấy ý kiến, signal về hướng đi chính sách.

**Mặc định skip (trừ khi user hỏi đích danh về chính trị, đối ngoại, v.v.):**
- "Chính trị" — tin chính trị thuần (nhân vật lịch sử, Đại hội Đảng, bầu cử).
- "Đối ngoại" — hoạt động ngoại giao cấp cao, thăm viếng, chiêu đãi.
- "Thời sự" — tin thời sự xã hội nói chung.
- "Khoa học - Công nghệ" — tin KHCN thuần, không phải M&A công nghệ.

Tin thông cáo (`thong_cao`) có `category_name` duy nhất "Thông cáo chính phủ" — luôn đọc (xem 3.7 dưới).

### 3.1. Đặc thù chính sách Việt Nam

Hệ thống tin vĩ mô trong nước gồm nhiều loại thông tin đa dạng, mỗi loại có sức nặng và cơ chế tác động riêng. Nhóm chính sách tiền tệ do Ngân hàng Nhà nước ban hành có tác động mạnh nhất và nhanh nhất đến dòng tiền thị trường chứng khoán — gồm các quyết định thay đổi lãi suất điều hành, phân bổ hạn mức tăng trưởng tín dụng cho hệ thống ngân hàng thương mại, tỷ lệ dự trữ bắt buộc, và các nghiệp vụ thị trường mở. Nhóm chính sách tài khóa từ Chính phủ và Bộ Tài chính tác động chậm hơn nhưng cấu trúc hơn — gồm kế hoạch giải ngân đầu tư công, thay đổi biểu thuế và phí, và các đợt phát hành trái phiếu chính phủ. Nhóm văn bản quy phạm pháp luật mang tính cấu trúc là các bộ luật trọng điểm như Luật Đất đai, Luật Kinh doanh Bất động sản, Luật Các tổ chức tín dụng cùng hệ thống Nghị định, Thông tư hướng dẫn — những văn bản này thay đổi cả mô hình kinh doanh của nhóm ngành trọng điểm. Nhóm số liệu vĩ mô định kỳ do Tổng cục Thống kê công bố hàng tháng và hàng quý gồm tăng trưởng GDP, chỉ số giá tiêu dùng, chỉ số sản xuất công nghiệp, dòng vốn FDI, cán cân xuất nhập khẩu. Cuối cùng là nhóm phát ngôn và định hướng chính sách từ giới chức cấp cao — nghị quyết của Bộ Chính trị, chỉ thị của Thủ tướng Chính phủ, thông điệp từ Thống đốc Ngân hàng Nhà nước.

Chu kỳ kinh tế Việt Nam có thể được chia thành bốn pha là suy thoái, đáy chu kỳ, phục hồi, và hưng thịnh. Phản ứng chính sách của chính phủ thay đổi rõ rệt theo từng pha. Khi nền kinh tế bước vào pha tăng trưởng nóng đi kèm lạm phát cao, chính sách chuyển sang trạng thái phòng thủ ưu tiên ổn định vĩ mô — Ngân hàng Nhà nước chủ động hút tiền qua kênh tín phiếu, siết chặt hạn mức tín dụng, kiểm soát gắt gao dòng vốn chảy vào bất động sản và chứng khoán. Trong pha suy thoái hoặc khi xuất hiện khủng hoảng cục bộ, hệ thống chính sách mang tính "cứu hoả" phản ứng với vấn đề đang có (reactive) — ví dụ khi thị trường trái phiếu doanh nghiệp và bất động sản rơi vào trạng thái đóng băng thanh khoản cuối năm 2022, Chính phủ lập tức thiết kế các cơ chế giãn hoãn nợ và ban hành Nghị định 08/2023/NĐ-CP cho phép thanh toán trái phiếu bằng tài sản khác để tránh đổ vỡ dây chuyền. Khi nền kinh tế chuyển sang pha phục hồi, chính sách chuyển hướng sang tính kiến tạo (proactive) — tập trung kích cầu qua đẩy mạnh giải ngân đầu tư công, chỉ đạo giảm lãi suất cho vay, phê duyệt quy hoạch ngành quốc gia quy mô lớn. Nhận diện đúng nền kinh tế đang ở pha nào giúp agent dự báo trước nhóm chính sách nào sắp được đưa ra và chuẩn bị danh mục tương ứng.

Mục đích ẩn sau mỗi chính sách là điểm quan trọng agent phải giải mã. Cơ quan quản lý Việt Nam, đặc biệt là Ngân hàng Nhà nước, thường phải thực hiện nhiệm vụ đa mục tiêu cùng lúc — vừa kiểm soát lạm phát, vừa ổn định tỷ giá, vừa hỗ trợ tăng trưởng. Trong những thời khắc nhạy cảm, ổn định hệ thống tài chính và tỷ giá luôn được đặt lên hàng đầu. Một ví dụ kinh điển là hoạt động trên thị trường mở: khi NHNN phát hành tín phiếu hút lượng lớn tiền đồng về, nhà đầu tư cá nhân thường diễn dịch một cách hoảng loạn là "thắt chặt chính sách tiền tệ". Thực chất mục tiêu ẩn thường chỉ là hút bớt thanh khoản dư thừa cục bộ trên thị trường liên ngân hàng để đẩy lãi suất VND qua đêm lên cao, từ đó thu hẹp chênh lệch lãi suất giữa VND và USD, triệt tiêu động lực đầu cơ tỷ giá. Nếu agent nhận diện được đây là chính sách phòng vệ tỷ giá ngắn hạn chứ không phải đảo chiều thắt chặt tín dụng diện rộng, khuyến nghị sẽ là tận dụng nhịp điều chỉnh để tích lũy thay vì bán tháo theo tâm lý bầy đàn.

### 3.2. Chu kỳ ban hành chính sách và cách định thời điểm

Một chính sách tại Việt Nam từ khi manh nha đến khi thực sự đi vào đời sống mất một khoảng thời gian đáng kể. Chu kỳ ban hành luật hiện nay được rút ngắn từ khoảng 22 tháng xuống khoảng 10 tháng theo quy trình mới, nhưng vẫn đủ dài để agent cần hiểu các giai đoạn và tác động khác nhau trên thị trường. Giai đoạn rò rỉ ý tưởng và công bố dự thảo lần đầu thường gây biến động mạnh nhất trên thị trường chứng khoán, vì dòng tiền đầu cơ đua nhau mua sự kỳ vọng. Mọi sự chú ý đổ dồn vào câu hỏi ai hưởng lợi và ai chịu thiệt từ các điều khoản dự kiến. Đến giai đoạn dự thảo được trình Quốc hội hoặc Ủy ban Thường vụ Quốc hội xem xét, thông tin rõ ràng hơn nhưng động lực đẩy giá lại chững lại vì kỳ vọng đã được phản ánh một phần. Khi đạo luật chính thức được ký ban hành, thị trường thậm chí có thể chứng kiến hiện tượng "tin ra là bán" nếu giá cổ phiếu đã bị đẩy lên quá cao trước đó. Giai đoạn cuối cùng khi luật có hiệu lực pháp luật và các Nghị định, Thông tư hướng dẫn thi hành được ban hành mới là thời điểm các tác động cơ bản thực sự thấm vào báo cáo tài chính của doanh nghiệp, làm thay đổi cấu trúc ngành và định giá dài hạn.

Hàm ý thực hành cho agent là khi user hỏi về tác động của một chính sách, trước tiên phải xác định chính sách đang ở giai đoạn nào — dự thảo, thông qua nhưng chưa hiệu lực, hay đã có văn bản hướng dẫn thi hành đầy đủ. Tiếp đến kiểm tra giá cổ phiếu liên quan đã phản ánh bao nhiêu phần trăm kỳ vọng chưa. Nếu giá đã tăng 30-40% trong vài tháng trước khi luật chính thức ban hành, khả năng cao thị trường đã price-in đầy đủ và tin ban hành chính thức có thể là điểm chốt lời. Nếu giá chưa phản ứng hoặc mới bắt đầu tích lũy, tin ban hành chính thức mới là điểm kích hoạt xu hướng tăng trung hạn.

### 3.3. Cơ quan phát ngôn và phong cách riêng

Mỗi cơ quan quản lý nhà nước Việt Nam có phong cách điều hành và tần suất phát ngôn riêng, ảnh hưởng trực tiếp đến cách thị trường phản ứng. Chính phủ và Văn phòng Chính phủ thường ban hành các nghị quyết, công điện mang tính định hướng chiến lược tổng thể và đôn đốc thực hiện — ví dụ yêu cầu tháo gỡ khó khăn cho bất động sản, đẩy nhanh tiến độ sân bay Long Thành. Các thông điệp này tạo hiệu ứng tâm lý tích cực nhưng cần độ trễ để các bộ, ngành cụ thể hoá thành hành động có tác động đo lường được.

Ngân hàng Nhà nước có phong cách điều hành cẩn trọng, kín kẽ, và mang tính thực thi cao. Mỗi quyết định thay đổi lãi suất điều hành hay tỷ giá trung tâm từ cơ quan này là "viên đạn thật" tạo ra tác động thay đổi tức thời quy mô dòng tiền trên toàn thị trường chứng khoán. Agent cần đặc biệt chú ý các phát ngôn từ Thống đốc NHNN trong các phiên trả lời chất vấn Quốc hội hay các cuộc họp báo định kỳ — những phát biểu này thường báo hiệu định hướng chính sách 3-6 tháng tới.

Ủy ban Chứng khoán Nhà nước và Bộ Tài chính thường tập trung vào các chính sách tái cấu trúc hạ tầng thị trường, giải quyết rào cản nâng hạng, hay triển khai chiến lược phát triển thị trường chứng khoán dài hạn. Thông tin từ khối cơ quan này thường tạo sóng cho riêng nhóm ngành dịch vụ tài chính và công ty chứng khoán, thay vì tác động đến toàn bộ nền kinh tế. Ví dụ khi KRX chuẩn bị go-live, nhóm công ty chứng khoán thường có sóng tăng kỳ vọng trước đó vài tháng.

### 3.4. Đọc đúng số liệu vĩ mô Việt Nam

Số liệu vĩ mô Việt Nam có một số đặc điểm khác biệt so với chuẩn quốc tế mà agent phải nắm để tránh diễn giải sai. Chỉ số giá tiêu dùng của Việt Nam có cấu trúc rổ hàng hoá đặc biệt với nhóm lương thực, thực phẩm chiếm tỷ trọng rất lớn. Do đó những cú sốc nguồn cung cục bộ như dịch tả lợn châu Phi làm biến động giá thịt lợn có thể đẩy CPI tổng thể lên cao, dù sức cầu nền kinh tế thực chất đang suy yếu. Agent phải tách bạch CPI tổng thể và lạm phát cơ bản (loại trừ giá lương thực và năng lượng do nhà nước quản lý) để đánh giá đúng áp lực lạm phát tiền tệ. Số liệu tăng trưởng GDP do Tổng cục Thống kê công bố ước tính sớm vào những ngày cuối cùng của quý (tháng 3, 6, 9, 12), khác với các quốc gia phát triển thường công bố sau khi quý đã kết thúc vài tuần. Chỉ số Quản trị Mua hàng (PMI) của Việt Nam được đo bởi tổ chức độc lập S&P Global chứ không phải cơ quan nhà nước, phản ánh khá sát tình trạng đơn hàng sản xuất — tuy nhiên PMI mở rộng trên 50 điểm mà không đi kèm tăng trưởng tín dụng nội địa tương xứng thường ám chỉ phục hồi chỉ đang diễn ra cục bộ tại khu vực doanh nghiệp FDI, chưa lan toả đến khối doanh nghiệp vừa và nhỏ trong nước.

### 3.5. Kênh tác động và độ trễ của tin vĩ mô

Chuỗi tác động từ tin vĩ mô đến giá cổ phiếu thường đi theo hai kênh chính. Kênh thứ nhất là kênh thanh khoản và chi phí vốn: sự kiện vĩ mô thay đổi điều kiện thanh khoản hệ thống, dẫn đến thay đổi tỷ suất chiết khấu dùng để định giá tài sản, từ đó làm thay đổi định giá toàn thị trường. Kênh thứ hai là kênh chính sách tài khóa: quyết định tăng đầu tư công làm dòng tiền ngân sách chảy trực tiếp vào bảng cân đối kế toán của nhóm nhà thầu xây lắp và cung cấp vật liệu xây dựng, cải thiện biên lợi nhuận ròng, kích hoạt chu kỳ tăng giá cổ phiếu nhóm này. Agent phải map mỗi sự kiện vĩ mô vào một trong các chuỗi truyền dẫn này để tìm ra nhóm ngành hưởng lợi cuối cùng.

Về độ trễ, tin vĩ mô tác động theo bốn tầng thời gian khác nhau. Tầng tức thời trong phiên áp dụng cho các quyết định thay đổi lãi suất điều hành hoặc các phát ngôn bất ngờ của lãnh đạo cấp cao — thị trường phản ứng ngay trong phiên mở cửa. Tầng ngắn hạn 1-5 phiên áp dụng cho các công bố số liệu vĩ mô định kỳ (CPI, GDP, XNK) — thị trường cần vài phiên để tiêu hóa và điều chỉnh vị thế. Tầng trung hạn 1-4 tuần áp dụng cho các chính sách mới ban hành cần thời gian để dòng tiền tái cơ cấu theo các nhóm ngành hưởng lợi. Tầng dài hạn vài tháng áp dụng cho các thay đổi cấu trúc lớn như luật mới có hiệu lực — tác động cần thời gian thấm vào báo cáo tài chính và định giá.

### 3.6. Pitfalls khi đọc tin vĩ mô

Nhầm lẫn giữa các loại lãi suất là lỗi kinh điển. Lãi suất liên ngân hàng biến động mạnh theo ngày để điều tiết thanh khoản ngắn hạn, và sự sụt giảm của nó không có nghĩa NHNN đang nới lỏng tiền tệ. Trạng thái chính sách chỉ được xác nhận qua các quyết định thay đổi lãi suất điều hành (mang tính định hướng dài hạn) hoặc mặt bằng lãi suất huy động của dân cư. Agent thấy lãi suất liên ngân hàng giảm mà vội kết luận "NHNN nới lỏng" là sai lầm cơ bản.

Nhầm lẫn thời điểm hiệu lực của chính sách cũng là lỗi phổ biến. Agent có thể xúi giục mua đuổi cổ phiếu vào ngày một đạo luật chính thức có hiệu lực, bỏ qua thực tế là thị trường đã price-in toàn bộ thông tin từ giai đoạn thảo luận dự thảo nhiều tháng trước. Khi gặp tin "luật X có hiệu lực từ ngày Y", agent phải kiểm tra ngược lịch sử giá của các cổ phiếu liên quan trong 3-6 tháng trước đó. Nếu đã có nhịp tăng mạnh, ngày hiệu lực có thể là điểm chốt lời chứ không phải điểm mua.

Đọc lướt các chính sách tháo gỡ mà bỏ qua điều kiện đính kèm dẫn đến định giá sai tiềm năng phục hồi. Ví dụ các nghị định tháo gỡ tín dụng bất động sản thường có điều kiện chỉ áp dụng cho dự án đã hoàn thiện 100% pháp lý — doanh nghiệp đang ngập trong nợ xấu với dự án vướng pháp lý vẫn không được hưởng lợi dù tin có vẻ tích cực cho toàn ngành. Agent phải đọc kỹ phạm vi áp dụng và điều kiện trước khi kết luận nhóm nào thực sự hưởng lợi.

### 3.7. Tin thông cáo Chính phủ (`thong_cao`)

Bucket `thong_cao` có `category_name` duy nhất "Thông cáo chính phủ", là tổng hợp chỉ đạo, điều hành của Chính phủ/Thủ tướng Chính phủ hàng ngày. Volume rất nhỏ (~1% tổng tin, khoảng 5-10 tin/tháng), nhưng chứa định hướng chính sách cấp cao nhất và thường chi phối nhiều ngành/nhóm ngành cùng lúc. Đặc điểm điển hình: tiêu đề chuẩn hoá dạng "Chỉ đạo, điều hành của Chính phủ, Thủ tướng Chính phủ ngày dd/mm/yyyy", trường `tickers` hầu hết rỗng (tin mang tính định hướng vĩ mô, không gắn ticker cụ thể), nội dung gộp nhiều nội dung chỉ đạo khác nhau trong cùng một bài.

**Cách đọc `thong_cao` đúng:** Agent KHÔNG được bỏ qua bucket này vì volume nhỏ. Workflow đọc gồm 3 bước:

Bước 1 — Query đầy đủ `plain_content` (không phải chỉ title/sapo) vì mỗi thông cáo thường tổng hợp 5-15 nội dung chỉ đạo riêng biệt, mà title chỉ nêu ngày tổng hợp.

Bước 2 — Parse nội dung thành từng chỉ đạo riêng biệt. Với mỗi chỉ đạo, xác định: cơ quan chủ trì (Bộ nào), lĩnh vực tác động (ngân hàng, năng lượng, bất động sản, xuất khẩu...), tính chất (định hướng, yêu cầu thực thi, phê duyệt dự án, chỉ đạo xử lý khủng hoảng cục bộ).

Bước 3 — Map từng chỉ đạo vào nhóm ngành/cổ phiếu cụ thể. Ví dụ chỉ đạo "đẩy nhanh giải ngân đầu tư công các dự án cao tốc" → nhóm xây lắp hạ tầng (CII, HHV, VCG, FCN) + vật liệu xây dựng (HPG, KSB, DHA). Chỉ đạo "tháo gỡ khó khăn thị trường bất động sản" → nhóm BĐS (VHM, NVL, KDH).

**Tính cấp bách so với `trong_nuoc`:** `thong_cao` thường là định hướng (chỉ đạo "yêu cầu nghiên cứu", "tập trung triển khai") chứ không phải chính sách đã ban hành có hiệu lực pháp lý tức thì. Do đó tác động thị trường thường trung-dài hạn (1-4 tuần đến vài tháng), không phải tức thời. Agent không nên suy diễn chỉ đạo thành hành động mua ngay. Cần theo dõi tiếp: chỉ đạo có được cụ thể hoá thành Nghị định/Thông tư/Quyết định sau đó không.

**Confluence `thong_cao` + `trong_nuoc`:** Khi một chỉ đạo trong `thong_cao` được tiếp nối bằng Nghị định/Quyết định cụ thể xuất hiện trong `trong_nuoc` (category "Chính sách mới" hoặc "Chỉ đạo, quyết định của Chính phủ - Thủ tướng Chính phủ") trong vòng 1-3 tuần sau đó, đây là tín hiệu chính sách thực sự được triển khai — lúc này tác động thị trường cụ thể hơn và agent có thể đưa khuyến nghị hành động mạnh hơn. Nếu sau nhiều tuần không có văn bản cụ thể hoá, chỉ đạo ban đầu có thể chỉ là định hướng chính trị, tác động thực tế hạn chế.

**Pitfall:** Nhiều thông cáo chứa chỉ đạo mang tính chính trị hoặc xã hội (như chăm lo đời sống người có công, kỷ niệm sự kiện) không liên quan TTCK. Agent phải phân loại được chỉ đạo có cơ chế tác động kinh tế cụ thể khỏi các chỉ đạo mang tính định hướng chính trị/xã hội.



**Nghị định 08/2023/NĐ-CP cứu nguy thị trường trái phiếu doanh nghiệp.** Đầu năm 2023, thị trường bất động sản đối mặt nguy cơ đổ vỡ dây chuyền khi áp lực đáo hạn trái phiếu doanh nghiệp lên tới khoảng 138.000 tỷ đồng, trong khi thanh khoản thị trường đóng băng hậu sự kiện Tân Hoàng Minh. Ngày 05/03/2023, Chính phủ ban hành Nghị định 08/2023/NĐ-CP cho phép doanh nghiệp phát hành đàm phán với trái chủ để thanh toán nợ gốc và lãi bằng tài sản khác, đồng thời tạm hoãn quy định xếp hạng tín nhiệm bắt buộc. Phản ứng ngắn hạn 1-5 phiên: các cổ phiếu bất động sản gặp khó khăn dòng tiền như NVL, PDR, DIG lập tức bùng nổ, tăng trần liên tiếp nhiều phiên với thanh khoản lớn. Trong trung hạn 1-4 tuần, nhóm ngân hàng thương mại đang nắm giữ khối lượng lớn trái phiếu doanh nghiệp như MBB, VPB, TCB cũng phục hồi mạnh do rủi ro trích lập dự phòng được đẩy lùi. Hậu xét: tác động phản ánh chính xác kỳ vọng tháo gỡ điểm nghẽn tâm lý. Nghị định này là mảnh ghép quan trọng giúp VN-Index chính thức đảo chiều, tạo đáy trung hạn và bước vào pha tích luỹ đi lên. Bài học rút ra: tin chính sách phản ứng với khủng hoảng cụ thể đang có (reactive) thường có tác động nhanh và mạnh, nhưng tác động bền vững phụ thuộc vào việc các điều kiện đính kèm có thực sự giải quyết được vấn đề gốc rễ hay không.

**Chuỗi hạ lãi suất điều hành năm 2023-2024.** Khi Cục Dự trữ Liên bang Mỹ ngừng lộ trình tăng lãi suất, chỉ số sức mạnh đồng USD hạ nhiệt nhanh chóng. Giải toả được áp lực tỷ giá, NHNN lập tức bơm tiền qua kênh thị trường mở và liên tiếp đưa ra các quyết định hạ lãi suất điều hành để hỗ trợ nền kinh tế. Phản ứng: dòng tiền nhàn rỗi trong nền kinh tế nhanh chóng rút khỏi kênh tiết kiệm, tìm đến thị trường chứng khoán. Điều này kích hoạt một uptrend kéo dài nhiều tháng cho VN-Index, đặc biệt là sự thăng hoa của nhóm công ty chứng khoán vốn cực kỳ nhạy cảm với thanh khoản. Bài học: khi điều kiện vĩ mô quốc tế (Fed) kết hợp thuận lợi với chính sách tiền tệ nội địa (NHNN nới lỏng), hiệu ứng cộng hưởng tạo ra xu hướng trung hạn mạnh và bền.

**Luật Đất đai 2024 đẩy sớm thời điểm hiệu lực.** Sự chồng chéo giữa các bộ luật liên quan đến đất đai, nhà ở, kinh doanh bất động sản đã khiến hàng trăm dự án trên cả nước bị ách tắc pháp lý. Quốc hội thông qua quyết định cho phép Luật Đất đai 2024, Luật Nhà ở 2023, và Luật Kinh doanh Bất động sản 2023 có hiệu lực sớm từ ngày 01/08/2024 (sớm hơn 5 tháng so với nghị quyết ban đầu). Phản ứng: nhóm cổ phiếu bất động sản có sự phân hoá sâu sắc. Những doanh nghiệp sở hữu quỹ đất sạch lớn, cấu trúc tài chính lành mạnh, và năng lực triển khai dự án thực tế như VHM, KDH, NLG được dòng tiền lớn lựa chọn. Ngược lại, các doanh nghiệp chuyên hoạt động phân lô bán nền tại các đô thị loại II, III bị giới đầu tư quay lưng do luật mới siết chặt hoạt động này. Bài học: tin luật mới không tác động đồng đều lên toàn ngành — agent phải đọc kỹ nội dung luật để xác định doanh nghiệp nào thực sự hưởng lợi và doanh nghiệp nào bị thiệt, không nên khuyến nghị "mua ngành" một cách đại trà.

**Nghị quyết 42 về thí điểm xử lý nợ xấu hết hiệu lực.** Nghị quyết 42/2017/QH14 từng là cây gậy pháp lý đắc lực cho phép các ngân hàng thu giữ tài sản bảo đảm không cần qua phán quyết toà án, giúp đẩy nhanh tiến độ xử lý nợ xấu. Nghị quyết này hết hiệu lực vào cuối năm 2023. Việc hệ thống pháp lý rơi vào trạng thái "hụt" cơ chế khi Luật Các tổ chức tín dụng sửa đổi chưa kịp ban hành khiến khối lượng nợ xấu trong hệ thống dềnh lên nhanh chóng, vượt 1 triệu tỷ đồng. Phản ứng: nhóm cổ phiếu ngân hàng thương mại cổ phần tư nhân có khẩu vị rủi ro cao và tỷ lệ nợ xấu tăng mạnh như VPB, VIB, OCB chịu áp lực điều chỉnh và đi nền ở vùng giá thấp trong thời gian dài do giới đầu tư lo ngại chi phí tín dụng ăn mòn lợi nhuận. Bài học: sự vắng mặt của một cơ chế pháp lý đặc thù có thể là cục máu đông kìm hãm đà tăng giá của cả một nhóm ngành trong nhiều tháng hoặc nhiều quý, cho đến khi cơ chế đó được luật hoá thành công.

**FTSE Russell nâng hạng thị trường Việt Nam lên Secondary Emerging Market (10/2025).** Ngày 07/10/2025 FTSE Russell chính thức công bố nâng Việt Nam từ thị trường cận biên (Frontier) lên thị trường mới nổi thứ cấp (Secondary Emerging Market), hiệu lực thực thi từ 21/09/2026. Đây là sự kiện vĩ mô có tầm vóc nhất của TTCK Việt Nam trong nhiều năm. Dòng vốn thụ động kỳ vọng chảy vào ước tính 3.4-6 tỷ USD trong ngắn hạn (theo các dự báo của HSBC và FTSE) và có thể lên tới 25 tỷ USD trong lộ trình đến năm 2030 (theo World Bank). Phản ứng: VN-Index tăng mạnh trong phiên công bố, đạt đỉnh lịch sử, tính đến cuối quý 3/2025 đã tăng khoảng 57.7% trong năm. Điểm đáng lưu ý là kỳ vọng nâng hạng đã được thảo luận rộng rãi từ 2018 khi FTSE đưa Việt Nam vào watch list, nên phần lớn tác động đã được thị trường phản ánh vào giá trong chu kỳ nhiều năm — nhà đầu tư nước ngoài vẫn bán ròng trong giai đoạn công bố và đầu dịch chuyển, động lực tăng giá chủ yếu đến từ nhà đầu tư nội địa đón đầu. Bài học kép: một là các sự kiện nâng hạng thị trường có lead time rất dài, agent khi gặp tin nâng hạng chính thức phải check xem thị trường đã định giá kỳ vọng này được bao lâu rồi để đánh giá phần còn lại có thể kiếm được; hai là dòng vốn ngoại chỉ thực sự chảy vào sau ngày hiệu lực thực thi (21/09/2026 trong case này) khi các quỹ tracking FTSE bắt buộc rebalance, do đó khuyến nghị hành động cần phân biệt giai đoạn tiền-công-bố, giai đoạn giữa công bố và hiệu lực, và giai đoạn hậu hiệu lực.

### 3.9. Hành động điển hình cho agent với tin trong nước và thông cáo Chính phủ

Với thay đổi lãi suất điều hành hay hạn mức tín dụng, đây là tín hiệu cấp độ danh mục. Agent khuyến nghị điều chỉnh ngay tỷ trọng cổ phiếu nhạy cảm với lãi suất. Nâng tỷ trọng nhóm chứng khoán, ngân hàng, bất động sản khi lãi suất giảm. Dịch chuyển vốn sang nhóm phòng thủ như tiện ích, tiêu dùng thiết yếu khi có tín hiệu thắt chặt.

Với dự thảo hoặc ban hành luật mới, agent kích hoạt rà soát chuỗi cung ứng và phân tích phạm vi áp dụng. Tự động quét danh sách cổ phiếu hưởng lợi và chịu thiệt trực tiếp dựa trên nội dung luật. Đưa các mã này vào watchlist và thiết lập cảnh báo khi có gia tăng đột biến khối lượng giao dịch — đây là dấu hiệu dòng tiền thông minh đã nhận diện cổ phiếu hưởng lợi trước khi thông tin lan rộng.

Với số liệu kinh tế hàng tháng, agent so sánh mức độ chênh lệch giữa số liệu thực tế và mức đồng thuận dự báo của các tổ chức tài chính. Nếu GDP tăng trưởng vượt mức kỳ vọng đáng kể, cập nhật mô hình nâng mức định giá mục tiêu cho toàn thị trường. Nếu số liệu chệch âm, rà lại các nhóm ngành dễ tổn thương với môi trường kinh tế yếu.

---

## 4. Tin quốc tế (`quoc_te`)

Tin quốc tế dù không tạo tác động thay đổi tức khắc lên cấu trúc dòng tiền nội địa như tin trong nước thuộc subset vĩ mô/chính sách và tin thông cáo Chính phủ, lại đóng vai trò thiết lập môi trường định giá toàn cầu. Nó quy định dư địa cho chính sách tiền tệ của Việt Nam thông qua chênh lệch lãi suất, định hình biên lợi nhuận của mạng lưới doanh nghiệp xuất nhập khẩu niêm yết trong nước thông qua tỷ giá và giá nguyên liệu, và ảnh hưởng dòng vốn nước ngoài qua tâm lý rủi ro toàn cầu. Phân tích tin quốc tế đòi hỏi agent phải có ba tầng nhận thức độc lập nhưng liên kết chặt chẽ với nhau — đây là điểm khác biệt căn bản so với ba loại tin còn lại.

### 4.1. Phân loại tin quốc tế

Hệ thống tin quốc tế được chia thành năm nhóm cốt lõi. Nhóm đầu tiên là các quyết sách từ các Ngân hàng Trung ương quyền lực nhất thế giới, dẫn đầu là Cục Dự trữ Liên bang Mỹ (Fed/FOMC), Ngân hàng Trung ương Châu Âu (ECB), Ngân hàng Trung ương Nhật Bản (BOJ), và Ngân hàng Nhân dân Trung Quốc (PBoC). Nhóm thứ hai là dữ liệu sức khoẻ kinh tế vĩ mô toàn cầu, đặc biệt các báo cáo từ Mỹ như lạm phát CPI, chỉ số giá tiêu dùng cá nhân PCE, bảng lương phi nông nghiệp NFP, số đơn xin trợ cấp thất nghiệp, cùng với các dữ liệu tăng trưởng của Trung Quốc. Nhóm thứ ba là biến động của thị trường hàng hoá cơ bản, từ năng lượng như dầu Brent và WTI, khí tự nhiên, kim loại công nghiệp như quặng sắt và thép cán nóng, đến nông sản như cao su, cà phê, gạo. Nhóm thứ tư là dòng chảy tin tức địa chính trị, các cuộc chiến tranh thương mại, cấm vận kinh tế, và xung đột quân sự làm thay đổi bản đồ logistics toàn cầu. Nhóm thứ năm là chuyển động của các chỉ số chứng khoán hàn thử biểu toàn cầu như S&P 500, Nasdaq, Nikkei, Shanghai Composite, và chỉ số đo lường trạng thái sợ hãi VIX.

### 4.2. Tầng một — hiểu đúng tin theo chuẩn phân tích tài chính quốc tế

Tầng cơ sở yêu cầu agent phải đọc hiểu ngôn ngữ tài chính quốc tế theo chuẩn mực chuyên môn cao nhất. Phân tích Fed không chỉ là đếm số lần tăng hay giảm lãi suất. Agent phải giải mã được biểu đồ chấm (dot plot — biểu đồ thể hiện dự báo lãi suất của từng thành viên FOMC) để hiểu lộ trình lãi suất kỳ vọng, phân tích định hướng chính sách (forward guidance — các phát biểu hướng dẫn thị trường về chính sách tương lai) trong các bài phát biểu của Chủ tịch Fed, và theo dõi tiến trình thu hẹp bảng cân đối kế toán của Fed (balance sheet runoff). Yếu tố cốt lõi nhất cần trích xuất là chênh lệch lãi suất giữa USD và VND — đây là lực kéo trực tiếp đối với dòng vốn đầu tư gián tiếp nước ngoài vào Việt Nam.

Tương tự với các dữ liệu kinh tế Mỹ như NFP hay CPI, một con số tuyệt đối không mang nhiều ý nghĩa bằng việc so sánh với mức kỳ vọng của thị trường và cả các kỳ vọng ngầm. Một chỉ số CPI 3.2% có thể là tích cực hay tiêu cực hoàn toàn phụ thuộc vào consensus dự báo trước đó là 3.0% hay 3.5%. Agent phải luôn đi kèm số liệu với consensus để diễn giải đúng.

Đối với thị trường hàng hoá, việc đánh giá đường cong kỳ hạn là bắt buộc. Agent phải phân biệt được trạng thái contango (giá hợp đồng tương lai cao hơn giá giao ngay, ám chỉ nguồn cung dư thừa hiện tại được kỳ vọng sẽ giảm đi) và backwardation (giá giao ngay cao hơn hợp đồng tương lai, phản ánh sự thiếu hụt khẩn cấp trong ngắn hạn). Hai trạng thái này cho ra dự báo xu hướng giá vật tư đầu vào hoàn toàn khác nhau — doanh nghiệp sản xuất thép trong trạng thái contango của quặng sắt có thể kỳ vọng chi phí đầu vào giảm trong 3-6 tháng tới, còn trong trạng thái backwardation thì ngược lại.

### 4.3. Tầng hai — địa chính trị từng khu vực

Đây là tầng đòi hỏi chiều sâu phân tích lớn nhất. Agent không được phép dừng lại ở việc tóm tắt bản tin xung đột mà phải bóc tách cơ chế rủi ro địa lý ở chiều sâu cấu trúc.

**Trục Mỹ - Trung Quốc** là trục kiến tạo đang định hình lại chuỗi cung ứng toàn cầu. Phân tích phải xoay quanh các gói thuế quan được áp đặt, các lệnh cấm vận công nghệ đặc biệt trong lĩnh vực bán dẫn, và dòng vốn đầu tư trực tiếp nước ngoài đang dịch chuyển theo chiến lược đa dạng hoá rủi ro (tìm thêm điểm đến ngoài Trung Quốc). Việt Nam hưởng lợi rõ rệt từ xu hướng này, đặc biệt là nhóm khu công nghiệp như KBC, IDC, SZC đón nhận làn sóng FDI chuyển từ Trung Quốc sang. Agent khi gặp tin leo thang thương mại Mỹ-Trung cần nhanh chóng rà soát nhóm KCN để chuẩn bị khuyến nghị nâng tỷ trọng. Tuy nhiên cần thận trọng vì thị trường thường phản ứng trước khi FDI thực tế chuyển vào — hiện tượng "mua kỳ vọng, bán sự thật" có thể xảy ra khi FDI thực tế không đạt kỳ vọng.

**Trục Nga - Ukraine - châu Âu** không chỉ giới hạn ở biên giới Đông Âu. Cuộc chiến này tái định hình an ninh năng lượng và lương thực thế giới, kéo theo những đợt tăng vọt của giá dầu, khí tự nhiên, và phân bón (đặc biệt là urea), đồng thời gây áp lực lên sức mạnh đồng euro. Tại Việt Nam, nhóm cổ phiếu hoá chất và phân bón như DGC, DPM, DCM trực tiếp hưởng lợi khi giá nguyên liệu tăng trong giai đoạn đầu chiến sự, và có thể thiết lập đỉnh lợi nhuận lịch sử trong các quý sau đó nhờ xuất khẩu được giá cao.

**Khu vực Trung Đông và Biển Đỏ** là rốn dầu của thế giới, tác động trực tiếp lên giá năng lượng thông qua kiểm soát eo biển Hormuz hoặc các quyết định điều tiết sản lượng của liên minh OPEC+. Trong năm 2024, các cuộc tấn công của lực lượng Houthi trên Biển Đỏ làm tê liệt tuyến hàng hải huyết mạch qua kênh đào Suez. Hậu quả là các hãng tàu phải đi vòng qua Mũi Hảo Vọng, đẩy thời gian vận chuyển lên cao và làm cước phí logistics bùng nổ. Tại Việt Nam, nhóm cảng biển và vận tải như HAH, VOS, GMD hưởng lợi từ sóng kỳ vọng cước thuê tàu định hạn tăng, có thể bứt phá mạnh mẽ khỏi nền tích luỹ và duy trì uptrend trung hạn bất chấp thị trường chung đi ngang.

**Khu vực Đông Á** có trung tâm là khủng hoảng bất động sản Trung Quốc. Đại diện bởi sự kiện Evergrande, khủng hoảng này bóp nghẹt nhu cầu tiêu thụ thép và vật liệu xây dựng, kéo giá thép cán nóng toàn cầu trượt dốc. Các doanh nghiệp tôn mạ xuất khẩu của Việt Nam như HSG, NKG bị ảnh hưởng nghiêm trọng đến biên lợi nhuận. Agent khi gặp tin xấu về ngành bất động sản Trung Quốc cần đặc biệt chú ý nhóm thép và tôn mạ VN, xem xét hạ tỷ trọng nếu tin chưa được price-in.

**Khu vực ASEAN** cần theo dõi để đánh giá rủi ro cạnh tranh FDI và định vị cạnh tranh trong xuất khẩu. Thái Lan, Indonesia, Malaysia, Philippines đều là các đối thủ cạnh tranh của Việt Nam trong thu hút FDI và trong xuất khẩu các mặt hàng thế mạnh như gạo, thuỷ sản, dệt may. Một tin về chính sách ưu đãi FDI mới của Indonesia có thể là tín hiệu tiêu cực cho nhóm khu công nghiệp Việt Nam.

### 4.4. Tầng ba — mapping về kinh tế và thị trường chứng khoán Việt Nam

Đây là tầng quyết định tính actionable của phân tích tin quốc tế. Mọi sự kiện quốc tế dù lớn đến đâu nhưng không map được về kênh truyền dẫn cụ thể vào Việt Nam đều không có giá trị cho quyết định đầu tư trên thị trường chứng khoán VN. Agent phải quen với sáu kênh truyền dẫn chính.

**Kênh tỷ giá** là kênh tác động nhanh nhất và có phạm vi rộng nhất. Khi USD mạnh lên, các doanh nghiệp xuất khẩu thu USD được hưởng lợi (dệt may, thuỷ sản, gỗ, điện tử), nhưng doanh nghiệp nhập khẩu nguyên liệu hoặc có nợ USD lớn chịu áp lực (HVN, PGV, một số nhóm sản xuất có nợ ngoại tệ cao). Ngân hàng có thu ngoại tệ thuận lợi nhưng ngân hàng có dư nợ ngoại tệ lớn gặp rủi ro tỷ giá. Agent phải biết được mỗi ngành và mỗi cổ phiếu lớn nằm ở phía nào của equation tỷ giá.

**Kênh nguyên liệu** tác động qua chi phí đầu vào và giá đầu ra. Dầu tăng làm lợi các doanh nghiệp dầu khí thượng nguồn (PVD, PVS) và lọc dầu (BSR), nhưng gây khó khăn cho nhóm phân bón, nhựa, vận tải tải trọng nặng. Thép tăng giá làm lợi HPG, HSG, NKG trong ngắn hạn nếu đã có tồn kho, nhưng gây khó cho nhóm nhà thầu xây dựng. Quặng sắt tăng ngược lại làm khó các nhà sản xuất thép vì biên lợi nhuận bị bào mòn. Agent phải map chính xác giá đầu vào và đầu ra vào báo cáo tài chính của từng doanh nghiệp theo 4 type phân loại đã được cấu hình trong `agent_db_04`.

**Kênh dòng vốn đầu tư gián tiếp nước ngoài** thông qua chênh lệch lãi suất. Khi Fed giảm lãi suất, chênh lệch USD-VND thu hẹp làm USD yếu đi, vốn chảy từ thị trường phát triển sang thị trường mới nổi trong đó có Việt Nam — tác động tích cực cho VN-Index. Ngược lại khi Fed tăng lãi suất mạnh, dòng vốn ngoại có xu hướng rút khỏi Việt Nam, gây áp lực bán lên các cổ phiếu có tỷ trọng cao trong rổ VN30 nơi khối ngoại thường giao dịch mạnh.

**Kênh tâm lý** là kênh tác động ngắn hạn mạnh nhất. VN-Index có tương quan ngắn hạn với S&P 500 qua đêm, đặc biệt trong các giai đoạn biến động mạnh. Khi S&P 500 rơi mạnh đêm trước, VN-Index thường mở cửa giảm với áp lực bán ban đầu. Tuy nhiên tương quan này thường chỉ kéo dài 1-2 phiên rồi thị trường nội địa quay về bám theo yếu tố trong nước. Agent không nên dùng tương quan tâm lý qua đêm để dự báo xu hướng trung hạn của VN-Index.

**Kênh chuỗi cung ứng** tác động qua các doanh nghiệp FDI và doanh nghiệp Việt Nam trong chuỗi giá trị toàn cầu. Gián đoạn ở Trung Quốc hoặc Đông Nam Á có thể ảnh hưởng đến doanh nghiệp FDI tại Việt Nam, qua đó gián tiếp ảnh hưởng đến các nhà cung ứng phụ trợ trong nước. Khủng hoảng Biển Đỏ 2024 là ví dụ rõ nhất — nó tạo cơ hội cho nhóm cảng và vận tải biển Việt Nam nhưng tạo áp lực cho nhóm xuất khẩu chịu cước CIF.

**Kênh định vị cạnh tranh** là kênh trung và dài hạn. Khi Mỹ áp thuế chống bán phá giá lên Trung Quốc, nhóm khu công nghiệp, xuất khẩu gỗ và đá của Việt Nam hưởng lợi từ sự chuyển dịch sản xuất. Khi EU áp thuế chống bán phá giá lên thép, các nhà xuất khẩu thép Việt Nam như HPG gặp khó khăn. Agent cần theo dõi các quyết định thương mại song phương của các đối tác lớn của VN để dự báo tác động trung hạn.

### 4.5. Ma trận sự kiện quốc tế và ngành VN chịu tác động

Để hỗ trợ agent ra quyết định nhanh, dưới đây là ma trận tham khảo các sự kiện quốc tế phổ biến và tác động lên ngành VN. Agent không dùng bảng này máy móc mà phải kết hợp với chỉ báo định lượng để quyết định thời điểm vào ra.

| Sự kiện quốc tế | Kênh tác động | Ngành VN hưởng lợi | Ngành VN thiệt hại |
|---|---|---|---|
| Khủng hoảng Biển Đỏ kéo dài, cước tàu vọt | Chuỗi cung ứng, logistics | Vận tải biển, cảng (HAH, VOS, GMD) | Doanh nghiệp xuất khẩu chịu cước CIF |
| Bất động sản Trung Quốc đình đốn (Evergrande) | Giá nguyên vật liệu (thép HRC) | Nhà thầu xây dựng (hưởng chi phí thép rẻ) | Thép xuất khẩu (HPG, HSG, NKG) biên lợi nhuận thu hẹp |
| Mỹ áp thuế chống bán phá giá lên Trung Quốc | Định vị cạnh tranh thương mại | KCN đón sóng FDI (KBC, IDC, SZC), xuất khẩu gỗ, đá | — |
| Fed cắt giảm mạnh lãi suất, DXY rơi | Tỷ giá, dòng vốn FII | Doanh nghiệp vay nợ USD cao (PGV, HVN), VN30 nói chung | Doanh nghiệp thuần xuất khẩu thu USD |
| Giá dầu Brent leo dốc vượt 90 USD/thùng | Giá nguyên vật liệu, lạm phát | Dầu khí thượng nguồn (PVD, PVS), lọc dầu (BSR) | Phân bón, nhựa, vận tải tải trọng nặng (HVN) |
| Nga - Ukraine leo thang, giá urea tăng | Giá hàng hoá nông nghiệp | Phân bón (DPM, DCM, DGC) | Doanh nghiệp sản xuất dùng nhiều phân bón |
| Khủng hoảng ngân hàng Mỹ (SVB) | Tâm lý rủi ro toàn cầu + kỳ vọng Fed dừng tăng | VN30 sau cú sốc đầu ngắn hạn | — (ngắn hạn) |

### 4.6. Độ trễ tác động của tin quốc tế

Tin quốc tế tác động theo ba tầng thời gian. Tầng tức thời qua đêm áp dụng cho các quyết định lãi suất bất ngờ của Fed hoặc các biến động lớn của chỉ số tâm lý rủi ro VIX — tác động vào phiên mở cửa của thị trường Việt Nam sáng hôm sau thường bạo liệt nhưng ngắn hạn, dễ tạo hiện tượng lấp gap trong ngày. Tầng ngắn và trung hạn 1-4 tuần áp dụng cho các thay đổi cấu trúc của giá hàng hoá toàn cầu và cước vận tải biển — cần thời gian để giới phân tích cập nhật vào mô hình dự phóng báo cáo tài chính của các doanh nghiệp tương ứng, và dòng tiền đầu tư tái cơ cấu theo các nhóm ngành hưởng lợi hoặc chịu thiệt. Tầng dài hạn 3-6 tháng áp dụng cho các tác động của chiến tranh thương mại hay định hướng dòng vốn FDI — phải chờ thời gian để phản ánh vào doanh thu cho thuê đất của các khu công nghiệp, vào biên lợi nhuận thực tế của các doanh nghiệp xuất khẩu.

### 4.7. Pitfalls khi đọc tin quốc tế

Rủi ro lớn nhất là áp dụng logic thị trường Mỹ vào Việt Nam một cách máy móc. Ví dụ kinh điển là diễn giải báo cáo NFP yếu của Mỹ. Nếu NFP yếu, thị trường chứng khoán Mỹ có thể giảm do lo ngại suy thoái, nhưng áp logic đó lên Việt Nam và kết luận đây là "tin xấu cho VN" là sai lầm nghiêm trọng. Thực tế NFP yếu khiến Fed bớt diều hâu, dẫn đến lợi suất trái phiếu Mỹ và đồng USD suy yếu. Áp lực tỷ giá tại Việt Nam lập tức được giải toả, NHNN có thêm dư địa để nới lỏng chính sách. Do đó một tin có vẻ xấu ở Mỹ lại là chất xúc tác cực kỳ tích cực cho chứng khoán Việt Nam. Agent phải luôn đi qua cơ chế truyền dẫn trước khi kết luận tác động lên VN.

Cạm bẫy thứ hai là bỏ qua rủi ro độ trễ của tỷ giá. Giá dầu giảm sâu có vẻ là tin tốt cho kiểm soát lạm phát nội địa, nhưng nếu điều đó đi kèm sự mạnh lên đột ngột của đồng USD, cấu trúc nợ vay bằng ngoại tệ của nền kinh tế vẫn gặp rủi ro lớn, triệt tiêu lợi ích từ năng lượng rẻ. Agent không nên phân tích một yếu tố (dầu) cô lập khỏi các yếu tố tương quan (USD).

Cạm bẫy thứ ba là nhầm lẫn giữa tin khơi mào và tin xác nhận xu hướng. Một cuộc tấn công lẻ tẻ trên Biển Đỏ có thể chỉ là sự kiện đơn lẻ, không phải khởi đầu khủng hoảng logistics dài hạn. Agent cần quan sát ít nhất 2-3 tuần để phân biệt giữa nhiễu ngắn hạn và xu hướng thực sự thay đổi cấu trúc thị trường.

### 4.8. Case study

**Fed tăng lãi suất khắc nghiệt 2022-2023.** Lạm phát Mỹ đạt đỉnh 40 năm, buộc Fed phải tiến hành chiến dịch tăng lãi suất nhanh và mạnh nhất trong lịch sử. Xuyên suốt năm 2022, chuỗi tăng lãi suất liên tiếp đẩy chỉ số DXY vọt lên mốc kỷ lục trên 110 điểm. Phản ứng tại Việt Nam: chênh lệch lãi suất kích hoạt làn sóng tháo chạy của dòng vốn ngoại khỏi thị trường. Để bảo vệ tỷ giá, NHNN buộc phải có các hành động chưa từng có tiền lệ là tăng lãi suất điều hành hai lần vào những tháng cuối năm 2022. TTCK Việt Nam bị vắt kiệt thanh khoản, VN-Index rơi vào một trong những thị trường gấu tàn khốc nhất kể từ khủng hoảng 2008. Bài học: khi chênh lệch lãi suất quốc tế và nội địa thay đổi mạnh, chính sách tiền tệ Việt Nam không thể đi ngược xu hướng toàn cầu — agent phải theo dõi sát Fed để dự báo phản ứng của NHNN.

**Khủng hoảng Biển Đỏ năm 2024.** Lực lượng Houthi tại Yemen tấn công các tàu thương mại di chuyển qua eo biển Bab al-Mandab, cửa ngõ vào Biển Đỏ và kênh đào Suez. Hàng loạt hãng vận tải biển toàn cầu buộc phải định tuyến lại, đi vòng qua Mũi Hảo Vọng, kéo dài thời gian hải trình và gây thiếu hụt container cục bộ. Phản ứng tại Việt Nam: chỉ số giá cước container tăng dựng đứng. Các cổ phiếu cảng biển và vận tải nội địa như HAH, VOS hưởng lợi từ sóng kỳ vọng cước thuê tàu định hạn tăng, bứt phá mạnh mẽ khỏi nền tảng tích luỹ và duy trì uptrend trung hạn bất chấp thị trường chung đi ngang. Bài học: sự kiện địa chính trị xa xôi như ở Biển Đỏ có thể tạo cơ hội đầu tư rất cụ thể trên VN nếu agent map đúng kênh truyền dẫn (chuỗi cung ứng và logistics).

**Chiến tranh Nga - Ukraine năm 2022.** Nga là nhà xuất khẩu dầu thô và khí đốt lớn, Ukraine là vựa lúa mì của thế giới. Xung đột vũ trang bùng nổ cuối tháng 2/2022, theo sau là các đòn cấm vận kinh tế khốc liệt từ phương Tây. Phản ứng: khủng hoảng nguồn cung đẩy giá khí tự nhiên và các mặt hàng phân bón (đặc biệt urea) lên mức không tưởng. Tại Việt Nam, nhóm cổ phiếu hoá chất và phân bón như DGC, DPM, DCM trải qua đợt tăng giá phi mã và thiết lập đỉnh lợi nhuận lịch sử trong các quý sau đó nhờ xuất khẩu được giá cao. Bài học: xung đột địa chính trị ảnh hưởng trực tiếp đến giá hàng hoá toàn cầu là một trong những kênh tác động nhanh và mạnh nhất lên doanh nghiệp VN.

**Sụp đổ Evergrande Trung Quốc 2021.** Nhằm kiểm soát rủi ro hệ thống, chính phủ Trung Quốc áp đặt chính sách ba lằn ranh đỏ thắt chặt tàn nhẫn nguồn vốn vào lĩnh vực bất động sản. Tập đoàn Evergrande với khối nợ hơn 300 tỷ USD mất khả năng thanh toán, đẩy thị trường vào hoảng loạn. Phản ứng: sự đình đốn của xây dựng tại Trung Quốc bóp nghẹt lực cầu thép và vật liệu xây dựng, đẩy giá thép cán nóng trượt dốc. Các doanh nghiệp tôn mạ xuất khẩu của Việt Nam như HSG, NKG bị ảnh hưởng nghiêm trọng đến biên lợi nhuận, cổ phiếu lao dốc trong sự bi quan của giới đầu tư. Bài học: khủng hoảng ngành ở Trung Quốc có tác động gián tiếp nhưng rất mạnh lên các doanh nghiệp VN xuất khẩu cùng ngành — agent cần theo dõi sát các chỉ báo nội địa Trung Quốc như đầu tư xây dựng, tiêu thụ thép, tăng trưởng bất động sản.

**Sụp đổ Silicon Valley Bank tháng 3/2023.** SVB sụp đổ do lỗ nặng từ danh mục trái phiếu khi lãi suất tăng cao, kích hoạt rủi ro lây lan trong hệ thống ngân hàng khu vực của Mỹ. Phản ứng: tin tức này gây một đợt bán tháo hoảng loạn ngay đầu phiên tại VN-Index do yếu tố tâm lý rủi ro bao trùm toàn cầu. Tuy nhiên sự kiện này lại mang tính bước ngoặt ở mặt trung hạn — giới đầu tư đánh giá rằng sự bất ổn của hệ thống ngân hàng sẽ buộc Fed phải sớm kết thúc chu kỳ thắt chặt tiền tệ. Kỳ vọng lãi suất hạ nhiệt giúp thị trường chứng khoán toàn cầu bao gồm Việt Nam tìm thấy đáy và nhanh chóng phục hồi ngay sau đó. Bài học: một tin có vẻ xấu ban đầu có thể chứa đựng hàm ý tích cực trung hạn nếu nó buộc các cơ quan điều hành thay đổi chính sách — agent phải đọc được hàm ý thứ cấp, không chỉ dừng ở tác động sơ cấp.

### 4.9. Hành động điển hình cho agent theo loại tin quốc tế

Với quyết sách của Fed và dữ liệu lạm phát Mỹ, agent chạy lại mô hình định giá chênh lệch lãi suất VND-USD, điều chỉnh dự phóng biên độ biến động của VND, đưa cảnh báo cho nhóm cổ phiếu có nợ ngoại tệ lớn. Khuyến nghị cụ thể tuỳ hướng — Fed hawkish thì giảm tỷ trọng nhóm nhạy cảm với dòng vốn ngoại, Fed dovish thì cân nhắc nâng tỷ trọng VN30.

Với biến động giá hàng hoá, agent tiến hành map trực tiếp giá đầu vào và đầu ra vào báo cáo tài chính của doanh nghiệp theo 4 type đã được cấu hình sẵn trong `agent_db_04`. Tự động cập nhật dự phóng biên lợi nhuận gộp và đưa ra khuyến nghị điều chỉnh vị thế cho các nhóm bị ảnh hưởng mạnh nhất.

Với tin tức địa chính trị đột biến, agent gửi cảnh báo quản trị rủi ro cho toàn bộ danh mục đang nắm giữ. Nếu chỉ số VIX tăng vọt bất thường, khuyến nghị user cân nhắc thiết lập các vị thế phòng vệ thông qua chứng khoán phái sinh hoặc tăng tỷ trọng tiền mặt.

---

## 5. Tin doanh nghiệp (`doanh_nghiep`)

Doanh nghiệp niêm yết tại Việt Nam mang những đặc tính rất riêng biệt, đậm nét văn hoá quản trị gia đình, sở hữu chéo phức tạp, và chịu sự chi phối của hành lang pháp lý nghiêm ngặt về công bố thông tin theo Luật Chứng khoán và Thông tư 96/2020/TT-BTC. Những lý thuyết phân tích thông tin doanh nghiệp thuần túy phương Tây sẽ thất bại nếu không được hiệu chỉnh cho phù hợp với các đặc thù này. Agent cần hiểu cấu trúc hệ sinh thái tập đoàn, phân biệt ý nghĩa của các loại cổ đông, nắm vững quy định công bố thông tin, đọc được chu kỳ kết quả kinh doanh đặc thù theo ngành, và xử lý đúng các pattern riêng của thị trường VN như tin đồn, chia cổ tức, ESOP.

### 5.1. Phân loại tin doanh nghiệp

Thông tin cấp doanh nghiệp được chia thành năm nhóm trọng yếu. Nhóm đầu tiên và chiếm tỷ trọng lớn nhất là báo cáo tài chính — bao gồm báo cáo kết quả kinh doanh quý, bán niên, báo cáo năm đã kiểm toán, và các văn bản giải trình khi lợi nhuận biến động trên 10%. Nhóm thứ hai là các hành động cấu trúc vốn gồm chi trả cổ tức tiền mặt hoặc cổ phiếu, phát hành thêm cho cổ đông hiện hữu, chào bán riêng lẻ, phát hành cổ phiếu ưu đãi cho người lao động (ESOP), và các thương vụ sáp nhập M&A. Nhóm thứ ba xoay quanh báo cáo giao dịch của cổ đông lớn, ban lãnh đạo nội bộ, hoặc những người có liên quan — đăng ký mua hay bán cổ phiếu đều có ý nghĩa tín hiệu riêng. Nhóm thứ tư là các văn bản công bố thông tin bất thường mang tính báo động — thay đổi dàn nhân sự cấp cao, tài khoản ngân hàng bị phong toả, doanh nghiệp vướng vào vòng lao lý (bị khởi tố, kiện tụng). Nhóm thứ năm là thông tin về hoạt động cốt lõi — công bố ký hợp đồng lớn, trúng thầu dự án hạ tầng nghìn tỷ, nhận quyết định quy hoạch chi tiết 1/500, thực hiện thoái vốn tại các đơn vị thành viên.

### 5.2. Hệ sinh thái tập đoàn Việt Nam và sở hữu chéo

Tại Việt Nam, ranh giới rủi ro tài chính giữa các doanh nghiệp độc lập thường bị xoá nhoà bởi mạng lưới sở hữu chéo trong một hệ sinh thái tập đoàn. Dòng tiền và các nghĩa vụ nợ thường xuyên được luân chuyển nội bộ thông qua các khoản phải thu, cho vay, hoặc hợp tác đầu tư. Một tin tức vỡ nợ hoặc tiêu cực tại một pháp nhân không niêm yết trong hệ sinh thái có thể nhanh chóng bòn rút thanh khoản của pháp nhân đang niêm yết.

Các hệ sinh thái lớn đáng chú ý trên thị trường Việt Nam bao gồm Vingroup với các công ty niêm yết VIC, VHM, VRE — đây là cấu trúc Holding-Subsidiary điển hình nơi VIC là công ty mẹ chi phối. Masan với MSN chi phối MCH, MML. Gelex với GEX chi phối Viglacera (VGC), Cadivi (CAV), và các công ty năng lượng. Novaland với NVL và các công ty con bất động sản. Hoà Phát với HPG và các công ty con thép, nông nghiệp. FPT với FPT và các công ty con công nghệ. Viettel với các công ty niêm yết trong nhóm. Ngoài ra còn các hệ sinh thái có mức độ liên kết lỏng hơn qua sở hữu chéo phức tạp.

Khi một thương vụ M&A hay thoái vốn xảy ra tại công ty mẹ, agent không chỉ ghi nhận dòng tiền bất thường vào báo cáo tài chính hợp nhất mà còn phải định giá lại toàn bộ giá trị tài sản ròng của các công ty con. Khi có tin tiêu cực tại một công ty trong hệ sinh thái, agent phải phân bổ trọng số lan truyền rủi ro cho các công ty còn lại trong hệ theo mức độ sở hữu và mức độ phụ thuộc dòng tiền. Ví dụ tin xấu về NVL sẽ tác động mạnh lên các công ty bất động sản trong hệ Novaland nhưng có thể không liên quan đến hệ Vingroup.

### 5.3. Phân biệt ý nghĩa giao dịch của các loại cổ đông

Bản chất dòng tiền đằng sau các giao dịch cổ đông quyết định tín hiệu thị trường — không phải mọi giao dịch mua hoặc bán đều có ý nghĩa như nhau.

Sự thoái vốn của cổ đông Nhà nước (đại diện bởi SCIC hoặc các Bộ ngành) thường được thị trường săn đón, do kỳ vọng việc thay đổi chủ sở hữu sẽ giúp doanh nghiệp rũ bỏ sức ỳ quản trị, mở khoá giá trị tài sản ngầm thông qua sáp nhập M&A. Lịch sử thoái vốn thành công tại Sabeco hay Vinamilk cho thấy trong giai đoạn tiền đấu giá, thị giá cổ phiếu có thể được đầu cơ đẩy lên các mức định giá P/E rất cao (P/E của SAB có lúc vọt lên trên 40 lần) nhờ kỳ vọng mức giá premium mà giới tỷ phú nước ngoài sẵn sàng trả để nắm quyền kiểm soát. Tuy nhiên ngay sau khi thương vụ kết thúc thành công, động lực đầu cơ tan biến — giá cổ phiếu thường bước vào chu kỳ downtrend miệt mài kéo dài nhiều năm để đưa định giá trở về mặt bằng chung.

Nhóm cổ đông nội bộ gồm Chủ tịch, Tổng Giám đốc, và người có liên quan có động thái mang tín hiệu mạnh nhất. Việc ban lãnh đạo đăng ký mua vào khối lượng lớn thường là lời khẳng định về sức khoẻ doanh nghiệp hoặc nỗ lực tạo đáy cho giá cổ phiếu. Ngược lại nếu ban lãnh đạo liên tục bán ra trong giai đoạn thị trường hưng phấn, hoặc tệ hơn là thực hiện "bán chui" không đăng ký trước, đây là tín hiệu báo động đỏ về sự suy thoái tiềm ẩn. Agent phải đặc biệt chú ý các giao dịch của người đứng đầu vì họ có thông tin nội bộ mà thị trường chưa biết.

Giao dịch của các quỹ đầu tư ngoại như Dragon Capital, VinaCapital có ý nghĩa khác hoàn toàn. Họ mua bán thường dựa trên nguyên tắc cơ cấu danh mục định kỳ, đạt mục tiêu định giá, hoặc thoái vốn theo thời hạn quỹ đóng. Những giao dịch này chủ yếu tạo sức ép cung cầu cơ học trong ngắn hạn chứ hiếm khi mang thông điệp về góc khuất trong hoạt động kinh doanh. Agent không nên đọc giao dịch quỹ ngoại như tín hiệu insider knowledge.

### 5.4. Công bố thông tin theo luật Việt Nam

Sự minh bạch thông tin trên TTCK Việt Nam được chi phối chặt chẽ bởi Luật Chứng khoán và Thông tư 96/2020/TT-BTC. Agent cần nắm vững các cột mốc thời gian để phát hiện sự chậm trễ cố ý của doanh nghiệp.

Với báo cáo tài chính quý, doanh nghiệp phải công bố trong vòng 20 ngày kể từ ngày kết thúc quý, hoặc 30 ngày nếu phải lập báo cáo hợp nhất với công ty con. Với các sự kiện mang tính đột biến như tài khoản ngân hàng bị phong toả, nghị quyết đại hội đồng cổ đông bất thường được thông qua, doanh nghiệp phải tuân thủ nghiêm ngặt quy tắc công bố thông tin bất thường trong vòng 24 giờ. Các giao dịch của người nội bộ và cổ đông lớn phải được báo cáo trước cho Uỷ ban Chứng khoán Nhà nước tối thiểu 3 ngày làm việc trước khi thực hiện.

Bất kỳ sự vi phạm, chậm nộp báo cáo, hoặc việc tổ chức kiểm toán đưa ra các ý kiến không chấp nhận toàn phần đều phải được agent gắn ngay nhãn cảnh báo cao nhất. Các ý kiến kiểm toán đáng chú ý bao gồm: ý kiến chấp nhận toàn phần (doanh nghiệp bình thường, không vấn đề), ý kiến ngoại trừ (có một số khoản mục kiểm toán không đồng ý với doanh nghiệp nhưng không ảnh hưởng toàn diện), ý kiến không chấp nhận (kiểm toán không đồng ý với phần lớn báo cáo), và từ chối đưa ra ý kiến (kiểm toán không thể có đủ bằng chứng để kết luận). Hai ý kiến cuối cùng là tín hiệu rủi ro nghiêm trọng — cổ phiếu thường bị đưa vào diện cảnh báo, cắt tỷ lệ cho vay ký quỹ.

Chất lượng của tổ chức kiểm toán cũng là tín hiệu tham khảo. Các doanh nghiệp được kiểm toán bởi nhóm bốn công ty kiểm toán lớn nhất toàn cầu (PwC, EY, KPMG, Deloitte — thường gọi là Big 4) có độ tin cậy báo cáo cao hơn so với các công ty kiểm toán nội địa quy mô nhỏ. Agent không kết luận "doanh nghiệp có vấn đề" chỉ vì không dùng Big 4, nhưng coi đây là một yếu tố cộng vào độ tin cậy tổng thể.

### 5.5. Chu kỳ kết quả kinh doanh đặc thù theo ngành

Áp dụng mô hình phân tích chu kỳ trơn tru lên doanh nghiệp Việt Nam thường gặp trở ngại do đặc thù ghi nhận kế toán và đặc điểm ngành. Phần này mô tả các đặc thù định tính về chu kỳ và cách đọc báo cáo theo nhóm ngành chính. Các ngưỡng định lượng cụ thể cho từng ngành — NIM, CASA, NPL, CAR cho ngân hàng; D/E, presales, inventory cho bất động sản; margin gộp, giá đầu vào cho xuất nhập khẩu; margin lending, loss ratio cho chứng khoán và bảo hiểm — được đặt trong `agent_db_04` phần D tương ứng với bốn type doanh nghiệp (SXKD, NGANHANG, CHUNGKHOAN, BAOHIEM). Khi diễn giải tin doanh nghiệp cụ thể, agent tra `agent_db_04` phần D để lấy ngưỡng chuẩn rồi so sánh với số liệu tin đang xử lý.

Với nhóm ngân hàng, chu kỳ lợi nhuận thực tế thường bị bóp méo bởi chu kỳ trích lập dự phòng nợ xấu. Các nhà băng có truyền thống "giấu lãi" bằng cách trích lập dự phòng quá tay trong những quý kinh doanh thuận lợi để tạo bộ đệm, rồi hoàn nhập dự phòng để làm mượt lợi nhuận trong những quý kinh tế vĩ mô khó khăn. Agent khi đọc lợi nhuận ngân hàng phải tách bạch lợi nhuận từ hoạt động kinh doanh cốt lõi (biên lãi ròng × tài sản sinh lãi) với lợi nhuận từ hoàn nhập dự phòng — chỉ lợi nhuận cốt lõi mới phản ánh năng lực thực sự của ngân hàng.

Với ngành bất động sản dân cư, dòng tiền thực nhận từ việc mở bán dự án (pre-sales) không được hạch toán ngay vào doanh thu mà neo lại ở khoản mục "người mua trả tiền trước" trên bảng cân đối kế toán. Báo cáo thu nhập chỉ bùng nổ vào thời điểm dự án đủ điều kiện bàn giao nhà. Điều này dẫn đến nghịch lý là báo cáo tài chính quý có thể ghi nhận lỗ ròng, nhưng giá cổ phiếu vẫn tăng rực rỡ do thị trường đánh giá kỳ vọng dòng tiền thu được từ đợt mở bán thành công. Agent khi phân tích bất động sản dân cư phải xem tốc độ mở bán dự án và khoản người mua trả tiền trước, không chỉ nhìn vào lợi nhuận hiện tại.

Với doanh nghiệp xuất nhập khẩu, tác động tỷ giá có đặc thù riêng. Doanh nghiệp thu USD và có nợ VND được hưởng lợi khi USD mạnh, nhưng doanh nghiệp thu VND và có nợ USD thì ngược lại. Tác động tỷ giá có thể tạo ra biến động lớn trong lợi nhuận kế toán mà không phản ánh năng lực kinh doanh thực — agent phải tách bạch lợi nhuận từ hoạt động cốt lõi và lợi nhuận từ biến động tỷ giá.

### 5.6. Tin đồn và lỗ thông tin trên TTCK Việt Nam

Một đặc tính của TTCK Việt Nam là tốc độ lan truyền của tin đồn qua các nền tảng tin nhắn như Zalo, Telegram thường nhanh hơn nhiều so với tốc độ ra văn bản chính thức. Đến khi tin xuất hiện trên các cổng thông tin chính thống, giá cổ phiếu có thể đã hoàn thành một nhịp tăng hoặc giảm dài. Agent cần có framework rạch ròi để ứng xử với tin đồn.

Tin đồn liên quan đến kết quả lợi nhuận quý đột biến thường rò rỉ từ bộ phận kế toán hoặc các bên liên quan trong quy trình kiểm toán. Tác động của chúng thường làm giá cổ phiếu biến động có định hướng nhưng ôn hoà, vì thị trường không chắc chắn 100% cho đến khi BCTC chính thức được công bố.

Tin đồn mang tính chất hình sự — chẳng hạn lãnh đạo bị bắt giữ hoặc doanh nghiệp bị điều tra — thường kích hoạt tâm lý bán tháo hoảng loạn. Giá rớt sàn hàng loạt và gây ra hiện tượng bán giải chấp chéo toàn bộ hệ sinh thái. Agent khi phát hiện tin đồn dạng này cần đặc biệt thận trọng — không dùng tin đồn làm cơ sở khuyến nghị, nhưng dùng nó làm "lẫy kích hoạt" để rà soát bất thường trên thị trường. Nếu có tin đồn kèm khối lượng giao dịch đột biến gấp 3 lần bình thường và hàng loạt lệnh bán giá thị trường chất đống, agent kích hoạt cảnh báo "dòng tiền tháo chạy" và đề xuất user cân nhắc hạ khẩn cấp tỷ lệ vay ký quỹ để phòng thủ.

### 5.7. Các pattern đặc thù của doanh nghiệp Việt Nam

**Chia cổ tức bằng cổ phiếu** có ý nghĩa khác hẳn thị trường phương Tây. Trên thế giới, hành động này thường bị xem là pha loãng giá trị vô nghĩa. Tuy nhiên văn hoá đầu tư cá nhân tại Việt Nam rất ưa chuộng các đợt chia cổ phiếu trong giai đoạn thị trường uptrend, bởi việc điều chỉnh giá kỹ thuật xuống mức thấp tạo ra ảo giác cổ phiếu rẻ hơn, thu hút dòng tiền đầu cơ mới. Ngược lại trong thị trường downtrend, tin chia cổ phiếu bị thị trường cực kỳ ruồng rẫy vì làm tăng lượng cung cổ phiếu trôi nổi trong bối cảnh cạn kiệt thanh khoản. Agent khi đọc tin chia cổ phiếu phải xác định đang ở pha thị trường nào trước khi kết luận tác động — tham chiếu nhãn pha của hệ trong `market_phase` và/hoặc trend đa khung `agent_db_04` (xem 8.0), không phán đoán chay.

**Phát hành ESOP** có ý nghĩa kép tuỳ vào tỷ lệ và điều kiện. Nếu tỷ lệ ESOP duy trì ở mức hợp lý (dưới 1.5% số lượng cổ phiếu đang lưu hành) và có điều kiện hoàn thành KPI cụ thể, nó đóng vai trò khích lệ nhân tài. Nhưng lịch sử lạm dụng ESOP với tỷ lệ lớn hơn 3-5% mỗi năm, giá bán rẻ hơn nhiều so với thị giá, đi kèm thời hạn hạn chế chuyển nhượng lỏng lẻo, sẽ bị thị trường định giá khắt khe như hành vi bòn rút tài sản của cổ đông nhỏ lẻ để tư lợi cho giới tinh hoa quản trị. Agent phải nhận diện đây là một điểm trừ lớn về chất lượng quản trị doanh nghiệp.

**Thoái vốn Nhà nước** đã được đề cập ở phần cổ đông, cần bổ sung pattern thời gian. Giai đoạn thông báo lộ trình đấu giá đến giai đoạn đấu giá thực tế thường kéo dài 3-6 tháng — đây là giai đoạn giá cổ phiếu được đầu cơ đẩy lên. Giai đoạn sau đấu giá thành công đến khi chủ sở hữu mới thực sự triển khai chiến lược cần thêm 6-12 tháng — giai đoạn này giá thường điều chỉnh về định giá hợp lý. Agent khuyến nghị khác nhau tuỳ thời điểm user đặt vị thế trong chu kỳ này.

### 5.8. Kênh tác động và độ trễ

Chuỗi truyền dẫn thông tin của nhóm doanh nghiệp hoạt động theo logic: hành động của doanh nghiệp làm thay đổi cấu trúc vốn, biên lợi nhuận gộp, hoặc chi phí quản lý, từ đó thay đổi các chỉ số định giá kỳ vọng (Forward P/E, Forward P/B), dẫn đến điều chỉnh cơ học của thị giá để tiệm cận định giá mới.

Về độ trễ, tin doanh nghiệp tác động theo ba tầng. Tầng tức thời trong phiên áp dụng cho các bản án khởi tố, bắt giam lãnh đạo, hoặc lệnh bán giải chấp tự động nhắm vào tài khoản ký quỹ của Chủ tịch Hội đồng quản trị — phản ứng thị trường thường là trắng bên mua sàn liên tiếp. Tầng ngắn hạn 1-5 phiên áp dụng cho các báo cáo kết quả kinh doanh bất ngờ — thường xuất hiện hiệu ứng tin ra là bán nếu giá đã âm thầm tăng hơn 20% trong tháng trước khi báo cáo nộp. Tầng trung hạn 1-4 tuần áp dụng cho thông tin cơ cấu lại doanh nghiệp như M&A, phát hành tăng vốn, phê duyệt đầu tư mở rộng — dòng tiền cần thời gian để tái đánh giá hiệu quả vốn.

### 5.9. Pitfalls khi đọc tin doanh nghiệp

Lỗi phổ biến nhất là nhầm lẫn giữa lợi nhuận cốt lõi từ hoạt động kinh doanh chính và lợi nhuận tài chính một lần. Một doanh nghiệp công bố lãi đột biến hàng ngàn tỷ, nhưng nếu agent không quét cấu trúc lợi nhuận để phát hiện nguồn gốc khoản lãi đó đến từ thanh lý tài sản cố định hay đánh giá lại các khoản đầu tư tài chính, việc định giá sẽ bị sai lệch hoàn toàn. Lợi nhuận một lần không thể được tính vào tỷ suất P/E cốt lõi bền vững. Agent khi đọc báo cáo cần luôn bóc tách phần lợi nhuận cốt lõi, loại bỏ các khoản thu nhập bất thường.

Cạm bẫy thứ hai là hợp nhất kết quả kinh doanh trong hệ sinh thái. Lợi nhuận từ một dự án béo bở của công ty liên kết (sở hữu dưới 50%) chỉ được hợp nhất theo phương pháp vốn chủ sở hữu vào lợi nhuận tài chính của công ty mẹ, không làm bùng nổ doanh thu thuần. Sự hiểu nhầm này thường khiến các nhà đầu tư cá nhân đẩy giá cổ phiếu mẹ lên một cách phù phiếm. Agent phải xác định đúng tỷ lệ sở hữu và phương pháp hợp nhất trước khi kết luận tác động.

Cạm bẫy thứ ba là đọc một tin doanh nghiệp cô lập khỏi hệ sinh thái. Tin về công ty con có thể lan tác động sang công ty mẹ và các công ty liên kết khác — không tính đến hiệu ứng lan truyền là bỏ sót rủi ro quan trọng, đặc biệt với các hệ sinh thái có sở hữu chéo chặt chẽ.

### 5.10. Case study

**Vụ Trịnh Văn Quyết và thao túng FLC năm 2022.** Đầu năm 2022, người đứng đầu hệ sinh thái FLC thực hiện "bán chui" gần 75 triệu cổ phiếu, vi phạm nghiêm trọng quy định công bố thông tin. Ngày 29/03/2022, ông Trịnh Văn Quyết bị khởi tố và bắt giam vì tội thao túng TTCK. Phản ứng: sự kiện tạo chấn động huỷ diệt. Các mã trong hệ sinh thái FLC (FLC, ROS, HAI, AMD, KLF) rớt giá sàn trắng bên mua trong hàng loạt phiên giao dịch. Do kẹt thanh khoản, các công ty chứng khoán buộc phải kích hoạt cơ chế bán giải chấp chéo sang các cổ phiếu cơ bản tốt của nhà đầu tư, châm ngòi cho đợt lao dốc kinh hoàng của VN-Index từ vùng 1.500 điểm xuống quanh mốc 870 điểm vào cuối năm. Bài học: rủi ro pháp lý của người đứng đầu là "thiên nga đen" mang sức tàn phá lan toả lớn nhất. Agent phải treo cờ đỏ ngay lập tức khi có tin khởi tố lãnh đạo cấp cao, không đợi phân tích thêm.

**Vụ Tân Hoàng Minh huỷ phát hành trái phiếu tháng 4/2022.** Tháng 4/2022, 9 lô trái phiếu doanh nghiệp trị giá hơn 10.000 tỷ đồng của hệ sinh thái Tân Hoàng Minh bị cơ quan quản lý huỷ bỏ do hành vi che giấu thông tin. Mặc dù Tân Hoàng Minh chưa niêm yết, toàn bộ nhóm cổ phiếu bất động sản và ngân hàng trên sàn bị bán tháo. Các định chế tài chính và công ty chứng khoán đóng vai trò đại lý tư vấn phát hành phải đối mặt với nguy cơ thanh khoản khổng lồ và mất niềm tin nghiêm trọng. Bài học: tin từ doanh nghiệp không niêm yết vẫn có thể lan sang doanh nghiệp niêm yết qua kênh tâm lý và quan hệ kinh doanh — agent cần theo dõi cả hệ sinh thái rộng hơn, không chỉ giới hạn ở các công ty niêm yết.

**Game thoái vốn Nhà nước tại Sabeco và Vinamilk.** SCIC và Bộ Công Thương đưa ra lộ trình đấu giá công khai tỷ lệ cổ phần chi phối. Trong suốt giai đoạn tiền đấu giá, thị giá cổ phiếu được dòng tiền đầu cơ đẩy lên các mức định giá P/E cao chót vót (có lúc P/E của SAB vọt lên trên 40 lần) nhờ kỳ vọng mức giá premium mà giới tỷ phú nước ngoài sẵn sàng trả để nắm quyền kiểm soát. Ngay sau khi thương vụ kết thúc thành công, động lực đầu cơ tan biến — giá cổ phiếu bước vào chu kỳ downtrend miệt mài kéo dài nhiều năm để đưa định giá trở về mặt bằng chung. Bài học: trong các thương vụ thoái vốn Nhà nước, thời điểm đẹp nhất để bán không phải là ngày đấu giá thành công mà là vài tuần trước đó khi dòng tiền đầu cơ đạt đỉnh — agent phải theo dõi lộ trình đấu giá để định thời điểm khuyến nghị chốt lời cho user.

**Cú sốc ý kiến kiểm toán ngoại trừ tại HBC.** Các doanh nghiệp như Xây dựng Hoà Bình (HBC) vi phạm việc chậm nộp báo cáo tài chính kiểm toán, hoặc bị đơn vị kiểm toán từ chối đưa ra ý kiến về khả năng tiếp tục hoạt động liên tục. Phản ứng: cổ phiếu lập tức bị Sở Giao dịch đưa vào diện cảnh báo, cắt toàn bộ tỷ lệ cho vay ký quỹ. Dòng tiền lớn quay lưng khiến thanh khoản khô cạn, cổ phiếu trượt dài bất chấp diễn biến tích cực của thị trường chung. Bài học: ý kiến kiểm toán không chấp nhận là tín hiệu rủi ro hệ thống với cổ phiếu — agent cần coi đây là lệnh đóng vị thế ngay lập tức, không chờ giá hồi.

**Lạm dụng phát hành ESOP tại một số doanh nghiệp bán lẻ.** Đề xuất phát hành lượng lớn cổ phiếu ESOP với giá chỉ bằng một phần mười thị giá, tỷ lệ pha loãng cao mà không đi kèm điều khoản yêu cầu tăng trưởng lợi nhuận khắt khe. Phản ứng: hành động này vấp phải sự phản đối dữ dội từ các tổ chức nước ngoài và cổ đông nhỏ lẻ. Giá cổ phiếu chịu sức ép điều chỉnh và đi ngang dai dẳng trong nhiều tháng do thị trường chiết khấu rủi ro xung đột lợi ích nội bộ. Bài học: chất lượng quản trị doanh nghiệp phản ánh qua các quyết định ESOP — agent cần tính vào điểm tín nhiệm doanh nghiệp, không nên bỏ qua.

**VPBank bán 15% cho SMBC (27/03/2023 ký, 22/10/2023 hoàn tất).** Đây là ví dụ điển hình của pattern đối tác chiến lược uy tín giá hợp lý. SMBC mua 1.19 tỷ cổ phiếu tương đương 15% vốn VPB, giá trị thương vụ 35.9 nghìn tỷ đồng (khoảng 1.5 tỷ USD) với giá 30.160 đồng/cổ phiếu, đi kèm điều khoản khoá giao dịch 5 năm. Tác động tài chính: vốn chủ sở hữu VPB tăng từ 103.5 nghìn tỷ lên khoảng 140 nghìn tỷ, hệ số an toàn vốn CAR nâng lên khoảng 19% (cao nhất trong các ngân hàng Việt Nam được Moody's xếp hạng), VPB trở thành ngân hàng lớn thứ hai về vốn chủ sở hữu chỉ sau Vietcombank. Phản ứng thị trường: ngắn hạn tích cực với giá VPB tăng sau công bố; trung-dài hạn định giá được nâng lên nhờ CAR dẫn đầu ngành và đối tác chiến lược uy tín cam kết lock-up dài hạn. Điểm cần chú ý là SMBC đã có quan hệ chiến lược trước đó (mua 49% FE Credit — công ty con của VPB — năm 2021 với 1.37 tỷ USD), không phải đối tác mới hoàn toàn. Bài học: khi agent gặp tin giao dịch chiến lược với định chế tài chính quốc tế uy tín, cần kiểm tra ba yếu tố — chất lượng đối tác (thứ hạng ngân hàng toàn cầu, lịch sử đầu tư), quy mô giao dịch so với vốn điều lệ hiện tại, và điều khoản lock-up (càng dài càng thể hiện cam kết chiến lược). Nếu cả ba yếu tố đều tích cực thì đây là tin positive mạnh có thể định giá lại cổ phiếu trong nhiều quý, không chỉ phản ứng trong vài phiên.

**VinFast IPO trên NASDAQ tháng 8/2023.** Ngày 15/08/2023 VinFast niêm yết trên NASDAQ thông qua hình thức sáp nhập với một công ty SPAC là Black Spade Acquisition Co, giá trị vốn hoá tại thời điểm niêm yết vượt 23 tỷ USD. Phản ứng của công ty mẹ VIC: trong tuần trước IPO từ 31/07-04/08 tăng 20.78%, tuần niêm yết tiếp tục tăng 16.7% đạt đỉnh 72.600 đồng do kỳ vọng VinFast unlock giá trị cho toàn hệ sinh thái Vingroup. Diễn biến VFS sau niêm yết: ngày 21/08/2023 tăng gấp đôi sau tin EPA chứng nhận VF9 đạt 291-330 dặm; trong tháng 8-9/2023 có lúc tăng hơn 270% trong vài phiên với vốn hoá chạm 191 tỷ USD (vượt cả GM và Ford); nhưng sang 2024-2025 giảm mạnh về khoảng 3-5 USD so với giá IPO 22 USD, mất khoảng 80% giá trị. Bài học kép rất quan trọng: một là IPO của công ty con tại sàn quốc tế lớn có thể tạo catalyst mạnh cho công ty mẹ ở TTCK Việt Nam trong giai đoạn tiền IPO và ngay sau IPO (pattern "unlock value" tương tự game thoái vốn Nhà nước nhưng chiều ngược), agent nên chú ý nhóm cổ phiếu mẹ khi các công ty con lớn công bố kế hoạch IPO quốc tế; hai là định giá quá cao trong giai đoạn FOMO sau IPO có thể không bền vững, agent không nên khuyến nghị mua đuổi công ty mới IPO ở vùng vốn hoá phi lý — pattern này áp dụng chung cho mọi IPO có biến động lớn, không chỉ VFS.

### 5.11. Hành động điển hình cho agent theo loại tin doanh nghiệp

Với thông báo vi phạm pháp luật hay rủi ro pháp lý của ban lãnh đạo, đây là nhóm rủi ro không thể lượng hoá. Lệnh mặc định của agent là đóng ngay mọi vị thế đang mở, đưa mã cổ phiếu và các doanh nghiệp trong hệ sinh thái vào danh sách đen, cảnh báo user khẩn cấp.

Với báo cáo kết quả kinh doanh quý có lợi nhuận tăng trưởng cốt lõi mạnh (đã bóc tách khoản một lần), kết hợp xác nhận từ xu hướng kỹ thuật trung hạn đang tăng, agent cập nhật mức định giá Forward P/E, nâng điểm tín nhiệm của cổ phiếu, đưa ra khuyến nghị mua hoặc gia tăng tỷ trọng.

Với giao dịch bán của cổ đông nội bộ khối lượng lớn, agent kích hoạt cảnh báo phân phối. Đề xuất kịch bản hạ tỷ trọng danh mục nếu giá cổ phiếu bắt đầu suy yếu tại các ngưỡng kháng cự mạnh.

Với tin thoái vốn Nhà nước, agent theo dõi lộ trình đấu giá và đưa khuyến nghị khác nhau theo từng giai đoạn — mua hoặc giữ trong giai đoạn tiền đấu giá khi dòng tiền đầu cơ mạnh, chốt lời ngay trước ngày đấu giá, tránh mua đuổi sau khi thương vụ kết thúc.

---

## 6. Workflow tổng hợp khi có đa tin đồng thời

Một agent chuyên nghiệp hoạt động trong môi trường ngập tràn thông tin không bao giờ xử lý tuyến tính và rời rạc từng tin tức. Agent phải có khả năng xử lý song song, bóc tách và nhận diện mối tương quan khi hàng loạt luồng tin thuộc cả bốn loại đổ về cùng một lúc. Phần này cung cấp workflow để xử lý tình huống đa tin.

### 6.1. Thứ tự ưu tiên — tiếp cận từ trên xuống

Khi tiếp nhận thông tin hỗn hợp trong một phiên phân tích, agent áp dụng triết lý phân tích từ trên xuống qua ba cấp độ.

Ở cấp độ vĩ mô (tin `thong_cao` chỉ đạo cấp Thủ tướng, tin `trong_nuoc` subset vĩ mô/chính sách, hoặc tin `quoc_te` trọng yếu), khung cảnh vĩ mô là chiếc mỏ neo định hình chi phí vốn toàn thị trường. `thong_cao` và `trong_nuoc` subset chính sách có priority cao nhất vì tác động thẳng vào chi phí vốn và cấu trúc dòng tiền nội địa; tin `quoc_te` trọng yếu (Fed, địa chính trị lớn, hàng hoá chiến lược) xếp ngang hoặc thấp hơn tuỳ cơ chế truyền dẫn. Nếu xuất hiện tín hiệu vĩ mô đảo chiều tiêu cực — ví dụ Fed tăng lãi suất bất ngờ, NHNN hút ròng thanh khoản quy mô lớn — agent sẽ chủ động hạ thấp trọng số của mọi tin tức doanh nghiệp tích cực xuất hiện trong cùng session. Lý do là khi nước rút thì thuyền giảm — định giá P/E toàn thị trường bị hạ bớt do môi trường lãi suất thay đổi, một tin doanh nghiệp tốt cũng không đủ bù đắp tác động vĩ mô âm.

Ở cấp độ ngành (tin tức tập trung vào một ngành cụ thể), agent dựa vào bức tranh vĩ mô đã thiết lập ở cấp độ trên để cập nhật nhanh chóng nhóm ngành nào đang đón nhận cơn gió thuận và ngành nào đang hứng chịu rủi ro. Ví dụ khi Fed giảm lãi suất (vĩ mô tích cực), các ngành nhạy cảm với lãi suất như chứng khoán, ngân hàng, bất động sản được ưu tiên; ngành phòng thủ như tiện ích, tiêu dùng thiết yếu bị giảm ưu tiên.

Ở cấp độ cổ phiếu cụ thể (tin doanh nghiệp), agent xử lý ở lớp cuối cùng để sàng lọc các mã có sức mạnh nội tại vượt trội trong lòng các ngành đang được vĩ mô ủng hộ. Một cổ phiếu có tin tốt nhưng thuộc ngành đang bị vĩ mô ép xuống sẽ khó tăng giá bền — agent cần chờ ngữ cảnh ngành chuyển tích cực trước khi khuyến nghị vào.

### 6.2. Phát hiện confluence (đồng thuận) và divergence (phân kỳ)

Confluence xảy ra khi nhiều luồng tin cùng hỗ trợ một hướng đi. Ví dụ tình huống thuận lợi nhất: Ngân hàng Nhà nước hạ lãi suất (tin vĩ mô tích cực), số liệu xuất khẩu cá tra sang Mỹ phục hồi mạnh (tin quốc tế tích cực cho ngành thuỷ sản), VHC công bố báo cáo tài chính quý có lợi nhuận tăng gấp đôi (tin doanh nghiệp tích cực), đồng thời chỉ báo kỹ thuật MACD cắt lên. Sự đồng thuận từ bốn nguồn này kích hoạt tín hiệu mua mạnh với độ tin cậy cao. Agent có thể đề xuất tăng tỷ trọng vị thế lên mức cao nhất cho phép theo khung rủi ro của user.

Divergence xảy ra khi thông tin từ các cấp độ xung đột nhau. Ví dụ thông tin vĩ mô và thị trường chung đang uptrend rực rỡ, nhưng đối với một cổ phiếu cụ thể, ban lãnh đạo liên tục đăng ký thoái vốn và đơn vị kiểm toán đưa ra ý kiến ngoại trừ. Trong tình huống xung đột này, rủi ro quản trị doanh nghiệp (tin doanh nghiệp tiêu cực) sẽ mang sức mạnh phủ quyết. Agent lập tức huỷ bỏ mọi tín hiệu mua bất chấp vĩ mô thuận lợi.

Nguyên tắc xử lý divergence là: tin tiêu cực ở cấp độ cụ thể hơn thường phủ quyết tin tích cực ở cấp độ tổng quát hơn. Lý do là tin ở cấp độ cụ thể có độ chính xác cao hơn về cổ phiếu cụ thể đó — vĩ mô tốt không bù đắp được rủi ro pháp lý của lãnh đạo doanh nghiệp.

### 6.3. Công thức tổng hợp độ tự tin

Khi kết hợp tin với phân tích định lượng, agent có thể tư duy theo công thức không chính thức: News Score cộng với Technical Score cộng với Fundamental Score bằng tổng mức độ tự tin của khuyến nghị. Nếu cả ba nguồn đều đồng thuận dương, mức độ tự tin cao nhất — khuyến nghị hành động mạnh mẽ. Nếu một trong ba xung đột, mức độ tự tin trung bình — khuyến nghị thăm dò với khối lượng nhỏ. Nếu hai trong ba xung đột, mức độ tự tin thấp — khuyến nghị chờ quan sát thêm.

Mọi kỳ vọng định giá tăng lên nhờ tin tức phải được đem ra đối chứng với dòng tiền thực tế. Nếu dòng tiền lớn đã tích luỹ đủ (chỉ báo dòng tiền tuần của cổ phiếu dương mạnh, rank trong top 20% thị trường), agent khuyến nghị nắm giữ và gồng lãi. Nếu thanh khoản vẫn yếu dù tin có vẻ tốt, agent đưa cổ phiếu vào danh sách theo dõi, thiết lập cảnh báo chờ một phiên bùng nổ khối lượng xác nhận xu hướng mới khuyến nghị vào.

---

## 7. Xử lý tình huống khó

Một chiến lược phân tích hoàn hảo sẽ sụp đổ nếu thiếu bộ lọc tinh vi để ứng phó với các vùng xám của TTCK Việt Nam. Phần này hướng dẫn agent xử lý ba tình huống khó nhất: tin đồn, thao túng truyền thông, và bẫy "tin ra là bán".

### 7.1. Xử lý tin đồn và rò rỉ thông tin

Tin đồn thường bắt đầu trong các nhóm chat kín hoặc diễn đàn ngay trước những phiên giao dịch có biên độ lớn, không kèm đường dẫn từ nguồn báo chí chính thống và uy tín. Đặc điểm nhận diện rõ nhất là tin xuất hiện trước khi có bất kỳ văn bản chính thức nào từ doanh nghiệp hoặc cơ quan quản lý.

Nguyên tắc phản ứng của agent: không bao giờ dùng tin đồn làm dữ liệu đầu vào để cập nhật mô hình cơ bản hay đưa ra khuyến nghị mua bán chiến lược. Tuy nhiên tin đồn có giá trị như một "lẫy kích hoạt" để rà soát bất thường trên thị trường. Agent sử dụng tin đồn theo cách sau: khi nghe tin đồn về một doanh nghiệp, agent kiểm tra ngay các chỉ báo định lượng của doanh nghiệp đó — khối lượng giao dịch so với trung bình 5 phiên, dòng tiền trong ngày, tỷ lệ lệnh bán giá thị trường. Nếu các chỉ báo này cho thấy dòng tiền bất thường đang xảy ra trùng khớp với tin đồn, agent kích hoạt cảnh báo rủi ro (không dựa trên nội dung tin đồn mà dựa trên dữ liệu giao dịch thực).

Cụ thể, khi có tin đồn lãnh đạo cấp cao bị điều tra kèm khối lượng giao dịch đột biến gấp 3 lần bình thường và hàng loạt lệnh bán giá thị trường chất đống trên bảng điện, agent kích hoạt cảnh báo "dòng tiền tháo chạy" và đề xuất user cân nhắc hạ khẩn cấp tỷ lệ vay ký quỹ để phòng thủ. Agent không khẳng định "lãnh đạo bị điều tra thật hay không" vì chưa có nguồn chính thức — agent chỉ khuyến nghị hành động dựa trên rủi ro thanh khoản.

### 7.2. Xử lý tin tức bị thao túng

Đặc điểm nhận diện thao túng truyền thông là ban lãnh đạo doanh nghiệp liên tục "bơm" hàng loạt bài viết PR có nội dung lặp lại trên các trang tin nhỏ lẻ, vẽ ra những viễn cảnh siêu dự án hàng chục nghìn tỷ đồng, ký kết với các đối tác không tên tuổi. Kèm theo đó thường là khối lượng giao dịch bất thường tại các cổ phiếu penny hoặc midcap có vốn hoá nhỏ.

Agent phản ứng bằng cách đối chiếu nội dung tin với bảng cân đối kế toán của doanh nghiệp. Nếu công ty khoe dự án nghìn tỷ nhưng vốn hoá thị trường rất nhỏ (dưới 1.000 tỷ đồng), lượng tiền mặt quanh quẩn ở số 0 hoặc vay ngắn hạn cao, khoản mục xây dựng cơ bản dở dang trống trơn — agent đánh giá đây là chiến dịch thao túng bơm thổi và tự động đưa mã này vào danh sách không khuyến nghị. Agent cũng cần tỉnh táo nếu thấy một cổ phiếu được nhiều bài viết khen ngợi trong thời gian ngắn trên các nguồn không thuộc top báo uy tín — đây là pattern "pump and dump" kinh điển.

### 7.3. Bẫy "tin ra là bán"

Khi hệ thống ghi nhận một báo cáo tài chính với kết quả tăng trưởng thần tốc, agent phải quay ngược lại dữ liệu lịch sử giá của cổ phiếu đó trong 30 đến 45 ngày trước. Nếu thị giá cổ phiếu đã tăng hơn 20-30% và chạm các ngưỡng cản tâm lý cực mạnh (như đỉnh lịch sử hoặc mốc Fibonacci quan trọng), agent đưa ra kết luận: dữ liệu kinh doanh cực kỳ tích cực nhưng phần lớn lợi ích đã được thị trường tiên liệu và hấp thụ vào giá trước đó. Rủi ro đảo chiều ngắn hạn gia tăng. Khuyến nghị cân nhắc hiện thực hoá lợi nhuận, tuyệt đối không mở vị thế mua đuổi.

Nguyên tắc tổng quát: tin càng tích cực bao nhiêu trong khi giá đã tăng nhiều, càng có khả năng là điểm chốt lời hơn là điểm mua. Và ngược lại, tin càng tiêu cực bao nhiêu trong khi giá đã giảm sâu, càng có khả năng là điểm mua hơn là điểm bán — đây là logic wash-out cuối cùng của nhịp giảm.

---

## 8. Kết hợp tin với chỉ báo định lượng

Phần này là điểm giao giữa file này và `agent_db_04` — mô tả cách agent kết hợp phân tích tin với các chỉ báo định lượng đã có (dòng tiền, trend, kỹ thuật, cơ bản) để ra kết luận có độ tin cậy cao hơn so với dùng riêng rẽ mỗi loại.

### 8.0. Bối cảnh pha thị trường (v2 — nguồn dữ liệu đã có)

Cùng một tin, thông điệp đổi theo pha thị trường. Pha lấy từ `market_phase` (headline sẵn trong
`data_briefing.core.phase`) và/hoặc đánh giá trend đa khung của agent (`agent_db_04`) — đây là bước hiệu chỉnh
cách ĐỌC tin, không phải thứ bắt buộc nêu ra output:

- **DOWNTREND (exposure 0):** hệ đang đứng ngoài — tin tốt mã lẻ thường chỉ ở mức "điểm cộng cho danh sách
  theo dõi, chờ hệ bật lại"; nếu agent đánh giá tin đủ mạnh để cân nhắc vị thế, nói rõ đây là quan điểm ngược
  tín hiệu hệ. Tin xấu = xác nhận thêm cho phòng thủ.
- **UPTREND:** tin xấu mã lẻ đọc nghiêm hơn (rủi ro riêng trong thị trường thuận); tin tốt dễ được dòng tiền hưởng ứng.
- **TRANSITION/SIDEWAY:** tin có vai trò chất xúc tác lớn nhất — kiểm tra chéo dòng tiền (8.1) quyết định.
- Các đoạn dưới đây (8.1–8.3) nhắc "pha thị trường"/"uptrend/downtrend" (vd tin chia cổ phiếu ở phần 5.7):
  từ v2 có thêm nhãn pha của hệ trong `market_phase` để tham chiếu, bên cạnh đánh giá trend đa khung của agent
  — không phán đoán chay không nguồn.

### 8.1. Nguyên tắc chung — tin không thay thế chỉ báo

Agent không bao giờ ra quyết định chỉ dựa trên tin. Mỗi tin tức sau khi được diễn giải phải được kiểm tra chéo với ít nhất một chỉ báo định lượng từ `agent_db_04` để xác nhận hoặc bác bỏ hướng tác động. Có bốn tình huống điển hình xảy ra khi kết hợp.

Tình huống thứ nhất là tin tích cực xác nhận bởi dòng tiền. Một tin tốt xuất hiện kèm dòng tiền tuần của cổ phiếu chuyển dương mạnh, rank cổ phiếu trong top 20% thị trường, chỉ báo kỹ thuật khung tuần ở vùng tích cực hoặc mạnh. Đây là tín hiệu đồng thuận với độ tin cậy cao nhất — khuyến nghị mua hoặc gia tăng tỷ trọng với khối lượng lớn.

Tình huống thứ hai là tin tích cực không xác nhận bởi dòng tiền. Một tin tốt xuất hiện nhưng dòng tiền không hưởng ứng — điểm dòng tiền ngày vẫn âm, khối lượng giao dịch không tăng đáng kể, giá lình xình hoặc giảm nhẹ. Đây là cảnh báo nghiêm trọng rằng tin có thể đã được price-in trước đó, hoặc thị trường không tin vào tin đã công bố. Trong tình huống này, agent không khuyến nghị mua dù tin có vẻ tốt — đợi xác nhận bằng chuỗi ít nhất 3 phiên dòng tiền dương liên tiếp trước khi kết luận.

Tình huống thứ ba là tin tiêu cực xác nhận bởi dòng tiền. Một tin xấu xuất hiện kèm khối ngoại bán ròng mạnh, dòng tiền tuần âm sâu, giá phá vỡ hỗ trợ kỹ thuật quan trọng. Đây là tín hiệu rủi ro hệ thống — agent khuyến nghị đóng vị thế ngay lập tức, không chờ giá hồi.

Tình huống thứ tư là tin tiêu cực không xác nhận bởi dòng tiền. Một tin xấu xuất hiện nhưng khối ngoại và khối tự doanh liên tục mua ròng tại vùng định giá thấp lịch sử, giá không thiết lập đáy mới. Agent nhận diện đây có thể là pha rũ bỏ cuối cùng của nhịp giảm. Tự động hạ trọng số rủi ro của thông tin tiêu cực đó và chuẩn bị kích hoạt kịch bản vị thế mua khi có xác nhận đảo chiều từ chỉ báo dòng tiền.

### 8.2. Kịch bản tin tốt trên đỉnh — cảnh báo phân phối

Một kịch bản đặc biệt quan trọng agent cần nhận diện: công ty công bố báo cáo tài chính với lợi nhuận bùng nổ vượt kỳ vọng, nhưng giá cổ phiếu đang ở đỉnh lịch sử, chỉ báo dòng tiền tuần đã chuyển từ cao xuống trung tính, khối lượng giao dịch tăng đột biến mà giá không tăng tương ứng (hiện tượng phân phối đỉnh). Trong tình huống này, agent phải đảo ngược thông điệp mặc định — thay vì khuyến nghị mua theo tin tốt, agent nhận diện đây là chất xúc tác để chốt lời, cảnh báo user tuyệt đối không mở vị thế mua mới ở vùng giá này. Đây là ứng dụng thực tế của nguyên tắc "tin tích cực trên nền giá đã tăng nhiều = phân phối".

### 8.3. Kịch bản tin trung tính nhưng kỹ thuật xác nhận — confluence breakout

Ngược lại với 8.2, khi tin có vẻ trung tính hoặc chỉ hơi tích cực (ví dụ tin khởi công dự án mới của một doanh nghiệp bất động sản), nhưng cổ phiếu đang tạo nền tích luỹ chặt chẽ sau một giai đoạn điều chỉnh sâu, và có một phiên breakout với khối lượng trên 1.5 lần trung bình 20 phiên — agent xác nhận tính đồng thuận giữa phân tích tin và phân tích kỹ thuật. Đây là điểm mua tốt với độ tin cậy cao. Tin không cần phải "bùng nổ" — chỉ cần đủ làm chất xúc tác cho dòng tiền đã sẵn sàng vào.

---

## 9. Bảng dịch thuật ngữ tiếng Anh trong phân tích tin tức

Các thuật ngữ tiếng Anh xuất hiện khi phân tích tin tức theo chuẩn quốc tế là công cụ tư duy của agent — tuyệt đối không để nguyên tiếng Anh trong output cho user. Agent cần dịch sang ngôn ngữ tự nhiên tiếng Việt trước khi trả lời. Bảng dưới đây cung cấp bản dịch chuẩn cho các thuật ngữ thường gặp.

| Thuật ngữ tiếng Anh | Bản dịch / mô tả cho user |
|---|---|
| sell on news / buy the rumor, sell the news | Bán khi tin được công bố chính thức sau một giai đoạn đầu cơ theo kỳ vọng |
| priced-in | Đã phản ánh vào giá — thị trường đã tiêu hoá thông tin này trước khi công bố |
| dot plot | Biểu đồ chấm của Fed — thể hiện dự báo lãi suất của từng thành viên FOMC |
| forward guidance | Định hướng chính sách — các phát biểu hướng dẫn thị trường về chính sách tương lai |
| interest rate differential | Chênh lệch lãi suất giữa hai đồng tiền, thường là USD và VND |
| balance sheet runoff | Tiến trình thu hẹp bảng cân đối kế toán của ngân hàng trung ương |
| hawkish / dovish | Diều hâu (nghiêng về thắt chặt) / bồ câu (nghiêng về nới lỏng) |
| consensus | Mức đồng thuận dự báo của giới phân tích tài chính |
| whisper number | Kỳ vọng ngầm của giới giao dịch, khác với consensus công khai |
| contango | Giá hợp đồng tương lai cao hơn giá giao ngay — ám chỉ nguồn cung dư thừa |
| backwardation | Giá giao ngay cao hơn hợp đồng tương lai — phản ánh thiếu hụt khẩn cấp |
| tailwinds | Cơn gió thuận — các yếu tố hỗ trợ tích cực |
| headwinds | Gió ngược — các yếu tố gây khó khăn |
| China Plus One | Chiến lược đa dạng hoá sản xuất ngoài Trung Quốc |
| confluence | Sự hội tụ đồng thuận của nhiều tín hiệu cùng hướng |
| divergence | Sự phân kỳ — các tín hiệu xung đột nhau |
| veto | Quyền phủ quyết — trong bối cảnh này là tín hiệu có sức mạnh át các tín hiệu khác |
| smart money | Dòng tiền thông minh — thường là dòng tiền từ nhà đầu tư tổ chức lớn |
| wash-out | Pha rũ bỏ cuối cùng của nhịp giảm — điểm bán tháo hoảng loạn trước khi tạo đáy |
| bull trap / bear trap | Bẫy tăng giá / bẫy giảm giá — tín hiệu giả ngược hướng xu hướng thực |
| risk-off / risk-on | Trạng thái ngại rủi ro / chấp nhận rủi ro của giới đầu tư toàn cầu |
| pump and dump | Bơm thổi rồi xả — chiến dịch thao túng giá lên để bán cho nhà đầu tư nhỏ lẻ |
| overbought / oversold | Quá mua / quá bán — vùng cực đoan của chỉ báo kỹ thuật |
| breakout | Bứt phá — giá vượt qua mức kháng cự quan trọng |
| target price | Giá mục tiêu — mức giá kỳ vọng đạt tới trong phân tích |
| going concern | Khả năng hoạt động liên tục — đánh giá của kiểm toán về việc doanh nghiệp có thể tiếp tục hoạt động |
| cross-default | Bán giải chấp chéo — lệnh bán tự động lan từ cổ phiếu này sang cổ phiếu khác trong cùng tài khoản ký quỹ |
| pre-sales | Doanh thu từ mở bán dự án (bất động sản) — chưa hạch toán vào doanh thu cho đến khi bàn giao |
| earnings smoothing | Làm mượt lợi nhuận — kỹ thuật kế toán để ổn định lợi nhuận qua các kỳ |
| one-off / non-recurring | Một lần / không lặp lại — khoản thu nhập hoặc chi phí bất thường, không thuộc hoạt động cốt lõi |
| force sell | Bán giải chấp bắt buộc — lệnh bán tự động khi tỷ lệ ký quỹ dưới ngưỡng an toàn |

Ngoài các thuật ngữ trong bảng, một số thuật ngữ viết tắt thông dụng cũng cần được giải thích khi lần đầu xuất hiện trong output: FOMC (Uỷ ban Thị trường mở Liên bang — cơ quan quyết định lãi suất của Fed), NFP (bảng lương phi nông nghiệp — số liệu việc làm Mỹ hàng tháng), CPI (chỉ số giá tiêu dùng), PCE (chỉ số giá tiêu dùng cá nhân — Fed ưu tiên dùng thay cho CPI), PMI (chỉ số quản trị mua hàng — đo hoạt động sản xuất), DXY (chỉ số sức mạnh đồng USD so với rổ tiền tệ), VIX (chỉ số đo lường trạng thái sợ hãi của thị trường Mỹ), FDI (đầu tư trực tiếp nước ngoài), FII (đầu tư gián tiếp nước ngoài — thường là qua thị trường chứng khoán), ESOP (cổ phiếu ưu đãi cho người lao động), M&A (sáp nhập và thâu tóm).

---

## 10. Checklist cuối trước khi output cho user

Để đảm bảo quy trình phân tích tin tức của agent vận hành ổn định và không bỏ sót các trường thông tin trọng yếu, khi bất kỳ gói dữ liệu tin tức nào được đưa vào (bao gồm news_type, thời gian, danh sách ticker, content), agent phải tuần tự thực hiện 8 bước phân tích trước khi chuyển đổi thành lời khuyên đầu tư cho user.

**Bước 1 — Phân loại cấu trúc.** Tin thuộc lớp `doanh_nghiep`, `quoc_te`, `trong_nuoc`, hay `thong_cao`? Nếu là `trong_nuoc`, thuộc `category_name` nào và có relevant TTCK không (xem section 3.0)? Với cả 4 lớp, thuộc sub-category/chủ đề nhỏ nào trong phân loại đã mô tả ở phần 3, 4, 5?

**Bước 2 — Đánh giá độ tin cậy nguồn tin.** Nguồn tin có phải chính thống (văn bản nhà nước có số hiệu, nguồn Reuters/Bloomberg, công bố doanh nghiệp qua Sở Giao dịch) hay không? Nếu không, lọc bỏ khỏi mô hình định lượng.

**Bước 3 — Chấm điểm impact nội bộ.** Áp dụng bộ 5 câu hỏi logic gates ở phần 2 để đánh giá mức độ tác động. Nhắc lại: điểm và nhãn HIGH/MID/LOW chỉ dùng nội bộ, KHÔNG xuất hiện trong output.

**Bước 4 — Xác định kênh truyền dẫn.** Tin này tác động qua kênh nào lên TTCK VN — chi phí vốn, thanh khoản, tỷ giá, giá nguyên liệu, dòng vốn FII, chuỗi cung ứng, định vị cạnh tranh, hay tâm lý? Nếu tin quốc tế thì phải áp đủ ba tầng nhận thức (chuẩn quốc tế, địa chính trị, mapping về VN).

**Bước 5 — Kiểm tra độ trễ và price-in.** Tin này có độ trễ tác động thế nào (tức thời, ngắn, trung, dài hạn)? Thị trường đã tiêu hoá được bao nhiêu phần trăm kỳ vọng rồi (giá cổ phiếu liên quan đã tăng/giảm nhiều trước khi tin công bố)?

**Bước 6 — Kết hợp với chỉ báo định lượng.** Dòng tiền có xác nhận hướng tác động của tin không? Trend kỹ thuật đồng pha hay xung đột? Định giá cơ bản có hợp lý ở vùng giá hiện tại không? Áp dụng một trong bốn tình huống mô tả ở phần 8.1 để phân loại mức độ tự tin.

**Bước 7 — Xử lý nếu có đa tin đồng thời.** Nếu trong session có nhiều tin thuộc các loại khác nhau, áp dụng thứ tự ưu tiên từ trên xuống ở phần 6.1 — vĩ mô trước, ngành sau, cổ phiếu cụ thể cuối cùng. Kiểm tra confluence hay divergence. Nếu có divergence, tin tiêu cực ở cấp độ cụ thể hơn có sức mạnh phủ quyết.

**Bước 8 — Soạn output theo nguyên tắc K hygiene.** Rà soát lần cuối output trước khi send: không lộ ký hiệu DB raw, không lộ taxonomy nội bộ (bao gồm "HIGH/MID/LOW impact", "logic gate", "framework chấm điểm"), không để nguyên thuật ngữ tiếng Anh chưa dịch. Mô tả trực tiếp tác động, cơ chế, hành động bằng ngôn ngữ tự nhiên. Tone và format theo system prompt mục 2 — direct, expert-level, concise, evidence-based.

**Dẫn link nguồn khi cần:** khi output liệt kê nhiều tin/báo cáo dạng bảng hoặc cite claim cụ thể, bổ sung URL bài gốc bên cạnh mỗi entry để user verify. Pattern: `https://finext.vn/news/{article_slug}` cho tin thường, `https://finext.vn/reports/{report_slug}` cho báo cáo tổng hợp. Khi user explicit yêu cầu "dẫn link" hoặc "cho link bài báo", bắt buộc đưa URL đầy đủ. Chi tiết pattern và K hygiene exception xem `agent_db_01` section F (Khối tin tức).

Sau khi chạy đủ 8 bước, agent đưa ra kết luận có cấu trúc gồm ba thành phần: (1) tác động thực tế của tin tới nhóm cổ phiếu nào theo cơ chế gì, (2) khuyến nghị hành động cụ thể kèm điều kiện, (3) các yếu tố rủi ro hoặc dấu hiệu cần theo dõi trong các phiên tiếp theo để xác nhận hoặc bác bỏ kết luận ban đầu.

---

## Phụ lục — Tham chiếu chéo với các file khác

Phần này giúp agent navigate nhanh giữa file này và các file còn lại trong hệ thống.

Khi gặp tin cần query từ DB: xem Workflow L trong `agent_db_02`, và schema 4 collection tin tức ở phần E của `agent_db_01`.

Khi cần phân tích trend thị trường hoặc ngành kết hợp với tin trong nước (subset vĩ mô/chính sách) và thông cáo Chính phủ: xem phần B1.5 của `agent_db_04` (bắt buộc query snapshot + recent 20 phiên) và Workflow K của `agent_db_02`.

Khi phân tích cơ bản doanh nghiệp kết hợp với tin doanh nghiệp: xem phần D của `agent_db_04` về 4 type doanh nghiệp, đặc biệt chú ý cách đọc chu kỳ quarterly ở mục D5.

Khi gặp mâu thuẫn tín hiệu giữa tin và chỉ báo định lượng: xem các pitfall F1-F12 trong `agent_db_04` — nhiều pitfall đã cover các tình huống mâu thuẫn tương tự.

Khi soạn output cuối cùng: xem system prompt mục 8.5 + 9 (K hygiene — cấm lộ ký hiệu nội bộ và taxonomy), cùng bảng dịch thuật ngữ ở phần 9 của file này.
