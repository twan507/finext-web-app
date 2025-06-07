# finext-fastapi/app/utils/google_auth.py
import logging
import time
from datetime import datetime, timezone
from typing import Dict, Any, Optional

import httpx
from jose import jwt, JWTError

logger = logging.getLogger(__name__)

# Cache cho Google public keys
_google_keys_cache = {"keys": None, "expires_at": 0}
CACHE_DURATION = 3600  # 1 hour cache


def _get_google_public_keys() -> Dict[str, Any]:
    """
    Lấy Google public keys với caching.
    """
    current_time = time.time()

    # Kiểm tra cache
    if _google_keys_cache["keys"] is not None and current_time < _google_keys_cache["expires_at"]:
        logger.debug("Using cached Google public keys")
        return _google_keys_cache["keys"]

    # Fetch keys mới với retry logic
    max_retries = 3
    for attempt in range(max_retries):
        try:
            logger.info(f"Fetching Google public keys (attempt {attempt + 1}/{max_retries})")
            response = httpx.get("https://www.googleapis.com/oauth2/v3/certs", timeout=10.0)
            response.raise_for_status()

            keys_data = response.json()

            # Update cache
            _google_keys_cache["keys"] = keys_data
            _google_keys_cache["expires_at"] = current_time + CACHE_DURATION

            logger.info("Successfully fetched and cached Google public keys")
            return keys_data

        except (httpx.HTTPError, httpx.TimeoutException) as e:
            logger.warning(f"Attempt {attempt + 1} failed to fetch Google keys: {e}")
            if attempt == max_retries - 1:
                raise
            time.sleep(1 * (attempt + 1))  # Exponential backoff

    raise ValueError("Failed to fetch Google public keys after all retries")


def verify_google_id_token_with_tolerance(token: str, client_id: str, tolerance_seconds: int = 30) -> Dict[str, Any]:
    """
    Verify Google ID token với clock skew tolerance.

    Args:
        token: Google ID token string
        client_id: Google OAuth client ID
        tolerance_seconds: Số giây tolerance cho clock skew (mặc định 30s)

    Returns:
        Dict chứa thông tin user từ token

    Raises:
        ValueError: Nếu token không hợp lệ
        httpx.HTTPError: Nếu không thể lấy Google public keys
        JWTError: Nếu có lỗi JWT verification
    """
    try:
        logger.debug(f"Verifying Google ID token with {tolerance_seconds}s tolerance")

        # Decode header để lấy kid (key id)
        unverified_header = jwt.get_unverified_header(token)
        kid = unverified_header.get("kid")

        if not kid:
            raise ValueError("Token header missing 'kid' field")

        logger.debug(f"Token kid: {kid}")

        # Lấy Google's public keys (with caching)
        google_keys = _get_google_public_keys()

        # Tìm key phù hợp
        key = None
        for google_key in google_keys.get("keys", []):
            if google_key.get("kid") == kid:
                key = google_key
                break

        if not key:
            raise ValueError(f"Unable to find appropriate key for kid: {kid}")

        logger.debug("Found matching public key")

        # Decode token để lấy payload mà không verify
        unverified_payload = jwt.get_unverified_claims(token)

        # Log timestamp info for debugging
        current_time = datetime.now(timezone.utc).timestamp()
        exp = unverified_payload.get("exp")
        iat = unverified_payload.get("iat")
        nbf = unverified_payload.get("nbf")

        logger.debug(f"Token timestamps - Current: {current_time}, IAT: {iat}, EXP: {exp}, NBF: {nbf}")

        # Kiểm tra thời gian với tolerance
        # Kiểm tra exp (expiration time)
        if exp:
            if current_time > (exp + tolerance_seconds):
                raise ValueError(f"Token has expired. Current: {current_time}, Exp: {exp}, Tolerance: {tolerance_seconds}")

        # Kiểm tra iat (issued at time) với tolerance
        if iat:
            if current_time < (iat - tolerance_seconds):
                raise ValueError(f"Token used too early. Current: {current_time}, IAT: {iat}, Tolerance: {tolerance_seconds}")

        # Kiểm tra nbf (not before time) với tolerance
        if nbf:
            if current_time < (nbf - tolerance_seconds):
                raise ValueError(f"Token not yet valid. Current: {current_time}, NBF: {nbf}, Tolerance: {tolerance_seconds}")

        logger.debug("Timestamp checks passed")
        # Verify signature và các claim khác (trừ thời gian và at_hash)
        verified_payload = jwt.decode(
            token,
            key,
            algorithms=["RS256"],
            audience=client_id,
            issuer=["accounts.google.com", "https://accounts.google.com"],
            options={
                "verify_aud": True,
                "verify_iss": True,
                "verify_exp": False,  # Đã check manual với tolerance
                "verify_nbf": False,  # Đã check manual với tolerance
                "verify_iat": False,  # Đã check manual với tolerance
                "verify_signature": True,
                "verify_at_hash": False,  # Skip at_hash verification since we don't have access_token
                "require_aud": True,
                "require_iss": True,
                "require_exp": True,
                "require_iat": True,
            },
        )

        user_email = verified_payload.get("email", "unknown")
        logger.info(f"Successfully verified Google ID token for user: {user_email}")
        return verified_payload

    except (JWTError, ValueError, httpx.HTTPError) as e:
        logger.error(f"Failed to verify Google ID token: {e}")
        raise
    except Exception as e:
        logger.error(f"Unexpected error verifying Google ID token: {e}", exc_info=True)
        raise ValueError(f"Unexpected error during token verification: {e}")


def get_google_user_info_from_token(token: str, client_id: str) -> Optional[Dict[str, Any]]:
    """
    Convenience function để lấy thông tin user từ Google ID token với fallback methods.

    Args:
        token: Google ID token string
        client_id: Google OAuth client ID

    Returns:
        Dict chứa thông tin user hoặc None nếu token không hợp lệ
    """
    # Thử các tolerance khác nhau
    tolerance_levels = [30, 60, 120]  # 30s, 1min, 2min

    for i, tolerance in enumerate(tolerance_levels):
        try:
            logger.info(f"Attempting Google token verification with {tolerance}s tolerance (attempt {i + 1}/{len(tolerance_levels)})")
            result = verify_google_id_token_with_tolerance(token, client_id, tolerance)

            if i > 0:  # Nếu cần fallback, log warning
                logger.warning(
                    f"Google token verification succeeded only with {tolerance}s tolerance. Consider checking system clock synchronization."
                )

            return result

        except Exception as e:
            logger.warning(f"Token verification failed with {tolerance}s tolerance: {e}")

            # Nếu đây là attempt cuối cùng, log detailed error
            if i == len(tolerance_levels) - 1:
                logger.error(f"All Google token verification attempts failed. Final error: {e}")

                # Thêm thông tin debug về thời gian hiện tại
                try:
                    current_time = datetime.now(timezone.utc)
                    logger.error(f"Current system time (UTC): {current_time.isoformat()}")
                    logger.error(f"Current timestamp: {current_time.timestamp()}")
                except Exception as time_error:
                    logger.error(f"Could not get current time for debugging: {time_error}")

    return None


def get_clock_skew_info() -> Dict[str, Any]:
    """
    Helper function để debug clock skew issues.

    Returns:
        Dict với thông tin về thời gian hệ thống
    """
    try:
        local_time = datetime.now()
        utc_time = datetime.now(timezone.utc)

        return {
            "local_time": local_time.isoformat(),
            "utc_time": utc_time.isoformat(),
            "local_timestamp": local_time.timestamp(),
            "utc_timestamp": utc_time.timestamp(),
            "timezone_offset_hours": (local_time - utc_time.replace(tzinfo=None)).total_seconds() / 3600,
        }
    except Exception as e:
        return {"error": str(e)}
