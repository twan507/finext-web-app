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
    # =========================================================================
    # ADMIN-ONLY PERMISSIONS (System Critical)
    # =========================================================================
    # Core System Administration
    {"name": "user:delete_any", "description": "Quyền xóa bất kỳ người dùng nào.", "roles": ["admin"], "category": "user_management"},
    {
        "name": "user:manage_roles",
        "description": "Quyền gán/thu hồi vai trò cho người dùng.",
        "roles": ["admin"],
        "category": "user_management",
    },
    # Role Management (Admin Only)
    {"name": "role:create", "description": "Quyền tạo vai trò mới.", "roles": ["admin"], "category": "role_management"},
    {"name": "role:update_any", "description": "Quyền cập nhật vai trò.", "roles": ["admin"], "category": "role_management"},
    {"name": "role:delete_any", "description": "Quyền xóa vai trò.", "roles": ["admin"], "category": "role_management"},
    # Session Management (Admin Only)
    {
        "name": "session:list_any",
        "description": "Quyền xem danh sách tất cả các session đang hoạt động của mọi người dùng.",
        "roles": ["admin"],
        "category": "session_management",
    },
    {
        "name": "session:delete_any",
        "description": "Quyền xóa bất kỳ session nào đang hoạt động.",
        "roles": ["admin"],
        "category": "session_management",
    },
    # Broker Management (Admin Only)
    {"name": "broker:create", "description": "Quyền tạo Đối tác mới.", "roles": ["admin"], "category": "broker_management"},
    {
        "name": "broker:update_any",
        "description": "Quyền cập nhật Đối tác bất kỳ (ví dụ: is_active).",
        "roles": ["admin"],
        "category": "broker_management",
    },
    {"name": "broker:delete_any", "description": "Quyền xóa Đối tác.", "roles": ["admin"], "category": "broker_management"},
    # System Monitoring & Control (Admin Only)
    {
        "name": "permission:list_all_definitions",
        "description": "Quyền xem danh sách tất cả các permission được định nghĩa trong hệ thống.",
        "roles": ["admin"],
        "category": "admin_only",
    },
    {
        "name": "permission:create",
        "description": "Quyền tạo permission mới trong hệ thống.",
        "roles": ["admin"],
        "category": "admin_only",
    },
    {
        "name": "permission:read_any",
        "description": "Quyền xem chi tiết bất kỳ permission nào trong hệ thống.",
        "roles": ["admin"],
        "category": "admin_only",
    },
    {
        "name": "permission:update_any",
        "description": "Quyền cập nhật bất kỳ permission nào trong hệ thống.",
        "roles": ["admin"],
        "category": "admin_only",
    },
    {
        "name": "permission:delete_any",
        "description": "Quyền xóa bất kỳ permission nào trong hệ thống.",
        "roles": ["admin"],
        "category": "admin_only",
    },
    {
        "name": "otp:read_any",
        "description": "Quyền xem tất cả các bản ghi OTP của mọi người dùng.",
        "roles": ["admin"],
        "category": "admin_only",
    },
    {
        "name": "otp:invalidate_any",
        "description": "Quyền vô hiệu hóa OTP của bất kỳ người dùng nào.",
        "roles": ["admin"],
        "category": "admin_only",
    },
    # =========================================================================
    # ADMIN & MANAGER PERMISSIONS (Management Level)
    # =========================================================================
    # User Management
    {"name": "user:create", "description": "Quyền tạo người dùng mới.", "roles": ["admin", "manager"], "category": "user_management"},
    {
        "name": "user:list",
        "description": "Quyền xem danh sách tất cả người dùng.",
        "roles": ["admin", "manager"],
        "category": "user_management",
    },
    {
        "name": "user:read_any",
        "description": "Quyền xem thông tin chi tiết của bất kỳ người dùng nào.",
        "roles": ["admin", "manager"],
        "category": "user_management",
    },
    {
        "name": "user:update_any",
        "description": "Quyền cập nhật thông tin của bất kỳ người dùng nào.",
        "roles": ["admin", "manager"],
        "category": "user_management",
    },
    {
        "name": "user:change_password_any",
        "description": "Quyền thay đổi mật khẩu của bất kỳ người dùng nào.",
        "roles": ["admin", "manager"],
        "category": "user_management",
    },
    # Role Management (View Only for Manager)
    {"name": "role:list", "description": "Quyền xem danh sách vai trò.", "roles": ["admin", "manager"], "category": "role_management"},
    {"name": "role:read_any", "description": "Quyền xem chi tiết vai trò.", "roles": ["admin", "manager"], "category": "role_management"},
    # System Features & Licenses
    {
        "name": "feature:manage",
        "description": "Quyền quản lý (CRUD) các features.",
        "roles": ["admin", "manager"],
        "category": "feature_license_management",
    },
    {
        "name": "license:manage",
        "description": "Quyền quản lý (CRUD) các licenses.",
        "roles": ["admin", "manager"],
        "category": "feature_license_management",
    },
    # Subscription Management
    {
        "name": "subscription:create",
        "description": "Quyền tạo subscription mới.",
        "roles": ["admin", "manager"],
        "category": "subscription_management",
    },
    {
        "name": "subscription:read_any",
        "description": "Quyền xem subscription của bất kỳ ai.",
        "roles": ["admin", "manager"],
        "category": "subscription_management",
    },
    {
        "name": "subscription:update_any",
        "description": "Quyền cập nhật subscription của bất kỳ ai.",
        "roles": ["admin", "manager"],
        "category": "subscription_management",
    },
    {
        "name": "subscription:deactivate_any",
        "description": "Quyền hủy kích hoạt subscription của bất kỳ ai.",
        "roles": ["admin", "manager"],
        "category": "subscription_management",
    },
    {
        "name": "subscription:delete_any",
        "description": "Quyền xóa subscription của bất kỳ ai.",
        "roles": ["admin"],
        "category": "subscription_management",
    },
    # Transaction Management
    {
        "name": "transaction:create_any",
        "description": "Quyền tạo giao dịch mới cho bất kỳ người dùng nào.",
        "roles": ["admin", "manager"],
        "category": "transaction_management",
    },
    {
        "name": "transaction:read_any",
        "description": "Quyền xem tất cả giao dịch.",
        "roles": ["admin", "manager"],
        "category": "transaction_management",
    },
    {
        "name": "transaction:update_any",
        "description": "Quyền cập nhật thông tin giao dịch của bất kỳ ai.",
        "roles": ["admin", "manager"],
        "category": "transaction_management",
    },
    {
        "name": "transaction:delete_any",
        "description": "Quyền xóa giao dịch của bất kỳ ai.",
        "roles": ["admin", "manager"],
        "category": "transaction_management",
    },
    {
        "name": "transaction:confirm_payment_any",
        "description": "Quyền xác nhận thanh toán thành công cho giao dịch của bất kỳ ai.",
        "roles": ["admin", "manager"],
        "category": "transaction_management",
    },
    {
        "name": "transaction:cancel_any",
        "description": "Quyền hủy giao dịch của bất kỳ ai.",
        "roles": ["admin", "manager"],
        "category": "transaction_management",
    },
    # Broker Management (View & Limited Operations)
    {"name": "broker:list", "description": "Quyền xem danh sách Đối tác.", "roles": ["admin", "manager"], "category": "broker_management"},
    {
        "name": "broker:read_any",
        "description": "Quyền xem chi tiết Đối tác bất kỳ.",
        "roles": ["admin", "manager"],
        "category": "broker_management",
    },
    # Promotion Management
    {
        "name": "promotion:manage",
        "description": "Quyền quản lý (CRUD) các mã khuyến mãi.",
        "roles": ["admin", "manager"],
        "category": "promotion_management",
    },
    # Watchlist Management
    {
        "name": "watchlist:read_any",
        "description": "Quyền xem tất cả watchlists của mọi người dùng.",
        "roles": ["admin", "manager"],
        "category": "watchlist_management",
    },
    {
        "name": "watchlist:delete_any",
        "description": "Quyền xóa watchlist của bất kỳ người dùng nào.",
        "roles": ["admin", "manager"],
        "category": "watchlist_management",
    },
    # =========================================================================
    # BROKER-SPECIFIC PERMISSIONS
    # =========================================================================
    {
        "name": "broker:read_own",
        "description": "Quyền tự xem thông tin Đối tác của mình.",
        "roles": ["broker"],
        "category": "broker_management",
    },
    {
        "name": "transaction:read_referred",
        "description": "Quyền xem các giao dịch được giới thiệu bởi mình.",
        "roles": ["broker"],
        "category": "transaction_management",
    },
    # =========================================================================
    # COMMON PERMISSIONS (All Roles)
    # =========================================================================
    # Personal Account Management
    {
        "name": "user:update_own",
        "description": "Quyền tự cập nhật thông tin cá nhân của mình.",
        "roles": ["admin", "manager", "broker", "user"],
        "category": "user_management",
    },
    # Session Management (Personal)
    {
        "name": "session:list_own",
        "description": "Quyền xem danh sách các session đang hoạt động của chính mình.",
        "roles": ["admin", "manager", "broker", "user"],
        "category": "session_management",
    },
    {
        "name": "session:delete_own",
        "description": "Quyền tự xóa một session đang hoạt động của mình.",
        "roles": ["admin", "manager", "broker", "user"],
        "category": "session_management",
    },
    # Subscription (Personal)
    {
        "name": "subscription:read_own",
        "description": "Quyền xem subscription của chính mình.",
        "roles": ["admin", "manager", "broker", "user"],
        "category": "subscription_management",
    },
    # Transaction (Personal)
    {
        "name": "transaction:create_own",
        "description": "Quyền tự tạo đơn hàng/giao dịch mới cho chính mình.",
        "roles": ["admin", "manager", "broker", "user"],
        "category": "transaction_management",
    },
    {
        "name": "transaction:read_own",
        "description": "Quyền xem lịch sử giao dịch của chính mình.",
        "roles": ["admin", "manager", "broker", "user"],
        "category": "transaction_management",
    },
    # Watchlist Management (Personal)
    {
        "name": "watchlist:create_own",
        "description": "Quyền tự tạo danh sách theo dõi cổ phiếu mới.",
        "roles": ["admin", "manager", "broker", "user"],
        "category": "watchlist_management",
    },
    {
        "name": "watchlist:read_own",
        "description": "Quyền xem các danh sách theo dõi cổ phiếu của chính mình.",
        "roles": ["admin", "manager", "broker", "user"],
        "category": "watchlist_management",
    },
    {
        "name": "watchlist:update_own",
        "description": "Quyền tự cập nhật (thêm/xóa cổ phiếu, đổi tên) danh sách theo dõi của mình.",
        "roles": ["admin", "manager", "broker", "user"],
        "category": "watchlist_management",
    },
    {
        "name": "watchlist:delete_own",
        "description": "Quyền tự xóa danh sách theo dõi của mình.",
        "roles": ["admin", "manager", "broker", "user"],
        "category": "watchlist_management",
    },
    # Public/Common Features
    {
        "name": "broker:validate",
        "description": "Quyền kiểm tra tính hợp lệ của một broker_code.",
        "roles": ["admin", "manager", "broker", "user"],
        "category": "broker_management",
    },
    {
        "name": "promotion:validate",
        "description": "Quyền kiểm tra tính hợp lệ của một mã khuyến mãi.",
        "roles": ["admin", "manager", "broker", "user"],
        "category": "promotion_management",
    },
    {
        "name": "upload:create",
        "description": "Quyền upload file/image cho chính mình.",
        "roles": ["admin", "manager", "broker", "user"],
        "category": "file_management",
    },
]

# =============================================================================
# PERMISSION METADATA & HELPER FUNCTIONS
# =============================================================================

# Set containing all default permission names for validation
ALL_DEFAULT_PERMISSION_NAMES: Set[str] = {p["name"] for p in DEFAULT_PERMISSIONS_DATA}

# All available roles in the system (ordered by privilege level)
AVAILABLE_ROLES: Set[str] = {"admin", "manager", "broker", "user"}

# Permission categories organized by functional areas
PERMISSION_CATEGORIES: Set[str] = {
    "user_management",  # User account operations
    "role_management",  # Role and permission management
    "session_management",  # Session and authentication
    "feature_license_management",  # System features and licensing
    "subscription_management",  # User subscriptions
    "transaction_management",  # Financial transactions
    "broker_management",  # Partner/broker operations
    "promotion_management",  # Promotional codes and campaigns
    "watchlist_management",  # Stock watchlists
    "file_management",  # File uploads and storage
    "admin_only",  # System administration only
}

# Role hierarchy (higher index = more privileges)
ROLE_HIERARCHY = ["user", "broker", "manager", "admin"]


def get_permissions_by_role(role: str) -> List[Dict[str, Any]]:
    """Get all permissions available for a specific role."""
    if role not in AVAILABLE_ROLES:
        return []
    return [p for p in DEFAULT_PERMISSIONS_DATA if role in p.get("roles", [])]


def get_permissions_by_category(category: str) -> List[Dict[str, Any]]:
    """Get all permissions in a specific category."""
    if category not in PERMISSION_CATEGORIES:
        return []
    return [p for p in DEFAULT_PERMISSIONS_DATA if p.get("category") == category]


def get_admin_only_permissions() -> List[Dict[str, Any]]:
    """Get permissions that are exclusively for admin role."""
    return [p for p in DEFAULT_PERMISSIONS_DATA if p.get("roles") == ["admin"]]


def get_common_permissions() -> List[Dict[str, Any]]:
    """Get permissions that are available to all roles."""
    return [
        p for p in DEFAULT_PERMISSIONS_DATA if len(p.get("roles", [])) == 4 and all(role in p.get("roles", []) for role in AVAILABLE_ROLES)
    ]


def get_role_specific_permissions(role: str) -> List[Dict[str, Any]]:
    """Get permissions that are specific to only one role."""
    return [p for p in DEFAULT_PERMISSIONS_DATA if p.get("roles") == [role]]


def get_management_permissions() -> List[Dict[str, Any]]:
    """Get permissions available to management roles (admin + manager)."""
    return [p for p in DEFAULT_PERMISSIONS_DATA if "admin" in p.get("roles", []) and "manager" in p.get("roles", [])]


# =============================================================================
# DEFAULT FEATURES CONFIGURATION
# =============================================================================

DEFAULT_FEATURES_DATA: List[Dict[str, Any]] = [
    # Basic Features (Free Tier)
    {
        "key": "basic_feature",
        "name": "Tính năng Miễn Phí",
        "description": "Tính năng miễn phí cho người dùng.",
    },
    # Premium Features (Paid Tier)
    {
        "key": "advanced_feature",
        "name": "Tính năng Nâng cao",
        "description": "Tính năng nâng cao cho người dùng.",
    },
    # Role-specific Features
    {
        "key": "broker_feature",
        "name": "Tính năng Đối tác",
        "description": "Tính năng dành riêng cho Đối tác giới thiệu.",
    },
    {
        "key": "manager_feature",
        "name": "Tính năng Quản lý",
        "description": "Tính năng dành cho quản lý.",
    },
    {
        "key": "admin_feature",
        "name": "Tính năng Quản trị viên",
        "description": "Tính năng dành cho quản trị viên hệ thống.",
    },
]

# =============================================================================
# ROLE PERMISSION MAPPING FUNCTIONS
# =============================================================================


def get_default_role_permissions() -> Dict[str, List[str]]:
    """
    Tự động tạo mapping permissions cho các default roles dựa trên metadata.
    Returns dict với key là role name và value là list permission names.
    """
    role_permissions = {"admin": [], "manager": [], "broker": [], "user": []}

    # Duyệt qua tất cả permissions và phân loại theo roles
    for permission in DEFAULT_PERMISSIONS_DATA:
        permission_name = permission["name"]
        permission_roles = permission.get("roles", [])

        for role in permission_roles:
            if role in role_permissions:
                role_permissions[role].append(permission_name)

    return role_permissions


def get_role_permission_summary() -> Dict[str, Dict[str, int]]:
    """
    Trả về thống kê số lượng permissions theo category cho mỗi role.
    """
    role_permissions = get_default_role_permissions()
    summary = {}

    for role, permissions in role_permissions.items():
        category_count = {}
        for perm_name in permissions:
            # Tìm permission trong data để lấy category
            perm_data = next((p for p in DEFAULT_PERMISSIONS_DATA if p["name"] == perm_name), None)
            if perm_data:
                category = perm_data.get("category", "unknown")
                category_count[category] = category_count.get(category, 0) + 1

        summary[role] = {"total": len(permissions), "by_category": category_count}

    return summary


# Set containing all default feature keys for validation
ALL_DEFAULT_FEATURE_KEYS: Set[str] = {f["key"] for f in DEFAULT_FEATURES_DATA}
