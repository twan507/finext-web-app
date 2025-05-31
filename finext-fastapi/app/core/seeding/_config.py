"""
Configuration file for seeding default permissions and features into the database.

This module contains the default permissions and features that will be created
when initializing the application database.
"""

from typing import List, Dict, Any, Set

# =============================================================================
# DEFAULT PERMISSIONS CONFIGURATION
# =============================================================================

DEFAULT_PERMISSIONS_DATA: List[Dict[str, Any]] = [
    # -------------------------------------------------------------------------
    # User Management Permissions
    # -------------------------------------------------------------------------
    {
        "name": "user:create",
        "description": "Quyền tạo người dùng mới (ví dụ: bởi admin).",
    },
    {
        "name": "user:list",
        "description": "Quyền xem danh sách tất cả người dùng.",
    },
    {
        "name": "user:read_any",
        "description": "Quyền xem thông tin chi tiết của bất kỳ người dùng nào.",
    },
    {
        "name": "user:update_own",
        "description": "Quyền tự cập nhật thông tin cá nhân của mình.",
    },
    {
        "name": "user:update_any",
        "description": "Quyền cập nhật thông tin của bất kỳ người dùng nào (admin).",
    },
    {
        "name": "user:delete_any",
        "description": "Quyền xóa bất kỳ người dùng nào (admin).",
    },
    {
        "name": "user:manage_roles",
        "description": "Quyền gán/thu hồi vai trò cho người dùng.",
    },
    # -------------------------------------------------------------------------
    # Role Management Permissions
    # -------------------------------------------------------------------------
    {
        "name": "role:create",
        "description": "Quyền tạo vai trò mới.",
    },
    {
        "name": "role:list",
        "description": "Quyền xem danh sách vai trò.",
    },
    {
        "name": "role:read_any",
        "description": "Quyền xem chi tiết vai trò.",
    },
    {
        "name": "role:update_any",
        "description": "Quyền cập nhật vai trò.",
    },
    {
        "name": "role:delete_any",
        "description": "Quyền xóa vai trò.",
    },
    # -------------------------------------------------------------------------
    # Session Management Permissions
    # -------------------------------------------------------------------------
    {
        "name": "session:list_own",
        "description": "Quyền xem danh sách các session đang hoạt động của chính mình.",
    },
    {
        "name": "session:list_any",
        "description": "Quyền xem danh sách tất cả các session đang hoạt động của mọi người dùng (admin).",
    },
    {
        "name": "session:delete_own",
        "description": "Quyền tự xóa một session đang hoạt động của mình.",
    },
    {
        "name": "session:delete_any",
        "description": "Quyền xóa bất kỳ session nào đang hoạt động (admin).",
    },
    # -------------------------------------------------------------------------
    # Feature & License Management Permissions (Admin only)
    # -------------------------------------------------------------------------
    {
        "name": "feature:manage",
        "description": "Quyền quản lý (CRUD) các features.",
    },
    {
        "name": "license:manage",
        "description": "Quyền quản lý (CRUD) các licenses.",
    },
    # -------------------------------------------------------------------------
    # Subscription Management Permissions
    # -------------------------------------------------------------------------
    {
        "name": "subscription:create",
        "description": "Quyền tạo subscription mới.",
    },
    {
        "name": "subscription:read_own",
        "description": "Quyền xem subscription của chính mình.",
    },
    {
        "name": "subscription:read_any",
        "description": "Quyền xem subscription của bất kỳ ai.",
    },
    {
        "name": "subscription:update_any",
        "description": "Quyền cập nhật subscription của bất kỳ ai.",
    },
    {
        "name": "subscription:deactivate_any",
        "description": "Quyền hủy kích hoạt subscription của bất kỳ ai.",
    },
    # -------------------------------------------------------------------------
    # Transaction Management Permissions
    # -------------------------------------------------------------------------
    {
        "name": "transaction:create_any",
        "description": "Quyền tạo giao dịch mới cho bất kỳ người dùng nào (admin).",
    },
    {
        "name": "transaction:create_own",
        "description": "Quyền tự tạo đơn hàng/giao dịch mới cho chính mình.",
    },
    {
        "name": "transaction:read_any",
        "description": "Quyền xem tất cả giao dịch (admin).",
    },
    {
        "name": "transaction:update_details_any",
        "description": "Quyền cập nhật chi tiết giao dịch đang chờ xử lý của bất kỳ ai (admin).",
    },
    {
        "name": "transaction:confirm_payment_any",
        "description": "Quyền xác nhận thanh toán thành công cho giao dịch của bất kỳ ai (admin).",
    },
    {
        "name": "transaction:cancel_any",
        "description": "Quyền hủy giao dịch của bất kỳ ai (admin).",
    },
    {
        "name": "transaction:read_own",
        "description": "Quyền xem lịch sử giao dịch của chính mình.",
    },
    {
        "name": "transaction:read_referred",
        "description": "Quyền xem các giao dịch được giới thiệu bởi mình (Đối tác).",
    },
    # -------------------------------------------------------------------------
    # Broker Management Permissions
    # -------------------------------------------------------------------------
    {
        "name": "broker:create",
        "description": "Quyền tạo Đối tác mới.",
    },
    {
        "name": "broker:list",
        "description": "Quyền xem danh sách Đối tác.",
    },
    {
        "name": "broker:read_any",
        "description": "Quyền xem chi tiết Đối tác bất kỳ.",
    },
    {
        "name": "broker:read_own",
        "description": "Quyền tự xem thông tin Đối tác của mình.",
    },
    {
        "name": "broker:update_any",
        "description": "Quyền cập nhật Đối tác bất kỳ (ví dụ: is_active).",
    },
    {
        "name": "broker:delete_any",
        "description": "Quyền xóa Đối tác.",
    },
    {
        "name": "broker:validate",
        "description": "Quyền kiểm tra tính hợp lệ của một broker_code.",
    },
    # -------------------------------------------------------------------------
    # Promotion Management Permissions
    # -------------------------------------------------------------------------
    {
        "name": "promotion:manage",
        "description": "Quyền quản lý (CRUD) các mã khuyến mãi (admin).",
    },
    {
        "name": "promotion:validate",
        "description": "Quyền kiểm tra tính hợp lệ của một mã khuyến mãi (user/public).",
    },
    # -------------------------------------------------------------------------
    # Watchlist Management Permissions
    # -------------------------------------------------------------------------
    {
        "name": "watchlist:create_own",
        "description": "Quyền tự tạo danh sách theo dõi cổ phiếu mới.",
    },
    {
        "name": "watchlist:read_own",
        "description": "Quyền xem các danh sách theo dõi cổ phiếu của chính mình.",
    },
    {
        "name": "watchlist:update_own",
        "description": "Quyền tự cập nhật (thêm/xóa cổ phiếu, đổi tên) danh sách theo dõi của mình.",
    },
    {
        "name": "watchlist:delete_own",
        "description": "Quyền tự xóa danh sách theo dõi của mình.",
    },
    # -------------------------------------------------------------------------
    # File Upload Permissions
    # -------------------------------------------------------------------------
    {
        "name": "upload:create",
        "description": "Quyền upload file/image cho chính mình.",
    },
]

# Set containing all default permission names for validation
ALL_DEFAULT_PERMISSION_NAMES: Set[str] = {p["name"] for p in DEFAULT_PERMISSIONS_DATA}

# =============================================================================
# DEFAULT FEATURES CONFIGURATION
# =============================================================================

DEFAULT_FEATURES_DATA: List[Dict[str, Any]] = [
    {
        "key": "basic_feature",
        "name": "Tính năng Miễn Phí",
        "description": "Tính năng miễn phí cho người dùng.",
    },
    {
        "key": "advanced_feature",
        "name": "Tính năng Nâng cao",
        "description": "Tính năng nâng cao cho người dùng.",
    },
    {
        "key": "broker_feature",
        "name": "Tính năng Đối tác",
        "description": "Tính năng dành riêng cho Đối tác giới thiệu.",
    },
    {
        "key": "admin_feature",
        "name": "Tính năng Quản trị viên",
        "description": "Tính năng dành cho quản trị viên hệ thống.",
    },
]

ALL_DEFAULT_FEATURE_KEYS: Set[str] = {f["key"] for f in DEFAULT_FEATURES_DATA}
