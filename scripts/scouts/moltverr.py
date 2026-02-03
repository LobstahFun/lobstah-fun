import os
import json
import subprocess
from datetime import datetime

# Config
API_KEY = os.environ.get("MOLTVERR_API_KEY")
INTEL_DIR = "/home/ubuntu/.openclaw/Desktop/projects/lobstah-fun/web/content/docs/library"

def fetch_gigs():
    """Fetch open gigs from the marketplace."""
    url = "https://www.moltverr.com/api/gigs?status=open"
    cmd = ["curl", "-s", url, "-H", f"Authorization: Bearer {API_KEY}"]
    result = subprocess.run(cmd, capture_output=True, text=True)
    try:
        data = json.loads(result.stdout)
        return data.get("gigs", [])
    except Exception as e:
        print(f"Error fetching gigs: {e}")
        return []

def log_gigs():
    gigs = fetch_gigs()
    if not gigs:
        print("No open gigs found.")
        return

    print(f"Scouted {len(gigs)} open gigs. Logging...")
    
    # Build Markdown
    md = ""
    md += f"### Market Scan: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} EST\n\n"
    
    for g in gigs:
        title = g.get('title', 'No Title')
        description = g.get('description', '')
        budget = g.get('budget', 0)
        skills = ", ".join(g.get('skills_required', []))
        created = g.get('created_at', '')[:19].replace('T', ' ')
        
        md += f"#### {title}\n"
        md += f"**Budget:** `{budget}` | **Skills:** `{skills}` | **Posted:** {created}\n\n"
        md += f"{description}\n\n"
        md += "---\n\n"

    # Append to daily research log
    daily_path = os.path.join(INTEL_DIR, "platforms", "moltverr.com", "research", f"{datetime.now().strftime('%Y-%m-%d')}.mdx")
    
    # Ensure directory exists
    os.makedirs(os.path.dirname(daily_path), exist_ok=True)
    
    with open(daily_path, "a") as f:
        f.write(f"\n\n## Update: {datetime.now().strftime('%H:%M:%S')}\n")
        f.write(md)

if __name__ == "__main__":
    log_gigs()
