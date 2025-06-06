#!/usr/bin/env python3
"""
GitHub Backlog Synchronization Script
Syncs GitHub issues with the optimized v0.1 backlog (15 issues)
"""
import subprocess
import json
import time

def run_gh_command(cmd):
    """Run a GitHub CLI command and return the result."""
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        return result.stdout.strip()
    except subprocess.CalledProcessError as e:
        print(f"❌ Command failed: {' '.join(cmd)}")
        print(f"   Error: {e.stderr}")
        return None

def get_all_issues():
    """Get all open issues from GitHub."""
    cmd = ["gh", "issue", "list", "--state", "open", "--json", "number,title,labels"]
    result = run_gh_command(cmd)
    if result:
        return json.loads(result)
    return []

def close_issue_with_label(issue_number, reason="post-v0.1"):
    """Close an issue and add a label."""
    print(f"🔒 Closing issue #{issue_number} (marked as {reason})")
    
    # Add label first
    cmd = ["gh", "issue", "edit", str(issue_number), "--add-label", reason]
    run_gh_command(cmd)
    
    # Then close with comment
    comment = f"Closing this issue as it's been deferred to {reason}. The v0.1 scope has been optimized to focus on demo-ready functionality."
    cmd = ["gh", "issue", "close", str(issue_number), "--comment", comment]
    run_gh_command(cmd)

def create_issue(title, body, labels):
    """Create a new GitHub issue."""
    cmd = [
        "gh", "issue", "create",
        "--title", title,
        "--body", body,
        "--label", ",".join(labels)
    ]
    
    result = run_gh_command(cmd)
    if result:
        print(f"✅ Created: {title}")
        return True
    return False

def load_optimized_backlog():
    """Load the optimized backlog from JSON."""
    with open('intentive_complete_backlog.json', 'r') as f:
        return json.load(f)

def main():
    print("🔄 Syncing GitHub repository with optimized v0.1 backlog...")
    
    # Load optimized backlog
    backlog = load_optimized_backlog()
    
    # Extract all v0.1 issue titles from optimized backlog
    v01_titles = set()
    for epic in backlog['epics'].values():
        for issue in epic['issues']:
            v01_titles.add(issue['title'])
    
    print(f"📋 Target v0.1 scope: {len(v01_titles)} issues")
    
    # Get current GitHub issues
    current_issues = get_all_issues()
    print(f"📋 Current GitHub issues: {len(current_issues)} open issues")
    
    # Find issues to close (not in v0.1 scope)
    issues_to_close = []
    existing_v01_issues = set()
    
    for issue in current_issues:
        title = issue['title']
        if title in v01_titles:
            existing_v01_issues.add(title)
        else:
            issues_to_close.append(issue)
    
    print(f"🔒 Issues to close/defer: {len(issues_to_close)}")
    print(f"✅ v0.1 issues already exist: {len(existing_v01_issues)}")
    
    # Close non-v0.1 issues
    if issues_to_close:
        print("\n🔒 Closing non-v0.1 issues...")
        for issue in issues_to_close:
            close_issue_with_label(issue['number'])
            time.sleep(0.5)  # Rate limiting
    
    # Create missing v0.1 issues
    missing_issues = v01_titles - existing_v01_issues
    if missing_issues:
        print(f"\n✨ Creating {len(missing_issues)} missing v0.1 issues...")
        
        for epic in backlog['epics'].values():
            for issue in epic['issues']:
                if issue['title'] in missing_issues:
                    create_issue(issue['title'], issue['body'], issue['labels'])
                    time.sleep(1)  # Rate limiting
    
    print(f"\n🎉 GitHub sync complete!")
    print(f"   • Closed/deferred: {len(issues_to_close)} issues")
    print(f"   • Created: {len(missing_issues)} new v0.1 issues")
    print(f"   • Total v0.1 issues: {len(v01_titles)}")
    print("\n💡 Next steps:")
    print("   • Review closed issues at: gh issue list --state=closed")
    print("   • Check v0.1 issues at: gh issue list --label=v0.1")

if __name__ == "__main__":
    main() 