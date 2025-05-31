from invoke import task, Collection
import subprocess
import json
import os

# --- Configuration ---
DEFAULT_PROFILE = "mauferna-sso"
DEFAULT_ROLE = "PersonalWebsiteDeployer"
CREDS_DIR = ".aws-creds"

# ---------- AWS TASKS ----------

@task
def sso_login(c, profile=DEFAULT_PROFILE):
    """Launch browser-based AWS SSO login."""
    c.run(f"aws sso login --profile {profile}", pty=True)

@task
def check_sso(c, profile=DEFAULT_PROFILE):
    """Validate current AWS SSO session."""
    result = c.run(f"aws sts get-caller-identity --profile {profile}", warn=True, pty=True)
    print("✅ SSO session is valid." if result.ok else "❌ Session expired. Run: invoke aws.sso-login")

@task
def assume_role(c, env="dev", profile=DEFAULT_PROFILE, role_name=DEFAULT_ROLE):
    """Assume AWS IAM role and write credentials to .aws-creds/<env>.sh"""
    result = subprocess.run(
        ["aws", "sts", "get-caller-identity", "--profile", profile],
        capture_output=True, text=True
    )
    if result.returncode != 0:
        print("❌ Cannot get account ID. Try `invoke aws.sso-login` first.")
        return
    account_id = json.loads(result.stdout)["Account"]
    role_arn = f"arn:aws:iam::{account_id}:role/{role_name}"

    result = subprocess.run([
        "aws", "sts", "assume-role",
        "--role-arn", role_arn,
        "--role-session-name", f"{env}-session",
        "--profile", profile
    ], capture_output=True, text=True)
    if result.returncode != 0:
        print("❌ Failed to assume role:\n", result.stderr)
        return

    creds = json.loads(result.stdout)["Credentials"]
    os.makedirs(CREDS_DIR, exist_ok=True)
    creds_path = f"{CREDS_DIR}/{env}.sh"
    with open(creds_path, "w") as f:
        f.write(f"export AWS_ACCESS_KEY_ID={creds['AccessKeyId']}\n")
        f.write(f"export AWS_SECRET_ACCESS_KEY={creds['SecretAccessKey']}\n")
        f.write(f"export AWS_SESSION_TOKEN={creds['SessionToken']}\n")
        f.write(f"export CDK_ENV={env}\n")

    print(f"✅ Credentials written to {creds_path}")
    print(f"🔒 Session expires at: {creds['Expiration']}")
    print(f"💡 Run: ENV={env} direnv reload")

@task
def renew_creds(c, env="dev"):
    """Reassume role and reload env via direnv."""
    c.run(f"invoke aws.assume-role --env {env}", pty=True)
    c.run("direnv reload", pty=True)

@task
def login(c, env="dev", profile=DEFAULT_PROFILE, role_name=DEFAULT_ROLE):
    """Complete login: SSO + Assume Role + direnv reload"""
    c.run(f"invoke aws.sso-login --profile {profile}", pty=True)
    c.run(f"invoke aws.assume-role --env {env} --profile {profile} --role-name {role_name}", pty=True)
    c.run("direnv reload", pty=True)

@task
def whoami(c):
    """Print current AWS identity"""
    c.run("aws sts get-caller-identity", pty=True)

aws_ns = Collection("aws")
aws_ns.add_task(sso_login, "sso-login")
aws_ns.add_task(check_sso, "check-sso")
aws_ns.add_task(assume_role, "assume-role")
aws_ns.add_task(renew_creds, "renew-creds")
aws_ns.add_task(login)
aws_ns.add_task(whoami)

# ---------- CDK TASKS ----------

@task
def bootstrap_cdk(c, profile=DEFAULT_PROFILE):
    """Run CDK bootstrap"""
    with c.cd("infra"):
        c.run(f"AWS_PROFILE={profile} npx cdk bootstrap", pty=True)

@task
def deploy_cdk(c, stack=None, profile=DEFAULT_PROFILE):
    """Deploy CDK stack(s)"""
    with c.cd("infra"):
        cmd = f"npx cdk deploy {stack} --require-approval never" if stack else "npx cdk deploy --require-approval never"
        c.run(f"AWS_PROFILE={profile} {cmd}", pty=True)

@task
def destroy_cdk(c, stack=None, profile=DEFAULT_PROFILE):
    """Destroy CDK stack(s)"""
    with c.cd("infra"):
        cmd = f"npx cdk destroy {stack} --force" if stack else "npx cdk destroy --force"
        c.run(f"AWS_PROFILE={profile} {cmd}", pty=True)

cdk_ns = Collection("cdk")
cdk_ns.add_task(bootstrap_cdk, "bootstrap")
cdk_ns.add_task(deploy_cdk, "deploy")
cdk_ns.add_task(destroy_cdk, "destroy")

# ---------- Root Collection ----------

ns = Collection()
ns.add_collection(aws_ns)
ns.add_collection(cdk_ns)

@task
def help(c):
    print("""
🛠️  Available Invoke Namespaces & Tasks:

AWS Credential & Session Helpers
--------------------------------
  invoke aws.sso-login         Launch AWS SSO login flow
  invoke aws.check-sso         Check current AWS SSO session
  invoke aws.assume-role       Assume IAM role and write temp creds to .aws-creds/<env>.sh
  invoke aws.renew-creds       Refresh creds and reload direnv
  invoke aws.login             Full login flow: SSO + Assume Role + direnv reload
  invoke aws.whoami            Show current AWS identity

CDK Deployment Helpers
-----------------------
  invoke cdk.bootstrap         Run CDK bootstrap from infra/
  invoke cdk.deploy            Deploy CDK stack(s)
  invoke cdk.destroy           Destroy CDK stack(s)

🧪 Common Flow:
  invoke aws.login --env dev
  invoke aws.whoami
  invoke cdk.bootstrap
  invoke cdk.deploy

🔐 Tip: AWS credentials expire after 1h. Use 'invoke aws.renew-creds' to refresh.
""")

ns.add_task(help)