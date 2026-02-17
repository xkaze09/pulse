"""Compatibility patch for pydantic v1 on Python 3.14+.

ChromaDB internally uses pydantic v1's BaseSettings, which has a type inference
bug on Python 3.14+. This module patches pydantic v1's ModelField to gracefully
handle the 'unable to infer type' error by falling back to Any.

This module MUST be imported before chromadb or langchain_chroma.
"""

import sys
import warnings


def apply_pydantic_v1_patch():
    """Patch pydantic v1 to work on Python 3.14+."""
    if sys.version_info < (3, 14):
        return

    try:
        # Suppress the pydantic v1 warning since we're patching it
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", UserWarning)
            import pydantic.v1.fields as pv1_fields
            import pydantic.v1.errors as pv1_errors

        _original_set_default_and_type = pv1_fields.ModelField._set_default_and_type

        def _patched_set_default_and_type(self):
            try:
                _original_set_default_and_type(self)
            except pv1_errors.ConfigError as e:
                if "unable to infer type" in str(e):
                    # Fall back to Any type when inference fails on Python 3.14+
                    from typing import Any
                    self.outer_type_ = Any
                    self.type_ = Any
                    if self.default is not None:
                        self.required = False
                else:
                    raise

        pv1_fields.ModelField._set_default_and_type = _patched_set_default_and_type

    except ImportError:
        pass  # pydantic v1 not installed, nothing to patch


# Apply patch on import
apply_pydantic_v1_patch()
