"""Test hardening cho sinh mã OTP: phải dùng CSPRNG (secrets), không phải random."""

import string

import app.utils.otp_utils as otp_utils
from app.core.config import OTP_LENGTH


def test_generate_otp_code_length_and_digits() -> None:
    code = otp_utils.generate_otp_code()
    assert isinstance(code, str)
    assert len(code) == OTP_LENGTH
    assert code.isdigit()
    assert all(c in string.digits for c in code)


def test_generate_otp_code_uses_secrets_not_random(monkeypatch) -> None:
    # Chứng minh mỗi ký tự được sinh bằng secrets.choice (CSPRNG), không phải
    # random.choices (Mersenne Twister - đoán được nếu biết state).
    calls = {"n": 0}
    real_choice = otp_utils.secrets.choice

    def spy_choice(seq):
        calls["n"] += 1
        return real_choice(seq)

    monkeypatch.setattr(otp_utils.secrets, "choice", spy_choice)
    code = otp_utils.generate_otp_code()

    assert calls["n"] == OTP_LENGTH  # mỗi ký tự = 1 lần gọi secrets.choice
    assert len(code) == OTP_LENGTH
    assert code.isdigit()


def test_otp_utils_does_not_depend_on_random_module() -> None:
    # Module không được import random (RNG không mật mã) nữa.
    assert not hasattr(otp_utils, "random")


def test_generated_otps_have_variety() -> None:
    # Không phải test tính mật mã (không thể), chỉ chốt không bị kẹt hằng số.
    codes = {otp_utils.generate_otp_code() for _ in range(50)}
    assert len(codes) > 1
