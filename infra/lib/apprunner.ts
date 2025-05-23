import * as cdk from 'aws-cdk-lib';
import { Stack } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as apprunner from 'aws-cdk-lib/aws-apprunner';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as iam from 'aws-cdk-lib/aws-iam';

export interface AppRunnerServiceProps {
  envName: string;
  skipServiceCreation?: boolean;
  linkedDomains?: string[]; // Optional, but not used via CFN now
}

export class AppRunnerService extends Construct {
  public readonly serviceUrl: string;
  public readonly serviceArn: string;

  constructor(scope: Construct, id: string, props: AppRunnerServiceProps) {
    super(scope, id);

    const { envName } = props;

    const repository = new ecr.Repository(this, 'WebAppRepo', {
      repositoryName: `personal-website-${envName}`,
      removalPolicy:
        envName === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    const apprunnerEcrAccessRole = new iam.Role(this, 'AppRunnerEcrAccessRole', {
      assumedBy: new iam.ServicePrincipal('build.apprunner.amazonaws.com'),
      description: 'IAM role allowing App Runner to pull image from ECR',
    });

    apprunnerEcrAccessRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEC2ContainerRegistryReadOnly')
    );

    const service = new apprunner.CfnService(this, 'AppRunnerService', {
      serviceName: `personal-website-${envName}`,
      sourceConfiguration: {
        authenticationConfiguration: {
          accessRoleArn: apprunnerEcrAccessRole.roleArn,
        },
        imageRepository: {
          imageIdentifier: repository.repositoryUriForTag('latest'),
          imageRepositoryType: 'ECR',
          imageConfiguration: {
            port: '3000',
            runtimeEnvironmentVariables: [
              {
                name: 'NODE_ENV',
                value: envName === 'prod' ? 'production' : 'development',
              },
              {
                name: 'NEXT_PUBLIC_ENVIRONMENT',
                value: envName,
              },
            ],
          },
        },
        autoDeploymentsEnabled: true,
      },
    });
    this.serviceUrl = service.attrServiceUrl;
    this.serviceArn = service.attrServiceArn;


    Stack.of(this).exportValue(this.serviceUrl, {
      name: `${envName}-AppRunnerServiceUrl`,
    });
  }
}