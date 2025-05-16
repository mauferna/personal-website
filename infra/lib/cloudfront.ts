import {
  Distribution,
  ViewerProtocolPolicy,
  CfnOriginAccessControl,
  CachePolicy,
  OriginRequestPolicy,
  CfnDistribution
} from 'aws-cdk-lib/aws-cloudfront';
import { S3Origin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { ICertificate } from 'aws-cdk-lib/aws-certificatemanager';
import { Construct } from 'constructs';

export function createCloudFront(
  scope: Construct,
  bucket: Bucket,
  domainName: string,
  cert: ICertificate
): Distribution {
  // Create Origin Access Control for CloudFront ↔ S3
  const oac = new CfnOriginAccessControl(scope, 'OAC', {
    originAccessControlConfig: {
      name: 'OAC-CloudFront-S3',
      description: 'Access control for S3 via CloudFront',
      signingBehavior: 'always',
      signingProtocol: 'sigv4',
      originAccessControlOriginType: 's3',
    },
  });

  const distribution = new Distribution(scope, 'SiteDistribution', {
    defaultBehavior: {
      origin: new S3Origin(bucket),
      viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      cachePolicy: CachePolicy.CACHING_OPTIMIZED,
      originRequestPolicy: OriginRequestPolicy.CORS_S3_ORIGIN,
    },
    defaultRootObject: 'index.html',
    domainNames: [domainName, `www.${domainName}`],
    certificate: cert,
    comment: `CDN for ${domainName}`,
  });

  // Patch CFN to use OAC instead of OAI (yes, this is needed today)
  const cfnDist = distribution.node.defaultChild as unknown as CfnDistribution;
  cfnDist.addPropertyOverride(
    'DistributionConfig.Origins.0.OriginAccessControlId',
    oac.attrId
  );
  cfnDist.addPropertyOverride('DistributionConfig.Origins.0.S3OriginConfig.OriginAccessIdentity', '');

  return distribution;
}