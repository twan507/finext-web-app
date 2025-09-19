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
    },  # Role Management (Admin Only)
    {
        "name": "role:manage",
        "description": "Quyền quản lý (CRUD) tất cả vai trò trong hệ thống.",
        "roles": ["admin"],
        "category": "admin_system",
    },
    {
        "name": "role:read",
        "description": "Quyền đọc thông tin vai trò.",
        "roles": ["admin", "manager", "user"],
        "category": "user_management",
    },  # Session Management (Admin Only)
    {
        "name": "session:manage_any",
        "description": "Quyền quản lý (xem, xóa) tất cả các session đang hoạt động của mọi người dùng.",
        "roles": ["admin"],
        "category": "others",
    },
    # Broker Management (Admin Only)
    {"name": "broker:create", "description": "Quyền tạo Đối tác mới.", "roles": ["admin"], "category": "broker_management"},
    {
        "name": "broker:update_any",
        "description": "Quyền cập nhật Đối tác bất kỳ (ví dụ: is_active).",
        "roles": ["admin"],
        "category": "broker_management",
    },
    {
        "name": "broker:delete_any",
        "description": "Quyền xóa Đối tác.",
        "roles": ["admin"],
        "category": "broker_management",
    },  # System Monitoring & Control (Admin Only)
    {
        "name": "permission:manage",
        "description": "Quyền quản lý (CRUD) tất cả các permission trong hệ thống.",
        "roles": ["admin"],
        "category": "admin_system",
    },
    {
        "name": "otp:manage",
        "description": "Quyền quản lý (xem, vô hiệu hóa) tất cả các bản ghi OTP của mọi người dùng.",
        "roles": ["admin"],
        "category": "admin_system",
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
    },  # System Features & Licenses
    {
        "name": "feature:manage",
        "description": "Quyền quản lý (CRUD) các features.",
        "roles": ["admin", "manager"],
        "category": "others",
    },
    {
        "name": "license:read",
        "description": "Quyền xem thông tin licenses.",
        "roles": ["admin", "manager", "user"],
        "category": "others",
    },
    {
        "name": "license:manage",
        "description": "Quyền quản lý (CRUD) các licenses.",
        "roles": ["admin", "manager"],
        "category": "others",
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
    },  # Promotion Management
    {
        "name": "promotion:manage",
        "description": "Quyền quản lý (CRUD) các mã khuyến mãi.",
        "roles": ["admin", "manager"],
        "category": "others",
    },  # Watchlist Management
    {
        "name": "watchlist:manage_any",
        "description": "Quyền quản lý (CRUD) watchlists của bất kỳ người dùng nào.",
        "roles": ["admin", "manager"],
        "category": "others",
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
    },  # Session Management (Personal)
    {
        "name": "session:manage_own",
        "description": "Quyền quản lý (xem, xóa) các session đang hoạt động của chính mình.",
        "roles": ["admin", "manager", "broker", "user"],
        "category": "others",
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
    },  # Watchlist Management (Personal)
    {
        "name": "watchlist:manage_own",
        "description": "Quyền quản lý (CRUD) danh sách theo dõi cổ phiếu của chính mình.",
        "roles": ["admin", "manager", "broker", "user"],
        "category": "others",
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
        "category": "others",
    },
    {
        "name": "upload:create",
        "description": "Quyền upload file/image cho chính mình.",
        "roles": ["admin", "manager", "broker", "user"],
        "category": "others",
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
    "user_management",  # User account operations (8 quyền)
    "transaction_management",  # Financial transactions (9 quyền)
    "broker_management",  # Partner/broker operations (7 quyền)
    "subscription_management",  # User subscriptions (6 quyền)
    "admin_system",  # System administration (4 quyền: permission, otp, role)
    "others",  # Other features (8 quyền: sessions, features, licenses, promotions, files, watchlists)
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
