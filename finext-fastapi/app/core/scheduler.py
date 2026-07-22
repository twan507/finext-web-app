# finext-fastapi/app/core/scheduler.py
import logging
import os
import sys
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from motor.motor_asyncio import AsyncIOMotorDatabase # Cần thiết

from app.core.database import get_database
from app.agent.suggestions import generate_and_store
# IMPORT CÁC HÀM TASK TỪ CRUD
from app.crud.subscriptions import run_deactivate_expired_subscriptions_task, send_expiry_reminders_task
from app.crud.promotions import run_deactivate_expired_promotions_task

# fcntl chỉ có trên Unix (Linux/Mac). Trên Windows (dev) skip lock — dev
# thường 1 worker nên không cần đồng bộ đa worker.
_IS_WINDOWS = sys.platform == "win32"
if not _IS_WINDOWS:
    import fcntl  # type: ignore[import-not-found]

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler(timezone="Asia/Ho_Chi_Minh")

# File lock để đảm bảo chỉ 1 worker chạy scheduler (uvicorn --workers > 1).
# Worker đầu tiên acquire được lock sẽ là "leader" → chạy job.
# Khi worker leader die, OS tự release lock → worker khác có thể take over.
_SCHEDULER_LOCK_PATH = "/tmp/finext_scheduler.lock"
_scheduler_lock_fd: int | None = None


def _try_acquire_scheduler_lock() -> bool:
    """Thử acquire exclusive file lock. Trả True nếu thành công (worker này là leader).

    Trên Windows: luôn trả True (skip lock) — dev chạy 1 worker nên không có
    race condition giữa các worker.
    """
    if _IS_WINDOWS:
        return True
    global _scheduler_lock_fd
    try:
        fd = os.open(_SCHEDULER_LOCK_PATH, os.O_CREAT | os.O_WRONLY, 0o644)
        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        _scheduler_lock_fd = fd
        return True
    except (OSError, BlockingIOError):
        return False

async def run_daily_maintenance_tasks():
    logger.info("Starting daily maintenance tasks (00:00)...")
    db_user: AsyncIOMotorDatabase = get_database("user_db") # Lấy instance DB một lần
    
    try:
        logger.info("Running: Deactivate expired subscriptions...")
        await run_deactivate_expired_subscriptions_task(db_user) # Gọi hàm task
    except Exception as e:
        logger.error(f"Error during 'run_deactivate_expired_subscriptions_task': {e}", exc_info=True)

    try:
        logger.info("Running: Deactivate expired promotions...")
        await run_deactivate_expired_promotions_task(db_user) # Gọi hàm task
    except Exception as e:
        logger.error(f"Error during 'run_deactivate_expired_promotions_task': {e}", exc_info=True)

    try:
        logger.info("Running: Send subscription expiry reminders...")
        await send_expiry_reminders_task(db_user, days_before_expiry=7)
    except Exception as e:
        logger.error(f"Error during 'send_expiry_reminders_task': {e}", exc_info=True)
        
    logger.info("Daily maintenance tasks finished.")

async def run_refresh_chat_suggestions():
    """Làm mới câu hỏi gợi ý màn hình chat (30 phút/lần trong giờ giao dịch)."""
    db_user: AsyncIOMotorDatabase = get_database("user_db")
    await generate_and_store(db_user)  # never-raise, tự log

def add_jobs_to_scheduler():
    try:
        scheduler.add_job(
            run_daily_maintenance_tasks,
            trigger=CronTrigger(hour="0", minute="0", second="0"),
            id="daily_maintenance_tasks_job",
            name="Daily system maintenance",
            replace_existing=True,
            misfire_grace_time=600 # 10 phút
        )
        scheduler.add_job(
            run_refresh_chat_suggestions,
            # Giờ giao dịch VN, scheduler đã set timezone="Asia/Ho_Chi_Minh".
            trigger=CronTrigger(
                day_of_week="mon-fri", hour="8-15", minute="0,30", timezone=scheduler.timezone
            ),
            id="refresh_chat_suggestions_job",
            name="Refresh chat suggested questions",
            replace_existing=True,
            misfire_grace_time=300,  # lỡ nhịp quá 5 phút thì bỏ, chờ nhịp sau
        )
        
    except Exception as e:
        logger.error(f"Error adding jobs to scheduler: {e}", exc_info=True)

async def start_scheduler():
    if scheduler.running:
        logger.info("Scheduler is already running.")
        return

    # Multi-worker safe: chỉ worker acquire được lock mới chạy scheduler.
    # Các worker khác skip → không gửi mail/cron duplicate.
    if not _try_acquire_scheduler_lock():
        logger.info(f"Scheduler skipped on PID {os.getpid()} — another worker is the leader.")
        return

    logger.info(f"Scheduler starting on PID {os.getpid()} (leader).")
    add_jobs_to_scheduler()
    scheduler.start()


async def shutdown_scheduler():
    global _scheduler_lock_fd
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("Scheduler shut down successfully.")
    else:
        logger.info("Scheduler was not running, no need to shut down.")
    # Release lock nếu worker này là leader (Unix only)
    if not _IS_WINDOWS and _scheduler_lock_fd is not None:
        try:
            fcntl.flock(_scheduler_lock_fd, fcntl.LOCK_UN)
            os.close(_scheduler_lock_fd)
        except OSError:
            pass
        _scheduler_lock_fd = None
