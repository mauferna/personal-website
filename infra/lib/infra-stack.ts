import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { HostedZone } from 'aws-cdk-lib/aws-route53';
import { createCloudFront } from './cloudfront';
import { createSiteBucket } from './site-bucket';
import { createCertificate } from './certificate';
import { createDnsRecord } from './dns-record';
import { AppRunnerService } from './apprunner';

export class InfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const envName = this.node.tryGetContext('envName') || 'dev';
    const envs = this.node.tryGetContext('envs');
    const config = envs[envName];

    const domainName = config.domainName;
    const bucketName = config.bucketName;
    const zoneName = config.zoneName;
    const recordNames: string[] = config.recordNames;

    const zone = HostedZone.fromLookup(this, 'Zone', { domainName: zoneName });
    const cert = createCertificate(this, zone, domainName);
    const bucket = createSiteBucket(this, bucketName);

    // Compute linkedDomains from recordNames and zoneName
    // const linkedDomains = recordNames.map((subdomain: string) =>
    //   subdomain.includes('.') ? subdomain : `${subdomain}.${zoneName}`
    // );

    const appRunner = new AppRunnerService(this, 'AppRunnerService', { envName });
    const appRunnerUrl = appRunner.serviceUrl;

    const distribution = createCloudFront(this, bucket, domainName, cert, appRunnerUrl);

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

    recordNames.forEach((name) => {
      createDnsRecord(this, zone, name, distribution);
    });

    new cdk.CfnOutput(this, 'BucketName', { value: bucket.bucketName });
    new cdk.CfnOutput(this, 'CloudFrontURL', { value: `https://${distribution.domainName}` });
    new cdk.CfnOutput(this, 'DomainURL', { value: `https://${domainName}` });
    new cdk.CfnOutput(this, 'AppRunnerURL', { value: appRunnerUrl });
  }
}