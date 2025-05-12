from invoke import task
import json
import subprocess
import os

@task
def assume_role(c, env="dev", profile="mauferna-sso", role_name="PersonalWebsiteDeployer"):
    """
    Assume AWS role using AWS SSO and write temporary credentials to .aws-creds/<env>.sh for direnv.
    Usage: invoke assume-role --env dev
    """
    print(f"🔍 Getting AWS account ID using profile: {profile}")
    result = subprocess.run(
        ["aws", "sts", "get-caller-identity", "--profile", profile],
        capture_output=True, text=True
    )

    if result.returncode != 0:
        print("❌ Failed to get AWS account ID")
        print(result.stderr)
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
    os.makedirs(".aws-creds", exist_ok=True)
    creds_path = f".aws-creds/{env}.sh"

    with open(creds_path, "w") as f:
        f.write(f"export AWS_ACCESS_KEY_ID={creds['AccessKeyId']}\n")
        f.write(f"export AWS_SECRET_ACCESS_KEY={creds['SecretAccessKey']}\n")
        f.write(f"export AWS_SESSION_TOKEN={creds['SessionToken']}\n")

    print(f"\n✅ Wrote temporary credentials to {creds_path}")
    print(f"💡 Next: 'ENV={env} direnv reload'")

@task
def whoami(c):
    """
    Show current AWS identity (for debugging)
    """
    result = c.run("aws sts get-caller-identity", warn=True, pty=True)
    
@task
def bootstrap_cdk(c):
    """
    Bootstrap AWS CDK from the infra/ directory using current env vars.
    """
    print("🚀 Bootstrapping AWS CDK environment...")
    with c.cd("infra"):
        result = c.run("npx cdk bootstrap", warn=True, pty=True)

    if result.ok:
        print("✅ CDK bootstrap completed successfully.")
    else:
        print("❌ CDK bootstrap failed. Check AWS credentials or environment.")