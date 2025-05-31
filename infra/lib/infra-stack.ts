import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { HostedZone } from 'aws-cdk-lib/aws-route53';
import { getEnvConfig } from './context';
import { createCloudFront } from './cloudfront';
import { createSiteBucket } from './site-bucket';
import { createCertificate } from './certificate';
import { createDnsRecord } from './dns-record';
import { AppRunnerService } from './apprunner';

export class InfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const envName = this.node.tryGetContext('envName') || 'dev';
    const config = getEnvConfig(this);
    const { domainName, bucketName, zoneName, recordNames } = config;

    const zoneId = config.zoneId;
    const zone = HostedZone.fromHostedZoneAttributes(this, 'Zone', {
      hostedZoneId: zoneId,
      zoneName: zoneName,
    });
    const cert = createCertificate(this, zone, domainName);
    const bucket = createSiteBucket(this, bucketName);

    // Compute linkedDomains from recordNames and zoneName
    // const linkedDomains = recordNames.map((subdomain: string) =>
    //   subdomain.includes('.') ? subdomain : `${subdomain}.${zoneName}`
    // );

    const appRunner = new AppRunnerService(this, 'AppRunnerService', { envName });
    const appRunnerUrl = appRunner.serviceUrl;

    const distribution = createCloudFront(this, bucket, domainName, cert, appRunnerUrl);

    // Allow CloudFront to access the private S3 bucket
    bucket.addToResourcePolicy(
      new cdk.aws_iam.PolicyStatement({
        actions: ['s3:GetObject'],
        resources: [`${bucket.bucketArn}/*`],
        principals: [new cdk.aws_iam.ServicePrincipal('cloudfront.amazonaws.com')],
        conditions: {
          StringEquals: {
            'AWS:SourceArn': `arn:aws:cloudfront::${this.account}:distribution/${distribution.distributionId}`,
          },
        },
      })
    );

    // Create DNS records for each name in recordNames
    recordNames.forEach((name) => {
      createDnsRecord(this, zone, name, distribution);
    });

    // Tag the stack for cost and environment tracking
    cdk.Tags.of(this).add('env', envName);
    cdk.Tags.of(this).add('project', 'personal-website');

    // Test CDK config resolution
    console.log("🔧 Loaded env config:", config);

    // CDK Outputs
    new cdk.CfnOutput(this, 'BucketName', { value: bucket.bucketName });
    new cdk.CfnOutput(this, 'CloudFrontURL', { value: `https://${distribution.domainName}` });
    new cdk.CfnOutput(this, 'DomainURL', { value: `https://${domainName}` });
    new cdk.CfnOutput(this, 'AppRunnerURL', { value: appRunnerUrl });
  }
}