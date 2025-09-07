import subprocess
import sys
import os
from pathlib import Path


def run_fastapi_server():
    """Chạy FastAPI server với môi trường development"""

    # Đường dẫn đến thư mục finext-fastapi
    fastapi_dir = Path(__file__).parent

    # Kiểm tra xem thư mục có tồn tại không
    if not fastapi_dir.exists():
        print(f"❌ Không tìm thấy thư mục: {fastapi_dir}")
        return

    # Đường dẫn đến môi trường ảo
    venv_path = fastapi_dir / "venv"
    python_exe = venv_path / "Scripts" / "python.exe"

    # Kiểm tra môi trường ảo
    if not python_exe.exists():
        print(f"❌ Không tìm thấy môi trường ảo tại: {venv_path}")
        print("💡 Hãy tạo môi trường ảo bằng lệnh: python -m venv finext-fastapi/venv")
        return

    # Kiểm tra file .env.development
    env_file = fastapi_dir / ".env.development"
    if not env_file.exists():
        print(f"❌ Không tìm thấy file môi trường: {env_file}")
        print("💡 Hãy tạo file .env.development trong thư mục finext-fastapi")
        return

    print("🚀 Đang khởi động Finext FastAPI server...")
    print(f"📁 Thư mục làm việc: {fastapi_dir}")
    print(f"🐍 Python executable: {python_exe}")
    print(f"⚙️  Environment file: {env_file}")

    try:
        # Chuyển đến thư mục finext-fastapi
        os.chdir(fastapi_dir)

        # Chạy uvicorn với môi trường ảo
        cmd = [
            str(python_exe),
            "-m",
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
    """Cài đặt dependencies cho dự án"""

    fastapi_dir = Path(__file__).parent / "finext-fastapi"
    venv_path = fastapi_dir / "venv"
    requirements_file = fastapi_dir / "requirements.txt"
    python_exe = venv_path / "Scripts" / "python.exe"
    pip_exe = venv_path / "Scripts" / "pip.exe"

    if not python_exe.exists():
        print("❌ Môi trường ảo chưa được tạo")
        return

    if not requirements_file.exists():
        print(f"❌ Không tìm thấy file: {requirements_file}")
        return

    print("📦 Đang cài đặt dependencies...")
    try:
        subprocess.run([str(pip_exe), "install", "-r", str(requirements_file)], check=True, cwd=fastapi_dir)
        print("✅ Cài đặt dependencies thành công!")
    except subprocess.CalledProcessError as e:
        print(f"❌ Lỗi khi cài đặt dependencies: {e}")


def create_venv():
    """Tạo môi trường ảo mới"""

    fastapi_dir = Path(__file__).parent / "finext-fastapi"
    venv_path = fastapi_dir / "venv"

    if venv_path.exists():
        print("ℹ️  Môi trường ảo đã tồn tại")
        return

    print("🔧 Đang tạo môi trường ảo...")
    try:
        subprocess.run([sys.executable, "-m", "venv", str(venv_path)], check=True)
        print("✅ Tạo môi trường ảo thành công!")

        # Tự động cài đặt dependencies
        install_dependencies()

    except subprocess.CalledProcessError as e:
        print(f"❌ Lỗi khi tạo môi trường ảo: {e}")


def main():
    """Hàm main với menu lựa chọn"""

    print("\n" + "=" * 60)
    print("🚀 FINEXT FASTAPI DEVELOPMENT SERVER")
    print("=" * 60)
    print("1. Chạy server (mặc định)")
    print("2. Tạo môi trường ảo")
    print("3. Cài đặt dependencies")
    print("4. Thoát")
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
        elif arg in ["install", "deps", "3"]:
            install_dependencies()
        elif arg in ["help", "-h", "--help"]:
            print("\nSử dụng:")
            print("  python main.py              # Chạy server")
            print("  python main.py run          # Chạy server")
            print("  python main.py venv         # Tạo môi trường ảo")
            print("  python main.py install      # Cài đặt dependencies")
        else:
            print(f"❌ Tham số không hợp lệ: {arg}")
            print("💡 Sử dụng 'python main.py help' để xem hướng dẫn")
    else:
        # Menu tương tác
        choice = input("\nChọn tùy chọn (1-4): ").strip()

        if choice == "1" or choice == "":
            run_fastapi_server()
        elif choice == "2":
            create_venv()
        elif choice == "3":
            install_dependencies()
        elif choice == "4":
            print("👋 Tạm biệt!")
        else:
            print("❌ Lựa chọn không hợp lệ")


if __name__ == "__main__":
    main()
