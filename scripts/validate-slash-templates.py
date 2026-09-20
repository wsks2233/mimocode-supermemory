import json
import os
import re
import sys

root = "templates"
errs = []
cmds = sorted(os.listdir(os.path.join(root, "commands")))
print("commands:", cmds)
expected_cmds = [
    "supermemory-index.md",
    "supermemory-init.md",
    "supermemory-login.md",
    "supermemory-logout.md",
    "supermemory-status.md",
]
if cmds != expected_cmds:
    errs.append(f"commands set mismatch: {cmds}")
for n in cmds:
    p = os.path.join(root, "commands", n)
    t = open(p, encoding="utf-8").read()
    if not t.startswith("---\n"):
        errs.append(f"{p}: missing frontmatter")
    if n in ("supermemory-login.md", "supermemory-logout.md", "supermemory-status.md"):
        if "{{PS1}}" not in t:
            errs.append(f"{p}: missing {{{{PS1}}}}")
skills = sorted(
    d
    for d in os.listdir(os.path.join(root, "skills"))
    if os.path.isdir(os.path.join(root, "skills", d))
)
print("skills:", skills)
expected_skills = [
    "mimocode-supermemory",
    "supermemory-init",
    "supermemory-login",
    "supermemory-logout",
    "supermemory-status",
]
if skills != expected_skills:
    errs.append(f"skills set mismatch: {skills}")
for s in skills:
    md = os.path.join(root, "skills", s, "SKILL.md")
    if not os.path.exists(md):
        errs.append(f"{md} missing")
        continue
    t = open(md, encoding="utf-8").read()
    m = re.search(r"^---\n(.*?)\n---", t, re.S)
    if not m:
        errs.append(f"{md}: no frontmatter")
        continue
    fm = m.group(1)
    name_m = re.search(r"name:\s*([^\n]+)", fm)
    name = name_m.group(1).strip().strip('"') if name_m else None
    if name != s:
        errs.append(f"{md}: name {name!r} != dir {s}")
    if "description:" not in fm:
        errs.append(f"{md}: no description")
    for loc in ("zh-CN.json", "en-US.json"):
        lp = os.path.join(root, "skills", s, "locales", loc)
        if not os.path.exists(lp):
            errs.append(f"{lp} missing")
            continue
        data = json.load(open(lp, encoding="utf-8"))
        if set(data) != {"displayName", "brief"}:
            errs.append(f"{lp}: keys {set(data)}")
if errs:
    print("FAIL")
    for e in errs:
        print(" -", e)
    sys.exit(1)
print("TEMPLATES_OK")
