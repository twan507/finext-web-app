# finext-fastapi/app/core/scheduler.py
import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from motor.motor_asyncio import AsyncIOMotorDatabase # Cần thiết

from app.core.database import get_database
# IMPORT CÁC HÀM TASK TỪ CRUD
from app.crud.subscriptions import run_deactivate_expired_subscriptions_task, send_expiry_reminders_task
from app.crud.promotions import run_deactivate_expired_promotions_task

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler(timezone="Asia/Ho_Chi_Minh")

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
        
    except Exception as e:
        logger.error(f"Error adding jobs to scheduler: {e}", exc_info=True)

async def start_scheduler():
    if not scheduler.running:
        add_jobs_to_scheduler()
        scheduler.start()
    else:
        logger.info("Scheduler is already running.")

async def shutdown_scheduler():
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("Scheduler shut down successfully.")
    else:
        logger.info("Scheduler was not running, no need to shut down.")