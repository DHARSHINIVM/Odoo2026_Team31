import json
import sys

with open(r'C:\Users\vmdha\.gemini\antigravity\brain\9c8850e1-5a0c-4529-b24a-1ff8e351e282\.system_generated\logs\transcript.jsonl', 'r', encoding='utf-8') as f:
    for line in f:
        data = json.loads(line)
        idx = data.get('step_index', 0)
        if 2931 <= idx <= 2942:
            sys.stdout.buffer.write(f"\n=== STEP {idx} [{data.get('source')}] [{data.get('type')}] ===\n".encode('utf-8'))
            c = data.get('content', '')
            if c:
                sys.stdout.buffer.write((c + '\n').encode('utf-8'))
            th = data.get('thinking', '')
            if th:
                sys.stdout.buffer.write(("Thinking: " + th + '\n').encode('utf-8'))
