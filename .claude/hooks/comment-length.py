#!/usr/bin/env python3
"""Flag long comment blocks added by Write/Edit. See CLAUDE.md."""

import json
import re
import sys

MAX_LINES = 2
EXTS = ('.ts', '.tsx', '.js', '.jsx', '.css', '.py')


def content_lines(text):
    """Longest run of consecutive comment lines that carry actual prose.

    Bare `/**`, `*/` and `//` separators do not count — a three-line JSDoc
    holding one sentence is fine, a nine-line one is not.
    """
    longest = 0
    run = 0
    in_block = False

    for raw in text.splitlines():
        line = raw.strip()
        is_comment = False
        body = ''

        if in_block:
            is_comment = True
            body = line
            if '*/' in line:
                in_block = False
                body = line.split('*/')[0]
        elif line.startswith('//') or line.startswith('#'):
            is_comment = True
            body = line.lstrip('/#')
        elif line.startswith('/*'):
            is_comment = True
            if '*/' in line:
                body = line[2:].split('*/')[0]
            else:
                in_block = True
                body = line[2:]

        if not is_comment:
            longest = max(longest, run)
            run = 0
            continue

        # Strip leading block-comment asterisks and rule-off dashes.
        body = re.sub(r'^\**\s*', '', body).strip(' -=*')
        if body:
            run += 1

    return max(longest, run)


def main():
    try:
        payload = json.load(sys.stdin)
    except Exception:
        return

    tool_input = payload.get('tool_input') or {}
    path = tool_input.get('file_path', '')
    if not path.endswith(EXTS):
        return

    added = tool_input.get('new_string') or tool_input.get('content') or ''
    if not added:
        return

    found = content_lines(added)
    if found <= MAX_LINES:
        return

    note = (
        f'{path}: added a {found}-line comment block. CLAUDE.md says comments '
        f'are one or two lines, never a paragraph. Cut it to the why behind '
        f'the choice, or delete it if the code already says it. This repo\'s '
        f'existing comments are long essays — matching them is not a reason.'
    )
    json.dump(
        {
            'systemMessage': f'Long comment ({found} lines) in {path.split("/")[-1]}',
            'hookSpecificOutput': {
                'hookEventName': 'PostToolUse',
                'additionalContext': note,
            },
        },
        sys.stdout,
    )


main()
