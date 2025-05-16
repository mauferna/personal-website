import { ARecord, RecordTarget, IHostedZone } from 'aws-cdk-lib/aws-route53';
import { CloudFrontTarget } from 'aws-cdk-lib/aws-route53-targets';
import { Distribution } from 'aws-cdk-lib/aws-cloudfront';
import { Construct } from 'constructs';

export function createDnsRecord(
  scope: Construct,
  zone: IHostedZone,
  recordName: string,
  distribution: Distribution
) {
  const safeId = `DnsRecord-${recordName.replace(/\./g, '-')}`;
  new ARecord(scope, safeId, {
    zone,
    recordName,
    target: RecordTarget.fromAlias(new CloudFrontTarget(distribution)),
  });
}