from invoke import task, Collection
import subprocess
import json
import os

# --- Configuration ---
DEFAULT_PROFILE = "mauferna-sso"
DEFAULT_ROLE = "PersonalWebsiteDeployer"
CREDS_DIR = ".aws-creds"


@task
def help(c):
    """
    Show available tasks and usage tips.
    """
    print("""
🛠️  Available invoke tasks:

  assume-role      Assume AWS IAM role and write temporary credentials to .aws-creds/<env>.sh
  renew-creds      Reassume role and reload direnv in one step
  bootstrap-cdk    Run CDK bootstrap from the infra/ directory
  deploy-cdk       Deploy CDK stack(s) using current CDK_ENV
  whoami           Print AWS identity (sts get-caller-identity)
  sso-login        Launch SSO login flow for configured profile
  check-sso        Validate current SSO token status
  help             Show this help message

💡 Common Flow:
  invoke sso-login
  invoke assume-role --env dev
  direnv reload
  invoke bootstrap-cdk
  invoke deploy-cdk

🔐 Reminder: AWS credentials expire after 1h. Use 'invoke renew-creds' to refresh.
""")


@task
def sso_login(c, profile=DEFAULT_PROFILE):
    """
    Launch browser-based AWS SSO login for a given profile.
    """
    print(f"🔐 Launching SSO login for profile: {profile}")
    c.run(f"aws sso login --profile {profile}", pty=True)


@task
def check_sso(c, profile=DEFAULT_PROFILE):
    """
    Validate whether the current SSO session is still valid.
    """
    print(f"🔎 Checking SSO session for profile: {profile}")
    result = c.run(f"aws sts get-caller-identity --profile {profile}", warn=True, pty=True)
    if result.ok:
        print("✅ SSO session is valid.")
    else:
        print("❌ SSO session appears to be expired. Run: invoke sso-login")


@task
def assume_role(c, env="dev", profile=DEFAULT_PROFILE, role_name=DEFAULT_ROLE):
    """
    Assume AWS IAM role and write credentials to .aws-creds/<env>.sh (used by direnv).
    """
    print(f"🔍 Getting AWS account ID using profile: {profile}")
    result = subprocess.run(
        ["aws", "sts", "get-caller-identity", "--profile", profile],
        capture_output=True, text=True
    )

    if result.returncode != 0:
        print("❌ Failed to get AWS account ID")
        print(result.stderr)
        print(f"⚠️ SSO session may have expired. Run: invoke sso-login --profile {profile}")
        return

    account_id = json.loads(result.stdout)["Account"]
    role_arn = f"arn:aws:iam::{account_id}:role/{role_name}"

    print(f"🔐 Assuming role: {role_arn}")
    result = subprocess.run([
        "aws", "sts", "assume-role",
        "--role-arn", role_arn,
        "--role-session-name", f"{env}-session",
        "--profile", profile
    ], capture_output=True, text=True)

    if result.returncode != 0:
        print("❌ Failed to assume role")
        print(result.stderr)
        return

    creds = json.loads(result.stdout)["Credentials"]
    os.makedirs(CREDS_DIR, exist_ok=True)
    creds_path = f"{CREDS_DIR}/{env}.sh"

    with open(creds_path, "w") as f:
        f.write(f"export AWS_ACCESS_KEY_ID={creds['AccessKeyId']}\n")
        f.write(f"export AWS_SECRET_ACCESS_KEY={creds['SecretAccessKey']}\n")
        f.write(f"export AWS_SESSION_TOKEN={creds['SessionToken']}\n")

    print(f"\n✅ Wrote temporary credentials to {creds_path}")
    print(f"💡 Now run: ENV={env} direnv reload")


@task
def renew_creds(c, env="dev"):
    """
    Reassume role and reload environment via direnv.
    """
    c.run(f"invoke assume-role --env {env}", pty=True)
    c.run("direnv reload", pty=True)
    print("✅ AWS credentials refreshed.")


@task
def whoami(c):
    """
    Print AWS identity from current session (used for debugging).
    """
    c.run("aws sts get-caller-identity", pty=True)


@task
def bootstrap_cdk(c):
    """
    Run CDK bootstrap from the infra/ directory.
    """
    print("🚀 Running CDK bootstrap...")
    with c.cd("infra"):
        c.run("npx cdk bootstrap", pty=True)
    print("✅ CDK environment bootstrapped.")


@task
def deploy_cdk(c, stack=None):
    """
    Deploy CDK stack(s) using current environment and credentials.
    Usage: invoke deploy-cdk --stack <stack-name>
    """
    print("🚀 Deploying CDK stack...")
    with c.cd("infra"):
        if stack:
            c.run(f"npx cdk deploy {stack} --require-approval never", pty=True)
        else:
            c.run("npx cdk deploy --require-approval never", pty=True)
    print("✅ CDK deploy complete.")