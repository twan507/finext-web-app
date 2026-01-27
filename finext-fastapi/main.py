import subprocess
import sys
import os
from pathlib import Path


def check_uv_installed():
    """Kiểm tra UV đã được cài đặt chưa"""
    try:
        result = subprocess.run(["uv", "--version"], capture_output=True, text=True)
        if result.returncode == 0:
            return True
    except FileNotFoundError:
        pass
    return False


def run_fastapi_server():
    """Chạy FastAPI server với môi trường development"""

    # Đường dẫn đến thư mục finext-fastapi
    fastapi_dir = Path(__file__).parent

    # Kiểm tra xem thư mục có tồn tại không
    if not fastapi_dir.exists():
        print(f"❌ Không tìm thấy thư mục: {fastapi_dir}")
        return

    # Kiểm tra UV
    if not check_uv_installed():
        print("❌ UV chưa được cài đặt")
        print("💡 Cài đặt UV bằng lệnh: pip install uv")
        print("   hoặc: curl -LsSf https://astral.sh/uv/install.sh | sh")
        return

    # Đường dẫn đến môi trường ảo
    venv_path = fastapi_dir / ".venv"

    # Kiểm tra môi trường ảo
    if not venv_path.exists():
        print("⚠️  Môi trường ảo chưa tồn tại, đang tạo...")
        create_venv()

    # Kiểm tra file .env.development
    env_file = fastapi_dir / ".env.development"
    if not env_file.exists():
        print(f"❌ Không tìm thấy file môi trường: {env_file}")
        print("💡 Hãy tạo file .env.development trong thư mục finext-fastapi")
        return

    print("🚀 Đang khởi động Finext FastAPI server...")
    print(f"📁 Thư mục làm việc: {fastapi_dir}")
    print(f"🐍 Virtual environment: {venv_path}")
    print(f"⚙️  Environment file: {env_file}")

    try:
        # Chuyển đến thư mục finext-fastapi
        os.chdir(fastapi_dir)

        # Chạy uvicorn với UV
        cmd = [
            "uv",
            "run",
            "uvicorn",
            "app.main:app",
            "--reload",
            "--env-file",
            ".env.development",
            "--host",
            "127.0.0.1",
            "--port",
            "8000",
        ]

        print(f"🔧 Lệnh chạy: {' '.join(cmd)}")
        print("\n" + "=" * 50)
        print("🌐 Server sẽ chạy tại: http://127.0.0.1:8000")
        print("📚 API Docs: http://127.0.0.1:8000/api/v1/docs")
        print("🛑 Nhấn CTRL+C để dừng server")
        print("=" * 50 + "\n")

        # Chạy server
        subprocess.run(cmd, check=True)

    except KeyboardInterrupt:
        print("\n🛑 Server đã được dừng bởi người dùng")
    except subprocess.CalledProcessError as e:
        print(f"❌ Lỗi khi chạy server: {e}")
    except Exception as e:
        print(f"❌ Lỗi không xác định: {e}")


def install_dependencies():
    """Cài đặt dependencies cho dự án bằng UV"""

    fastapi_dir = Path(__file__).parent
    pyproject_file = fastapi_dir / "pyproject.toml"

    if not check_uv_installed():
        print("❌ UV chưa được cài đặt")
        print("💡 Cài đặt UV bằng lệnh: pip install uv")
        return

    if not pyproject_file.exists():
        print(f"❌ Không tìm thấy file: {pyproject_file}")
        return

    print("📦 Đang cài đặt dependencies bằng UV...")
    try:
        subprocess.run(["uv", "sync"], check=True, cwd=fastapi_dir)
        print("✅ Cài đặt dependencies thành công!")
    except subprocess.CalledProcessError as e:
        print(f"❌ Lỗi khi cài đặt dependencies: {e}")


def create_venv():
    """Tạo môi trường ảo mới bằng UV"""

    fastapi_dir = Path(__file__).parent
    venv_path = fastapi_dir / ".venv"

    if not check_uv_installed():
        print("❌ UV chưa được cài đặt")
        print("💡 Cài đặt UV bằng lệnh: pip install uv")
        return

    if venv_path.exists():
        print("ℹ️  Môi trường ảo đã tồn tại")
        return

    print("🔧 Đang tạo môi trường ảo bằng UV...")
    try:
        subprocess.run(["uv", "venv", str(venv_path)], check=True, cwd=fastapi_dir)
        print("✅ Tạo môi trường ảo thành công!")

        # Tự động cài đặt dependencies
        install_dependencies()

    except subprocess.CalledProcessError as e:
        print(f"❌ Lỗi khi tạo môi trường ảo: {e}")


def generate_lockfile():
    """Tạo uv.lock file"""

    fastapi_dir = Path(__file__).parent

    if not check_uv_installed():
        print("❌ UV chưa được cài đặt")
        return

    print("🔒 Đang tạo lockfile...")
    try:
        subprocess.run(["uv", "lock"], check=True, cwd=fastapi_dir)
        print("✅ Tạo lockfile thành công!")
    except subprocess.CalledProcessError as e:
        print(f"❌ Lỗi khi tạo lockfile: {e}")


def main():
    """Hàm main với menu lựa chọn"""

    print("\n" + "=" * 60)
    print("🚀 FINEXT FASTAPI DEVELOPMENT SERVER (UV)")
    print("=" * 60)
    print("1. Chạy server (mặc định)")
    print("2. Tạo môi trường ảo")
    print("3. Cài đặt dependencies")
    print("4. Tạo lockfile")
    print("5. Thoát")
    print("=" * 60)

    # Nếu chạy không có tham số, mặc định chạy server
    if len(sys.argv) == 1:
        run_fastapi_server()
        return

    # Xử lý tham số dòng lệnh
    if len(sys.argv) > 1:
        arg = sys.argv[1].lower()
        if arg in ["run", "server", "1"]:
            run_fastapi_server()
        elif arg in ["venv", "create-venv", "2"]:
            create_venv()
        elif arg in ["install", "deps", "sync", "3"]:
            install_dependencies()
        elif arg in ["lock", "lockfile", "4"]:
            generate_lockfile()
        elif arg in ["help", "-h", "--help"]:
            print("\nSử dụng:")
            print("  python main.py              # Chạy server")
            print("  python main.py run          # Chạy server")
            print("  python main.py venv         # Tạo môi trường ảo")
            print("  python main.py install      # Cài đặt dependencies (uv sync)")
            print("  python main.py lock         # Tạo lockfile")
        else:
            print(f"❌ Tham số không hợp lệ: {arg}")
            print("💡 Sử dụng 'python main.py help' để xem hướng dẫn")
    else:
        # Menu tương tác
        choice = input("\nChọn tùy chọn (1-5): ").strip()

        if choice == "1" or choice == "":
            run_fastapi_server()
        elif choice == "2":
            create_venv()
        elif choice == "3":
            install_dependencies()
        elif choice == "4":
            generate_lockfile()
        elif choice == "5":
            print("👋 Tạm biệt!")
        else:
            print("❌ Lựa chọn không hợp lệ")


if __name__ == "__main__":
    main()
