"""Best-effort erasure of key material from process memory.

Read this before relying on anything here.

WHAT THIS CANNOT DO IN CPYTHON
------------------------------
``bytes`` is immutable and there is no supported way to zero one. The popular
``ctypes.memset(id(b) + offset, 0, n)`` trick mutates an object the interpreter
believes is immutable: it can corrupt interned singletons, it is undefined
across CPython versions, and it does nothing about the copies. We do not do it.

Copies are made constantly and invisibly:

  * asyncpg materialises a ``BYTEA`` column into a fresh ``bytes``
  * httpx builds request and response buffers when talking to Vault
  * ``base64.b64decode`` and ``json.loads`` allocate
  * the ``cryptography`` bindings copy in and out of OpenSSL's own buffers
  * every slice allocates

CPython's allocator does not zero freed blocks, and the OS does not zero pages
until reallocation, so a freed heap block holding a DEK stays readable to
anything with ``ptrace``, ``/proc/<pid>/mem``, or a core dump. ``gunicorn``
forks, so a child can inherit parent pages. All of it is moot against swap
unless pages are ``mlock``ed, and moot against a compromised application
server — which is the residual risk this architecture already accepts.

WHAT THIS DOES DO
-----------------
Shortens the window during which a key is resident in a buffer we control. That
is a real, if modest, reduction in exposure to memory scraping and core dumps.
It is not a guarantee, and no comment in this codebase should imply otherwise.

We deliberately do NOT attempt to zero plaintext document bodies. At a 20 MB
cap there are four or five copies of a body in flight (upload buffer, OpenSSL,
response buffer, socket buffer) and zeroing one of them is theatre that costs
CPU. Key material only is the defensible line.

We also deliberately skip ``mlock``. ``RLIMIT_MEMLOCK`` is typically 64 KB on
Linux and containers routinely lack ``CAP_IPC_LOCK``, so a best-effort lock that
silently fails is worse than none: it invites the belief that it worked.
"""

import ctypes
from types import TracebackType

__all__ = ["EphemeralKey", "random_dek", "secure_zero"]

#: Length in bytes of every data-encryption key in the system (AES-256).
DEK_LENGTH = 32


def secure_zero(buf: bytearray | memoryview | None) -> None:
    """Overwrite a writable buffer with zeroes, in place.

    Accepts ``bytearray`` or a writable ``memoryview`` — never ``bytes``, which
    cannot be zeroed safely (see the module docstring). Passing ``None`` is a
    no-op so callers can zero optional state without branching.

    Uses ``ctypes.memset`` over ``from_buffer``, which is the supported path: it
    requires a *writable* buffer and so cannot be pointed at an immutable
    object. Falls back to slice assignment if the buffer is exported or locked
    (``BufferError``), which still overwrites, just less directly.
    """
    if buf is None:
        return
    n = len(buf)
    if n == 0:
        return
    try:
        ctypes.memset((ctypes.c_char * n).from_buffer(buf), 0, n)
    except (BufferError, TypeError):
        # Buffer is exported elsewhere (e.g. a live memoryview) or is not
        # writable. Slice assignment still clears a bytearray.
        try:
            buf[:] = b"\x00" * n
        except (TypeError, ValueError):  # pragma: no cover — read-only view
            pass


def random_dek(length: int = DEK_LENGTH) -> bytearray:
    """Generate a fresh data-encryption key in a zeroable buffer.

    Returns a ``bytearray`` rather than ``bytes`` so the caller can erase it.
    Note the honest caveat: ``os.urandom`` returns an immutable ``bytes`` that
    we copy into the bytearray, and that original copy lands in the allocator's
    free list where we cannot reach it. The window is short but non-zero.

    Uses ``os.urandom`` (via ``secrets``' underlying source) — the OS CSPRNG.
    """
    import os

    seed = os.urandom(length)
    try:
        return bytearray(seed)
    finally:
        del seed


class EphemeralKey:
    """Context manager that zeroes a key buffer on exit, including on exception.

    Every DEK use site should be written as::

        with EphemeralKey(dek) as key:
            ciphertext = encrypt(bytes(key), ...)
        # key is zeroed here, even if encrypt() raised

    The ``finally`` semantics are the whole point: an exception mid-encryption
    must not leave key material resident while a traceback propagates.
    """

    __slots__ = ("_buf",)

    def __init__(self, buf: bytearray) -> None:
        if not isinstance(buf, bytearray):
            raise TypeError(
                "EphemeralKey requires a bytearray; bytes cannot be zeroed in CPython."
            )
        self._buf = buf

    def __enter__(self) -> bytearray:
        return self._buf

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        tb: TracebackType | None,
    ) -> None:
        secure_zero(self._buf)
