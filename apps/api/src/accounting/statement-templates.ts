// Mẫu báo cáo tài chính theo chế độ kế toán (CONG_VIEC_15; QUYTAC_NGHIEPVU_99, 101).
// Thông tư 99/2025/TT-BTC: Điều 17, Phụ lục IV (lập từ bản chép kèm Thông tư và tài liệu tập huấn của Bộ Tài chính; phải đối chiếu bản gốc trước khi phát hành).
// Thông tư 133/2016/TT-BTC: Điều 81. Công thức chỉ dùng tài khoản có trong charts.ts; "longTermOf": chỉ tiêu dài hạn lấy cùng công thức với chỉ tiêu ngắn hạn
// tương ứng nhưng chỉ trên tài khoản chi tiết đánh dấu dài hạn.
import type { AccountingRegime } from "contracts";

export interface StatementFormula {
  sum?: string[];
  minus?: string[];
  debitBalance?: string[];
  creditBalance?: string[];
  debitBalanceByPartner?: string[];
  creditBalanceByPartner?: string[];
  netBalance?: string[];
  negative?: boolean;
  debitTurnover?: string[];
  creditTurnover?: string[];
  counter?: string[];
  excludeCounter?: string[];
  subtract?: { debitTurnover?: string[]; creditTurnover?: string[]; counter?: string[] };
}
export interface StatementLine {
  code: string;
  name: string;
  level: number;
  formula?: StatementFormula;
  longTermOf?: string;
  note?: string;
}
export interface StatementTemplate {
  form: string;
  name: string;
  lines: StatementLine[];
}

export const statementTemplates: Record<AccountingRegime, { balanceSheet: StatementTemplate; balanceSheetB01b?: StatementTemplate; incomeStatement: StatementTemplate; source: unknown }> = {
  TT99_2025: {
    balanceSheet: {
      form: "B01-DN",
      name: "Báo cáo tình hình tài chính",
      lines: [
        {
          code: "100",
          name: "A - TÀI SẢN NGẮN HẠN",
          level: 0,
          formula: {
            sum: ["110", "120", "130", "140", "150", "160"],
          },
        },
        {
          code: "110",
          name: "I. Tiền và các khoản tương đương tiền",
          level: 1,
          formula: {
            sum: ["111", "112"],
          },
        },
        {
          code: "111",
          name: "1. Tiền",
          level: 2,
          formula: {
            debitBalance: ["111", "112", "113"],
          },
          note: "Chỉ gồm tiền không bị hạn chế sử dụng; tiền bị hạn chế chuyển sang 165/274 (phần mềm chưa theo dõi, mặc định toàn bộ ở đây).",
        },
        {
          code: "112",
          name: "2. Các khoản tương đương tiền",
          level: 2,
          note: "Nguồn: số dư Nợ chi tiết TK 1281 có kỳ hạn gốc không quá 3 tháng và khoản đủ tiêu chuẩn tương đương tiền. Phần mềm chưa có kỳ hạn gốc; mặc định 0, toàn bộ 128 trình bày ở 123. Đề xuất: cờ 'tương đương tiền' trên khế ước tiền gửi.",
        },
        {
          code: "120",
          name: "II. Đầu tư tài chính ngắn hạn",
          level: 1,
          formula: {
            sum: ["121", "122", "123", "124", "125", "126"],
          },
        },
        {
          code: "121",
          name: "1. Chứng khoán kinh doanh",
          level: 2,
          formula: {
            debitBalance: ["121"],
          },
        },
        {
          code: "122",
          name: "2. Dự phòng giảm giá chứng khoán kinh doanh (*)",
          level: 2,
          formula: {
            creditBalance: ["2291"],
            negative: true,
          },
        },
        {
          code: "123",
          name: "3. Đầu tư nắm giữ đến ngày đáo hạn ngắn hạn",
          level: 2,
          formula: {
            debitBalance: ["1281", "1282", "1283", "1288"],
          },
          note: "Đúng ra chỉ phần có kỳ hạn còn lại không quá 12 tháng, không gồm phần đã trình bày ở 112. Phần mềm chưa có thông tin kỳ hạn.",
        },
        {
          code: "124",
          name: "4. Dự phòng đầu tư nắm giữ đến ngày đáo hạn ngắn hạn (*)",
          level: 2,
          note: "Chưa xác minh được tài khoản nguồn từ văn bản gốc (bài hướng dẫn thứ cấp ghi số dư Có chi tiết TK 2292, nhưng danh mục đặt tên TK 2292 là 'Dự phòng tổn thất đầu tư vào đơn vị khác'). Mặc định 0; toàn bộ 2292 trình bày ở 264.",
        },
        {
          code: "125",
          name: "5. Đầu tư ngắn hạn khác",
          level: 2,
          note: "Nguồn (tài liệu tập huấn Bộ Tài chính): số dư Nợ chi tiết TK 2281 phần đầu tư vào hợp đồng BCC không có quyền đồng kiểm soát, kỳ hạn còn lại không quá 12 tháng. Phần mềm chưa tách; mặc định 0, toàn bộ 2281 ở 263.",
        },
        {
          code: "126",
          name: "6. Dự phòng tổn thất các khoản đầu tư ngắn hạn khác (*)",
          level: 2,
          note: "Nguồn (tài liệu tập huấn): số dư Có chi tiết TK 2292 tương ứng chỉ tiêu 125. Mặc định 0 (đi cùng 125).",
        },
        {
          code: "130",
          name: "III. Các khoản phải thu ngắn hạn",
          level: 1,
          formula: {
            sum: ["131", "132", "133", "134", "135", "136", "137"],
          },
        },
        {
          code: "131",
          name: "1. Phải thu ngắn hạn của khách hàng",
          level: 2,
          formula: {
            debitBalanceByPartner: ["131"],
          },
          note: "Mặc định toàn bộ là ngắn hạn (xem 211).",
        },
        {
          code: "132",
          name: "2. Trả trước cho người bán ngắn hạn",
          level: 2,
          formula: {
            debitBalanceByPartner: ["331"],
          },
          note: "Mặc định toàn bộ là ngắn hạn (xem 212).",
        },
        {
          code: "133",
          name: "3. Phải thu nội bộ ngắn hạn",
          level: 2,
          formula: {
            debitBalance: ["1362", "1363", "1368"],
          },
          note: "Mặc định toàn bộ là ngắn hạn (xem 214).",
        },
        {
          code: "134",
          name: "4. Phải thu theo tiến độ hợp đồng xây dựng",
          level: 2,
          formula: {
            debitBalance: ["337"],
          },
        },
        {
          code: "135",
          name: "5. Phải thu ngắn hạn khác",
          level: 2,
          formula: {
            debitBalanceByPartner: ["1388", "334", "3381", "3382", "3383", "3384", "3386", "3388", "141", "244"],
          },
          note: "Nguồn: số dư Nợ chi tiết TK 1388, 334, 338, 141, 244. Lấy theo đối tác để không bù trừ giữa các đối tượng; nếu tài khoản không theo dõi đối tác thì lấy số dư Nợ của tài khoản. TK 3387 không đưa vào (xem 319). Mặc định toàn bộ là ngắn hạn (xem 215).",
        },
        {
          code: "136",
          name: "6. Dự phòng phải thu ngắn hạn khó đòi (*)",
          level: 2,
          formula: {
            creditBalance: ["2293"],
            negative: true,
          },
          note: "Mặc định toàn bộ là ngắn hạn (xem 216).",
        },
        {
          code: "137",
          name: "7. Tài sản thiếu chờ xử lý",
          level: 2,
          formula: {
            debitBalance: ["1381"],
          },
        },
        {
          code: "140",
          name: "IV. Hàng tồn kho",
          level: 1,
          formula: {
            sum: ["141", "142"],
          },
        },
        {
          code: "141",
          name: "1. Hàng tồn kho",
          level: 2,
          formula: {
            debitBalance: ["151", "152", "153", "154", "155", "156", "157", "158"],
          },
          note: "Không gồm chi phí SXKD dở dang dài hạn (251) và thiết bị, vật tư, phụ tùng thay thế dài hạn (273); phần mềm chưa tách nên mặc định toàn bộ ở đây.",
        },
        {
          code: "142",
          name: "2. Dự phòng giảm giá hàng tồn kho (*)",
          level: 2,
          formula: {
            creditBalance: ["2294"],
            negative: true,
          },
        },
        {
          code: "150",
          name: "V. Tài sản sinh học ngắn hạn",
          level: 1,
          formula: {
            sum: ["151", "152", "153"],
          },
        },
        {
          code: "151",
          name: "1. Súc vật nuôi lấy sản phẩm một lần ngắn hạn",
          level: 2,
          formula: {
            debitBalance: ["2152"],
          },
          note: "Mặc định toàn bộ TK 2152 là ngắn hạn (xem 236).",
        },
        {
          code: "152",
          name: "2. Cây trồng theo mùa vụ hoặc lấy sản phẩm một lần ngắn hạn",
          level: 2,
          formula: {
            debitBalance: ["2153"],
          },
          note: "Mặc định toàn bộ TK 2153 là ngắn hạn (xem 237).",
        },
        {
          code: "153",
          name: "3. Dự phòng tổn thất tài sản sinh học ngắn hạn (*)",
          level: 2,
          formula: {
            creditBalance: ["2295"],
            negative: true,
          },
          note: "Mặc định toàn bộ là ngắn hạn (xem 238).",
        },
        {
          code: "160",
          name: "VI. Tài sản ngắn hạn khác",
          level: 1,
          formula: {
            sum: ["161", "162", "163", "164", "165"],
          },
        },
        {
          code: "161",
          name: "1. Chi phí chờ phân bổ ngắn hạn",
          level: 2,
          formula: {
            debitBalance: ["242"],
          },
          note: "Đúng ra chỉ phần có thời gian phân bổ không quá 12 tháng. Mặc định toàn bộ TK 242 ở đây (xem 271).",
        },
        {
          code: "162",
          name: "2. Thuế GTGT được khấu trừ",
          level: 2,
          formula: {
            debitBalance: ["133"],
          },
        },
        {
          code: "163",
          name: "3. Thuế và các khoản khác phải thu Nhà nước",
          level: 2,
          formula: {
            debitBalance: ["1383", "33311", "33312", "3332", "3333", "3334", "3335", "3336", "3337", "33381", "33382", "3339"],
          },
          note: "Nguồn: số dư Nợ chi tiết TK 1383 và TK 333. Liệt kê tài khoản chi tiết cuối của 333 để mỗi loại thuế bù trừ riêng; đối xứng với 314.",
        },
        {
          code: "164",
          name: "4. Giao dịch mua bán lại trái phiếu Chính phủ",
          level: 2,
          formula: {
            debitBalance: ["171"],
          },
        },
        {
          code: "165",
          name: "5. Tài sản ngắn hạn khác",
          level: 2,
          formula: {
            debitBalance: ["2288"],
          },
          note: "Nguồn: số dư Nợ chi tiết TK 2288 và tiền, tương đương tiền bị hạn chế sử dụng ngắn hạn (phần mềm chưa theo dõi hạn chế sử dụng).",
        },
        {
          code: "200",
          name: "B - TÀI SẢN DÀI HẠN",
          level: 0,
          formula: {
            sum: ["210", "220", "230", "240", "250", "260", "270"],
          },
        },
        {
          code: "210",
          name: "I. Các khoản phải thu dài hạn",
          level: 1,
          formula: {
            sum: ["211", "212", "213", "214", "215", "216"],
          },
        },
        {
          code: "211",
          name: "1. Phải thu dài hạn của khách hàng",
          level: 2,
          longTermOf: "131",
          note: "Nguồn: tổng số dư Nợ chi tiết TK 131 theo khách hàng, phần dài hạn. Phần mềm chưa có thông tin kỳ hạn; mặc định toàn bộ số dư trình bày ở chỉ tiêu ngắn hạn tương ứng, chỉ tiêu dài hạn này để 0. Đề xuất: thêm cờ 'dài hạn' (hoặc ngày đáo hạn) cho đối tác/khế ước/tài khoản chi tiết để tách.",
        },
        {
          code: "212",
          name: "2. Trả trước cho người bán dài hạn",
          level: 2,
          longTermOf: "132",
          note: "Nguồn: tổng số dư Nợ chi tiết TK 331 theo người bán, phần dài hạn. Phần mềm chưa có thông tin kỳ hạn; mặc định toàn bộ số dư trình bày ở chỉ tiêu ngắn hạn tương ứng, chỉ tiêu dài hạn này để 0. Đề xuất: thêm cờ 'dài hạn' (hoặc ngày đáo hạn) cho đối tác/khế ước/tài khoản chi tiết để tách.",
        },
        {
          code: "213",
          name: "3. Vốn kinh doanh ở đơn vị trực thuộc",
          level: 2,
          formula: {
            debitBalance: ["1361"],
          },
        },
        {
          code: "214",
          name: "4. Phải thu nội bộ dài hạn",
          level: 2,
          longTermOf: "133",
          note: "Nguồn: số dư Nợ chi tiết TK 1362, 1363, 1368 phần dài hạn. Phần mềm chưa có thông tin kỳ hạn; mặc định toàn bộ số dư trình bày ở chỉ tiêu ngắn hạn tương ứng, chỉ tiêu dài hạn này để 0. Đề xuất: thêm cờ 'dài hạn' (hoặc ngày đáo hạn) cho đối tác/khế ước/tài khoản chi tiết để tách.",
        },
        {
          code: "215",
          name: "5. Phải thu dài hạn khác",
          level: 2,
          longTermOf: "135",
          note: "Nguồn: số dư Nợ chi tiết TK 1388, 334, 338, 141, 244 phần dài hạn. Phần mềm chưa có thông tin kỳ hạn; mặc định toàn bộ số dư trình bày ở chỉ tiêu ngắn hạn tương ứng, chỉ tiêu dài hạn này để 0. Đề xuất: thêm cờ 'dài hạn' (hoặc ngày đáo hạn) cho đối tác/khế ước/tài khoản chi tiết để tách.",
        },
        {
          code: "216",
          name: "6. Dự phòng phải thu dài hạn khó đòi (*)",
          level: 2,
          longTermOf: "136",
          note: "Nguồn: số dư Có chi tiết TK 2293 phần dự phòng cho phải thu dài hạn. Mặc định 0 (đi cùng 211-215).",
        },
        {
          code: "220",
          name: "II. Tài sản cố định",
          level: 1,
          formula: {
            sum: ["221", "224", "227"],
          },
        },
        {
          code: "221",
          name: "1. Tài sản cố định hữu hình",
          level: 2,
          formula: {
            sum: ["222", "223"],
          },
        },
        {
          code: "222",
          name: "- Nguyên giá",
          level: 3,
          formula: {
            debitBalance: ["211"],
          },
        },
        {
          code: "223",
          name: "- Giá trị hao mòn lũy kế (*)",
          level: 3,
          formula: {
            creditBalance: ["2141"],
            negative: true,
          },
        },
        {
          code: "224",
          name: "2. Tài sản cố định thuê tài chính",
          level: 2,
          formula: {
            sum: ["225", "226"],
          },
        },
        {
          code: "225",
          name: "- Nguyên giá",
          level: 3,
          formula: {
            debitBalance: ["212"],
          },
        },
        {
          code: "226",
          name: "- Giá trị hao mòn lũy kế (*)",
          level: 3,
          formula: {
            creditBalance: ["2142"],
            negative: true,
          },
        },
        {
          code: "227",
          name: "3. Tài sản cố định vô hình",
          level: 2,
          formula: {
            sum: ["228", "229"],
          },
        },
        {
          code: "228",
          name: "- Nguyên giá",
          level: 3,
          formula: {
            debitBalance: ["213"],
          },
        },
        {
          code: "229",
          name: "- Giá trị hao mòn lũy kế (*)",
          level: 3,
          formula: {
            creditBalance: ["2143"],
            negative: true,
          },
        },
        {
          code: "230",
          name: "III. Tài sản sinh học dài hạn",
          level: 1,
          formula: {
            sum: ["231", "236", "237", "238"],
          },
        },
        {
          code: "231",
          name: "1. Súc vật nuôi cho sản phẩm định kỳ",
          level: 2,
          formula: {
            sum: ["232", "233"],
          },
        },
        {
          code: "232",
          name: "a) Súc vật nuôi cho sản phẩm định kỳ chưa đến giai đoạn trưởng thành",
          level: 3,
          formula: {
            debitBalance: ["21511"],
          },
        },
        {
          code: "233",
          name: "b) Súc vật nuôi cho sản phẩm định kỳ đến giai đoạn trưởng thành",
          level: 3,
          formula: {
            sum: ["234", "235"],
          },
        },
        {
          code: "234",
          name: "- Nguyên giá",
          level: 4,
          formula: {
            debitBalance: ["215121"],
          },
        },
        {
          code: "235",
          name: "- Giá trị khấu hao lũy kế (*)",
          level: 4,
          formula: {
            creditBalance: ["215122"],
            negative: true,
          },
          note: "Tài khoản nguồn suy ra từ danh mục phần mềm (TK 215122 'Giá trị khấu hao lũy kế'); bài hướng dẫn thứ cấp ghi số hiệu khác, chưa xác minh được với văn bản gốc. TK 215122 mang số dư Có dù TK cha 215 có tính chất dư Nợ.",
        },
        {
          code: "236",
          name: "2. Súc vật nuôi lấy sản phẩm một lần dài hạn",
          level: 2,
          longTermOf: "151",
          note: "Nguồn: số dư Nợ chi tiết TK 2152 phần dài hạn. Phần mềm chưa có thông tin kỳ hạn; mặc định toàn bộ số dư trình bày ở chỉ tiêu ngắn hạn tương ứng, chỉ tiêu dài hạn này để 0. Đề xuất: thêm cờ 'dài hạn' (hoặc ngày đáo hạn) cho đối tác/khế ước/tài khoản chi tiết để tách.",
        },
        {
          code: "237",
          name: "3. Cây trồng theo mùa vụ hoặc lấy sản phẩm một lần dài hạn",
          level: 2,
          longTermOf: "152",
          note: "Nguồn: số dư Nợ chi tiết TK 2153 phần dài hạn. Phần mềm chưa có thông tin kỳ hạn; mặc định toàn bộ số dư trình bày ở chỉ tiêu ngắn hạn tương ứng, chỉ tiêu dài hạn này để 0. Đề xuất: thêm cờ 'dài hạn' (hoặc ngày đáo hạn) cho đối tác/khế ước/tài khoản chi tiết để tách.",
        },
        {
          code: "238",
          name: "4. Dự phòng tổn thất tài sản sinh học dài hạn (*)",
          level: 2,
          longTermOf: "153",
          note: "Nguồn: số dư Có chi tiết TK 2295 phần dài hạn. Mặc định 0.",
        },
        {
          code: "240",
          name: "IV. Bất động sản đầu tư",
          level: 1,
          formula: {
            sum: ["241", "242"],
          },
        },
        {
          code: "241",
          name: "- Nguyên giá",
          level: 3,
          formula: {
            debitBalance: ["217"],
          },
        },
        {
          code: "242",
          name: "- Giá trị hao mòn lũy kế (*)",
          level: 3,
          formula: {
            creditBalance: ["2147"],
            negative: true,
          },
        },
        {
          code: "250",
          name: "V. Tài sản dở dang dài hạn",
          level: 1,
          formula: {
            sum: ["251", "252"],
          },
        },
        {
          code: "251",
          name: "1. Chi phí sản xuất, kinh doanh dở dang dài hạn",
          level: 2,
          note: "Nguồn: số dư Nợ chi tiết TK 154 phần dài hạn trừ dự phòng (số dư Có chi tiết 2294 tương ứng). Mặc định 0, toàn bộ 154 ở 141.",
        },
        {
          code: "252",
          name: "2. Chi phí xây dựng cơ bản dở dang",
          level: 2,
          formula: {
            debitBalance: ["241"],
          },
        },
        {
          code: "260",
          name: "VI. Đầu tư tài chính dài hạn",
          level: 1,
          formula: {
            sum: ["261", "262", "263", "264", "265", "266"],
          },
        },
        {
          code: "261",
          name: "1. Đầu tư vào công ty con",
          level: 2,
          formula: {
            debitBalance: ["221"],
          },
        },
        {
          code: "262",
          name: "2. Đầu tư vào công ty liên doanh, liên kết",
          level: 2,
          formula: {
            debitBalance: ["222"],
          },
        },
        {
          code: "263",
          name: "3. Đầu tư góp vốn vào đơn vị khác",
          level: 2,
          formula: {
            debitBalance: ["2281"],
          },
          note: "Gồm cả phần BCC ngắn hạn lẽ ra ở 125 (phần mềm chưa tách).",
        },
        {
          code: "264",
          name: "4. Dự phòng tổn thất đầu tư vào đơn vị khác dài hạn (*)",
          level: 2,
          formula: {
            creditBalance: ["2292"],
            negative: true,
          },
          note: "Mặc định toàn bộ TK 2292 ở đây (124, 126, 266 để 0).",
        },
        {
          code: "265",
          name: "5. Đầu tư nắm giữ đến ngày đáo hạn dài hạn",
          level: 2,
          longTermOf: "123",
          note: "Nguồn: số dư Nợ chi tiết TK 128 (1281, 1282, 1283, 1288) phần kỳ hạn còn lại trên 12 tháng. Phần mềm chưa có thông tin kỳ hạn; mặc định toàn bộ số dư trình bày ở chỉ tiêu ngắn hạn tương ứng, chỉ tiêu dài hạn này để 0. Đề xuất: thêm cờ 'dài hạn' (hoặc ngày đáo hạn) cho đối tác/khế ước/tài khoản chi tiết để tách.",
        },
        {
          code: "266",
          name: "6. Dự phòng đầu tư nắm giữ đến ngày đáo hạn dài hạn (*)",
          level: 2,
          note: "Tài khoản nguồn chưa xác minh được (xem 124). Mặc định 0.",
        },
        {
          code: "270",
          name: "VII. Tài sản dài hạn khác",
          level: 1,
          formula: {
            sum: ["271", "272", "273", "274"],
          },
        },
        {
          code: "271",
          name: "1. Chi phí chờ phân bổ dài hạn",
          level: 2,
          longTermOf: "161",
          note: "Nguồn: số dư Nợ chi tiết TK 242 phần phân bổ trên 12 tháng. Phần mềm chưa có thông tin kỳ hạn; mặc định toàn bộ số dư trình bày ở chỉ tiêu ngắn hạn tương ứng, chỉ tiêu dài hạn này để 0. Đề xuất: thêm cờ 'dài hạn' (hoặc ngày đáo hạn) cho đối tác/khế ước/tài khoản chi tiết để tách.",
        },
        {
          code: "272",
          name: "2. Tài sản thuế thu nhập hoãn lại",
          level: 2,
          formula: {
            debitBalance: ["243"],
          },
          note: "Nếu đủ điều kiện bù trừ với thuế thu nhập hoãn lại phải trả (347) thì trình bày thuần; phần mềm chưa hỗ trợ bù trừ.",
        },
        {
          code: "273",
          name: "3. Thiết bị, vật tư, phụ tùng thay thế dài hạn",
          level: 2,
          note: "Nguồn: số dư Nợ chi tiết TK 153 (phụ tùng, thiết bị dự trữ dài hạn) trừ dự phòng 2294 tương ứng. Mặc định 0, toàn bộ 153 ở 141.",
        },
        {
          code: "274",
          name: "4. Tài sản dài hạn khác",
          level: 2,
          longTermOf: "165",
          note: "Nguồn: số dư Nợ chi tiết TK 2288 phần dài hạn và tiền bị hạn chế sử dụng dài hạn. Mặc định 0, toàn bộ 2288 ở 165.",
        },
        {
          code: "280",
          name: "TỔNG CỘNG TÀI SẢN (280 = 100 + 200)",
          level: 0,
          formula: {
            sum: ["100", "200"],
          },
        },
        {
          code: "300",
          name: "C - NỢ PHẢI TRẢ",
          level: 0,
          formula: {
            sum: ["310", "330"],
          },
        },
        {
          code: "310",
          name: "I. Nợ ngắn hạn",
          level: 1,
          formula: {
            sum: ["311", "312", "313", "314", "315", "316", "317", "318", "319", "320", "321", "322", "323", "324", "325"],
          },
        },
        {
          code: "311",
          name: "1. Phải trả người bán ngắn hạn",
          level: 2,
          formula: {
            creditBalanceByPartner: ["331"],
          },
          note: "Mặc định toàn bộ là ngắn hạn (xem 331).",
        },
        {
          code: "312",
          name: "2. Người mua trả tiền trước ngắn hạn",
          level: 2,
          formula: {
            creditBalanceByPartner: ["131"],
          },
          note: "Mặc định toàn bộ là ngắn hạn (xem 332).",
        },
        {
          code: "313",
          name: "3. Phải trả cổ tức, lợi nhuận",
          level: 2,
          formula: {
            creditBalance: ["332"],
          },
        },
        {
          code: "314",
          name: "4. Thuế và các khoản phải nộp Nhà nước ngắn hạn",
          level: 2,
          formula: {
            creditBalance: ["33311", "33312", "3332", "3333", "3334", "3335", "3336", "3337", "33381", "33382", "3339"],
          },
          note: "Số dư Có chi tiết TK 333; đối xứng với 163. Mặc định toàn bộ là ngắn hạn (xem 333).",
        },
        {
          code: "315",
          name: "5. Phải trả người lao động",
          level: 2,
          formula: {
            creditBalanceByPartner: ["334"],
          },
          note: "Đối xứng với phần 334 ở chỉ tiêu 135.",
        },
        {
          code: "316",
          name: "6. Chi phí phải trả ngắn hạn",
          level: 2,
          formula: {
            creditBalance: ["335"],
          },
          note: "Mặc định toàn bộ là ngắn hạn (xem 334).",
        },
        {
          code: "317",
          name: "7. Phải trả nội bộ ngắn hạn",
          level: 2,
          formula: {
            creditBalance: ["3362", "3363", "3368"],
          },
          note: "Mặc định toàn bộ là ngắn hạn (xem 336).",
        },
        {
          code: "318",
          name: "8. Phải trả theo tiến độ hợp đồng xây dựng ngắn hạn",
          level: 2,
          formula: {
            creditBalance: ["337"],
          },
        },
        {
          code: "319",
          name: "9. Doanh thu chờ phân bổ ngắn hạn",
          level: 2,
          formula: {
            creditBalance: ["3387"],
          },
          note: "Mặc định toàn bộ là ngắn hạn (xem 337).",
        },
        {
          code: "320",
          name: "10. Phải trả ngắn hạn khác",
          level: 2,
          formula: {
            creditBalanceByPartner: ["3381", "3382", "3383", "3384", "3386", "3388", "344", "1388"],
          },
          note: "Nguồn văn bản (bài hướng dẫn thứ cấp): số dư Có chi tiết TK 338, 344. Thêm số dư Có chi tiết theo đối tác TK 1388 theo thông lệ Thông tư 200 và Thông tư 133 (chưa xác minh với Phụ lục IV Thông tư 99) để đối xứng với 135 và giữ cân đối. Mặc định toàn bộ là ngắn hạn (xem 338).",
        },
        {
          code: "321",
          name: "11. Vay và nợ thuê tài chính ngắn hạn",
          level: 2,
          formula: {
            creditBalance: ["3411", "3412"],
          },
          note: "Nguồn: số dư Có chi tiết TK 341 (và phần trái phiếu TK 343 đến hạn trong 12 tháng). Mặc định toàn bộ 341 ở đây; trái phiếu thường 3431 mặc định ở 339.",
        },
        {
          code: "322",
          name: "12. Dự phòng phải trả ngắn hạn",
          level: 2,
          formula: {
            creditBalance: ["352"],
          },
          note: "Mặc định toàn bộ là ngắn hạn (xem 343).",
        },
        {
          code: "323",
          name: "13. Quỹ khen thưởng, phúc lợi",
          level: 2,
          formula: {
            creditBalance: ["353"],
          },
        },
        {
          code: "324",
          name: "14. Quỹ bình ổn giá",
          level: 2,
          formula: {
            creditBalance: ["357"],
          },
        },
        {
          code: "325",
          name: "15. Giao dịch mua bán lại trái phiếu Chính phủ",
          level: 2,
          formula: {
            creditBalance: ["171"],
          },
        },
        {
          code: "330",
          name: "II. Nợ dài hạn",
          level: 1,
          formula: {
            sum: ["331", "332", "333", "334", "335", "336", "337", "338", "339", "340", "341", "342", "343", "344"],
          },
        },
        {
          code: "331",
          name: "1. Phải trả người bán dài hạn",
          level: 2,
          longTermOf: "311",
          note: "Nguồn: tổng số dư Có chi tiết TK 331 theo người bán, phần dài hạn. Phần mềm chưa có thông tin kỳ hạn; mặc định toàn bộ số dư trình bày ở chỉ tiêu ngắn hạn tương ứng, chỉ tiêu dài hạn này để 0. Đề xuất: thêm cờ 'dài hạn' (hoặc ngày đáo hạn) cho đối tác/khế ước/tài khoản chi tiết để tách.",
        },
        {
          code: "332",
          name: "2. Người mua trả tiền trước dài hạn",
          level: 2,
          longTermOf: "312",
          note: "Nguồn: tổng số dư Có chi tiết TK 131 theo khách hàng, phần dài hạn. Phần mềm chưa có thông tin kỳ hạn; mặc định toàn bộ số dư trình bày ở chỉ tiêu ngắn hạn tương ứng, chỉ tiêu dài hạn này để 0. Đề xuất: thêm cờ 'dài hạn' (hoặc ngày đáo hạn) cho đối tác/khế ước/tài khoản chi tiết để tách.",
        },
        {
          code: "333",
          name: "3. Thuế và các khoản phải nộp Nhà nước dài hạn",
          level: 2,
          longTermOf: "314",
          note: "Nguồn: số dư Có chi tiết TK 333 phần dài hạn, như thuế TNDN bổ sung theo quy định thuế tối thiểu toàn cầu. Đề xuất đơn giản: nếu cần, lấy số dư Có TK 33382 khi xác định là dài hạn; mặc định 0.",
        },
        {
          code: "334",
          name: "4. Chi phí phải trả dài hạn",
          level: 2,
          longTermOf: "316",
          note: "Nguồn: số dư Có chi tiết TK 335 phần dài hạn. Phần mềm chưa có thông tin kỳ hạn; mặc định toàn bộ số dư trình bày ở chỉ tiêu ngắn hạn tương ứng, chỉ tiêu dài hạn này để 0. Đề xuất: thêm cờ 'dài hạn' (hoặc ngày đáo hạn) cho đối tác/khế ước/tài khoản chi tiết để tách.",
        },
        {
          code: "335",
          name: "5. Phải trả nội bộ về vốn kinh doanh",
          level: 2,
          formula: {
            creditBalance: ["3361"],
          },
        },
        {
          code: "336",
          name: "6. Phải trả nội bộ dài hạn",
          level: 2,
          longTermOf: "317",
          note: "Nguồn: số dư Có chi tiết TK 3362, 3363, 3368 phần dài hạn. Phần mềm chưa có thông tin kỳ hạn; mặc định toàn bộ số dư trình bày ở chỉ tiêu ngắn hạn tương ứng, chỉ tiêu dài hạn này để 0. Đề xuất: thêm cờ 'dài hạn' (hoặc ngày đáo hạn) cho đối tác/khế ước/tài khoản chi tiết để tách.",
        },
        {
          code: "337",
          name: "7. Doanh thu chờ phân bổ dài hạn",
          level: 2,
          longTermOf: "319",
          note: "Nguồn: số dư Có chi tiết TK 3387 phần dài hạn. Phần mềm chưa có thông tin kỳ hạn; mặc định toàn bộ số dư trình bày ở chỉ tiêu ngắn hạn tương ứng, chỉ tiêu dài hạn này để 0. Đề xuất: thêm cờ 'dài hạn' (hoặc ngày đáo hạn) cho đối tác/khế ước/tài khoản chi tiết để tách.",
        },
        {
          code: "338",
          name: "8. Phải trả dài hạn khác",
          level: 2,
          longTermOf: "320",
          note: "Nguồn: số dư Có chi tiết TK 338, 344 phần dài hạn. Phần mềm chưa có thông tin kỳ hạn; mặc định toàn bộ số dư trình bày ở chỉ tiêu ngắn hạn tương ứng, chỉ tiêu dài hạn này để 0. Đề xuất: thêm cờ 'dài hạn' (hoặc ngày đáo hạn) cho đối tác/khế ước/tài khoản chi tiết để tách.",
        },
        {
          code: "339",
          name: "9. Vay và nợ thuê tài chính dài hạn",
          level: 2,
          formula: {
            creditBalance: ["3431"],
          },
          note: "Nguồn: số dư Có chi tiết TK 341 phần dài hạn và TK 343 (trái phiếu thường). Mặc định: 341 ở 321; trái phiếu thường 3431 ở đây.",
        },
        {
          code: "340",
          name: "10. Trái phiếu chuyển đổi",
          level: 2,
          formula: {
            creditBalance: ["3432"],
          },
        },
        {
          code: "341",
          name: "11. Cổ phiếu ưu đãi",
          level: 2,
          note: "Cổ phiếu ưu đãi được phân loại là nợ phải trả (số dư Có chi tiết TK 41112 phần phân loại là nợ). Phần mềm chưa phân loại; mặc định 0, toàn bộ 41112 ở 411b.",
        },
        {
          code: "342",
          name: "12. Thuế thu nhập hoãn lại phải trả",
          level: 2,
          formula: {
            creditBalance: ["347"],
          },
        },
        {
          code: "343",
          name: "13. Dự phòng phải trả dài hạn",
          level: 2,
          longTermOf: "322",
          note: "Nguồn: số dư Có chi tiết TK 352 phần dài hạn. Phần mềm chưa có thông tin kỳ hạn; mặc định toàn bộ số dư trình bày ở chỉ tiêu ngắn hạn tương ứng, chỉ tiêu dài hạn này để 0. Đề xuất: thêm cờ 'dài hạn' (hoặc ngày đáo hạn) cho đối tác/khế ước/tài khoản chi tiết để tách.",
        },
        {
          code: "344",
          name: "14. Quỹ phát triển khoa học và công nghệ",
          level: 2,
          formula: {
            creditBalance: ["356"],
          },
        },
        {
          code: "400",
          name: "D - VỐN CHỦ SỞ HỮU",
          level: 0,
          formula: {
            sum: ["411", "412", "413", "414", "415", "416", "417", "418", "419", "420"],
          },
        },
        {
          code: "411",
          name: "1. Vốn góp của chủ sở hữu",
          level: 2,
          formula: {
            creditBalance: ["4111"],
          },
          note: "Chỉ lấy TK 4111 (không lấy TK cha 411, vì 4112, 4113, 4118 trình bày ở 412-414). Công ty không phải công ty cổ phần không trình bày 411a, 411b.",
        },
        {
          code: "411a",
          name: "- Cổ phiếu phổ thông có quyền biểu quyết",
          level: 3,
          formula: {
            creditBalance: ["41111"],
          },
          note: "Chỉ dòng chi tiết, không cộng thêm vào 400.",
        },
        {
          code: "411b",
          name: "- Cổ phiếu ưu đãi",
          level: 3,
          formula: {
            creditBalance: ["41112"],
          },
          note: "Chỉ dòng chi tiết, không cộng thêm vào 400.",
        },
        {
          code: "412",
          name: "2. Thặng dư vốn",
          level: 2,
          formula: {
            netBalance: ["4112"],
            negative: true,
          },
          note: "Số dư Có; nếu dư Nợ ghi số âm.",
        },
        {
          code: "413",
          name: "3. Quyền chọn chuyển đổi trái phiếu",
          level: 2,
          formula: {
            creditBalance: ["4113"],
          },
        },
        {
          code: "414",
          name: "4. Vốn khác của chủ sở hữu",
          level: 2,
          formula: {
            creditBalance: ["4118"],
          },
        },
        {
          code: "415",
          name: "5. Cổ phiếu mua lại của chính mình (*)",
          level: 2,
          formula: {
            debitBalance: ["419"],
            negative: true,
          },
        },
        {
          code: "416",
          name: "6. Chênh lệch đánh giá lại tài sản",
          level: 2,
          formula: {
            netBalance: ["412"],
            negative: true,
          },
          note: "Số dư Có; nếu dư Nợ ghi số âm.",
        },
        {
          code: "417",
          name: "7. Chênh lệch tỷ giá hối đoái",
          level: 2,
          formula: {
            netBalance: ["413"],
            negative: true,
          },
          note: "Số dư Có; nếu dư Nợ ghi số âm.",
        },
        {
          code: "418",
          name: "8. Quỹ đầu tư phát triển",
          level: 2,
          formula: {
            creditBalance: ["414"],
          },
        },
        {
          code: "419",
          name: "9. Quỹ khác thuộc vốn chủ sở hữu",
          level: 2,
          formula: {
            creditBalance: ["418"],
          },
        },
        {
          code: "420",
          name: "10. Lợi nhuận sau thuế chưa phân phối",
          level: 2,
          formula: {
            sum: ["420a", "420b"],
          },
        },
        {
          code: "420a",
          name: "- LNST chưa phân phối lũy kế đến cuối kỳ trước",
          level: 3,
          formula: {
            netBalance: ["4211"],
            negative: true,
          },
          note: "Báo cáo năm: số dư TK 4211 (dư Nợ ghi âm). Báo cáo quý: số dư 4211 cộng phần 4212 lũy kế từ đầu năm đến đầu kỳ báo cáo; phần mềm cần số dư 4212 đầu kỳ để chuyển sang đây.",
        },
        {
          code: "420b",
          name: "- LNST chưa phân phối kỳ này",
          level: 3,
          formula: {
            netBalance: ["4212"],
            negative: true,
          },
          note: "Báo cáo năm: số dư TK 4212. Báo cáo quý: chỉ phần phát sinh trong quý. Phải kết chuyển 911 sang 4212 trước khi lập, nếu không tổng tài sản sẽ lệch tổng nguồn vốn.",
        },
        {
          code: "440",
          name: "TỔNG CỘNG NGUỒN VỐN (440 = 300 + 400)",
          level: 0,
          formula: {
            sum: ["300", "400"],
          },
        },
      ],
    },
    incomeStatement: {
      form: "B02-DN",
      name: "Báo cáo kết quả hoạt động kinh doanh",
      lines: [
        {
          code: "01",
          name: "1. Doanh thu bán hàng và cung cấp dịch vụ",
          level: 1,
          formula: {
            creditTurnover: ["511"],
            excludeCounter: ["521", "911"],
          },
          note: "Lũy kế phát sinh Có TK 511. Không gồm doanh thu bán, thanh lý BĐSĐT (trình bày ở 21); danh mục chưa có tài khoản chi tiết để tách, mặc định gồm cả.",
        },
        {
          code: "02",
          name: "2. Các khoản giảm trừ doanh thu",
          level: 1,
          formula: {
            debitTurnover: ["511"],
            counter: ["521"],
          },
          note: "Phát sinh Nợ TK 511 đối ứng Có TK 521 (kết chuyển giảm trừ). Nếu chưa kết chuyển 521 cuối kỳ, số liệu bằng 0; khi đó có thể thay bằng phát sinh Nợ TK 521 trừ đối ứng 511.",
        },
        {
          code: "10",
          name: "3. Doanh thu thuần về bán hàng và cung cấp dịch vụ (10 = 01 - 02)",
          level: 0,
          formula: {
            sum: ["01"],
            minus: ["02"],
          },
        },
        {
          code: "11",
          name: "4. Giá vốn hàng bán",
          level: 1,
          formula: {
            creditTurnover: ["632"],
            counter: ["911"],
          },
          note: "Không gồm giá trị còn lại và chi phí bán, thanh lý BĐSĐT (trình bày ở 21); mặc định gồm cả.",
        },
        {
          code: "20",
          name: "5. Lợi nhuận gộp về bán hàng và cung cấp dịch vụ (20 = 10 - 11)",
          level: 0,
          formula: {
            sum: ["10"],
            minus: ["11"],
          },
        },
        {
          code: "21",
          name: "6. Lãi/lỗ của hoạt động bán, thanh lý bất động sản đầu tư",
          level: 1,
          note: "Mới so với Thông tư 200: chênh lệch doanh thu bán, thanh lý BĐSĐT với giá trị còn lại và chi phí bán, thanh lý (dương nếu lãi, âm nếu lỗ). Văn bản lấy từ chi tiết TK 511 và 632 phần BĐSĐT. Danh mục chưa có tài khoản chi tiết; mặc định 0. Đề xuất: thêm TK chi tiết 511x/632x (hoặc thẻ 'BĐSĐT') rồi đặt 21 = phần 511 BĐSĐT trừ phần 632 BĐSĐT và loại phần đó khỏi 01, 11.",
        },
        {
          code: "22",
          name: "7. Doanh thu hoạt động tài chính",
          level: 1,
          formula: {
            debitTurnover: ["515"],
            counter: ["911"],
          },
          note: "Lãi thuần chênh lệch tỷ giá đánh giá lại cuối kỳ trình bày thuần (ở 22 nếu lãi > lỗ, ở 23 nếu lỗ > lãi); phần mềm chưa bù trừ.",
        },
        {
          code: "23",
          name: "8. Chi phí tài chính",
          level: 1,
          formula: {
            creditTurnover: ["635"],
            counter: ["911"],
          },
        },
        {
          code: "24",
          name: "- Trong đó: Chi phí đi vay",
          level: 2,
          note: "Căn cứ sổ chi tiết TK 635 phần chi phí đi vay. Danh mục không có tài khoản chi tiết của 635; mặc định 0. Đề xuất: thêm TK chi tiết (ví dụ 6351) hoặc thẻ 'chi phí đi vay' trên bút toán. Chỉ là dòng 'trong đó', không tham gia công thức 30.",
        },
        {
          code: "25",
          name: "9. Chi phí bán hàng",
          level: 1,
          formula: {
            creditTurnover: ["641"],
            counter: ["911"],
          },
        },
        {
          code: "26",
          name: "10. Chi phí quản lý doanh nghiệp",
          level: 1,
          formula: {
            creditTurnover: ["642"],
            counter: ["911"],
          },
        },
        {
          code: "30",
          name: "11. Lợi nhuận thuần từ hoạt động kinh doanh {30 = 20 + 21 + 22 - (23 + 25 + 26)}",
          level: 0,
          formula: {
            sum: ["20", "21", "22"],
            minus: ["23", "25", "26"],
          },
        },
        {
          code: "31",
          name: "12. Thu nhập khác",
          level: 1,
          formula: {
            debitTurnover: ["711"],
            counter: ["911"],
          },
          note: "Riêng thanh lý, nhượng bán TSCĐ chỉ ghi phần chênh lệch thu lớn hơn giá trị còn lại và chi phí thanh lý; phần mềm chưa bù trừ, mặc định lấy toàn bộ phát sinh.",
        },
        {
          code: "32",
          name: "13. Chi phí khác",
          level: 1,
          formula: {
            creditTurnover: ["811"],
            counter: ["911"],
          },
          note: "Xem ghi chú 31 về thanh lý TSCĐ.",
        },
        {
          code: "40",
          name: "14. Lợi nhuận khác (40 = 31 - 32)",
          level: 0,
          formula: {
            sum: ["31"],
            minus: ["32"],
          },
        },
        {
          code: "50",
          name: "15. Tổng lợi nhuận kế toán trước thuế (50 = 30 + 40)",
          level: 0,
          formula: {
            sum: ["30", "40"],
          },
        },
        {
          code: "51",
          name: "16. Chi phí thuế TNDN hiện hành",
          level: 1,
          formula: {
            creditTurnover: ["8211"],
            counter: ["911"],
            subtract: {
              debitTurnover: ["8211"],
              counter: ["911"],
            },
          },
          note: "Phát sinh Có 8211 đối ứng Nợ 911; nếu phát sinh Nợ 8211 đối ứng Có 911 thì ghi số âm. Khóa 'subtract' là đề xuất mở rộng quy ước (trừ đi phần tính theo khóa con); nếu bộ máy chưa hỗ trợ thì bỏ và chấp nhận thiếu trường hợp ghi âm.",
        },
        {
          code: "52",
          name: "17. Chi phí thuế TNDN hoãn lại",
          level: 1,
          formula: {
            creditTurnover: ["8212"],
            counter: ["911"],
            subtract: {
              debitTurnover: ["8212"],
              counter: ["911"],
            },
          },
          note: "Như 51, với TK 8212.",
        },
        {
          code: "60",
          name: "18. Lợi nhuận sau thuế thu nhập doanh nghiệp (60 = 50 - 51 - 52)",
          level: 0,
          formula: {
            sum: ["50"],
            minus: ["51", "52"],
          },
        },
        {
          code: "70",
          name: "19. Lãi cơ bản trên cổ phiếu (*)",
          level: 1,
          note: "Chỉ áp dụng tại công ty cổ phần; cần số cổ phiếu phổ thông bình quân, phần mềm không có từ sổ cái. Nhập tay.",
        },
        {
          code: "71",
          name: "20. Lãi suy giảm trên cổ phiếu (*)",
          level: 1,
          note: "Chỉ áp dụng tại công ty cổ phần; nhập tay.",
        },
      ],
    },
    source:
      "Thông tư 99/2025/TT-BTC ngày 27/10/2025 của Bộ Tài chính, hiệu lực 01/01/2026, tình trạng: còn hiệu lực (tra Lawgical). Điều 17 (hệ thống BCTC, ký hiệu mẫu) đã đối chiếu nguyên văn. Biểu mẫu B01-DN, B02-DN (danh sách chỉ tiêu, mã số) lấy từ bản PDF Phụ lục IV phát tán trên mạng (docs.google.com, đầu trang ghi 'Kèm theo Thông tư số 99/2025/TT-BTC'), Phụ lục IV không có trong văn bản tra cứu. Cách lấy số liệu: tài liệu tập huấn 'Chế độ kế toán doanh nghiệp (Thông tư 99/2025/TT-BTC thay thế Thông tư 200/2014/TT-BTC)' của Bộ Tài chính (các chỉ tiêu 110, 123, 125, 126, 135, 137, 151-153, 163, 165, 215, 230-237, 263, 265, 274, 313, 333; B02 mã 01, 02, 11, 21), phần còn lại theo bài hướng dẫn thứ cấp helpact.misa.vn/kb/nguyen-tac-va-cach-lay-so-lieu-bang-can-doi-ke-toan-theo-thong-tu-99-2025-tt-btc và ketoanthienung.net/cach-lap-bao-cao-ket-qua-hoat-dong-kinh-doanh-theo-thong-tu-99.htm (có lỗi chép số hiệu, đã đối chiếu với danh mục tài khoản). Phải so với Phụ lục IV bản gốc trên Công báo trước khi phát hành.",
  },
  TT133: {
    balanceSheet: {
      form: "B01a-DNN",
      name: "Báo cáo tình hình tài chính",
      lines: [
        {
          code: "110",
          name: "1. Tiền và các khoản tương đương tiền",
          level: 1,
          formula: {
            debitBalance: ["111", "112"],
          },
          note: "Văn bản: tổng số dư Nợ TK 111, 112 và số dư Nợ chi tiết TK 1281 (kỳ hạn gốc không quá 3 tháng), 1288 (đủ tiêu chuẩn tương đương tiền). Phần mềm chưa có kỳ hạn gốc; mặc định không lấy 1281, 1288 (trình bày ở 122).",
        },
        {
          code: "120",
          name: "2. Đầu tư tài chính",
          level: 1,
          formula: {
            sum: ["121", "122", "123", "124"],
          },
        },
        {
          code: "121",
          name: "a) Chứng khoán kinh doanh",
          level: 2,
          formula: {
            debitBalance: ["121"],
          },
        },
        {
          code: "122",
          name: "b) Đầu tư nắm giữ đến ngày đáo hạn",
          level: 2,
          formula: {
            debitBalance: ["1281", "1288"],
          },
          note: "Không gồm phần đã trình bày ở 110 và khoản cho vay (TK 1288 chi tiết cho vay) trình bày ở 134; phần mềm chưa tách, mặc định toàn bộ 1281, 1288 ở đây.",
        },
        {
          code: "123",
          name: "c) Đầu tư góp vốn vào đơn vị khác",
          level: 2,
          formula: {
            debitBalance: ["228"],
          },
        },
        {
          code: "124",
          name: "d) Dự phòng tổn thất đầu tư tài chính (*)",
          level: 2,
          formula: {
            creditBalance: ["2291", "2292"],
            negative: true,
          },
        },
        {
          code: "130",
          name: "3. Các khoản phải thu",
          level: 1,
          formula: {
            sum: ["131", "132", "133", "134", "135", "136"],
          },
        },
        {
          code: "131",
          name: "a) Phải thu của khách hàng",
          level: 2,
          formula: {
            debitBalanceByPartner: ["131"],
          },
        },
        {
          code: "132",
          name: "b) Trả trước cho người bán",
          level: 2,
          formula: {
            debitBalanceByPartner: ["331"],
          },
        },
        {
          code: "133",
          name: "c) Vốn kinh doanh ở đơn vị trực thuộc",
          level: 2,
          formula: {
            debitBalance: ["1361"],
          },
        },
        {
          code: "134",
          name: "d) Phải thu khác",
          level: 2,
          formula: {
            debitBalanceByPartner: ["1368", "1386", "1388", "334", "3381", "3382", "3383", "3384", "3385", "3386", "3387", "3388", "141"],
          },
          note: "Văn bản: số dư Nợ chi tiết TK 1288 (phải thu về cho vay), 1368, 1386, 1388, 334, 338, 141. Phần 1288 cho vay chưa tách (mặc định ở 122). Lấy theo đối tác; tài khoản không theo dõi đối tác thì lấy số dư Nợ của tài khoản.",
        },
        {
          code: "135",
          name: "đ) Tài sản thiếu chờ xử lý",
          level: 2,
          formula: {
            debitBalance: ["1381"],
          },
        },
        {
          code: "136",
          name: "e) Dự phòng phải thu khó đòi (*)",
          level: 2,
          formula: {
            creditBalance: ["2293"],
            negative: true,
          },
        },
        {
          code: "140",
          name: "4. Hàng tồn kho",
          level: 1,
          formula: {
            sum: ["141", "142"],
          },
        },
        {
          code: "141",
          name: "a) Hàng tồn kho",
          level: 2,
          formula: {
            debitBalance: ["151", "152", "153", "154", "155", "156", "157"],
          },
        },
        {
          code: "142",
          name: "b) Dự phòng giảm giá hàng tồn kho (*)",
          level: 2,
          formula: {
            creditBalance: ["2294"],
            negative: true,
          },
        },
        {
          code: "150",
          name: "5. Tài sản cố định",
          level: 1,
          formula: {
            sum: ["151", "152"],
          },
        },
        {
          code: "151",
          name: "- Nguyên giá",
          level: 2,
          formula: {
            debitBalance: ["211"],
          },
        },
        {
          code: "152",
          name: "- Giá trị hao mòn lũy kế (*)",
          level: 2,
          formula: {
            creditBalance: ["2141", "2142", "2143"],
            negative: true,
          },
        },
        {
          code: "160",
          name: "6. Bất động sản đầu tư",
          level: 1,
          formula: {
            sum: ["161", "162"],
          },
        },
        {
          code: "161",
          name: "- Nguyên giá",
          level: 2,
          formula: {
            debitBalance: ["217"],
          },
        },
        {
          code: "162",
          name: "- Giá trị hao mòn lũy kế (*)",
          level: 2,
          formula: {
            creditBalance: ["2147"],
            negative: true,
          },
        },
        {
          code: "170",
          name: "7. Xây dựng cơ bản dở dang",
          level: 1,
          formula: {
            debitBalance: ["241"],
          },
        },
        {
          code: "180",
          name: "8. Tài sản khác",
          level: 1,
          formula: {
            sum: ["181", "182"],
          },
        },
        {
          code: "181",
          name: "a) Thuế giá trị gia tăng được khấu trừ",
          level: 2,
          formula: {
            debitBalance: ["133"],
          },
        },
        {
          code: "182",
          name: "b) Tài sản khác",
          level: 2,
          formula: {
            debitBalance: ["242", "33311", "33312", "3332", "3333", "3334", "3335", "3336", "3337", "3338", "3339"],
          },
          note: "Số dư Nợ chi tiết TK 242, 333 (liệt kê tài khoản chi tiết cuối của 333, đối xứng với 313).",
        },
        {
          code: "200",
          name: "TỔNG CỘNG TÀI SẢN (200 = 110 + 120 + 130 + 140 + 150 + 160 + 170 + 180)",
          level: 0,
          formula: {
            sum: ["110", "120", "130", "140", "150", "160", "170", "180"],
          },
        },
        {
          code: "300",
          name: "I. NỢ PHẢI TRẢ",
          level: 0,
          formula: {
            sum: ["311", "312", "313", "314", "315", "316", "317", "318", "319", "320"],
          },
        },
        {
          code: "311",
          name: "1. Phải trả người bán",
          level: 1,
          formula: {
            creditBalanceByPartner: ["331"],
          },
        },
        {
          code: "312",
          name: "2. Người mua trả tiền trước",
          level: 1,
          formula: {
            creditBalanceByPartner: ["131"],
          },
        },
        {
          code: "313",
          name: "3. Thuế và các khoản phải nộp Nhà nước",
          level: 1,
          formula: {
            creditBalance: ["33311", "33312", "3332", "3333", "3334", "3335", "3336", "3337", "3338", "3339"],
          },
        },
        {
          code: "314",
          name: "4. Phải trả người lao động",
          level: 1,
          formula: {
            creditBalanceByPartner: ["334"],
          },
        },
        {
          code: "315",
          name: "5. Phải trả khác",
          level: 1,
          formula: {
            creditBalance: ["335"],
            creditBalanceByPartner: ["3368", "3381", "3382", "3383", "3384", "3385", "3386", "3387", "3388", "1388"],
          },
          note: "Văn bản: số dư Có chi tiết TK 335, 3368, 338, 1388.",
        },
        {
          code: "316",
          name: "6. Vay và nợ thuê tài chính",
          level: 1,
          formula: {
            creditBalance: ["341"],
          },
          note: "Văn bản: số dư Có chi tiết TK 341 và TK 4111 phần cổ phiếu ưu đãi phân loại là nợ phải trả; phần mềm chưa phân loại, mặc định toàn bộ 4111 ở 411.",
        },
        {
          code: "317",
          name: "7. Phải trả nội bộ về vốn kinh doanh",
          level: 1,
          formula: {
            creditBalance: ["3361"],
          },
        },
        {
          code: "318",
          name: "8. Dự phòng phải trả",
          level: 1,
          formula: {
            creditBalance: ["352"],
          },
        },
        {
          code: "319",
          name: "9. Quỹ khen thưởng, phúc lợi",
          level: 1,
          formula: {
            creditBalance: ["353"],
          },
        },
        {
          code: "320",
          name: "10. Quỹ phát triển khoa học và công nghệ",
          level: 1,
          formula: {
            creditBalance: ["356"],
          },
        },
        {
          code: "400",
          name: "II. VỐN CHỦ SỞ HỮU",
          level: 0,
          formula: {
            sum: ["411", "412", "413", "414", "415", "416", "417"],
          },
        },
        {
          code: "411",
          name: "1. Vốn góp của chủ sở hữu",
          level: 1,
          formula: {
            creditBalance: ["4111"],
          },
        },
        {
          code: "412",
          name: "2. Thặng dư vốn cổ phần",
          level: 1,
          formula: {
            netBalance: ["4112"],
            negative: true,
          },
          note: "Số dư Có; dư Nợ ghi số âm.",
        },
        {
          code: "413",
          name: "3. Vốn khác của chủ sở hữu",
          level: 1,
          formula: {
            creditBalance: ["4118"],
          },
        },
        {
          code: "414",
          name: "4. Cổ phiếu quỹ (*)",
          level: 1,
          formula: {
            debitBalance: ["419"],
            negative: true,
          },
        },
        {
          code: "415",
          name: "5. Chênh lệch tỷ giá hối đoái",
          level: 1,
          formula: {
            netBalance: ["413"],
            negative: true,
          },
          note: "Văn bản chỉ nêu nội dung (chênh lệch do chuyển đổi BCTC khi đơn vị tiền tệ kế toán khác VND), không nêu tài khoản. Đề xuất lấy số dư TK 413 (dư Có dương, dư Nợ âm) để giữ cân đối; với doanh nghiệp dùng VND, TK 413 phải được xử lý hết cuối năm nên thường bằng 0.",
        },
        {
          code: "416",
          name: "6. Các quỹ thuộc vốn chủ sở hữu",
          level: 1,
          formula: {
            creditBalance: ["418"],
          },
        },
        {
          code: "417",
          name: "7. Lợi nhuận sau thuế chưa phân phối",
          level: 1,
          formula: {
            netBalance: ["421"],
            negative: true,
          },
          note: "Số dư Có TK 421; dư Nợ ghi số âm. Phải kết chuyển 911 trước khi lập.",
        },
        {
          code: "500",
          name: "TỔNG CỘNG NGUỒN VỐN (500 = 300 + 400)",
          level: 0,
          formula: {
            sum: ["300", "400"],
          },
        },
      ],
    },
    balanceSheetB01b: {
      form: "B01b-DNN",
      name: "Báo cáo tình hình tài chính (có phân ngắn hạn, dài hạn)",
      lines: [
        {
          code: "100",
          name: "A - TÀI SẢN NGẮN HẠN",
          level: 0,
          formula: {
            sum: ["110", "120", "130", "140", "150"],
          },
        },
        {
          code: "110",
          name: "I. Tiền và các khoản tương đương tiền",
          level: 1,
          formula: {
            debitBalance: ["111", "112"],
          },
          note: "Như B01a-DNN mã 110.",
        },
        {
          code: "120",
          name: "II. Đầu tư tài chính ngắn hạn",
          level: 1,
          formula: {
            sum: ["121", "122", "123"],
          },
        },
        {
          code: "121",
          name: "1. Chứng khoán kinh doanh",
          level: 2,
          formula: {
            debitBalance: ["121"],
          },
        },
        {
          code: "122",
          name: "2. Dự phòng giảm giá chứng khoán kinh doanh (*)",
          level: 2,
          formula: {
            creditBalance: ["2291"],
            negative: true,
          },
        },
        {
          code: "123",
          name: "3. Đầu tư nắm giữ đến ngày đáo hạn ngắn hạn",
          level: 2,
          formula: {
            debitBalance: ["1281", "1288"],
          },
          note: "Mặc định toàn bộ là ngắn hạn (xem 253); phần cho vay chưa tách.",
        },
        {
          code: "130",
          name: "III. Các khoản phải thu ngắn hạn",
          level: 1,
          formula: {
            sum: ["131", "132", "133", "134", "135"],
          },
        },
        {
          code: "131",
          name: "1. Phải thu ngắn hạn của khách hàng",
          level: 2,
          formula: {
            debitBalanceByPartner: ["131"],
          },
        },
        {
          code: "132",
          name: "2. Trả trước cho người bán ngắn hạn",
          level: 2,
          formula: {
            debitBalanceByPartner: ["331"],
          },
        },
        {
          code: "133",
          name: "3. Phải thu ngắn hạn khác",
          level: 2,
          formula: {
            debitBalanceByPartner: ["1368", "1386", "1388", "334", "3381", "3382", "3383", "3384", "3385", "3386", "3387", "3388", "141"],
          },
          note: "Văn bản: số dư Nợ chi tiết TK 1288 (cho vay), 1368, 1386, 1388, 334, 338, 141.",
        },
        {
          code: "134",
          name: "4. Tài sản thiếu chờ xử lý",
          level: 2,
          formula: {
            debitBalance: ["1381"],
          },
        },
        {
          code: "135",
          name: "5. Dự phòng phải thu ngắn hạn khó đòi (*)",
          level: 2,
          formula: {
            creditBalance: ["2293"],
            negative: true,
          },
        },
        {
          code: "140",
          name: "IV. Hàng tồn kho",
          level: 1,
          formula: {
            sum: ["141", "142"],
          },
        },
        {
          code: "141",
          name: "1. Hàng tồn kho",
          level: 2,
          formula: {
            debitBalance: ["151", "152", "153", "154", "155", "156", "157"],
          },
        },
        {
          code: "142",
          name: "2. Dự phòng giảm giá hàng tồn kho (*)",
          level: 2,
          formula: {
            creditBalance: ["2294"],
            negative: true,
          },
        },
        {
          code: "150",
          name: "V. Tài sản ngắn hạn khác",
          level: 1,
          formula: {
            sum: ["151", "152"],
          },
        },
        {
          code: "151",
          name: "1. Thuế giá trị gia tăng được khấu trừ",
          level: 2,
          formula: {
            debitBalance: ["133"],
          },
        },
        {
          code: "152",
          name: "2. Tài sản ngắn hạn khác",
          level: 2,
          formula: {
            debitBalance: ["242", "33311", "33312", "3332", "3333", "3334", "3335", "3336", "3337", "3338", "3339"],
          },
          note: "Mặc định toàn bộ 242 là ngắn hạn (xem 260).",
        },
        {
          code: "200",
          name: "B - TÀI SẢN DÀI HẠN",
          level: 0,
          formula: {
            sum: ["210", "220", "230", "240", "250", "260"],
          },
        },
        {
          code: "210",
          name: "I. Các khoản phải thu dài hạn",
          level: 1,
          formula: {
            sum: ["211", "212", "213", "214", "215"],
          },
        },
        {
          code: "211",
          name: "1. Phải thu dài hạn của khách hàng",
          level: 2,
          longTermOf: "131",
          note: "Nguồn: tổng số dư Nợ chi tiết TK 131 phần dài hạn. Phần mềm chưa có thông tin kỳ hạn; mặc định toàn bộ số dư ở chỉ tiêu ngắn hạn tương ứng, chỉ tiêu dài hạn này để 0. Đề xuất: thêm cờ 'dài hạn' (hoặc ngày đáo hạn) cho đối tác/khế ước để tách.",
        },
        {
          code: "212",
          name: "2. Trả trước cho người bán dài hạn",
          level: 2,
          longTermOf: "132",
          note: "Nguồn: tổng số dư Nợ chi tiết TK 331 phần dài hạn. Phần mềm chưa có thông tin kỳ hạn; mặc định toàn bộ số dư ở chỉ tiêu ngắn hạn tương ứng, chỉ tiêu dài hạn này để 0. Đề xuất: thêm cờ 'dài hạn' (hoặc ngày đáo hạn) cho đối tác/khế ước để tách.",
        },
        {
          code: "213",
          name: "3. Vốn kinh doanh ở đơn vị trực thuộc",
          level: 2,
          formula: {
            debitBalance: ["1361"],
          },
        },
        {
          code: "214",
          name: "4. Phải thu dài hạn khác",
          level: 2,
          longTermOf: "133",
          note: "Nguồn: số dư Nợ chi tiết TK 1288, 1368, 1386, 1388, 334, 338, 141 phần dài hạn. Phần mềm chưa có thông tin kỳ hạn; mặc định toàn bộ số dư ở chỉ tiêu ngắn hạn tương ứng, chỉ tiêu dài hạn này để 0. Đề xuất: thêm cờ 'dài hạn' (hoặc ngày đáo hạn) cho đối tác/khế ước để tách.",
        },
        {
          code: "215",
          name: "5. Dự phòng phải thu dài hạn khó đòi (*)",
          level: 2,
          longTermOf: "135",
          note: "Nguồn: số dư Có chi tiết TK 2293 phần dài hạn. Mặc định 0.",
        },
        {
          code: "220",
          name: "II. Tài sản cố định",
          level: 1,
          formula: {
            sum: ["221", "222"],
          },
        },
        {
          code: "221",
          name: "- Nguyên giá",
          level: 2,
          formula: {
            debitBalance: ["211"],
          },
        },
        {
          code: "222",
          name: "- Giá trị hao mòn lũy kế (*)",
          level: 2,
          formula: {
            creditBalance: ["2141", "2142", "2143"],
            negative: true,
          },
        },
        {
          code: "230",
          name: "III. Bất động sản đầu tư",
          level: 1,
          formula: {
            sum: ["231", "232"],
          },
        },
        {
          code: "231",
          name: "- Nguyên giá",
          level: 2,
          formula: {
            debitBalance: ["217"],
          },
        },
        {
          code: "232",
          name: "- Giá trị hao mòn lũy kế (*)",
          level: 2,
          formula: {
            creditBalance: ["2147"],
            negative: true,
          },
        },
        {
          code: "240",
          name: "IV. Xây dựng cơ bản dở dang",
          level: 1,
          formula: {
            debitBalance: ["241"],
          },
        },
        {
          code: "250",
          name: "V. Đầu tư tài chính dài hạn",
          level: 1,
          formula: {
            sum: ["251", "252", "253"],
          },
        },
        {
          code: "251",
          name: "1. Đầu tư góp vốn vào đơn vị khác",
          level: 2,
          formula: {
            debitBalance: ["228"],
          },
        },
        {
          code: "252",
          name: "2. Dự phòng tổn thất đầu tư vào đơn vị khác (*)",
          level: 2,
          formula: {
            creditBalance: ["2292"],
            negative: true,
          },
        },
        {
          code: "253",
          name: "3. Đầu tư nắm giữ đến ngày đáo hạn dài hạn",
          level: 2,
          longTermOf: "123",
          note: "Nguồn: số dư Nợ chi tiết TK 1281, 1288 phần dài hạn. Phần mềm chưa có thông tin kỳ hạn; mặc định toàn bộ số dư ở chỉ tiêu ngắn hạn tương ứng, chỉ tiêu dài hạn này để 0. Đề xuất: thêm cờ 'dài hạn' (hoặc ngày đáo hạn) cho đối tác/khế ước để tách.",
        },
        {
          code: "260",
          name: "VI. Tài sản dài hạn khác",
          level: 1,
          longTermOf: "152",
          note: "Nguồn: số dư Nợ chi tiết TK 242, 333 phần dài hạn. Phần mềm chưa có thông tin kỳ hạn; mặc định toàn bộ số dư ở chỉ tiêu ngắn hạn tương ứng, chỉ tiêu dài hạn này để 0. Đề xuất: thêm cờ 'dài hạn' (hoặc ngày đáo hạn) cho đối tác/khế ước để tách.",
        },
        {
          code: "300",
          name: "TỔNG CỘNG TÀI SẢN (300 = 100 + 200)",
          level: 0,
          formula: {
            sum: ["100", "200"],
          },
        },
        {
          code: "400",
          name: "C - NỢ PHẢI TRẢ",
          level: 0,
          formula: {
            sum: ["410", "420"],
          },
        },
        {
          code: "410",
          name: "I. Nợ ngắn hạn",
          level: 1,
          formula: {
            sum: ["411", "412", "413", "414", "415", "416", "417", "418"],
          },
        },
        {
          code: "411",
          name: "1. Phải trả người bán ngắn hạn",
          level: 2,
          formula: {
            creditBalanceByPartner: ["331"],
          },
        },
        {
          code: "412",
          name: "2. Người mua trả tiền trước ngắn hạn",
          level: 2,
          formula: {
            creditBalanceByPartner: ["131"],
          },
        },
        {
          code: "413",
          name: "3. Thuế và các khoản phải nộp Nhà nước",
          level: 2,
          formula: {
            creditBalance: ["33311", "33312", "3332", "3333", "3334", "3335", "3336", "3337", "3338", "3339"],
          },
        },
        {
          code: "414",
          name: "4. Phải trả người lao động",
          level: 2,
          formula: {
            creditBalanceByPartner: ["334"],
          },
        },
        {
          code: "415",
          name: "5. Phải trả ngắn hạn khác",
          level: 2,
          formula: {
            creditBalance: ["335"],
            creditBalanceByPartner: ["3368", "3381", "3382", "3383", "3384", "3385", "3386", "3387", "3388", "1388"],
          },
          note: "Văn bản: số dư Có chi tiết TK 335, 3368, 338, 1388.",
        },
        {
          code: "416",
          name: "6. Vay và nợ thuê tài chính ngắn hạn",
          level: 2,
          formula: {
            creditBalance: ["341"],
          },
          note: "Mặc định toàn bộ là ngắn hạn (xem 425).",
        },
        {
          code: "417",
          name: "7. Dự phòng phải trả ngắn hạn",
          level: 2,
          formula: {
            creditBalance: ["352"],
          },
          note: "Mặc định toàn bộ là ngắn hạn (xem 426).",
        },
        {
          code: "418",
          name: "8. Quỹ khen thưởng, phúc lợi",
          level: 2,
          formula: {
            creditBalance: ["353"],
          },
        },
        {
          code: "420",
          name: "II. Nợ dài hạn",
          level: 1,
          formula: {
            sum: ["421", "422", "423", "424", "425", "426", "427"],
          },
        },
        {
          code: "421",
          name: "1. Phải trả người bán dài hạn",
          level: 2,
          longTermOf: "411",
          note: "Nguồn: tổng số dư Có chi tiết TK 331 phần dài hạn. Phần mềm chưa có thông tin kỳ hạn; mặc định toàn bộ số dư ở chỉ tiêu ngắn hạn tương ứng, chỉ tiêu dài hạn này để 0. Đề xuất: thêm cờ 'dài hạn' (hoặc ngày đáo hạn) cho đối tác/khế ước để tách.",
        },
        {
          code: "422",
          name: "2. Người mua trả tiền trước dài hạn",
          level: 2,
          longTermOf: "412",
          note: "Nguồn: số dư Có chi tiết TK 131 phần dài hạn. Phần mềm chưa có thông tin kỳ hạn; mặc định toàn bộ số dư ở chỉ tiêu ngắn hạn tương ứng, chỉ tiêu dài hạn này để 0. Đề xuất: thêm cờ 'dài hạn' (hoặc ngày đáo hạn) cho đối tác/khế ước để tách.",
        },
        {
          code: "423",
          name: "3. Phải trả nội bộ về vốn kinh doanh",
          level: 2,
          formula: {
            creditBalance: ["3361"],
          },
        },
        {
          code: "424",
          name: "4. Phải trả dài hạn khác",
          level: 2,
          longTermOf: "415",
          note: "Nguồn: số dư Có chi tiết TK 335, 3368, 338, 1388 phần dài hạn. Phần mềm chưa có thông tin kỳ hạn; mặc định toàn bộ số dư ở chỉ tiêu ngắn hạn tương ứng, chỉ tiêu dài hạn này để 0. Đề xuất: thêm cờ 'dài hạn' (hoặc ngày đáo hạn) cho đối tác/khế ước để tách.",
        },
        {
          code: "425",
          name: "5. Vay và nợ thuê tài chính dài hạn",
          level: 2,
          longTermOf: "416",
          note: "Nguồn: số dư Có chi tiết TK 341 phần dài hạn và TK 4111 phần cổ phiếu ưu đãi phân loại là nợ. Phần mềm chưa có thông tin kỳ hạn; mặc định toàn bộ số dư ở chỉ tiêu ngắn hạn tương ứng, chỉ tiêu dài hạn này để 0. Đề xuất: thêm cờ 'dài hạn' (hoặc ngày đáo hạn) cho đối tác/khế ước để tách.",
        },
        {
          code: "426",
          name: "6. Dự phòng phải trả dài hạn",
          level: 2,
          longTermOf: "417",
          note: "Nguồn: số dư Có chi tiết TK 352 phần dài hạn. Phần mềm chưa có thông tin kỳ hạn; mặc định toàn bộ số dư ở chỉ tiêu ngắn hạn tương ứng, chỉ tiêu dài hạn này để 0. Đề xuất: thêm cờ 'dài hạn' (hoặc ngày đáo hạn) cho đối tác/khế ước để tách.",
        },
        {
          code: "427",
          name: "7. Quỹ phát triển khoa học và công nghệ",
          level: 2,
          formula: {
            creditBalance: ["356"],
          },
        },
        {
          code: "500",
          name: "D - VỐN CHỦ SỞ HỮU",
          level: 0,
          formula: {
            sum: ["511", "512", "513", "514", "515", "516", "517"],
          },
        },
        {
          code: "511",
          name: "1. Vốn góp của chủ sở hữu",
          level: 2,
          formula: {
            creditBalance: ["4111"],
          },
        },
        {
          code: "512",
          name: "2. Thặng dư vốn cổ phần",
          level: 2,
          formula: {
            netBalance: ["4112"],
            negative: true,
          },
        },
        {
          code: "513",
          name: "3. Vốn khác của chủ sở hữu",
          level: 2,
          formula: {
            creditBalance: ["4118"],
          },
        },
        {
          code: "514",
          name: "4. Cổ phiếu quỹ (*)",
          level: 2,
          formula: {
            debitBalance: ["419"],
            negative: true,
          },
        },
        {
          code: "515",
          name: "5. Chênh lệch tỷ giá hối đoái",
          level: 2,
          formula: {
            netBalance: ["413"],
            negative: true,
          },
          note: "Như B01a-DNN mã 415 (tài khoản nguồn là đề xuất).",
        },
        {
          code: "516",
          name: "6. Các quỹ thuộc vốn chủ sở hữu",
          level: 2,
          formula: {
            creditBalance: ["418"],
          },
        },
        {
          code: "517",
          name: "7. Lợi nhuận sau thuế chưa phân phối",
          level: 2,
          formula: {
            netBalance: ["421"],
            negative: true,
          },
        },
        {
          code: "600",
          name: "TỔNG CỘNG NGUỒN VỐN (600 = 400 + 500)",
          level: 0,
          formula: {
            sum: ["400", "500"],
          },
        },
      ],
    },
    incomeStatement: {
      form: "B02-DNN",
      name: "Báo cáo kết quả hoạt động kinh doanh",
      lines: [
        {
          code: "01",
          name: "1. Doanh thu bán hàng và cung cấp dịch vụ",
          level: 1,
          formula: {
            creditTurnover: ["511"],
            excludeCounter: ["911"],
          },
          note: "Lũy kế phát sinh Có TK 511 trong kỳ (văn bản không nêu loại trừ đối ứng; loại 911 để phòng bút toán kết chuyển ngược).",
        },
        {
          code: "02",
          name: "2. Các khoản giảm trừ doanh thu",
          level: 1,
          formula: {
            debitTurnover: ["511"],
            counter: ["111", "112", "131"],
          },
          note: "Phát sinh Nợ TK 511 đối ứng Có TK 111, 112, 131 (Thông tư 133 không dùng TK 521; giảm trừ ghi thẳng Nợ 511).",
        },
        {
          code: "10",
          name: "3. Doanh thu thuần về bán hàng và cung cấp dịch vụ (10 = 01 - 02)",
          level: 0,
          formula: {
            sum: ["01"],
            minus: ["02"],
          },
        },
        {
          code: "11",
          name: "4. Giá vốn hàng bán",
          level: 1,
          formula: {
            creditTurnover: ["632"],
            counter: ["911"],
          },
        },
        {
          code: "20",
          name: "5. Lợi nhuận gộp về bán hàng và cung cấp dịch vụ (20 = 10 - 11)",
          level: 0,
          formula: {
            sum: ["10"],
            minus: ["11"],
          },
        },
        {
          code: "21",
          name: "6. Doanh thu hoạt động tài chính",
          level: 1,
          formula: {
            debitTurnover: ["515"],
            counter: ["911"],
          },
        },
        {
          code: "22",
          name: "7. Chi phí tài chính",
          level: 1,
          formula: {
            creditTurnover: ["635"],
            counter: ["911"],
          },
        },
        {
          code: "23",
          name: "- Trong đó: Chi phí lãi vay",
          level: 2,
          note: "Căn cứ số liệu chi tiết chi phí lãi vay trên TK 635. Danh mục không có tài khoản chi tiết; mặc định 0. Đề xuất: TK chi tiết hoặc thẻ 'lãi vay'. Không tham gia công thức 30.",
        },
        {
          code: "24",
          name: "8. Chi phí quản lý kinh doanh",
          level: 1,
          formula: {
            creditTurnover: ["642"],
            counter: ["911"],
          },
        },
        {
          code: "30",
          name: "9. Lợi nhuận thuần từ hoạt động kinh doanh (30 = 20 + 21 - 22 - 24)",
          level: 0,
          formula: {
            sum: ["20", "21"],
            minus: ["22", "24"],
          },
        },
        {
          code: "31",
          name: "10. Thu nhập khác",
          level: 1,
          formula: {
            debitTurnover: ["711"],
            counter: ["911"],
          },
          note: "Riêng thanh lý, nhượng bán TSCĐ chỉ ghi phần chênh lệch thu lớn hơn giá trị còn lại và chi phí thanh lý; phần mềm chưa bù trừ.",
        },
        {
          code: "32",
          name: "11. Chi phí khác",
          level: 1,
          formula: {
            creditTurnover: ["811"],
            counter: ["911"],
          },
          note: "Xem ghi chú 31.",
        },
        {
          code: "40",
          name: "12. Lợi nhuận khác (40 = 31 - 32)",
          level: 0,
          formula: {
            sum: ["31"],
            minus: ["32"],
          },
        },
        {
          code: "50",
          name: "13. Tổng lợi nhuận kế toán trước thuế (50 = 30 + 40)",
          level: 0,
          formula: {
            sum: ["30", "40"],
          },
        },
        {
          code: "51",
          name: "14. Chi phí thuế TNDN",
          level: 1,
          formula: {
            creditTurnover: ["821"],
            counter: ["911"],
            subtract: {
              debitTurnover: ["821"],
              counter: ["911"],
            },
          },
          note: "Phát sinh Có 821 đối ứng Nợ 911; nếu phát sinh Nợ 821 đối ứng Có 911 thì ghi số âm. Khóa 'subtract' là đề xuất mở rộng quy ước.",
        },
        {
          code: "60",
          name: "15. Lợi nhuận sau thuế thu nhập doanh nghiệp (60 = 50 - 51)",
          level: 0,
          formula: {
            sum: ["50"],
            minus: ["51"],
          },
        },
      ],
    },
    source:
      "Thông tư 133/2016/TT-BTC ngày 26/08/2016 của Bộ Tài chính, hiệu lực 01/01/2017, tình trạng: hết hiệu lực một phần (tra Lawgical; văn bản tra cứu không nêu phần nào hết hiệu lực, các Điều 71 và 81 về BCTC vẫn có trong văn bản). Hệ thống báo cáo: Điều 71. Mã số, tên và cách lấy số liệu từng chỉ tiêu: Điều 81 khoản 2.2.1 (B01a-DNN), 2.2.2 (B01b-DNN), 2.3 (B02-DNN), đối chiếu nguyên văn. Tên chỉ tiêu lấy theo phần hướng dẫn lập; số thứ tự La Mã/chữ cái của biểu mẫu (phụ lục) chưa đối chiếu.",
  },
};
