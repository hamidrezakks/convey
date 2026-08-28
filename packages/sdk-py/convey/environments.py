"""
convey.environments
Environment preset definitions and base URL resolution helpers.
"""

from __future__ import annotations

from enum import Enum
import os
from typing import Optional, Union

from convey.errors import ConveyConfigurationError


class ConveyEnvironment(str, Enum):
    PRODUCTION = "https://api.convey.dev"
    US = "https://us.api.convey.dev"
    EU = "https://eu.api.convey.dev"
    STAGING = "https://staging.api.convey.dev"
    LOCAL = "http://localhost:3000"
    SANDBOX = "https://sandbox.api.convey.dev"


def normalize_base_url(url: str) -> str:
    """Normalize and validate base URL string."""
    if not url or not isinstance(url, str) or not url.strip():
        raise ConveyConfigurationError("Base URL cannot be empty.")

    trimmed = url.strip().rstrip("/")
    if not (trimmed.startswith("http://") or trimmed.startswith("https://")):
        raise ConveyConfigurationError(f"Invalid base URL '{url}'. Must start with http:// or https://.")

    return trimmed


def resolve_environment_url(env: Union[ConveyEnvironment, str]) -> str:
    """Resolve environment preset into canonical base URL."""
    val = env.value if isinstance(env, ConveyEnvironment) else str(env)
    normalized = val.strip().upper()

    preset_map = {
        "PRODUCTION": ConveyEnvironment.PRODUCTION.value,
        "PROD": ConveyEnvironment.PRODUCTION.value,
        "US": ConveyEnvironment.US.value,
        "US_EAST": ConveyEnvironment.US.value,
        "US_WEST": ConveyEnvironment.US.value,
        "EU": ConveyEnvironment.EU.value,
        "EU_CENTRAL": ConveyEnvironment.EU.value,
        "EU_WEST": ConveyEnvironment.EU.value,
        "STAGING": ConveyEnvironment.STAGING.value,
        "STAGE": ConveyEnvironment.STAGING.value,
        "LOCAL": ConveyEnvironment.LOCAL.value,
        "DEV": ConveyEnvironment.LOCAL.value,
        "DEVELOPMENT": ConveyEnvironment.LOCAL.value,
        "SANDBOX": ConveyEnvironment.SANDBOX.value,
        "TEST": ConveyEnvironment.SANDBOX.value,
    }

    if normalized in preset_map:
        return preset_map[normalized]

    if val.startswith("http://") or val.startswith("https://"):
        return normalize_base_url(val)

    raise ConveyConfigurationError(f"Unknown Convey environment preset '{env}'.")


def resolve_base_url(
    base_url: Optional[str] = None,
    environment: Optional[Union[ConveyEnvironment, str]] = None,
) -> str:
    """
    Resolve the effective base URL with strict fail-fast enforcement.
    Mandatory: Throws ConveyConfigurationError if no base URL can be resolved.
    """
    if base_url and isinstance(base_url, str) and base_url.strip():
        return normalize_base_url(base_url)

    if environment:
        return resolve_environment_url(environment)

    env_var = os.getenv("CONVEY_BASE_URL")
    if env_var and env_var.strip():
        return normalize_base_url(env_var)

    raise ConveyConfigurationError(
        "Convey client requires a valid base URL. Please pass 'base_url', select an 'environment' preset, or set the 'CONVEY_BASE_URL' environment variable."
    )
