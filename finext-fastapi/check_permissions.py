from app.core.seeding._config import DEFAULT_PERMISSIONS_DATA
from collections import Counter

# Đếm số permissions theo category mới
category_counts = Counter()
for perm in DEFAULT_PERMISSIONS_DATA:
    category = perm.get("category", "unknown")
    category_counts[category] += 1

print("Số lượng permissions theo category mới:")
for category, count in sorted(category_counts.items(), key=lambda x: x[1], reverse=True):
    print(f"{category}: {count} quyền")

print(f"\nTổng cộng: {sum(category_counts.values())} permissions")

# Kiểm tra có permissions nào thiếu roles không
missing_roles = []
for perm in DEFAULT_PERMISSIONS_DATA:
    if not perm.get("roles"):
        missing_roles.append(perm["name"])

if missing_roles:
    print(f"\n⚠️  Permissions thiếu roles: {missing_roles}")
else:
    print("\n✅ Tất cả permissions đều có roles")
