import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import SectorDetailContent from './PageContent';

interface SectorDetailPageProps {
    params: Promise<{ sectorId: string }>;
}

const SECTOR_LIST: Record<string, string> = {
    'BANLE': 'Bán lẻ Tiêu dùng',
    'BAOHIEM': 'Kinh doanh Bảo hiểm',
    'BDS': 'Bất động sản Dân dụng',
    'CAOSU': 'Cao su Săm lốp',
    'CHUNGKHOAN': 'Công ty Chứng khoán',
    'CONGNGHE': 'Công nghệ Viễn thông',
    'CONGNGHIEP': 'Thiết bị Công nghiệp',
    'DAUKHI': 'Dịch vụ Dầu khí',
    'DETMAY': 'Dệt may Xuất khẩu',
    'DULICH': 'Du lịch Giải trí',
    'HOACHAT': 'Hóa chất Phân bón',
    'KCN': 'Bất động sản Khu công nghiệp',
    'KHOANGSAN': 'Tài nguyên cơ bản',
    'KIMLOAI': 'Kim loại công nghiệp',
    'NGANHANG': 'Tài chính Ngân hàng', // Viết hoa chữ Ngân hàng cho đẹp
    'NHUA': 'Nhựa và Bao bì',
    'NONGNGHIEP': 'Nông nghiệp Chăn nuôi',
    'THUCPHAM': 'Thực phẩm Đồ uống',
    'THUYSAN': 'Chế biến Thủy sản',
    'TIENICH': 'Hạ tầng Tiện ích',
    'VANTAI': 'Vận tải Kho bãi',
    'VLXD': 'Vật liệu Xây dựng',
    'XAYDUNG': 'Thi công Xây dựng',
    'YTEGD': 'Y tế Giáo dục',
};

export async function generateMetadata({ params }: SectorDetailPageProps): Promise<Metadata> {
    const { sectorId } = await params;
    
    // Viết hoa sectorId lấy từ URL (vd: nganhang -> NGANHANG)
    const upper = sectorId.toUpperCase();
    
    // Tìm tên ngành hiển thị cụ thể, nếu chưa map thì fallback sang định dạng cơ bản
    const displayName = SECTOR_LIST[upper] || decodeURIComponent(sectorId).replace(/-/g, ' ').toUpperCase();

    return {
        title: { absolute: `Ngành ${displayName} | Finext` },
        description: `Phân tích chi tiết ngành ${displayName}: dòng tiền, sức mạnh nhóm ngành và cổ phiếu tiêu biểu.`,
        openGraph: {
            title: `Ngành ${displayName} | Finext`,
            description: `Phân tích chi tiết ngành ${displayName}: dòng tiền, sức mạnh nhóm ngành và cổ phiếu tiêu biểu.`,
        },
    };
}

export default async function SectorDetailPage({ params }: SectorDetailPageProps) {
    const { sectorId } = await params;
    if (!SECTOR_LIST[sectorId.toUpperCase()]) {
        notFound();
    }
    return <SectorDetailContent />;
}
