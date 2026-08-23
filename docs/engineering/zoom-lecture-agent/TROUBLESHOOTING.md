# Troubleshooting

## 2026-08-23 - Child script stdout crashes on Korean Windows

- Symptom: `ingest.py` completed work but crashed while printing a line containing an em dash, with `UnicodeEncodeError: 'cp949' codec can't encode character`.
- Cause: child Python processes inherited the Windows console code page instead of UTF-8.
- Response: `agent.py` now runs child scripts with `PYTHONIOENCODING=utf-8` and `PYTHONUTF8=1`, and reconfigures its own stdout/stderr to UTF-8 with replacement.
- Prevention: keep all future subprocess calls inside `run_step()` so the UTF-8 environment is applied consistently.
