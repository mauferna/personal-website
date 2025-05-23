import {
  Distribution,
  ViewerProtocolPolicy,
  CfnOriginAccessControl,
  CachePolicy,
  OriginRequestPolicy,
  OriginRequestHeaderBehavior,
  OriginRequestCookieBehavior,
  OriginRequestQueryStringBehavior,
  CfnDistribution,
  BehaviorOptions,
  OriginProtocolPolicy
} from 'aws-cdk-lib/aws-cloudfront';
import { S3Origin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { HttpOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { ICertificate } from 'aws-cdk-lib/aws-certificatemanager';
import { Construct } from 'constructs';

export function createCloudFront(
  scope: Construct,
  bucket: Bucket,
  domainName: string,
  cert: ICertificate,
  appRunnerUrl: string
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

  // --- Origins ---
  const s3Origin = new S3Origin(bucket); // ✅

  const appRunnerOrigin = new HttpOrigin(appRunnerUrl, {
    protocolPolicy: OriginProtocolPolicy.HTTPS_ONLY,
  });

  const customOriginPolicy = new OriginRequestPolicy(scope, 'AppRunnerOriginPolicy', {
    originRequestPolicyName: 'AppRunner-With-Host-Headers',
    comment: 'Forward Host, all cookies and query strings to App Runner',
    headerBehavior: OriginRequestHeaderBehavior.allowList('Host'),
    cookieBehavior: OriginRequestCookieBehavior.all(),
    queryStringBehavior: OriginRequestQueryStringBehavior.all(),
  });

  // --- Distribution ---
  const distribution = new Distribution(scope, 'SiteDistribution', {
    defaultBehavior: {
      origin: appRunnerOrigin,
      viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      cachePolicy: CachePolicy.CACHING_DISABLED,
      originRequestPolicy: customOriginPolicy
    },
    additionalBehaviors: {
      '/images/*': s3Behavior(s3Origin),
      '/static/*': s3Behavior(s3Origin),
    },
    defaultRootObject: '',
    domainNames: [domainName, `www.${domainName}`],
    certificate: cert,
    comment: `CDN for ${domainName} (Dev App + Static)`,
  });

  const cfnDist = distribution.node.defaultChild as unknown as CfnDistribution;
  cfnDist.addPropertyOverride('DistributionConfig.Origins.1.OriginAccessControlId', oac.attrId);
  cfnDist.addPropertyOverride('DistributionConfig.Origins.1.S3OriginConfig.OriginAccessIdentity', '');

  return distribution;
}

function s3Behavior(origin: S3Origin): BehaviorOptions {
  return {
    origin,
    viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
    cachePolicy: CachePolicy.CACHING_OPTIMIZED,
    originRequestPolicy: OriginRequestPolicy.CORS_S3_ORIGIN,
  };
}